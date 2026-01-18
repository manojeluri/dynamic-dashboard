import type { DailySales, ProductTimeSeries, ProductForecast, ForecastSummary, ForecastValidation } from '../types';

/**
 * Convert DailySales[] to product-level time series for top N products
 * Fills missing dates with zero values for consistency
 */
export function prepareProductTimeSeries(
  salesData: DailySales[],
  topN: number = 10
): ProductTimeSeries[] {
  // Step 1: Aggregate by product
  const productMap = new Map<string, {
    company?: string;
    dailyData: Map<string, { quantity: number; revenue: number }>;
  }>();

  salesData.forEach(daily => {
    daily.records.forEach(record => {
      if (!productMap.has(record.ITNAME)) {
        productMap.set(record.ITNAME, {
          company: record.company,
          dailyData: new Map()
        });
      }

      const product = productMap.get(record.ITNAME)!;
      const existing = product.dailyData.get(daily.date) || { quantity: 0, revenue: 0 };

      product.dailyData.set(daily.date, {
        quantity: existing.quantity + record.QTY,
        revenue: existing.revenue + record.TAXBLEAMT
      });
    });
  });

  // Step 2: Calculate total revenue per product to get top N
  const productTotals = Array.from(productMap.entries()).map(([name, data]) => {
    const totalRevenue = Array.from(data.dailyData.values())
      .reduce((sum, day) => sum + day.revenue, 0);
    return { name, totalRevenue };
  });

  productTotals.sort((a, b) => b.totalRevenue - a.totalRevenue);
  const topProductNames = new Set(productTotals.slice(0, topN).map(p => p.name));

  // Step 3: Get all unique dates and sort
  const allDates = Array.from(new Set(salesData.map(d => d.date))).sort();

  // Step 4: Build time series for top products with filled dates
  const timeSeries: ProductTimeSeries[] = [];

  productMap.forEach((data, productName) => {
    if (!topProductNames.has(productName)) return;

    // Fill all dates (including missing ones with zero)
    const dailyData = allDates.map(date => {
      const dayData = data.dailyData.get(date) || { quantity: 0, revenue: 0 };
      return {
        date,
        quantity: dayData.quantity,
        revenue: dayData.revenue
      };
    });

    timeSeries.push({
      productName,
      company: data.company,
      dailyData
    });
  });

  return timeSeries;
}

/**
 * Identify missing dates in the time series
 */
export function findMissingDates(allDates: string[]): string[] {
  if (allDates.length < 2) return [];

  const missing: string[] = [];
  const start = new Date(allDates[0]);
  const end = new Date(allDates[allDates.length - 1]);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    if (!allDates.includes(dateStr)) {
      missing.push(dateStr);
    }
  }

  return missing;
}

/**
 * Calculate moving average with adaptive window size
 * Uses weighted average - recent data gets higher weight
 */
function calculateMovingAverage(
  values: number[],
  _targetIndex: number,
  windowSize: number = 7
): { value: number; confidence: number } {
  // Ensure we have enough data
  if (values.length === 0) {
    return { value: 0, confidence: 0 };
  }

  // Adaptive window: use smaller window if not enough data
  const actualWindow = Math.min(windowSize, values.length);

  if (actualWindow === 0) {
    return { value: 0, confidence: 0 };
  }

  // Get last N values
  const window = values.slice(-actualWindow);

  // Weighted moving average (more recent = higher weight)
  // Weights: [1, 2, 3, ..., N] normalized
  const weights = window.map((_, i) => i + 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  const weightedSum = window.reduce((sum, val, i) => sum + val * weights[i], 0);
  const weightedAvg = weightedSum / totalWeight;

  // Calculate confidence based on:
  // 1. Data availability (more days = higher confidence)
  // 2. Variance (lower variance = higher confidence)
  const dataQualityScore = Math.min(actualWindow / windowSize, 1) * 100;

  // Calculate standard deviation
  const mean = window.reduce((sum, val) => sum + val, 0) / window.length;
  const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / window.length;
  const stdDev = Math.sqrt(variance);

  // Coefficient of variation (CV) - lower is better
  const cv = mean > 0 ? stdDev / mean : 1;
  const variabilityScore = Math.max(0, (1 - cv) * 100);

  // Combined confidence (average of data quality and variability)
  const confidence = Math.min((dataQualityScore + variabilityScore) / 2, 100);

  return {
    value: weightedAvg,
    confidence: Math.round(confidence)
  };
}

/**
 * Multi-window ensemble forecast
 * Combines 7-day, 14-day, and 30-day moving averages
 */
function ensembleMovingAverage(values: number[]): { value: number; confidence: number } {
  const windows = [7, 14, 30];
  const results = windows.map(window => calculateMovingAverage(values, values.length, window));

  // Weight by confidence
  const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);

  if (totalConfidence === 0) {
    return { value: 0, confidence: 0 };
  }

  const weightedValue = results.reduce((sum, r) => sum + r.value * r.confidence, 0) / totalConfidence;
  const avgConfidence = totalConfidence / results.length;

  return {
    value: weightedValue,
    confidence: Math.round(avgConfidence)
  };
}

