const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get companies with interview experiences
  const companies = await prisma.company.findMany({
    where: {
      interviewExperiences: {
        some: {}
      }
    },
    select: {
      name: true,
      logoUrl: true,
      domain: true
    }
  });

  console.log("=== Interview Companies Logo Audit ===");
  const logoCounts = {};
  const data = companies.map(c => {
    const slug = c.name.trim().toLowerCase();
    const cleanName = slug.replace(/[^a-z0-9]/g, '');
    const domain = c.domain || `${cleanName}.com`;
    // Simulate the frontend logic
    const generatedUrl = c.logoUrl || `https://img.logo.dev/${domain}?token=pk_By0CIs75Tsy8K9CqV4sT7w&size=128`;
    
    logoCounts[generatedUrl] = (logoCounts[generatedUrl] || 0) + 1;
    
    return {
      name: c.name,
      logoInDb: c.logoUrl,
      domainInDb: c.domain,
      generatedUrl: generatedUrl
    };
  });

  data.forEach(item => {
    if (logoCounts[item.generatedUrl] > 1) {
      item.issue = "DUPLICATE";
    }
    // Check specific known ones
    if (item.name.toLowerCase().includes('google')) {
        item.issue = item.issue ? item.issue + ", CHECK_GOOGLE" : "CHECK_GOOGLE";
    }
  });

  console.log(JSON.stringify(data, null, 2));
  
  const duplicates = Object.entries(logoCounts).filter(([url, count]) => count > 1);
  if (duplicates.length > 0) {
      console.log("\n=== Duplicate Found ===");
      duplicates.forEach(([url, count]) => {
          const names = data.filter(d => d.generatedUrl === url).map(d => d.name);
          console.log(`${count} companies share: ${url} -> [${names.join(', ')}]`);
      });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
