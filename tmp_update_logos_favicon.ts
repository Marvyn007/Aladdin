import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Starting Logo Update to Google Favicon API ---');
  
  const companies = await prisma.company.findMany();
  console.log(`Found ${companies.length} companies to update.`);

  let updatedCount = 0;
  for (const company of companies) {
    if (company.domain) {
      const newLogoUrl = `https://www.google.com/s2/favicons?sz=128&domain=${company.domain}`;
      
      await prisma.company.update({
        where: { id: company.id },
        data: { logoUrl: newLogoUrl }
      });
      updatedCount++;
    }
  }

  console.log(`Successfully updated ${updatedCount} companies.`);
  console.log('--- Logo Update Complete ---');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
