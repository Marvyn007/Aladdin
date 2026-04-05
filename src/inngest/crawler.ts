/**
 * Inngest Crawler Functions — "Never-Fail" Architecture
 *
 * Replaces the GitHub Actions cron + spiky worker fan-out with two durable
 * Inngest functions:
 *
 *   crawlerTick         — Cron (every 10 min). Reads DB, builds enqueue plan,
 *                         and fans out one `crawler/process-task` event per task.
 *
 *   crawlerProcessTask  — Handles a single task durably. Inngest provides:
 *                           • Automatic retries with exponential backoff on failure.
 *                           • Concurrency limiting per source (max 2 concurrent
 *                             Greenhouse / Lever / Workday polls at a time).
 *                           • Full observability in the Inngest Cloud dashboard.
 *
 * Design note on date serialization:
 *   Inngest serializes step.run() return values as JSON, turning Date → string.
 *   To avoid that footgun, DB reads in crawlerTick run inline (outside step.run)
 *   so Date objects stay intact when passed to buildEnqueuePlan.
 *   Only step.sendEvent() needs to be a tracked step (for exactly-once fan-out).
 */

import { inngest } from '@/lib/inngest'
import { prisma } from '@/lib/prisma'
import { buildEnqueuePlan } from '@/lib/job-sources/scheduler'
import { processTask, processBatchTask, resolveAdapter } from '@/lib/job-sources/worker'
import { discoverNewCompanies } from '@/lib/job-sources/discovery'
import { createWorkerDb, createDiscoveryDb } from '@/lib/job-sources/worker-db'
import { DISCOVERY_TIER_SCHEDULES } from '@/lib/job-sources/types'
import type { DiscoveryTier } from '@/lib/job-sources/types'
import type { SourceName, QueueTask, EnqueueInput } from '@/lib/queue/types'
import { DEFAULT_MAX_ATTEMPTS } from '@/lib/queue/types'
import { InngestQueueAdapter } from '@/lib/queue/inngest-adapter'
import { randomUUID } from 'crypto'

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Build a synthetic QueueTask from an EnqueueInput (the Inngest event payload).
 * The task ID is ephemeral — Inngest owns durability, not the DB queue table.
 * Dates in event.data arrive as ISO strings; convert them back here.
 */
function toQueueTask(input: EnqueueInput & { runAt?: string | Date; lastNonEmptyAt?: string | Date | null }): QueueTask {
  const runAt = input.runAt
    ? new Date(input.runAt as string | Date)
    : new Date()

  return {
    id: randomUUID(),
    type: input.type,
    source: (input.source ?? null) as QueueTask['source'],
    payload: input.payload,
    status: 'processing',
    priority: input.priority ?? 2,
    runAt,
    attempts: 0,
    maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
    lastError: null,
    lockedAt: new Date(),
    lockedBy: 'inngest',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  }
}

// ── Function 1: Scheduled Tick ────────────────────────────────────────────────

export const crawlerTick = inngest.createFunction(
  {
    id: 'crawler/tick',
    name: 'Job Crawler — Scheduled Tick',
    // Runs every 10 minutes, replacing the GitHub Actions cron schedule.
    triggers: [{ cron: '*/10 * * * *' }],
  },
  async ({ step }) => {
    // ── Inline DB reads (not inside step.run) ──
    // Running these outside step.run avoids Inngest serializing Date → string.
    // DB reads are safe to re-run on retry since they're read-only.

    const companies = await prisma.trackedCompany.findMany({
      where: { isActive: true },
      select: {
        id: true,
        slug: true,
        ats: true,
        isActive: true,
        lastPolledAt: true,
        lastNonEmptyAt: true,
      },
    })

    const bulkSources: SourceName[] = ['themuse', 'arbeitnow', 'himalayas']
    const bulkLastPolled: Partial<Record<string, Date | null>> = {}
    for (const source of bulkSources) {
      const log = await prisma.sourcePollLog.findFirst({
        where: { source, error: null },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      })
      bulkLastPolled[source] = log?.createdAt ?? null
    }

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

    // Build plan (pure function — no side effects)
    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled,
      lastDiscoveryByTier,
      // Pass 0 so the Postgres soft-cap gate never fires.
      // Inngest's per-source concurrency limit provides back-pressure instead.
      pendingCount: 0,
      now: new Date(),
    })

    if (plan.length === 0) {
      return { enqueued: 0, message: 'Nothing due — all sources are fresh.' }
    }

    // ── Fan-out step (tracked for exactly-once semantics) ──
    await step.sendEvent(
      'fan-out-tasks',
      plan.map((task: EnqueueInput) => ({
        name: 'crawler/process-task' as const,
        data: task,
      }))
    )

    return { enqueued: plan.length }
  }
)

