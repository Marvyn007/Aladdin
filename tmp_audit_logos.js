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
  
  // Clean up company logourls if needed or identify issues
  const logoCounts = {};
  const issues = [];
  
  companies.forEach(c => {
    if (c.logoUrl) {
      logoCounts[c.logoUrl] = (logoCounts[c.logoUrl] || 0) + 1;
    }
  });
  
  Object.keys(logoCounts).forEach(url => {
    if (logoCounts[url] > 1) {
      const duplicates = companies.filter(c => c.logoUrl === url).map(c => c.name);
      issues.push(`Duplicate logo URL for: ${duplicates.join(', ')} - URL: ${url}`);
    }
  });

  console.log("=== All Companies Audit ===");
  console.log(JSON.stringify(companies, null, 2));
  console.log("\n=== Potential Issues ===");
  issues.forEach(i => console.log(i));
  
  // Check for Google specifically
  const google = companies.find(c => c.name.toLowerCase().includes('google'));
  console.log("\n=== Google Audit ===");
  console.log(JSON.stringify(google, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
