// Utility to map products to their companies

export class CompanyMapper {
  private productToCompany: Map<string, string> = new Map();
  private companyProducts: Map<string, Set<string>> = new Map();

  // List of company files (extracted from filename pattern Company_Products.csv)
  private static COMPANIES = [
    'Syngenta', 'Coramandel', 'Adama', 'Rallis', 'Godrej', 'T_Stanes',
    'Balaji', 'Nichino', 'Gharda', 'VNR', 'BestAgrolife', 'Swal',
    'Superior', 'Sudharsan', 'Sairam', 'Indofil', 'Dhanuka', 'Chennakesava',
    'Anjaneya', 'PI', 'Fact', 'PPL', 'NovaAgriScience', 'Nova_Agri_Tech',
    'LVS', 'Vasudha', 'Srikar', 'GSFC', 'Kisan', 'Nfcl'
  ];

  async loadAllCompanyMappings(): Promise<void> {
    const promises = CompanyMapper.COMPANIES.map(company =>
      this.loadCompanyProducts(company)
    );

    await Promise.all(promises);
    console.log(`📦 Loaded ${this.productToCompany.size} product-company mappings from ${CompanyMapper.COMPANIES.length} companies`);
  }

  private async loadCompanyProducts(companyName: string): Promise<void> {
    try {
      // Aggressive cache-busting: timestamp + random number
      const cacheBuster = `?v=${Date.now()}-${Math.random().toString(36).substring(7)}`;

      // Try both possible filename patterns
      let csvPath = `/Data/Company Wise Products/${companyName}_Products.csv${cacheBuster}`;

      const response = await fetch(csvPath, {
        cache: 'no-store', // Force browser to not use cache
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      });

      let text = await response.text();

      // Check if response is actually a CSV (not HTML from Vite's 404 fallback)
      const isHTML = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html');

      if (!response.ok || isHTML) {
        // Try alternate pattern
        csvPath = `/Data/Company Wise Products/${companyName}Product_Names.csv${cacheBuster}`;

        const altResponse = await fetch(csvPath, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });

        text = await altResponse.text();
        const altIsHTML = text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<!doctype') || text.trim().startsWith('<html');

        if (!altResponse.ok || altIsHTML) {
          console.warn(`Could not load products for ${companyName}`);
          return;
        }

        this.parseCSV(text, companyName);
        return;
      }

      this.parseCSV(text, companyName);

    } catch (error) {
      console.warn(`❌ Error loading ${companyName} products:`, error);
    }
  }

  private parseCSV(csvText: string, companyName: string): void {
    const lines = csvText.split('\n');

    // Skip header row and process product names
    for (let i = 1; i < lines.length; i++) {
      const productName = lines[i].trim();
      if (productName && productName !== '') {
        // Normalize product name for better matching
        const normalizedProduct = this.normalizeProductName(productName);

        this.productToCompany.set(normalizedProduct, companyName);

        if (!this.companyProducts.has(companyName)) {
          this.companyProducts.set(companyName, new Set());
        }
        this.companyProducts.get(companyName)!.add(normalizedProduct);
      }
    }
  }

  private normalizeProductName(name: string): string {
    // Normalize for better matching: lowercase, trim spaces
    return name.toLowerCase().trim();
  }

  getCompanyForProduct(productName: string): string | undefined {
    const normalized = this.normalizeProductName(productName);
    return this.productToCompany.get(normalized);
  }

  getProductsForCompany(companyName: string): string[] {
    const products = this.companyProducts.get(companyName);
    return products ? Array.from(products) : [];
  }

  getAllCompanies(): string[] {
    return Array.from(this.companyProducts.keys()).sort();
  }

  getStats(): { totalProducts: number; totalCompanies: number } {
    return {
      totalProducts: this.productToCompany.size,
      totalCompanies: this.companyProducts.size,
    };
  }
}

// Singleton instance
let companyMapperInstance: CompanyMapper | null = null;

export async function getCompanyMapper(): Promise<CompanyMapper> {
  if (!companyMapperInstance) {
    companyMapperInstance = new CompanyMapper();
    await companyMapperInstance.loadAllCompanyMappings();
  }
  return companyMapperInstance;
}
