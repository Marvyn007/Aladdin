import { prisma } from './src/lib/prisma';

async function main() {
  const pendingCount = await prisma.jobQueue.count({ where: { status: 'pending' } });
  const processingCount = await prisma.jobQueue.count({ where: { status: 'processing' } });
  const completedCount = await prisma.jobQueue.count({ where: { status: 'completed' } });
  const failedCount = await prisma.jobQueue.count({ where: { status: 'failed' } });
  const deadCount = await prisma.jobQueue.count({ where: { status: 'dead' } });
  
  console.log("Queue Stats:");
  console.log("- Pending:", pendingCount);
  console.log("- Processing:", processingCount);
  console.log("- Completed:", completedCount);
  console.log("- Failed:", failedCount);
  console.log("- Dead:", deadCount);

  const totalJobs = await prisma.job.count();
  console.log("\nTotal Jobs in database:", totalJobs);

  const recentPollLogs = await prisma.sourcePollLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log("\nRecent Poll Logs (last 20):");
  recentPollLogs.forEach(log => {
    console.log(`[${log.createdAt.toISOString()}] ${log.source} (${log.slug}): fetched=${log.jobsFetched}, new=${log.newJobs}, dup=${log.duplicates}, stale=${log.stale}, error=${log.error}`);
  });

  const sampleJobs = await prisma.job.findMany({
    select: { jobDescriptionPlain: true },
    take: 5,
    where: { jobDescriptionPlain: { not: null } }
  });
  console.log("\nSample Job Description Lengths:");
  sampleJobs.forEach((j, i) => console.log(`Job ${i+1}: ${j.jobDescriptionPlain?.length || 0} chars`));
}
main().catch(console.error).finally(() => prisma.$disconnect());
