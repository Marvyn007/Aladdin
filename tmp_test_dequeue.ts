import { prisma } from './src/lib/prisma';
import { getQueue } from './src/lib/queue';

async function main() {
  const queue = getQueue();
  
  console.log("Attempting to dequeue 2 tasks...");
  const tasks = await queue.dequeue(2);
  
  console.log("Dequeued tasks:", tasks);
  
  // Return them so we don't hold them in 'processing' state forever
  // wait actually, let's just leave them or mark them failed with a test error
  for (const t of tasks) {
    await queue.fail(t.id, "Test dequeue - returned to queue");
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
