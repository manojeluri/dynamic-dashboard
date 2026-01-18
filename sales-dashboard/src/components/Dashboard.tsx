import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from 'recharts';
import { TrendingUp, Package, DollarSign, Calendar, Building2, ArrowUpDown, ArrowUp, ArrowDown, Zap, Target, Activity } from 'lucide-react';
import type { DailySales } from '../types';
import {
  loadAllDataFromManifest,
  aggregateByProduct,
  aggregateByDate,
  getTotalSales,
  getTotalQuantity,
  enrichWithCompanyData,
  aggregateByCompany,
  getTopCompanies,
  aggregateByProductWithCompany,
} from '../utils/dataLoader';
import { getCompanyMapper } from '../utils/companyMapper';
import {
  calculateProductVelocity,
  splitDataByPeriod,
  compareVelocityPeriods,
  getVelocityDistribution,
} from '../utils/velocityAnalysis';
import {
  generateForecastSummary,
  validateForecasts,
} from '../utils/forecastingUtils';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Helper function to format date from YYYY-MM-DD to DD-MM-YYYY
function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
}

// Helper function to format currency in Indian format (Lakhs/Crores)
function formatIndianCurrency(value: number): string {
  if (value >= 10000000) {
    // 1 Crore or more
    return `₹${(value / 10000000).toFixed(2)}Cr`;
  } else if (value >= 100000) {
    // 1 Lakh or more
    return `₹${(value / 100000).toFixed(2)}L`;
  } else if (value >= 1000) {
    // 1 Thousand or more
    return `₹${(value / 1000).toFixed(1)}K`;
  } else {
    return `₹${value.toFixed(0)}`;
  }
}

// Helper function to format quantity in Indian format
function formatIndianQuantity(value: number): string {
  if (value >= 10000000) {
    return `${(value / 10000000).toFixed(2)}Cr`;
  } else if (value >= 100000) {
    return `${(value / 100000).toFixed(2)}L`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  } else {
    return value.toFixed(0);
  }
}

