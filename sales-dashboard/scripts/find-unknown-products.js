import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Company product mappings
const COMPANIES = [
  'Syngenta', 'Coramandel', 'Adama', 'Rallis', 'Godrej', 'T_Stanes',
  'Balaji', 'Nichino', 'Gharda', 'VNR', 'BestAgrolife', 'Swal',
  'Superior', 'Sudharsan', 'Sairam', 'Indofil', 'Dhanuka', 'Chennakesava',
  'Anjaneya', 'PI', 'Fact', 'PPL', 'NovaAgriScience', 'Nova_Agri_Tech',
  'LVS', 'Vasudha', 'Srikar'
];

function loadCompanyProducts() {
  const productToCompany = new Map();
  const companyDataDir = path.join(__dirname, '../public/Data/Company Wise Products');

  COMPANIES.forEach(company => {
    const csvPath = path.join(companyDataDir, `${company}_Products.csv`);
    const altCsvPath = path.join(companyDataDir, `${company}Product_Names.csv`);

    let filePath = csvPath;
    if (!fs.existsSync(csvPath)) {
      filePath = altCsvPath;
    }

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Skip header and process products
      for (let i = 1; i < lines.length; i++) {
        const productName = lines[i].trim();
        if (productName && productName !== '') {
          const normalized = productName.toLowerCase().trim();
          productToCompany.set(normalized, company);
        }
      }
    }
  });

  return productToCompany;
}

function findUnknownProducts() {
  console.log('🔍 Analyzing products to find unmatched items...\n');

  // Load company mappings
  const productToCompany = loadCompanyProducts();
  console.log(`📦 Loaded ${productToCompany.size} product mappings from ${COMPANIES.length} companies\n`);

  // Load manifest
  const manifestPath = path.join(__dirname, '../public/data-manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

  // Track all unique products
  const allProducts = new Set();
  const unknownProducts = new Map(); // product -> count

  // Process each file
  manifest.files.forEach(fileInfo => {
    const filePath = path.join(__dirname, '../public', fileInfo.path);

    if (fs.existsSync(filePath)) {
      try {
        const workbook = XLSX.readFile(filePath);
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);

        data.forEach(row => {
          if (row.ITNAME) {
            const productName = row.ITNAME.trim();
            const normalized = productName.toLowerCase().trim();

            allProducts.add(productName);

            // Check if product has a company mapping
            if (!productToCompany.has(normalized)) {
              const count = unknownProducts.get(productName) || 0;
              unknownProducts.set(productName, count + 1);
            }
          }
        });
      } catch (error) {
        console.error(`Error reading ${filePath}:`, error.message);
      }
    }
  });

  // Sort unknown products by frequency
  const sortedUnknown = Array.from(unknownProducts.entries())
    .sort((a, b) => b[1] - a[1]);

  // Output results
  console.log(`📊 RESULTS:`);
  console.log(`   Total unique products in sales data: ${allProducts.size}`);
  console.log(`   Products matched to companies: ${allProducts.size - unknownProducts.size}`);
  console.log(`   Products with UNKNOWN company: ${unknownProducts.size}`);
  console.log(`\n${'='.repeat(80)}\n`);

  if (sortedUnknown.length > 0) {
    console.log('❌ PRODUCTS NOT MATCHED TO ANY COMPANY:\n');
    console.log('Product Name'.padEnd(60) + 'Occurrences');
    console.log('-'.repeat(80));

    sortedUnknown.forEach(([product, count]) => {
      console.log(product.padEnd(60) + count);
    });

    console.log(`\n${'='.repeat(80)}\n`);

    // Save to file
    const outputPath = path.join(__dirname, '../unknown-products.txt');
    const outputLines = [
      'UNKNOWN PRODUCTS REPORT',
      `Generated: ${new Date().toISOString()}`,
      '',
      `Total unique products: ${allProducts.size}`,
      `Products matched: ${allProducts.size - unknownProducts.size}`,
      `Products unknown: ${unknownProducts.size}`,
      '',
      '='.repeat(80),
      '',
      'PRODUCT LIST (sorted by frequency):',
      '',
      ...sortedUnknown.map(([product, count]) => `${count.toString().padStart(4)} | ${product}`)
    ];

    fs.writeFileSync(outputPath, outputLines.join('\n'));
    console.log(`💾 Report saved to: ${outputPath}\n`);
  } else {
    console.log('✅ All products are matched to companies!\n');
  }
}

findUnknownProducts();
