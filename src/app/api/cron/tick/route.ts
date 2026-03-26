import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQueue, EXECUTION_BUDGET_MS, BURST_THRESHOLD, BURST_MAX_WORKERS } from '@/lib/queue'
import { buildEnqueuePlan } from '@/lib/job-sources/scheduler'
import { processTaskBatch } from '@/lib/job-sources/worker'
import { createWorkerDb, createDiscoveryDb } from '@/lib/job-sources/worker-db'
import type { SourceName } from '@/lib/queue/types'
import type { DiscoveryTier } from '@/lib/job-sources/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // ── Auth ──
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const queue = getQueue()
  const db = createWorkerDb(prisma)

  try {
    // ── Phase 0: Recover stale locks ──
    const recovered = await queue.recoverStaleLocks()
    if (recovered > 0) {
      console.log(`[tick] Recovered ${recovered} stale locks`)
    }

    // ── Phase 1: Enqueue tasks ──
    const stats = await queue.getStats()

    // Get all active tracked companies
    const companies = await prisma.trackedCompany.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        ats: true,
        isActive: true,
        lastPolledAt: true,
      },
    })

    // Get last poll times for bulk sources from SourcePollLog
    const bulkSources: SourceName[] = ['themuse', 'arbeitnow', 'himalayas']
    const bulkLastPolled: Partial<Record<string, Date | null>> = {}
    for (const source of bulkSources) {
      const lastLog = await prisma.sourcePollLog.findFirst({
        where: { source, error: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      bulkLastPolled[source] = lastLog?.createdAt ?? null
    }

    // Get last discovery time per tier
    const tiers: DiscoveryTier[] = [1, 2, 3]
    const lastDiscoveryByTier: Partial<Record<DiscoveryTier, Date | null>> = {}
    for (const tier of tiers) {
      const log = await prisma.sourcePollLog.findFirst({
        where: { source: 'discovery', slug: `tier:${tier}`, error: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      lastDiscoveryByTier[tier] = log?.createdAt ?? null
    }

    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled,
      lastDiscoveryByTier,
      pendingCount: stats.pending,
      now: new Date(),
    })

    if (plan.length > 0) {
      await queue.enqueueBatch(plan)
    }

    // ── Phase 2: Process tasks (up to 1, sequentially) ──
    const tasks = await queue.dequeue(1)
    const results = await processTaskBatch(tasks, queue, db, startTime, () => createDiscoveryDb(prisma))

    // ── Phase 3: Burst mode ──
    let burstFired = 0
    const currentStats = await queue.getStats()

    if (currentStats.pending > BURST_THRESHOLD) {
      const baseUrl = getBaseUrl(request)
      const secret = process.env.CRON_SECRET || ''

      burstFired = Math.min(BURST_MAX_WORKERS, Math.ceil((currentStats.pending - BURST_THRESHOLD) / 3))

      for (let i = 0; i < burstFired; i++) {
        // Fire-and-forget: don't await
        fetch(`${baseUrl}/api/worker/process`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
        }).catch((err) => {
          console.error(`[tick] Burst worker ${i} failed to fire:`, err.message)
        })
      }
    }

    const elapsed = Date.now() - startTime

    return NextResponse.json({
      ok: true,
      elapsed,
      recovered,
      enqueued: plan.length,
      processed: results.length,
      burstFired,
      pending: currentStats.pending,
      results: results.map((r) => ({
        taskId: r.taskId,
        source: r.source,
        slug: r.slug,
        newJobs: r.newJobs,
        error: r.error,
      })),
    })
  } catch (err) {
    console.error('[tick] Scheduler error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET || ''
  const authHeader = request.headers.get('authorization')

  console.log("[DEBUG v2] env.CRON_SECRET:", process.env.CRON_SECRET)
  console.log("[DEBUG v2] EXPECTED (fallback applied):", secret)
  console.log("[DEBUG v2] RECEIVED:", authHeader)

  if (!secret) return false

  if (authHeader === `Bearer ${secret}`) return true

  const { searchParams } = new URL(request.url)
  if (searchParams.get('key') === secret) return true

  return false
}

function getBaseUrl(request: Request): string {
  const url = new URL(request.url)
  return `${url.protocol}//${url.host}`
}
