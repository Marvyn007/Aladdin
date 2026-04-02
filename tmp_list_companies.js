const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const companies = await prisma.company.findMany({
    take: 50,
    select: {
      name: true,
      logoUrl: true,
      domain: true
    }
  });
  console.log(JSON.stringify(companies, null, 2));
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
