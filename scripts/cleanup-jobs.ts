import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting database cleanup...');

  try {
    // Delete in order of dependency
    console.log('- Cleaning job_scores...');
    await prisma.jobScore.deleteMany({});

    console.log('- Cleaning user_jobs...');
    await prisma.userJob.deleteMany({});

    console.log('- Cleaning source_poll_logs...');
    await prisma.sourcePollLog.deleteMany({});

    console.log('- Cleaning jobs...');
    // We use deleteMany to avoid foreign key issues if any remain
    await prisma.job.deleteMany({});

    console.log('✅ Database cleanup complete. All old jobs removed.');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
