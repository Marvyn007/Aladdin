import { prisma } from './src/lib/prisma';

async function main() {
  const recentLogs = await prisma.sourcePollLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  console.log("Recent Poll Logs:", recentLogs);

  const pendingTasks = await prisma.jobQueue.count({
    where: { status: 'pending' }
  });
  console.log("Pending Tasks:", pendingTasks);

  const failedTasks = await prisma.jobQueue.findMany({
    where: { status: 'failed' },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });
  console.log("Failed Tasks:", failedTasks);
  
  const processingTasks = await prisma.jobQueue.count({
    where: { status: 'processing' }
  });
  console.log("Processing Tasks:", processingTasks);

  const totalJobs = await prisma.job.count();
  console.log("Total Jobs:", totalJobs);
}
main().catch(console.error).finally(() => prisma.$disconnect());
