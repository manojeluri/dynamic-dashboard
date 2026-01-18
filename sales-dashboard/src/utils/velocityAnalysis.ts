import type { DailySales, ProductVelocityMetrics, VelocityChange } from '../types';

/**
 * Calculate product velocity metrics from sales data
 * Tracks daily and weekly velocity with automatic classification
 */
export function calculateProductVelocity(salesData: DailySales[]): ProductVelocityMetrics[] {
  // Map to track product metrics
  const productMap = new Map<string, {
    qty: number;
    amount: number;
    dates: Set<string>;
    company?: string;
  }>();

  // Accumulate data for each product
  salesData.forEach(daily => {
    daily.records.forEach(record => {
      const existing = productMap.get(record.ITNAME) || {
        qty: 0,
        amount: 0,
        dates: new Set<string>(),
        company: record.company,
      };

      productMap.set(record.ITNAME, {
        qty: existing.qty + record.QTY,
        amount: existing.amount + record.TAXBLEAMT,
        dates: existing.dates.add(daily.date),
        company: record.company || existing.company,
      });
    });
  });

  // Convert to array with velocity calculations
  const velocityMetrics = Array.from(productMap.entries()).map(([productName, data]) => {
    const daysActive = data.dates.size;
    const dailyVelocity = daysActive > 0 ? data.qty / daysActive : 0;
    const weeklyVelocity = dailyVelocity * 7;

    return {
      productName,
      company: data.company,
      totalQty: data.qty,
      totalAmount: data.amount,
      daysActive,
      dailyVelocity,
      weeklyVelocity,
      classification: 'medium' as 'fast' | 'medium' | 'slow', // Temporarily set to medium
      rank: 0, // Will be set after sorting
    };
  });

  // Sort by daily velocity (descending)
  velocityMetrics.sort((a, b) => b.dailyVelocity - a.dailyVelocity);

  // Assign ranks
  velocityMetrics.forEach((metric, index) => {
    metric.rank = index + 1;
  });

  // Auto-classify using percentiles (top 33% = fast, middle 34% = medium, bottom 33% = slow)
  const total = velocityMetrics.length;
  const fastThreshold = Math.ceil(total * 0.33);
  const mediumThreshold = Math.ceil(total * 0.67);

  velocityMetrics.forEach((metric, index) => {
    if (index < fastThreshold) {
      metric.classification = 'fast';
    } else if (index < mediumThreshold) {
      metric.classification = 'medium';
    } else {
      metric.classification = 'slow';
    }
  });

  return velocityMetrics;
}

/**
 * Split sales data into current and previous periods for comparison
 */
export function splitDataByPeriod(
  salesData: DailySales[],
  periodType: 'week' | 'month'
): { current: DailySales[]; previous: DailySales[] } {
  if (salesData.length === 0) {
    return { current: [], previous: [] };
  }

  // Get all unique dates and sort them
  const dates = Array.from(new Set(salesData.map(d => d.date))).sort();

  if (dates.length === 0) {
    return { current: [], previous: [] };
  }

  const latestDate = new Date(dates[dates.length - 1]);
  const periodDays = periodType === 'week' ? 7 : 30;

  // Calculate date boundaries
  const currentStart = new Date(latestDate);
  currentStart.setDate(latestDate.getDate() - (periodDays - 1));
  const currentStartStr = currentStart.toISOString().split('T')[0];

  const previousEnd = new Date(currentStart);
  previousEnd.setDate(currentStart.getDate() - 1);
  const previousEndStr = previousEnd.toISOString().split('T')[0];

  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousEnd.getDate() - (periodDays - 1));
  const previousStartStr = previousStart.toISOString().split('T')[0];

  // Split data into current and previous periods
  const current = salesData.filter(d => d.date >= currentStartStr && d.date <= dates[dates.length - 1]);
  const previous = salesData.filter(d => d.date >= previousStartStr && d.date <= previousEndStr);

  return { current, previous };
}

/**
 * Compare velocity between two periods to identify gainers and losers
 */
export function compareVelocityPeriods(
  currentPeriod: DailySales[],
  previousPeriod: DailySales[]
): VelocityChange[] {
  // Calculate velocity for both periods
  const currentVelocity = calculateProductVelocity(currentPeriod);
  const previousVelocity = calculateProductVelocity(previousPeriod);

  // Create map for quick lookup
  const previousMap = new Map(
    previousVelocity.map(v => [v.productName, v.dailyVelocity])
  );

  const currentMap = new Map(
    currentVelocity.map(v => [v.productName, v])
  );

  // Track all unique products from both periods
  const allProducts = new Set([
    ...currentVelocity.map(v => v.productName),
    ...previousVelocity.map(v => v.productName),
  ]);

  const changes: VelocityChange[] = [];

  allProducts.forEach(productName => {
    const current = currentMap.get(productName);
    const previous = previousMap.get(productName);

    // Handle new products (in current but not in previous)
    if (current && !previous) {
      changes.push({
        productName,
        company: current.company,
        currentVelocity: current.dailyVelocity,
        previousVelocity: 0,
        changePercent: 100, // New product = 100% growth
        changeAbsolute: current.dailyVelocity,
        trend: 'accelerating',
        classification: 'gainer',
      });
      return;
    }

    // Handle discontinued products (in previous but not in current)
    if (!current && previous) {
      changes.push({
        productName,
        company: previousVelocity.find(v => v.productName === productName)?.company,
        currentVelocity: 0,
        previousVelocity: previous,
        changePercent: -100, // Discontinued = -100%
        changeAbsolute: -previous,
        trend: 'decelerating',
        classification: 'loser',
      });
      return;
    }

    // Handle products in both periods
    if (current && previous) {
      const changeAbsolute = current.dailyVelocity - previous;
      const changePercent = previous > 0 ? (changeAbsolute / previous) * 100 : 0;

      // Determine trend
      let trend: 'accelerating' | 'stable' | 'decelerating';
      if (changePercent > 5) {
        trend = 'accelerating';
      } else if (changePercent < -5) {
        trend = 'decelerating';
      } else {
        trend = 'stable';
      }

      // Determine classification (>15% change threshold)
      let classification: 'gainer' | 'stable' | 'loser';
      if (changePercent > 15) {
        classification = 'gainer';
      } else if (changePercent < -15) {
        classification = 'loser';
      } else {
        classification = 'stable';
      }

      changes.push({
        productName,
        company: current.company,
        currentVelocity: current.dailyVelocity,
        previousVelocity: previous,
        changePercent,
        changeAbsolute,
        trend,
        classification,
      });
    }
  });

  return changes;
}

/**
 * Get velocity distribution summary
 */
export function getVelocityDistribution(velocityMetrics: ProductVelocityMetrics[]): {
  fast: number;
  medium: number;
  slow: number;
} {
  return {
    fast: velocityMetrics.filter(v => v.classification === 'fast').length,
    medium: velocityMetrics.filter(v => v.classification === 'medium').length,
    slow: velocityMetrics.filter(v => v.classification === 'slow').length,
  };
}