// ── Function 2: Durable Task Processor ───────────────────────────────────────

export const crawlerProcessTask = inngest.createFunction(
  {
    id: 'crawler/process-task',
    name: 'Job Crawler — Process Task',
    // Retry up to 3 times with Inngest's built-in exponential backoff.
    retries: DEFAULT_MAX_ATTEMPTS,
    // Per-source concurrency: at most 2 simultaneous polls per source.
    // Prevents Greenhouse / Lever / Workday from being overwhelmed.
    // Discover tasks (source = undefined/null) share one slot.
    concurrency: {
      limit: 2,
      key: 'event.data.source',
    },
    triggers: [{ event: 'crawler/process-task' }],
  },
  async ({ event, step }) => {
    const input = event.data as EnqueueInput

    return await step.run('process', async () => {
      const task = toQueueTask(input)
      const db = createWorkerDb(prisma)

      // The InngestQueueAdapter drives the retry contract:
      //   • complete() is a no-op (Inngest tracks success via function return)
      //   • fail()     re-throws the error → Inngest schedules a retry
      const queue = new InngestQueueAdapter()

      // ── discover task ──
      if (task.type === 'discover') {
        const tier = (task.payload.tier as DiscoveryTier) ?? 3
        const offset = (task.payload.offset as number) ?? 0
        const discoveryDb = createDiscoveryDb(prisma)

        const result = await discoverNewCompanies(discoveryDb, tier, offset)

        await db.logPoll({
          source: 'discovery',
          slug: `tier:${tier}`,
          jobsFetched: result.candidatesChecked,
          newJobs: result.added,
          duplicates: result.alreadyTracked,
          stale: 0,
          durationMs: 0,
          error: result.errors.length > 0 ? result.errors.join('; ') : null,
        })

        // Paginate: enqueue the next offset as a new Inngest event.
        // inngest.send() can be called outside step context (it's just HTTP).
        if (result.hasMore) {
          await queue.enqueue({
            type: 'discover',
            priority: DISCOVERY_TIER_SCHEDULES[tier].priority,
            payload: { tier, offset: result.nextOffset },
          })
        }

        return {
          type: 'discover',
          tier,
          candidatesChecked: result.candidatesChecked,
          added: result.added,
        }
      }

      // ── poll-batch task (parallel multi-company) ──
      if (task.type === 'poll-batch') {
        const result = await processBatchTask(task, queue, db)
        // Re-throw only on total batch failure (all companies errored, 0 jobs
        // fetched) so Inngest retries the entire batch. Partial failures are
        // logged but considered a success to avoid re-fetching completed polls.
        if (result.error && result.jobsFetched === 0) {
          throw new Error(result.error)
        }
        return result
      }

      // ── poll / poll-bulk task ──
      const adapter = resolveAdapter(task.source as SourceName)
      const result = await processTask(task, adapter, queue, db)
      // processTask returns errors in the result object instead of throwing.
      // Re-throw so Inngest retries on any error (404s, 500s, timeouts).
      if (result.error) {
        throw new Error(result.error)
      }
      return result
    })
  }
)
