export interface SalesRecord {
  HSNCODE: string;
  ITNAME: string;
  QTY: number;
  TAXBLEAMT: number;
  GST: number;
  company?: string;
}

export interface DailySales {
  date: string;
  type: 'PS' | 'FS';
  records: SalesRecord[];
  totalAmount: number;
  totalQuantity: number;
}

export interface ProductSales {
  productName: string;
  totalQty: number;
  totalAmount: number;
  avgPrice: number;
  company?: string;
}

export interface CompanySales {
  companyName: string;
  totalAmount: number;
  totalQuantity: number;
  productCount: number;
  products: ProductSales[];
}

export interface DateRangeSales {
  startDate: string;
  endDate: string;
  totalSales: number;
  totalQuantity: number;
  productBreakdown: ProductSales[];
  dailyTrend: {
    date: string;
    amount: number;
    quantity: number;
  }[];
}

export interface CompanyProduct {
  productName: string;
  company: string;
}

export interface ProductVelocityMetrics {
  productName: string;
  company?: string;
  totalQty: number;
  totalAmount: number;
  daysActive: number;
  dailyVelocity: number;
  weeklyVelocity: number;
  classification: 'fast' | 'medium' | 'slow';
  rank: number;
}

export interface VelocityChange {
  productName: string;
  company?: string;
  currentVelocity: number;
  previousVelocity: number;
  changePercent: number;
  changeAbsolute: number;
  trend: 'accelerating' | 'stable' | 'decelerating';
  classification: 'gainer' | 'stable' | 'loser';
}

export interface ProductTimeSeries {
  productName: string;
  company?: string;
  dailyData: {
    date: string;
    quantity: number;
    revenue: number;
  }[];
}

export interface ProductForecast {
  productName: string;
  company?: string;
  oneDayForecast: {
    revenue: number;
    quantity: number;
    confidence: number;
    targetDate: string;
  };
  sevenDayForecast: {
    revenue: number;
    quantity: number;
    confidence: number;
    targetDate: string;
  };
  historicalMetrics: {
    avgDailyRevenue: number;
    avgDailyQuantity: number;
    standardDeviation: {
      revenue: number;
      quantity: number;
    };
    daysOfData: number;
  };
}

export interface ForecastSummary {
  generatedAt: string;
  forecastPeriod: {
    oneDayTarget: string;
    sevenDayTarget: string;
  };
  totalForecast: {
    oneDay: {
      revenue: number;
      quantity: number;
      avgConfidence: number;
    };
    sevenDay: {
      revenue: number;
      quantity: number;
      avgConfidence: number;
    };
  };
  productForecasts: ProductForecast[];
  metadata: {
    dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
    totalHistoricalDays: number;
    missingDates: string[];
    warnings: string[];
  };
}

export interface ForecastValidation {
  productName: string;
  metrics: {
    mae: number;
    mape: number;
    rmse: number;
  };
  testPeriodDays: number;
}
