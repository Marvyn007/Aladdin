import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getQueue } from '@/lib/queue'
import { processTaskBatch } from '@/lib/job-sources/worker'
import { createWorkerDb } from '@/lib/job-sources/worker-db'

export const dynamic = 'force-dynamic'

/**
 * Stateless worker endpoint.
 * Dequeues up to 5 tasks (each poll-batch = 5 companies in parallel)
 * for a theoretical throughput of 25 companies per invocation.
 * Called by:
 *   - GitHub Actions orchestrator (primary, every 10 min)
 *   - The cron tick (burst mode fallback)
 *   - Manually via admin (for debugging)
 */
export async function POST(request: Request) {
  // ── Auth ──
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const queue = getQueue()
  const db = createWorkerDb(prisma)

  try {
    const tasks = await queue.dequeue(5)

    if (tasks.length === 0) {
      return NextResponse.json({
        ok: true,
        elapsed: Date.now() - startTime,
        processed: 0,
        results: [],
      })
    }

    const results = await processTaskBatch(tasks, queue, db, startTime)
    const elapsed = Date.now() - startTime

    return NextResponse.json({
      ok: true,
      elapsed,
      processed: results.length,
      results: results.map((r) => ({
        taskId: r.taskId,
        source: r.source,
        slug: r.slug,
        newJobs: r.newJobs,
        error: r.error,
      })),
    })
  } catch (err) {
    console.error('[worker] Processing error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authHeader = request.headers.get('authorization')
  if (authHeader === `Bearer ${secret}`) return true

  return false
}
