const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    select: {
      name: true,
      logoUrl: true,
      domain: true
    }
  });

  console.log(`=== Audit for ${companies.length} Companies ===`);
  const logoCounts = {};
  const logoToCompanies = {};
  
  const results = companies.map(c => {
    const slug = c.name.trim().toLowerCase();
    
    // Simulate the frontend override logic from the previous turn
    const companyDomainOverrides = {
        'google': 'google.com',
        'amazon': 'amazon.com',
        'meta': 'meta.com',
        'facebook': 'facebook.com',
        'uber-eats': 'ubereats.com',
        'uber': 'uber.com',
        'apple': 'apple.com',
        'microsoft': 'microsoft.com',
        'netflix': 'netflix.com',
        'linkedin': 'linkedin.com',
        'bloomberg': 'bloomberg.com',
        'tiktok': 'tiktok.com',
        'bytedance': 'bytedance.com',
        'goldman sachs': 'goldmansachs.com',
        'jpmorgan': 'jpmorganchase.com',
        'jpmorgan chase': 'jpmorganchase.com'
    };

    let generatedUrl = c.logoUrl;
    if (!generatedUrl) {
        if (companyDomainOverrides[slug]) {
            generatedUrl = `https://img.logo.dev/${companyDomainOverrides[slug]}?token=pk_By0CIs75Tsy8K9CqV4sT7w&size=128`;
        } else {
            const cleanName = slug.replace(/[^a-z0-9]/g, '');
            const domain = c.domain || `${cleanName}.com`;
            generatedUrl = `https://img.logo.dev/${domain}?token=pk_By0CIs75Tsy8K9CqV4sT7w&size=128`;
        }
    }

    logoCounts[generatedUrl] = (logoCounts[generatedUrl] || 0) + 1;
    if (!logoToCompanies[generatedUrl]) logoToCompanies[generatedUrl] = [];
    logoToCompanies[generatedUrl].push(c.name);

    return {
      name: c.name,
      dbLogo: c.logoUrl,
      dbDomain: c.domain,
      finalLogo: generatedUrl
    };
  });

  console.log("\n=== Duplicate Logos Detected ===");
  Object.entries(logoCounts).forEach(([url, count]) => {
    if (count > 1) {
      console.log(`${count} companies share: ${url}`);
      console.log(`  Names: ${logoToCompanies[url].join(', ')}`);
    }
  });

  console.log("\n=== Checking Specific Companies ===");
  const interest = ['google', 'amazon', 'meta', 'apple', 'microsoft', 'netflix', 'uber', 'goldman', 'jpmorgan'];
  results.filter(r => interest.some(i => r.name.toLowerCase().includes(i))).forEach(r => {
    console.log(JSON.stringify(r, null, 2));
  });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
