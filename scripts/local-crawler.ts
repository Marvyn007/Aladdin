import { PrismaClient } from '@prisma/client';
import { getQueue } from '../src/lib/queue';
import { processTaskBatch } from '../src/lib/job-sources/worker';
import { createWorkerDb, createDiscoveryDb } from '../src/lib/job-sources/worker-db';
import { buildEnqueuePlan } from '../src/lib/job-sources/scheduler';

const prisma = new PrismaClient();

async function runTick() {
  const queue = getQueue();
  const db = createWorkerDb(prisma);
  
  console.log(`\n[${new Date().toISOString()}] 🕐 Triggering local crawler tick...`);

  try {
    // 1. Recover stale tasks
    const recovered = await queue.recoverStaleLocks();
    if (recovered > 0) {
      console.log(`Recovered ${recovered} stale tasks`);
    }

    // 2. Scheduler: Enqueue new tasks if needed
    const stats = await queue.getStats();
    
    const companies = await prisma.trackedCompany.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, ats: true, isActive: true, lastPolledAt: true, lastNonEmptyAt: true },
    });

    const bulkSources: any[] = ['themuse', 'arbeitnow', 'himalayas'];
    const bulkLastPolled: any = {};
    for (const source of bulkSources) {
      const lastLog = await prisma.sourcePollLog.findFirst({
        where: { source, error: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      bulkLastPolled[source] = lastLog?.createdAt ?? null;
    }

    const lastDiscoveryByTier: any = {};
    for (const tier of [1, 2, 3]) {
      const log = await prisma.sourcePollLog.findFirst({
        where: { source: 'discovery', slug: `tier:${tier}`, error: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });
      lastDiscoveryByTier[tier as any] = log?.createdAt ?? null;
    }

    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled,
      lastDiscoveryByTier,
      pendingCount: stats.pending,
      now: new Date(),
    });

    if (plan.length > 0) {
      console.log(`Enqueuing ${plan.length} new tasks...`);
      await queue.enqueueBatch(plan);
    }

    // 3. Process existing queue (Drain up to 10 tasks in parallel = 10 companies)
    let totalProcessed = 0;
    while (true) {
        const tasks = await queue.dequeue(5);
        if (tasks.length === 0) break;
        
        console.log(`Processing batch of ${tasks.length} tasks...`);
        const results = await processTaskBatch(tasks, queue, db, Date.now(), () => createDiscoveryDb(prisma));
        totalProcessed += results.length;
        
        const newJobs = results.reduce((acc, r) => acc + (r.newJobs || 0), 0);
        console.log(`Batch finished. New jobs added: ${newJobs}`);
    }
    
    console.log(`✅ Tick finished. Total processed: ${totalProcessed}. Pending in queue: ${(await queue.getStats()).pending}`);
  } catch (e) {
    console.error("❌ Crawler tick failed:", e);
  }
}

// Run immediately, then every 10 minutes
runTick().then(() => {
    console.log("\n⏳ Waiting 10 minutes for next tick...");
    setInterval(() => {
        runTick();
    }, 10 * 60 * 1000);
});
