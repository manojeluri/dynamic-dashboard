const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// Read Nova_Agri_Tech products
function loadNovaAgriTechProducts() {
  const csvPath = path.join(__dirname, '../public/Data/Company Wise Products/Nova_Agri_TechProduct_Names.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  const products = [];

  for (let i = 1; i < lines.length; i++) {
    const product = lines[i].trim();
    if (product) {
      products.push(product.toLowerCase());
    }
  }

  return products;
}

// Load all company products to create mapping
function loadAllCompanyProducts() {
  const companiesDir = path.join(__dirname, '../public/Data/Company Wise Products');
  const productToCompany = new Map();

  const files = fs.readdirSync(companiesDir);

  for (const file of files) {
    if (file.endsWith('.csv')) {
      const companyName = file.replace('_Products.csv', '').replace('Product_Names.csv', '');
      const filePath = path.join(companiesDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 1; i < lines.length; i++) {
        const product = lines[i].trim();
        if (product) {
          productToCompany.set(product.toLowerCase(), companyName);
        }
      }
    }
  }

  return productToCompany;
}

// Scan all XLS files in Dec folder
function scanDecemberData() {
  const decDir = path.join(__dirname, '../public/Data/2025-26/Dec');
  const allProducts = new Set();
  const productCounts = new Map();

  ['PS', 'FS'].forEach(type => {
    const typeDir = path.join(decDir, type);
    const files = fs.readdirSync(typeDir);

    files.forEach(file => {
      if (file.endsWith('.XLS')) {
        const filePath = path.join(typeDir, file);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        data.forEach(row => {
          if (row.ITNAME) {
            const productName = row.ITNAME.trim();
            allProducts.add(productName);
            productCounts.set(productName, (productCounts.get(productName) || 0) + 1);
          }
        });
      }
    });
  });

  return { allProducts, productCounts };
}

// Main analysis
console.log('🔍 Analyzing Nova_Agri_Tech product mapping...\n');

const novaAgriTechProducts = loadNovaAgriTechProducts();
console.log(`📋 Found ${novaAgriTechProducts.length} products in Nova_Agri_TechProduct_Names.csv\n`);

const productToCompany = loadAllCompanyProducts();
console.log(`🏢 Loaded ${productToCompany.size} total product-company mappings\n`);

const { allProducts, productCounts } = scanDecemberData();
console.log(`📊 Found ${allProducts.size} unique products in December sales data\n`);

console.log('=' .repeat(80));
console.log('NOVA_AGRI_TECH PRODUCTS IN SALES DATA:');
console.log('=' .repeat(80));

let foundCount = 0;
let notFoundCount = 0;

novaAgriTechProducts.forEach(product => {
  const found = Array.from(allProducts).some(salesProduct =>
    salesProduct.toLowerCase() === product
  );

  if (found) {
    const exactMatch = Array.from(allProducts).find(p => p.toLowerCase() === product);
    const count = productCounts.get(exactMatch);
    const mappedCompany = productToCompany.get(product);
    console.log(`✅ FOUND: "${exactMatch}" (${count} times) -> Mapped to: ${mappedCompany}`);
    foundCount++;
  } else {
    notFoundCount++;
  }
});

console.log('\n' + '='.repeat(80));
console.log(`SUMMARY:`);
console.log(`  Nova_Agri_Tech products FOUND in sales data: ${foundCount}`);
console.log(`  Nova_Agri_Tech products NOT in sales data: ${notFoundCount}`);
console.log('=' .repeat(80));

// Check for Nova products that might be miscategorized
console.log('\n' + '='.repeat(80));
console.log('ALL "NOVA" PRODUCTS IN SALES DATA:');
console.log('=' .repeat(80));

const novaProducts = Array.from(allProducts)
  .filter(p => p.toLowerCase().includes('nova'))
  .sort();

novaProducts.forEach(product => {
  const count = productCounts.get(product);
  const mappedCompany = productToCompany.get(product.toLowerCase());
  console.log(`  ${product.padEnd(50)} (${count.toString().padStart(3)} times) -> ${mappedCompany || 'UNKNOWN'}`);
});

console.log('\n');
