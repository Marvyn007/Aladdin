const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.trackedCompany.count();
  console.log('Tracked Companies count:', count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