export default function Dashboard() {
  const [salesData, setSalesData] = useState<DailySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<'ALL' | 'PS' | 'FS'>('ALL');
  const [selectedCompany, setSelectedCompany] = useState<string>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [dateRangeStart, setDateRangeStart] = useState<string>('');
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('');
  const [dateRangePreset, setDateRangePreset] = useState<string>('ALL');
  const [availableCompanies, setAvailableCompanies] = useState<string[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  // Sorting state for Product Sales Details table
  const [productSortColumn, setProductSortColumn] = useState<string>('totalAmount');
  const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('desc');

  // Sorting state for Unknown Products table
  const [unknownSortColumn, setUnknownSortColumn] = useState<string>('totalAmount');

  // Tab state
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'velocity' | 'forecast'>('overview');
  const [unknownSortDirection, setUnknownSortDirection] = useState<'asc' | 'desc'>('desc');

  // Velocity analysis state
  const [velocityPeriodType, setVelocityPeriodType] = useState<'week' | 'month'>('week');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);

    // Load company mapper first
    const companyMapper = await getCompanyMapper();

    // Load all data files dynamically from manifest
    const allData = await loadAllDataFromManifest();

    // Enrich sales data with company information
    enrichWithCompanyData(allData, companyMapper);

    // Get list of companies
    const companies = companyMapper.getAllCompanies();
    setAvailableCompanies(companies);

    // Get list of unique dates and sort them
    const dates = Array.from(new Set(allData.map(d => d.date))).sort();
    setAvailableDates(dates);

    setSalesData(allData);
    setLoading(false);
  }

  // Handle preset date ranges
  const handlePresetRange = (preset: string) => {
    setDateRangePreset(preset);
    if (preset === 'ALL') {
      setDateRangeStart('');
      setDateRangeEnd('');
      setSelectedDate('ALL');
      return;
    }

    const dates = availableDates.sort();
    const latestDate = dates[dates.length - 1];
    const latestDateObj = new Date(latestDate);

    let startDate = '';
    switch (preset) {
      case 'TODAY':
        // Set both start and end to latest date (today)
        setDateRangeStart(latestDate);
        setDateRangeEnd(latestDate);
        setSelectedDate('RANGE');
        return;
      case 'LAST_7':
        startDate = new Date(latestDateObj.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'LAST_30':
        startDate = new Date(latestDateObj.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'THIS_MONTH':
        startDate = `${latestDate.substring(0, 7)}-01`;
        break;
    }
    setDateRangeStart(startDate);
    setDateRangeEnd(latestDate);
    setSelectedDate('RANGE');
  };

  // Handle sorting for product table
  const handleProductSort = (column: string) => {
    if (productSortColumn === column) {
      // Toggle direction if same column
      setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending for numbers, ascending for text
      setProductSortColumn(column);
      setProductSortDirection(column === 'productName' || column === 'company' ? 'asc' : 'desc');
    }
  };

  // Handle sorting for unknown products table
  const handleUnknownSort = (column: string) => {
    if (unknownSortColumn === column) {
      // Toggle direction if same column
      setUnknownSortDirection(unknownSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending for numbers, ascending for text
      setUnknownSortColumn(column);
      setUnknownSortDirection(column === 'productName' ? 'asc' : 'desc');
    }
  };

  // Sort helper function
  const sortData = <T extends Record<string, any>>(data: T[], column: string, direction: 'asc' | 'desc'): T[] => {
    return [...data].sort((a, b) => {
      let aVal = a[column];
      let bVal = b[column];

      // Handle null/undefined values
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // String comparison (case-insensitive)
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Render sort icon
  const SortIcon = ({ column, activeColumn, direction }: { column: string; activeColumn: string; direction: 'asc' | 'desc' }) => {
    if (column !== activeColumn) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return direction === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
      : <ArrowDown className="w-3.5 h-3.5 text-blue-600" />;
  };

  // Get current date range display text
  const getDateRangeDisplay = () => {
    if (dateRangePreset === 'ALL') return null;
    if (!dateRangeStart || !dateRangeEnd) return null;

    const startFormatted = formatDate(dateRangeStart);
    const endFormatted = formatDate(dateRangeEnd);

    if (dateRangeStart === dateRangeEnd) {
      return startFormatted;
    }
    return `${startFormatted} - ${endFormatted}`;
  };

  // Filter by type (PS/FS)
  let filteredData = selectedType === 'ALL'
    ? salesData
    : salesData.filter(d => d.type === selectedType);

  // Filter by date or date range
  if (selectedDate === 'RANGE' && dateRangeStart && dateRangeEnd) {
    filteredData = filteredData.filter(d => d.date >= dateRangeStart && d.date <= dateRangeEnd);
  } else if (selectedDate !== 'ALL' && selectedDate !== 'RANGE') {
    filteredData = filteredData.filter(d => d.date === selectedDate);
  }

  // Filter by company
  if (selectedCompany !== 'ALL') {
    filteredData = filteredData.map(daily => ({
      ...daily,
      records: daily.records.filter(r => r.company === selectedCompany),
      totalAmount: daily.records.filter(r => r.company === selectedCompany).reduce((sum, r) => sum + r.TAXBLEAMT, 0),
      totalQuantity: daily.records.filter(r => r.company === selectedCompany).reduce((sum, r) => sum + r.QTY, 0),
    }));
  }

  const totalSales = getTotalSales(filteredData);
  const totalQuantity = getTotalQuantity(filteredData);
  const topProducts = aggregateByProductWithCompany(filteredData).slice(0, 10);
  const dailyTrend = aggregateByDate(filteredData).map(d => ({
    ...d,
    date: formatDate(d.date),
  }));
  const topCompanies = getTopCompanies(filteredData, 10);
  const companyData = aggregateByCompany(filteredData);

  // Calculate unique days from filtered data
  const uniqueDays = new Set(filteredData.map(d => d.date)).size;

  // Get unknown products (products without company mapping) from filtered data
  const unknownProducts = aggregateByProductWithCompany(filteredData)
    .filter(p => !p.company || p.company === 'Unknown')
    .sort((a, b) => b.totalAmount - a.totalAmount);

  // Aggregate by type (PS vs FS) from filtered data
  const typeComparison = [
    {
      type: 'PS (Pesticides)',
      amount: getTotalSales(filteredData.filter(d => d.type === 'PS')),
      quantity: getTotalQuantity(filteredData.filter(d => d.type === 'PS')),
    },
    {
      type: 'FS (Fertilizers)',
      amount: getTotalSales(filteredData.filter(d => d.type === 'FS')),
      quantity: getTotalQuantity(filteredData.filter(d => d.type === 'FS')),
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mx-auto mb-3"></div>
          <div className="text-sm text-gray-500 font-medium">Loading analytics...</div>
        </div>
      </div>
    );
  }

  const avgDailySales = totalSales / uniqueDays;

  // Calculate insights from filtered data
  const dailySalesData = aggregateByDate(filteredData);
  const highestDay = dailySalesData.reduce((max, day) => day.amount > max.amount ? day : max, dailySalesData[0]);
  const top3Companies = getTopCompanies(filteredData, 3);
  const top3Revenue = top3Companies.reduce((sum, c) => sum + c.totalAmount, 0);
  const top3Percentage = ((top3Revenue / totalSales) * 100).toFixed(0);

  // Product Velocity Analysis
  const velocityMetrics = calculateProductVelocity(filteredData);
  const topVelocityProducts = velocityMetrics
    .sort((a, b) => b.dailyVelocity - a.dailyVelocity)
    .slice(0, 20);

  // Period comparison for gainers/losers
  const { current, previous } = splitDataByPeriod(filteredData, velocityPeriodType);
  const velocityChanges = compareVelocityPeriods(current, previous);
  const topGainers = velocityChanges
    .filter(v => v.classification === 'gainer')
    .sort((a, b) => b.changePercent - a.changePercent)
    .slice(0, 10);
  const topLosers = velocityChanges
    .filter(v => v.classification === 'loser')
    .sort((a, b) => a.changePercent - b.changePercent)
    .slice(0, 10);

  // Velocity distribution
  const velocityDistribution = getVelocityDistribution(velocityMetrics);
  const avgVelocity = velocityMetrics.length > 0
    ? velocityMetrics.reduce((sum, v) => sum + v.dailyVelocity, 0) / velocityMetrics.length
    : 0;

  // Sales Forecasting
  const forecastSummary = generateForecastSummary(filteredData, 10);
  const forecastValidation = validateForecasts(filteredData, 10);

  // Extract metrics for KPIs
  const oneDayRevenueForecast = forecastSummary.totalForecast.oneDay.revenue;
  const oneDayQuantityForecast = forecastSummary.totalForecast.oneDay.quantity;
  const sevenDayRevenueForecast = forecastSummary.totalForecast.sevenDay.revenue;
  const sevenDayQuantityForecast = forecastSummary.totalForecast.sevenDay.quantity;
  const avgForecastConfidence = forecastSummary.totalForecast.sevenDay.avgConfidence;

  // Prepare top 10 product chart data
  const top10ProductForecasts = forecastSummary.productForecasts
    .sort((a, b) => b.sevenDayForecast.revenue - a.sevenDayForecast.revenue)
    .slice(0, 10)
    .map(pf => ({
      productName: pf.productName.length > 30 ? pf.productName.substring(0, 30) + '...' : pf.productName,
      revenue: pf.sevenDayForecast.revenue,
      quantity: pf.sevenDayForecast.quantity,
      confidence: pf.sevenDayForecast.confidence
    }));

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Filter Toolbar - Full Width Header */}
      <div className="glass-header bg-gradient-to-r from-slate-900 via-blue-900 to-slate-900 border-b border-white-10">
        <div className="max-w-7xl mx-auto px-8 py-5">
          <div className="flex flex-wrap gap-5 items-center">
            {/* Category Filter */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-100 tracking-wide">Category</span>
              <div className="inline-flex glass-control rounded-full p-2">
                {[
                  { value: 'ALL', label: 'All' },
                  { value: 'PS', label: 'Pesticides' },
                  { value: 'FS', label: 'Fertilizers' },
                ].map(({ value, label }, index) => (
                  <button
                    key={value}
                    onClick={() => setSelectedType(value as any)}
                    className={`px-5 py-2 text-sm font-medium rounded-full transition-all duration-300 ${
                      index > 0 ? 'ml-2' : ''
                    } ${
                      selectedType === value
                        ? 'glass-active text-white shadow-glass'
                        : 'glass-inactive text-slate-700 hover:text-slate-900 hover:glass-hover'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-8 w-px bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-30"></div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-100 tracking-wide">Period</span>
              <select
                value={dateRangePreset}
                onChange={(e) => handlePresetRange(e.target.value)}
                className="glass-select px-5 py-2.5 text-sm rounded-full text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-300"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today</option>
                <option value="LAST_7">Last 7 Days</option>
                <option value="LAST_30">Last 30 Days</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="CUSTOM">Custom Range</option>
              </select>

              {/* Date Range Display */}
              {getDateRangeDisplay() && (
                <span className="px-3 py-1.5 bg-blue-500 bg-opacity-20 text-blue-100 text-xs font-semibold rounded-full border border-blue-400 border-opacity-30">
                  {getDateRangeDisplay()}
                </span>
              )}

              {/* Custom Range Selectors */}
              {dateRangePreset === 'CUSTOM' && (
                <>
                  <select
                    value={dateRangeStart}
                    onChange={(e) => {
                      setDateRangeStart(e.target.value);
                      if (e.target.value) {
                        setSelectedDate('RANGE');
                      }
                    }}
                    className="glass-select px-4 py-2 text-xs rounded-full text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-300"
                  >
                    <option value="">From</option>
                    {availableDates.map(date => (
                      <option key={date} value={date}>{formatDate(date)}</option>
                    ))}
                  </select>
                  <span className="text-blue-200 text-xs">to</span>
                  <select
                    value={dateRangeEnd}
                    onChange={(e) => {
                      setDateRangeEnd(e.target.value);
                      if (e.target.value) {
                        setSelectedDate('RANGE');
                      }
                    }}
                    className="glass-select px-4 py-2 text-xs rounded-full text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-300"
                  >
                    <option value="">To</option>
                    {availableDates.map(date => (
                      <option key={date} value={date}>{formatDate(date)}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className="h-8 w-px bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-30"></div>

            {/* Company Filter */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-100 tracking-wide">Company</span>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="glass-select px-5 py-2.5 text-sm rounded-full text-gray-100 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-50 transition-all duration-300"
              >
                <option value="ALL">All Companies</option>
                {availableCompanies.map(company => (
                  <option key={company} value={company}>{company}</option>
                ))}
              </select>
            </div>

            {(selectedType !== 'ALL' || selectedDate !== 'ALL' || selectedCompany !== 'ALL') && (
              <>
                <div className="h-8 w-px bg-gradient-to-b from-transparent via-blue-400 to-transparent opacity-30"></div>
                <button
                  onClick={() => {
                    setSelectedType('ALL');
                    setSelectedDate('ALL');
                    setSelectedCompany('ALL');
                    setDateRangeStart('');
                    setDateRangeEnd('');
                    setDateRangePreset('ALL');
                  }}
                  className="glass-button px-5 py-2.5 text-sm text-blue-200 hover:text-white font-semibold rounded-full transition-all duration-300"
                >
                  Clear filters
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-4 space-y-4">
        {/* KPI Grid */}
        <div className="kpi-grid">
          {/* Total Revenue */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Revenue</div>
              <div className="text-2xl font-bold text-gray-900">
                {totalSales >= 10000000
                  ? `₹${(totalSales / 10000000).toFixed(2)}Cr`
                  : `₹${(totalSales / 100000).toFixed(2)}L`
                }
              </div>
              <div className="text-xs text-gray-500">₹{totalSales.toLocaleString('en-IN')}</div>
            </div>
          </div>

          {/* Avg Daily Sales */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Daily Sales</div>
              <div className="text-2xl font-bold text-gray-900">₹{(avgDailySales / 100000).toFixed(1)}L</div>
              <div className="text-xs text-gray-500">Per day</div>
            </div>
          </div>

          {/* Total Quantity */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Quantity</div>
              <div className="text-2xl font-bold text-gray-900">{totalQuantity.toLocaleString('en-IN')}</div>
              <div className="text-xs text-gray-500">Units sold</div>
            </div>
          </div>

          {/* Products Sold */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gradient-to-br from-amber-50 to-amber-100 rounded-lg">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Products Sold</div>
              <div className="text-2xl font-bold text-gray-900">{aggregateByProduct(filteredData).length}</div>
              <div className="text-xs text-gray-500">Unique products</div>
            </div>
          </div>

          {/* Companies */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gradient-to-br from-rose-50 to-rose-100 rounded-lg">
                <Building2 className="w-5 h-5 text-rose-600" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Companies</div>
              <div className="text-2xl font-bold text-gray-900">{companyData.length}</div>
              <div className="text-xs text-gray-500">Active vendors</div>
            </div>
          </div>

          {/* Days Tracked */}
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2.5 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg">
                <Calendar className="w-5 h-5 text-indigo-600" />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Days Tracked</div>
              <div className="text-2xl font-bold text-gray-900">{uniqueDays}</div>
              <div className="text-xs text-gray-500">This period</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1.5">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('overview')}
              className={`flex-1 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>Overview</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('products')}
              className={`flex-1 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'products'
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Package className="w-4 h-4" />
                <span>Product Analysis</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('velocity')}
              className={`flex-1 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'velocity'
                  ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Velocity Analysis</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('forecast')}
              className={`flex-1 px-6 py-3 text-sm font-semibold rounded-lg transition-all duration-200 ${
                activeTab === 'forecast'
                  ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <Target className="w-4 h-4" />
                <span>Sales Forecast</span>
              </div>
            </button>
          </div>
        </div>

        {/* Overview Tab Content */}
        {activeTab === 'overview' && (
        <>
        {/* Insights */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 bg-white rounded-lg shadow-sm">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-gray-900 mb-3">Key Insights</h3>
              <div className="space-y-2.5 text-sm text-gray-700">
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0"></span>
                  <span>Highest revenue day: <span className="font-semibold">{formatDate(highestDay?.date || '')}</span> (₹{((highestDay?.amount || 0) / 100000).toFixed(1)}L)</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full flex-shrink-0"></span>
                  <span>Top 3 companies contribute: <span className="font-semibold">{top3Percentage}%</span> of revenue</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Charts - Premium Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Daily Sales Trend - Enhanced with Insights */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Daily Sales Trend</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Revenue over time with average reference line</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyTrend}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                />
                <ReferenceLine
                  y={avgDailySales}
                  stroke="#9CA3AF"
                  strokeDasharray="5 5"
                  strokeWidth={1.5}
                  label={{
                    value: 'Avg',
                    position: 'right',
                    fill: '#6B7280',
                    fontSize: 11,
                    fontWeight: 600
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fill="url(#colorAmount)"
                  name="Revenue (₹)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* PS vs FS Comparison */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Category Breakdown</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Pesticides vs Fertilizers</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeComparison}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  dataKey="type"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickMargin={8}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Bar dataKey="amount" fill="#3B82F6" radius={[8, 8, 0, 0]} name="Revenue (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top 10 Products */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Top Products</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">By revenue</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                />
                <YAxis
                  dataKey="productName"
                  type="category"
                  width={150}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Bar dataKey="totalAmount" fill="#8B5CF6" radius={[0, 4, 4, 0]} name="Sales (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Product Distribution Pie */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Product Distribution</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Top 6 products</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topProducts.slice(0, 6) as unknown as Record<string, unknown>[]}
                  dataKey="totalAmount"
                  nameKey="productName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name }: { name?: string }) => name || ''}
                  labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                >
                  {topProducts.slice(0, 6).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {topProducts.slice(0, 6).map((product, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-xs text-gray-700 whitespace-nowrap">{product.productName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Company Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Companies by Sales */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Top Companies</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">By revenue</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topCompanies} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => `₹${(value / 100000).toFixed(0)}L`}
                />
                <YAxis
                  dataKey="companyName"
                  type="category"
                  width={120}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Bar dataKey="totalAmount" fill="#10B981" radius={[0, 4, 4, 0]} name="Sales (₹)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Company Market Share */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Company Market Share</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Top 8 companies</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={topCompanies.slice(0, 8) as unknown as Record<string, unknown>[]}
                  dataKey="totalAmount"
                  nameKey="companyName"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name }: { name?: string }) => name || ''}
                  labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                >
                  {topCompanies.slice(0, 8).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              {topCompanies.slice(0, 8).map((company, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  ></div>
                  <span className="text-xs text-gray-700 whitespace-nowrap">{company.companyName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        </>
        )}

        {/* Velocity Analysis Tab Content */}
        {activeTab === 'velocity' && (
        <>
        {/* Product Velocity & Movement Section */}
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-white rounded-lg shadow-sm">
                <Zap className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Product Velocity & Movement</h2>
                <p className="text-sm text-gray-600">Track product sales speed and momentum</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setVelocityPeriodType('week')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  velocityPeriodType === 'week'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setVelocityPeriodType('month')}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  velocityPeriodType === 'month'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Monthly
              </button>
            </div>
          </div>

          {/* Velocity KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* Fast Moving Products Count */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Fast Moving</div>
              <div className="text-2xl font-bold text-green-600">{velocityDistribution.fast}</div>
              <div className="text-xs text-gray-500">Products</div>
            </div>

            {/* Average Velocity */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Avg Velocity</div>
              <div className="text-2xl font-bold text-blue-600">{avgVelocity.toFixed(1)}</div>
              <div className="text-xs text-gray-500">Units/day</div>
            </div>

            {/* Top Gainer */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Top Gainer</div>
              <div className="text-lg font-bold text-green-600">
                {topGainers[0]?.productName.substring(0, 20) || 'N/A'}
              </div>
              <div className="text-xs text-green-600 font-semibold">
                {topGainers[0] ? `+${topGainers[0].changePercent.toFixed(0)}%` : '--'}
              </div>
            </div>

            {/* Top Loser */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Top Loser</div>
              <div className="text-lg font-bold text-red-600">
                {topLosers[0]?.productName.substring(0, 20) || 'N/A'}
              </div>
              <div className="text-xs text-red-600 font-semibold">
                {topLosers[0] ? `${topLosers[0].changePercent.toFixed(0)}%` : '--'}
              </div>
            </div>
          </div>
        </div>

        {/* Velocity Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Products by Velocity */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Top Products by Velocity</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Fastest moving products (units/day)</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topVelocityProducts.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => value.toFixed(0)}
                />
                <YAxis
                  dataKey="productName"
                  type="category"
                  width={150}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [value.toFixed(1), 'Units/day']}
                />
                <Bar dataKey="dailyVelocity" fill="#A855F7" radius={[0, 4, 4, 0]} name="Velocity" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Velocity Distribution */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Velocity Distribution</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Product classification by speed</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Fast Moving', value: velocityDistribution.fast, color: '#10B981' },
                    { name: 'Medium', value: velocityDistribution.medium, color: '#F59E0B' },
                    { name: 'Slow Moving', value: velocityDistribution.slow, color: '#9CA3AF' },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.name} (${entry.value})`}
                  labelLine={{ stroke: '#9CA3AF', strokeWidth: 1 }}
                >
                  <Cell fill="#10B981" />
                  <Cell fill="#F59E0B" />
                  <Cell fill="#9CA3AF" />
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                <span className="text-xs text-gray-700">Fast Moving</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-yellow-500"></div>
                <span className="text-xs text-gray-700">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-gray-400"></div>
                <span className="text-xs text-gray-700">Slow Moving</span>
              </div>
            </div>
          </div>

          {/* Top Gainers */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Top Gainers</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Products with increasing velocity</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topGainers.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => `+${value.toFixed(0)}%`}
                />
                <YAxis
                  dataKey="productName"
                  type="category"
                  width={150}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`+${value.toFixed(1)}%`, 'Change']}
                />
                <Bar dataKey="changePercent" fill="#10B981" radius={[0, 4, 4, 0]} name="% Change" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top Losers */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Top Losers</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">Products with decreasing velocity</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topLosers.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                />
                <YAxis
                  dataKey="productName"
                  type="category"
                  width={150}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`${value.toFixed(1)}%`, 'Change']}
                />
                <Bar dataKey="changePercent" fill="#EF4444" radius={[0, 4, 4, 0]} name="% Change" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Velocity Table */}
        <div className="bg-white rounded-[12px] border border-gray-200 p-6 mt-4">
          <div className="mb-6">
            <h3 className="text-[16px] font-semibold text-gray-900">Product Velocity Details</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">Comprehensive velocity metrics for all products</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Daily Velocity
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Weekly Velocity
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Classification
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Days Active
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {topVelocityProducts.map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] font-medium text-gray-900">
                      #{product.rank}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] font-medium text-gray-900">
                      {product.productName}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600">
                      {product.company || 'Unknown'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-900 tabular-nums font-medium">
                      {product.dailyVelocity.toFixed(1)} units/day
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                      {product.weeklyVelocity.toFixed(0)} units/week
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px]">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        product.classification === 'fast' ? 'bg-green-100 text-green-800' :
                        product.classification === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {product.classification}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                      {product.daysActive} days
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}

        {/* Product Analysis Tab Content */}
        {activeTab === 'products' && (
        <>
        {/* Product Table */}
        <div className="bg-white rounded-[12px] border border-gray-200 p-6">
          <div className="mb-6">
            <h3 className="text-[16px] font-semibold text-gray-900">Product Sales Details</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">Top 20 products with detailed metrics (click headers to sort)</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    onClick={() => handleProductSort('productName')}
                    className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Product Name
                      <SortIcon column="productName" activeColumn={productSortColumn} direction={productSortDirection} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleProductSort('company')}
                    className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Company
                      <SortIcon column="company" activeColumn={productSortColumn} direction={productSortDirection} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleProductSort('totalQty')}
                    className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Quantity
                      <SortIcon column="totalQty" activeColumn={productSortColumn} direction={productSortDirection} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleProductSort('totalAmount')}
                    className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Total Sales
                      <SortIcon column="totalAmount" activeColumn={productSortColumn} direction={productSortDirection} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleProductSort('avgPrice')}
                    className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      Avg Price
                      <SortIcon column="avgPrice" activeColumn={productSortColumn} direction={productSortDirection} />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {sortData(topProducts.slice(0, 20), productSortColumn, productSortDirection).map((product, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] font-medium text-gray-900">
                      {product.productName}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600">
                      {product.company || 'Unknown'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                      {product.totalQty.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] font-medium text-gray-900 tabular-nums">
                      ₹{product.totalAmount.toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                      ₹{product.avgPrice.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
        )}

        {/* Sales Forecast Tab Content */}
        {activeTab === 'forecast' && (
        <>
        {/* Sales Forecast Section */}
        <div className="bg-gradient-to-r from-cyan-50 to-blue-50 rounded-xl border border-cyan-200 p-6 mb-4 mt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="p-2.5 bg-white rounded-lg shadow-sm">
                <Target className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Sales Forecast</h2>
                <p className="text-sm text-gray-600">AI-powered predictions for Top 10 products</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-sm">
              <Activity className="w-4 h-4 text-cyan-600" />
              <span className="text-sm font-medium text-gray-700">
                Data Quality: <span className="text-cyan-600 capitalize">{forecastSummary.metadata.dataQuality}</span>
              </span>
            </div>
          </div>

          {/* Forecast KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            {/* 7-Day Revenue Forecast */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                7-Day Revenue Forecast
              </div>
              <div className="text-2xl font-bold text-cyan-600">
                {formatIndianCurrency(sevenDayRevenueForecast)}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                <span className="text-green-600 font-semibold">{avgForecastConfidence}% confidence</span>
              </div>
            </div>

            {/* 7-Day Quantity Forecast */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                7-Day Quantity Forecast
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatIndianQuantity(sevenDayQuantityForecast)}
              </div>
              <div className="text-xs text-gray-500">Units (next 7 days)</div>
            </div>

            {/* 1-Day Revenue Forecast */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Next Day Revenue
              </div>
              <div className="text-2xl font-bold text-cyan-600">
                {formatIndianCurrency(oneDayRevenueForecast)}
              </div>
              <div className="text-xs text-gray-500">
                {forecastSummary.forecastPeriod.oneDayTarget}
              </div>
            </div>

            {/* 1-Day Quantity Forecast */}
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Next Day Quantity
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {formatIndianQuantity(oneDayQuantityForecast)}
              </div>
              <div className="text-xs text-gray-500">Units (tomorrow)</div>
            </div>
          </div>

          {/* Warnings if any */}
          {forecastSummary.metadata.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="text-xs font-semibold text-yellow-800 mb-1">Forecast Notices:</div>
              {forecastSummary.metadata.warnings.map((warning, idx) => (
                <div key={idx} className="text-xs text-yellow-700">• {warning}</div>
              ))}
            </div>
          )}
        </div>

        {/* Forecast Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top 10 Products 7-Day Revenue Forecast */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">
                Top 10 Products - 7-Day Revenue Forecast
              </h3>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Predicted revenue for next week
              </p>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={top10ProductForecasts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => formatIndianCurrency(value).replace('₹', '')}
                />
                <YAxis
                  dataKey="productName"
                  type="category"
                  width={150}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [formatIndianCurrency(value), 'Forecast']}
                />
                <Bar dataKey="revenue" fill="#06B6D4" radius={[0, 4, 4, 0]} name="Revenue Forecast" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top 10 Products 7-Day Quantity Forecast */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">
                Top 10 Products - 7-Day Quantity Forecast
              </h3>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Predicted units for next week
              </p>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={top10ProductForecasts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  tickFormatter={(value) => formatIndianQuantity(value)}
                />
                <YAxis
                  dataKey="productName"
                  type="category"
                  width={150}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [formatIndianQuantity(value), 'Units']}
                />
                <Bar dataKey="quantity" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Quantity Forecast" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Forecast Confidence Distribution */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Forecast Confidence Levels</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Reliability score for each product (0-100%)
              </p>
            </div>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={top10ProductForecasts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.5} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <YAxis
                  dataKey="productName"
                  type="category"
                  width={150}
                  tick={{ fontSize: 10, fill: '#6B7280' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                  formatter={(value: any) => [`${value}%`, 'Confidence']}
                />
                <Bar dataKey="confidence" radius={[0, 4, 4, 0]} name="Confidence Score">
                  {top10ProductForecasts.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.confidence >= 70 ? '#10B981' : entry.confidence >= 50 ? '#F59E0B' : '#EF4444'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-green-500"></div>
                <span className="text-xs text-gray-700">High (≥70%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-yellow-500"></div>
                <span className="text-xs text-gray-700">Medium (50-69%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm bg-red-500"></div>
                <span className="text-xs text-gray-700">Low (&lt;50%)</span>
              </div>
            </div>
          </div>

          {/* Forecast Validation Metrics */}
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="mb-6">
              <h3 className="text-[16px] font-semibold text-gray-900">Forecast Accuracy (Backtest)</h3>
              <p className="text-[12px] text-gray-500 mt-0.5">
                Validation metrics from last 7 days
              </p>
            </div>
            <div className="space-y-3 max-h-[350px] overflow-y-auto">
              {forecastValidation.slice(0, 10).map((validation, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="text-xs font-semibold text-gray-900 mb-2">
                    {validation.productName.substring(0, 40)}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <div className="text-gray-500">MAE</div>
                      <div className="font-semibold text-gray-900">
                        ₹{validation.metrics.mae.toFixed(0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">MAPE</div>
                      <div className="font-semibold text-gray-900">
                        {validation.metrics.mape.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">RMSE</div>
                      <div className="font-semibold text-gray-900">
                        ₹{validation.metrics.rmse.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Detailed Forecast Table */}
        <div className="bg-white rounded-[12px] border border-gray-200 p-6 mt-4">
          <div className="mb-6">
            <h3 className="text-[16px] font-semibold text-gray-900">Detailed Product Forecasts</h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Complete forecast data for top 10 products
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    1-Day Revenue
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    1-Day Qty
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    7-Day Revenue
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    7-Day Qty
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Avg Daily
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {forecastSummary.productForecasts.map((forecast, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] font-medium text-gray-900">
                      {forecast.productName}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600">
                      {forecast.company || 'Unknown'}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-900 tabular-nums font-medium">
                      {formatIndianCurrency(forecast.oneDayForecast.revenue)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                      {formatIndianQuantity(forecast.oneDayForecast.quantity)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-900 tabular-nums font-medium">
                      {formatIndianCurrency(forecast.sevenDayForecast.revenue)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                      {formatIndianQuantity(forecast.sevenDayForecast.quantity)}
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] tabular-nums">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        forecast.sevenDayForecast.confidence >= 70
                          ? 'bg-green-100 text-green-700'
                          : forecast.sevenDayForecast.confidence >= 50
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {forecast.sevenDayForecast.confidence}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                      {formatIndianCurrency(forecast.historicalMetrics.avgDailyRevenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Unknown Products Section */}
        {unknownProducts.length > 0 && (
          <div className="bg-white rounded-[12px] border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[16px] font-semibold text-gray-900">
                  Unknown Products ({unknownProducts.length})
                </h3>
                <p className="text-[12px] text-gray-500 mt-0.5">
                  Products not matched to any company (click headers to sort)
                </p>
              </div>
              <span className="px-3 py-1.5 bg-red-50 text-red-700 text-[11px] font-semibold rounded-md uppercase tracking-wider border border-red-200">
                Not Categorized
              </span>
            </div>
            <p className="text-[13px] text-gray-600 mb-5">
              Add these products to the appropriate company CSV file to categorize them.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      onClick={() => handleUnknownSort('productName')}
                      className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Product Name
                        <SortIcon column="productName" activeColumn={unknownSortColumn} direction={unknownSortDirection} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleUnknownSort('totalQty')}
                      className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Quantity Sold
                        <SortIcon column="totalQty" activeColumn={unknownSortColumn} direction={unknownSortDirection} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleUnknownSort('totalAmount')}
                      className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Total Sales
                        <SortIcon column="totalAmount" activeColumn={unknownSortColumn} direction={unknownSortDirection} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleUnknownSort('avgPrice')}
                      className="group px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        Avg Price
                        <SortIcon column="avgPrice" activeColumn={unknownSortColumn} direction={unknownSortDirection} />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {sortData(unknownProducts, unknownSortColumn, unknownSortDirection).map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap text-[13px] font-medium text-gray-900">
                        {product.productName}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                        {product.totalQty.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-[13px] font-medium text-gray-900 tabular-nums">
                        ₹{product.totalAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap text-[13px] text-gray-600 tabular-nums">
                        ₹{product.avgPrice.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}