/**
 * Generate forecasts for a single product
 */
export function forecastProduct(timeSeries: ProductTimeSeries): ProductForecast {
  const { dailyData, productName, company } = timeSeries;

  // Extract revenue and quantity arrays
  const revenues = dailyData.map(d => d.revenue);
  const quantities = dailyData.map(d => d.quantity);

  // Calculate historical metrics
  const totalRevenue = revenues.reduce((sum, r) => sum + r, 0);
  const totalQuantity = quantities.reduce((sum, q) => sum + q, 0);
  const daysOfData = dailyData.length;

  const avgDailyRevenue = totalRevenue / daysOfData;
  const avgDailyQuantity = totalQuantity / daysOfData;

  // Calculate standard deviation
  const revenueMean = avgDailyRevenue;
  const revenueVariance = revenues.reduce((sum, r) => sum + Math.pow(r - revenueMean, 2), 0) / daysOfData;
  const revenueStdDev = Math.sqrt(revenueVariance);

  const quantityMean = avgDailyQuantity;
  const quantityVariance = quantities.reduce((sum, q) => sum + Math.pow(q - quantityMean, 2), 0) / daysOfData;
  const quantityStdDev = Math.sqrt(quantityVariance);

  // Get last date
  const lastDate = dailyData[dailyData.length - 1].date;

  // Calculate target dates
  const lastDateObj = new Date(lastDate);
  const oneDayTargetObj = new Date(lastDateObj);
  oneDayTargetObj.setDate(lastDateObj.getDate() + 1);
  const oneDayTarget = oneDayTargetObj.toISOString().split('T')[0];

  const sevenDayTargetObj = new Date(lastDateObj);
  sevenDayTargetObj.setDate(lastDateObj.getDate() + 7);
  const sevenDayTarget = sevenDayTargetObj.toISOString().split('T')[0];

  // 1-day forecast (use 7-day window for next day prediction)
  const oneDayRevenueForecast = calculateMovingAverage(revenues, revenues.length, 7);
  const oneDayQuantityForecast = calculateMovingAverage(quantities, quantities.length, 7);

  // 7-day forecast (use ensemble for better accuracy)
  const sevenDayRevenueForecast = ensembleMovingAverage(revenues);
  const sevenDayQuantityForecast = ensembleMovingAverage(quantities);

  // For 7-day total, multiply daily average by 7
  const sevenDayRevenueTotal = sevenDayRevenueForecast.value * 7;
  const sevenDayQuantityTotal = sevenDayQuantityForecast.value * 7;

  return {
    productName,
    company,
    oneDayForecast: {
      revenue: Math.round(oneDayRevenueForecast.value * 100) / 100,
      quantity: Math.round(oneDayQuantityForecast.value * 100) / 100,
      confidence: Math.min(oneDayRevenueForecast.confidence, oneDayQuantityForecast.confidence),
      targetDate: oneDayTarget
    },
    sevenDayForecast: {
      revenue: Math.round(sevenDayRevenueTotal * 100) / 100,
      quantity: Math.round(sevenDayQuantityTotal * 100) / 100,
      confidence: Math.min(sevenDayRevenueForecast.confidence, sevenDayQuantityForecast.confidence),
      targetDate: sevenDayTarget
    },
    historicalMetrics: {
      avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
      avgDailyQuantity: Math.round(avgDailyQuantity * 100) / 100,
      standardDeviation: {
        revenue: Math.round(revenueStdDev * 100) / 100,
        quantity: Math.round(quantityStdDev * 100) / 100
      },
      daysOfData
    }
  };
}

/**
 * Generate complete forecast summary for top N products
 */
