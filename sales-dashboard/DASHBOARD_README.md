# Sales Analytics Dashboard

A comprehensive analytics dashboard for visualizing daily sales data for pesticides (PS) and fertilizers (FS).

## Features

### Dashboard Overview
- **Summary Cards**: Display total sales, total quantity, number of products sold, and days tracked
- **Daily Sales Trend**: Line chart showing sales amounts and quantities over time
- **PS vs FS Comparison**: Bar chart comparing pesticide and fertilizer sales
- **Top Products**: Horizontal bar chart showing top 10 products by sales value
- **Product Distribution**: Pie chart visualizing the top 6 products' contribution to total sales
- **Detailed Product Table**: Comprehensive table with product names, quantities, sales amounts, and average prices

### Interactive Features
- **Filter Buttons**: Switch between viewing all sales, PS (Pesticides) only, or FS (Fertilizers) only
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Real-time Data Processing**: Aggregates and analyzes sales data on the fly

## Technology Stack

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Charting Library**: Recharts
- **Data Processing**: XLSX (SheetJS)
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Project Structure

```
sales-dashboard/
├── public/
│   └── Data/                    # Sales data files
│       └── 2025-26/
│           ├── PS/              # Pesticide sales
│           │   ├── Dec01.XLS
│           │   └── Dec02.XLS
│           └── FS/              # Fertilizer sales
│               ├── Dec01.XLS
│               └── Dec02.XLS
├── src/
│   ├── components/
│   │   └── Dashboard.tsx        # Main dashboard component
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── utils/
│   │   └── dataLoader.ts       # Data loading and processing utilities
│   ├── App.tsx                 # Root app component
│   ├── index.css               # Global styles
│   └── main.tsx                # App entry point
└── package.json
```

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Navigate to the project directory:
```bash
cd sales-dashboard
```

2. Install dependencies (already done):
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and visit:
```
http://localhost:5173/
```

### Building for Production

```bash
npm run build
```

The production build will be created in the `dist/` directory.

## Data Format

The dashboard expects XLS files with the following columns:

- **HSNCODE**: Product HSN classification code
- **ITNAME**: Product/Item name
- **QTY**: Quantity sold
- **TAXBLEAMT**: Taxable amount (sales value in ₹)
- **GST**: GST percentage

## Adding New Data (Dynamic Loading)

The dashboard now automatically detects and loads all XLS files! To add new sales data:

1. **Add your XLS files** to the appropriate folder:
   - `public/Data/2025-26/PS/` for pesticide sales
   - `public/Data/2025-26/FS/` for fertilizer sales

2. **Regenerate the manifest** to detect new files:
```bash
npm run generate-manifest
```

3. **Refresh your browser** - The new data will automatically load!

### File Naming Convention
Files should follow the pattern: `MonthDD.XLS` (e.g., `Dec03.XLS`, `Jan15.XLS`)

The manifest generator will automatically:
- Detect all `.XLS` and `.xls` files
- Extract dates from filenames
- Categorize them as PS or FS based on folder
- Sort them chronologically

## Customization

### Modifying Chart Colors
Edit the `COLORS` array in `Dashboard.tsx`:
```typescript
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];
```

### Changing Top Products Limit
Modify the limit parameter in the `getTopProducts()` call:
```typescript
const topProducts = getTopProducts(filteredData, 20); // Show top 20 instead of 10
```

### Adding New Filters
Add new filter buttons and state management in the `Dashboard.tsx` component.

## Key Metrics

The dashboard calculates and displays:

1. **Total Sales**: Sum of all TAXBLEAMT values
2. **Total Quantity**: Sum of all QTY values
3. **Product Count**: Number of unique products sold
4. **Average Price**: Calculated as Total Amount / Total Quantity per product
5. **Daily Trends**: Aggregated sales by date
6. **Category Comparison**: PS vs FS sales breakdown

## Future Enhancements

Consider adding:
- Date range picker for custom period selection
- Export to CSV/Excel functionality
- Company-wise sales analysis using the Company Wise Products data
- Search and filter for specific products
- Monthly/Yearly aggregation views
- Sales forecasting with trend analysis
- Inventory tracking integration

## Troubleshooting

### Data Not Loading
- Ensure XLS files are in the correct `public/Data/` directory
- Check browser console for errors
- Verify file paths in the `loadData()` function

### Charts Not Displaying
- Clear browser cache and reload
- Check if recharts is properly installed: `npm list recharts`

### Build Errors
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear Vite cache: `rm -rf .vite`

## License

This project is private and proprietary.

## Support

For issues or questions, please contact the development team.
