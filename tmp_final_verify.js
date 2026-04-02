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
  
  const companyDomainOverrides = {
    // Tech Giants
    'google': 'google.com',
    'amazon': 'amazon.com',
    'meta': 'meta.com',
    'facebook': 'facebook.com',
    'apple': 'apple.com',
    'microsoft': 'microsoft.com',
    'netflix': 'netflix.com',
    'linkedin': 'linkedin.com',
    'uber-eats': 'ubereats.com',
    'uber': 'uber.com',
    'tiktok': 'tiktok.com',
    'bytedance': 'bytedance.com',
    'salesforce': 'salesforce.com',
    'oracle': 'oracle.com',
    'intel': 'intel.com',
    'nvidia': 'nvidia.com',
    'adobe': 'adobe.com',
    'atlassian': 'atlassian.com',
    'slack': 'slack.com',
    'zoom': 'zoom.us',
    'stripe': 'stripe.com',
    'airbnb': 'airbnb.com',
    'palantir': 'palantir.com',
    'snowflake': 'snowflake.com',
    'databricks': 'databricks.com',
    
    // Finance
    'goldman sachs': 'goldmansachs.com',
    'jpmorgan': 'jpmorganchase.com',
    'jpmorgan chase': 'jpmorganchase.com',
    'morgan stanley': 'morganstanley.com',
    'american express': 'americanexpress.com',
    'visa': 'visa.com',
    'mastercard': 'mastercard.com',
    'paypal': 'paypal.com',
    'robinhood': 'robinhood.com',
    'coinbase': 'coinbase.com',
    
    // Retail & Others
    'walmart': 'walmart.com',
    'target': 'target.com',
    'tesla': 'tesla.com',
    'spacex': 'spacex.com',
    'bloomberg': 'bloomberg.com',
    'realtor.com': 'realtor.com',
    'zillow': 'zillow.com'
  };

  const results = companies.map(c => {
    const rawName = c.name.trim().toLowerCase();
    const LOGO_DEV_TOKEN = 'pk_By0CIs75Tsy8K9CqV4sT7w';

    let generatedUrl = c.logoUrl;
    if (!generatedUrl || generatedUrl.includes('img.logo.dev')) {
        if (companyDomainOverrides[rawName]) {
            generatedUrl = `https://img.logo.dev/${companyDomainOverrides[rawName]}?token=${LOGO_DEV_TOKEN}&size=256`;
        } else {
            let cleanName = rawName
                .replace(/\b(llc|inc|corp|ltd|corporation|technologies|laboratories|group|solutions|services|international|limited|pvt)\b/g, '')
                .trim();
            cleanName = cleanName.replace(/[^a-z0-9]/g, '');
            const domain = c.domain || `${cleanName}.com`;
            generatedUrl = `https://img.logo.dev/${domain}?token=${LOGO_DEV_TOKEN}&size=256`;
        }
    }

    logoCounts[generatedUrl] = (logoCounts[generatedUrl] || 0) + 1;
    if (!logoToCompanies[generatedUrl]) logoToCompanies[generatedUrl] = [];
    logoToCompanies[generatedUrl].push(c.name);

    return {
      name: c.name,
      finalLogo: generatedUrl
    };
  });

  console.log("\n=== Duplicate Logos Detected (Duplicates > 2) ===");
  Object.entries(logoCounts).forEach(([url, count]) => {
    if (count > 2) {
      console.log(`${count} companies share: ${url}`);
      console.log(`  Names: ${logoToCompanies[url].slice(0, 5).join(', ')}${logoToCompanies[url].length > 5 ? '...' : ''}`);
    }
  });

  console.log("\n=== Checking Key Companies ===");
  const interest = ['Google', 'Amazon', 'Meta', 'Netflix', 'Abbott Laboratories', 'Goldman Sachs', 'Uber'];
  interest.forEach(name => {
      const match = results.find(r => r.name.toLowerCase() === name.toLowerCase());
      if (match) {
          console.log(`${name} -> ${match.finalLogo}`);
      } else {
          console.log(`${name} -> NOT FOUND`);
      }
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