export function generateForecastSummary(salesData: DailySales[], topN: number = 10): ForecastSummary {
  // Prepare time series data
  const timeSeries = prepareProductTimeSeries(salesData, topN);

  // Generate forecasts for each product
  const productForecasts = timeSeries.map(ts => forecastProduct(ts));

  // Calculate totals
  const totalOneDay = productForecasts.reduce((acc, pf) => ({
    revenue: acc.revenue + pf.oneDayForecast.revenue,
    quantity: acc.quantity + pf.oneDayForecast.quantity,
    confidence: acc.confidence + pf.oneDayForecast.confidence
  }), { revenue: 0, quantity: 0, confidence: 0 });

  const totalSevenDay = productForecasts.reduce((acc, pf) => ({
    revenue: acc.revenue + pf.sevenDayForecast.revenue,
    quantity: acc.quantity + pf.sevenDayForecast.quantity,
    confidence: acc.confidence + pf.sevenDayForecast.confidence
  }), { revenue: 0, quantity: 0, confidence: 0 });

  // Get dates info
  const allDates = Array.from(new Set(salesData.map(d => d.date))).sort();
  const missingDates = findMissingDates(allDates);

  // Assess data quality
  const missingPercent = (missingDates.length / allDates.length) * 100;
  let dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  if (missingPercent < 5) dataQuality = 'excellent';
  else if (missingPercent < 15) dataQuality = 'good';
  else if (missingPercent < 30) dataQuality = 'fair';
  else dataQuality = 'poor';

  // Generate warnings
  const warnings: string[] = [];
  if (allDates.length < 30) {
    warnings.push('Limited historical data (< 30 days). Forecasts may be less accurate.');
  }
  if (missingDates.length > 0) {
    warnings.push(`${missingDates.length} dates missing from historical data.`);
  }

  // Get target dates from first product (all should have same dates)
  const firstForecast = productForecasts[0];

  return {
    generatedAt: new Date().toISOString(),
    forecastPeriod: {
      oneDayTarget: firstForecast.oneDayForecast.targetDate,
      sevenDayTarget: firstForecast.sevenDayForecast.targetDate
    },
    totalForecast: {
      oneDay: {
        revenue: Math.round(totalOneDay.revenue * 100) / 100,
        quantity: Math.round(totalOneDay.quantity * 100) / 100,
        avgConfidence: Math.round(totalOneDay.confidence / productForecasts.length)
      },
      sevenDay: {
        revenue: Math.round(totalSevenDay.revenue * 100) / 100,
        quantity: Math.round(totalSevenDay.quantity * 100) / 100,
        avgConfidence: Math.round(totalSevenDay.confidence / productForecasts.length)
      }
    },
    productForecasts,
    metadata: {
      dataQuality,
      totalHistoricalDays: allDates.length,
      missingDates,
      warnings
    }
  };
}

/**
 * Backtest forecast accuracy on historical data
 * Uses last N days as test set, rest as training
 */
export function backtestForecast(
  timeSeries: ProductTimeSeries,
  testDays: number = 7
): ForecastValidation {
  const { dailyData, productName } = timeSeries;

  if (dailyData.length < testDays + 7) {
    // Not enough data for meaningful backtest
    return {
      productName,
      metrics: { mae: 0, mape: 0, rmse: 0 },
      testPeriodDays: 0
    };
  }

  // Split into train and test
  const trainData = dailyData.slice(0, -testDays);
  const testData = dailyData.slice(-testDays);

  const revenues = trainData.map(d => d.revenue);

  // Generate predictions for test period
  const errors: number[] = [];
  const percentErrors: number[] = [];

  testData.forEach((actual) => {
    const forecast = calculateMovingAverage(revenues, revenues.length, 7);
    const error = Math.abs(actual.revenue - forecast.value);
    errors.push(error);

    if (actual.revenue > 0) {
      percentErrors.push((error / actual.revenue) * 100);
    }
  });

  // Calculate metrics
  const mae = errors.reduce((sum, e) => sum + e, 0) / errors.length;
  const mape = percentErrors.length > 0
    ? percentErrors.reduce((sum, e) => sum + e, 0) / percentErrors.length
    : 0;
  const rmse = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);

  return {
    productName,
    metrics: {
      mae: Math.round(mae * 100) / 100,
      mape: Math.round(mape * 100) / 100,
      rmse: Math.round(rmse * 100) / 100
    },
    testPeriodDays: testDays
  };
}

/**
 * Validate all top products
 */
export function validateForecasts(salesData: DailySales[], topN: number = 10): ForecastValidation[] {
  const timeSeries = prepareProductTimeSeries(salesData, topN);
  return timeSeries.map(ts => backtestForecast(ts, 7));
}
