import { prisma } from './src/lib/prisma';

async function main() {
  const pendingTasks = await prisma.jobQueue.findMany({
    where: { status: 'pending' },
    orderBy: { runAt: 'asc' },
    take: 5
  });
  console.log("Top 5 Pending Tasks:");
  pendingTasks.forEach(t => console.log(`ID: ${t.id}, runAt: ${t.runAt}, attempts: ${t.attempts}`));

  const recentlyFailedTasks = await prisma.jobQueue.findMany({
    where: { status: 'failed' },
    orderBy: { updatedAt: 'desc' },
    take: 5
  });
  console.log("\nRecently Failed Tasks:");
  recentlyFailedTasks.forEach(t => console.log(`ID: ${t.id}, lastError: ${t.lastError}`));

  console.log("\nCurrent time:", new Date());
}
main().catch(console.error).finally(() => prisma.$disconnect());
