import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient();
  try {
    console.log('--- Enabling pgvector and pg_trgm extensions ---');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    console.log('Success: Extensions enabled.');
  } catch (error) {
    console.error('Error enabling vector extension:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
