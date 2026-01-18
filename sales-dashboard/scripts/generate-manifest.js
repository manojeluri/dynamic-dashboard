import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../public/Data/2025-26');

// Month name to number mapping
const monthMap = {
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
  'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
  'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
};

// Determine year based on month for 2025-26 fiscal year
// Oct, Nov, Dec = 2025
// Jan onwards = 2026
function getYearForMonth(monthName) {
  const month = monthName.toLowerCase();
  // Oct, Nov, Dec are in 2025
  if (month === 'oct' || month === 'nov' || month === 'dec') {
    return '2025';
  }
  // Jan onwards is 2026
  return '2026';
}

function scanMonthDirectory(monthFolder, type) {
  const files = [];
  const dirPath = path.join(dataDir, monthFolder, type);

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const entries = fs.readdirSync(dirPath);

  entries.forEach(file => {
    if (file.endsWith('.XLS') || file.endsWith('.xls')) {
      // Extract date from filename (e.g., Dec01.XLS -> 12-01 or Jan15.XLS -> 01-15)
      const match = file.match(/([A-Za-z]+)(\d+)/);
      if (match) {
        const month = match[1];
        const day = match[2].padStart(2, '0');

        const monthNum = monthMap[month.toLowerCase()];
        if (monthNum) {
          const year = getYearForMonth(month);
          const date = `${year}-${monthNum}-${day}`;

          files.push({
            path: `/Data/2025-26/${monthFolder}/${type}/${file}`,
            type: type,
            date: date,
            filename: file,
            month: monthFolder
          });
        }
      }
    }
  });

  return files;
}

function generateManifest() {
  const allFiles = [];
  let totalPS = 0;
  let totalFS = 0;

  // Check if dataDir exists
  if (!fs.existsSync(dataDir)) {
    console.error(`❌ Data directory not found: ${dataDir}`);
    return;
  }

  // Get all month folders (Dec, Jan, Feb, etc.)
  const monthFolders = fs.readdirSync(dataDir).filter(item => {
    const itemPath = path.join(dataDir, item);
    return fs.statSync(itemPath).isDirectory() && !item.startsWith('.');
  });

  console.log(`📅 Found month folders: ${monthFolders.join(', ')}`);

  // Scan each month folder for PS and FS subdirectories
  monthFolders.forEach(monthFolder => {
    const psFiles = scanMonthDirectory(monthFolder, 'PS');
    const fsFiles = scanMonthDirectory(monthFolder, 'FS');

    totalPS += psFiles.length;
    totalFS += fsFiles.length;

    allFiles.push(...psFiles, ...fsFiles);

    console.log(`   ${monthFolder}: ${psFiles.length} PS files, ${fsFiles.length} FS files`);
  });

  // Sort all files by date
  allFiles.sort((a, b) => a.date.localeCompare(b.date));

  const manifest = {
    generated: new Date().toISOString(),
    files: allFiles
  };

  const outputPath = path.join(__dirname, '../public/data-manifest.json');
  fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2));

  console.log('\n✅ Data manifest generated successfully!');
  console.log(`📁 Total: ${totalPS} PS files and ${totalFS} FS files`);
  console.log(`📝 Manifest saved to: ${outputPath}`);
  console.log(`\n📋 Sample entries:`);

  // Show first 5 and last 5 entries
  const sampleCount = Math.min(5, allFiles.length);
  allFiles.slice(0, sampleCount).forEach(file => {
    console.log(`   - ${file.month}/${file.type}: ${file.filename} (${file.date})`);
  });

  if (allFiles.length > 10) {
    console.log('   ...');
    allFiles.slice(-sampleCount).forEach(file => {
      console.log(`   - ${file.month}/${file.type}: ${file.filename} (${file.date})`);
    });
  }
}

generateManifest();
