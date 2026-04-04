import { PrismaClient } from '@prisma/client';
import { getQueue } from './src/lib/queue';
import { processTaskBatch } from './src/lib/job-sources/worker';
import { createWorkerDb, createDiscoveryDb } from './src/lib/job-sources/worker-db';

const prisma = new PrismaClient();

async function run() {
  const queue = getQueue();
  const db = createWorkerDb(prisma);
  
  console.log("Dequeuing 1 task...");
  const tasks = await queue.dequeue(1);
  console.log(`Dequeued ${tasks.length} tasks.`);
  
  if (tasks.length > 0) {
    console.log("Processing task...");
    const results = await processTaskBatch(tasks, queue, db, Date.now(), () => createDiscoveryDb(prisma));
    console.log("Results:");
    console.dir(results, { depth: null });
  } else {
    // If no tasks, we'll enqueue one to test.
    console.log("No tasks. We will check why they aren't dequeuing!");
    const pending = await prisma.jobQueue.count({ where: { status: 'pending' } });
    console.log(`Pending in db: ${pending}`);
    
    // Check if runAt is in the future
    const nextTask = await prisma.jobQueue.findFirst({
        where: { status: 'pending' },
        orderBy: { runAt: 'asc' }
    });
    console.log("Next pending task:", nextTask);
  }
}

run().catch(console.error).finally(() => prisma.$disconnect());
