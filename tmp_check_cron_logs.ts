import { prisma } from './src/lib/prisma';

async function main() {
  const recentLogs = await prisma.sourcePollLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log("Recent Poll Logs:", recentLogs);

  const pendingTasks = await prisma.queueTask.count({
    where: { status: 'PENDING' }
  });
  console.log("Pending Tasks:", pendingTasks);

  const failedTasks = await prisma.queueTask.findMany({
    where: { status: 'FAILED' },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });
  console.log("Failed Tasks:", failedTasks);
  
  const totalJobs = await prisma.job.count();
  console.log("Total Jobs:", totalJobs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
