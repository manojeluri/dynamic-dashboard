import * as XLSX from 'xlsx';
import type { SalesRecord, DailySales, ProductSales, CompanySales } from '../types';
import { type CompanyMapper } from './companyMapper';

interface DataManifest {
  generated: string;
  files: {
    path: string;
    type: 'PS' | 'FS';
    date: string;
    filename: string;
  }[];
}

export async function loadAllDataFromManifest(): Promise<DailySales[]> {
  try {
    const response = await fetch('/data-manifest.json');
    const manifest: DataManifest = await response.json();

    console.log(`📊 Loading ${manifest.files.length} data files from manifest...`);

    const allData: DailySales[] = [];

    // Load all files in parallel
    const promises = manifest.files.map(fileInfo =>
      loadXLSFile(fileInfo.path, fileInfo.type, fileInfo.date)
    );

    const results = await Promise.all(promises);

    results.forEach((data, index) => {
      if (data) {
        allData.push(data);
        console.log(`✅ Loaded: ${manifest.files[index].filename}`);
      } else {
        console.warn(`❌ Failed to load: ${manifest.files[index].filename}`);
      }
    });

    console.log(`🎉 Successfully loaded ${allData.length} files`);
    return allData;

  } catch (error) {
    console.error('Error loading data manifest:', error);
    return [];
  }
}

export async function loadXLSFile(filePath: string, type: 'PS' | 'FS', date: string): Promise<DailySales | null> {
  try {
    const response = await fetch(filePath);
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any>(firstSheet);

    const records: SalesRecord[] = data.map((row: any) => ({
      HSNCODE: row.HSNCODE?.toString() || '',
      ITNAME: row.ITNAME || '',
      QTY: Number(row.QTY) || 0,
      TAXBLEAMT: Number(row.TAXBLEAMT) || 0,
      GST: Number(row.GST) || 0,
    }));

    const totalAmount = records.reduce((sum, r) => sum + r.TAXBLEAMT, 0);
    const totalQuantity = records.reduce((sum, r) => sum + r.QTY, 0);

    return {
      date,
      type,
      records,
      totalAmount,
      totalQuantity,
    };
  } catch (error) {
    console.error(`Error loading file ${filePath}:`, error);
    return null;
  }
}

export function aggregateByProduct(salesData: DailySales[]): ProductSales[] {
  const productMap = new Map<string, { qty: number; amount: number }>();

  salesData.forEach(daily => {
    daily.records.forEach(record => {
      const existing = productMap.get(record.ITNAME) || { qty: 0, amount: 0 };
      productMap.set(record.ITNAME, {
        qty: existing.qty + record.QTY,
        amount: existing.amount + record.TAXBLEAMT,
      });
    });
  });

  return Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      totalQty: data.qty,
      totalAmount: data.amount,
      avgPrice: data.amount / data.qty,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function aggregateByDate(salesData: DailySales[]) {
  return salesData.map(daily => ({
    date: daily.date,
    type: daily.type,
    amount: daily.totalAmount,
    quantity: daily.totalQuantity,
  })).sort((a, b) => a.date.localeCompare(b.date));
}

export function getTopProducts(salesData: DailySales[], limit: number = 10): ProductSales[] {
  return aggregateByProduct(salesData).slice(0, limit);
}

export function getTotalSales(salesData: DailySales[]) {
  return salesData.reduce((sum, daily) => sum + daily.totalAmount, 0);
}

export function getTotalQuantity(salesData: DailySales[]) {
  return salesData.reduce((sum, daily) => sum + daily.totalQuantity, 0);
}

// Company-related functions
export function enrichWithCompanyData(salesData: DailySales[], companyMapper: CompanyMapper): void {
  salesData.forEach(daily => {
    daily.records.forEach(record => {
      const company = companyMapper.getCompanyForProduct(record.ITNAME);
      if (company) {
        record.company = company;
      }
    });
  });
}

export function aggregateByCompany(salesData: DailySales[]): CompanySales[] {
  const companyMap = new Map<string, { amount: number; qty: number; products: Map<string, { qty: number; amount: number }> }>();

  salesData.forEach(daily => {
    daily.records.forEach(record => {
      const company = record.company || 'Unknown';

      if (!companyMap.has(company)) {
        companyMap.set(company, { amount: 0, qty: 0, products: new Map() });
      }

      const companyData = companyMap.get(company)!;
      companyData.amount += record.TAXBLEAMT;
      companyData.qty += record.QTY;

      const productData = companyData.products.get(record.ITNAME) || { qty: 0, amount: 0 };
      productData.qty += record.QTY;
      productData.amount += record.TAXBLEAMT;
      companyData.products.set(record.ITNAME, productData);
    });
  });

  return Array.from(companyMap.entries())
    .map(([companyName, data]) => {
      const products: ProductSales[] = Array.from(data.products.entries()).map(([productName, productData]) => ({
        productName,
        totalQty: productData.qty,
        totalAmount: productData.amount,
        avgPrice: productData.amount / productData.qty,
        company: companyName,
      }));

      return {
        companyName,
        totalAmount: data.amount,
        totalQuantity: data.qty,
        productCount: data.products.size,
        products: products.sort((a, b) => b.totalAmount - a.totalAmount),
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function getTopCompanies(salesData: DailySales[], limit: number = 10): CompanySales[] {
  return aggregateByCompany(salesData).slice(0, limit);
}

export function aggregateByProductWithCompany(salesData: DailySales[]): ProductSales[] {
  const productMap = new Map<string, { qty: number; amount: number; company?: string }>();

  salesData.forEach(daily => {
    daily.records.forEach(record => {
      const existing = productMap.get(record.ITNAME) || { qty: 0, amount: 0, company: record.company };
      productMap.set(record.ITNAME, {
        qty: existing.qty + record.QTY,
        amount: existing.amount + record.TAXBLEAMT,
        company: record.company || existing.company,
      });
    });
  });

  return Array.from(productMap.entries())
    .map(([productName, data]) => ({
      productName,
      totalQty: data.qty,
      totalAmount: data.amount,
      avgPrice: data.amount / data.qty,
      company: data.company,
    }))
    .sort((a, b) => b.totalAmount - a.totalAmount);
}
