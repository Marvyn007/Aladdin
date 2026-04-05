import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('🔍 Diagnosing Job Crawler Status...\n');

  try {
    // 1. Queue Stats
    const statusCounts = await prisma.jobQueue.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    console.log('📊 Queue Status Counts:');
    statusCounts.forEach((c) => {
      console.log(`  - ${c.status}: ${c._count._all}`);
    });

    const totalQueue = statusCounts.reduce((acc, c) => acc + c._count._all, 0);
    console.log(`  TOTAL: ${totalQueue}\n`);

    // 2. Worker Activity (Processing jobs)
    const processingJobs = await prisma.jobQueue.findMany({
      where: { status: 'processing' },
      orderBy: { lockedAt: 'desc' },
      take: 20,
    });

    console.log('👷 Active Worker Check (Processing Jobs):');
    if (processingJobs.length === 0) {
      console.log('  ❌ No jobs currently marked as "processing".');
    } else {
      console.log(`  ✅ ${processingJobs.length} jobs currently being processed.`);
      processingJobs.slice(0, 5).forEach((j) => {
        console.log(`  - Job ${j.id} (${j.source || j.type}) locked at: ${j.lockedAt?.toISOString()}`);
      });
    }
    console.log('');

    // 3. Recent Completions (Last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const completedCount = await prisma.jobQueue.count({
      where: {
        status: 'completed',
        completedAt: { gte: oneHourAgo },
      },
    });

    console.log(`✅ Jobs completed in the last hour: ${completedCount}`);

    // 4. Recent Errors
    const recentErrors = await prisma.jobQueue.findMany({
      where: {
        status: { in: ['failed', 'dead'] },
        updatedAt: { gte: oneHourAgo },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    if (recentErrors.length > 0) {
      console.log('\n❌ Recent Errors in Queue:');
      recentErrors.forEach((e) => {
        console.log(`  - [${e.updatedAt.toISOString()}] ${e.source || e.type}: ${e.lastError?.substring(0, 100)}...`);
      });
    } else {
      console.log('\n✅ No errors in the last hour.');
    }

    // 5. Source Poll Logs (Actual crawler output)
    const recentPolls = await prisma.sourcePollLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log('\n📡 Recent Crawler Poll Results (source_poll_logs):');
    if (recentPolls.length === 0) {
      console.log('  ❌ No poll logs found.');
    } else {
      recentPolls.forEach((p) => {
        const status = p.error ? `❌ ERROR: ${p.error.substring(0, 50)}` : `✅ Added: ${p.newJobs}, Fetched: ${p.jobsFetched}, Dups: ${p.duplicates}`;
        console.log(`  - [${p.createdAt.toISOString()}] ${p.source}${p.slug ? ` (${p.slug})` : ''}: ${status}`);
      });
    }

    // 6. Check for "Thousand queued jobs"
    const pendingCount = await prisma.jobQueue.count({ where: { status: 'pending' } });
    if (pendingCount > 900) {
      console.log(`\n⚠️  BACKLOG DETECTED: There are ${pendingCount} pending jobs in the queue.`);
    }

  } catch (err) {
    console.error('Failed to diagnose:', err);
  } finally {
    await prisma.$disconnect();
  }
}

diagnose();
