import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.company.findFirst({
    where: { name: { equals: 'Paired', mode: 'insensitive' } },
  });
  if (!c) { console.log('Paired not found'); return; }
  await prisma.company.update({
    where: { id: c.id },
    data: { logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQqqrmqt3Dv-b2whxlyRwmZajFizusqSpXMJQ&s', logoFetched: true },
  });
  console.log('Updated Paired logo to 180px version');
}

main().finally(() => prisma.$disconnect());
