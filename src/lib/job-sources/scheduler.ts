import type { EnqueueInput, SourceName } from '../queue/types'
import {
  ENQUEUE_CAP_PER_TICK,
  QUEUE_PENDING_SOFT_CAP,
  POLL_BATCH_SIZE,
} from '../queue/types'
import {
  SOURCE_SCHEDULES,
  DISCOVERY_TIER_SCHEDULES,
} from './types'
import type { SourceScheduleConfig, DiscoveryTier } from './types'

/** Minimal TrackedCompany shape needed by the scheduler */
export interface SchedulerCompany {
  id: string
  slug: string
  ats: string
  isActive: boolean
  lastPolledAt: Date | null
  lastNonEmptyAt: Date | null
}

export interface BuildEnqueuePlanInput {
  companies: SchedulerCompany[]
  bulkLastPolled: Partial<Record<string, Date | null>>
  lastDiscoveryByTier: Partial<Record<DiscoveryTier, Date | null>>
  pendingCount: number
  now: Date
}

/**
 * Pure function: given current state, decide what tasks to enqueue.
 * No side effects, no DB access — just logic.
 *
 * Per-company sources are batched into poll-batch tasks (POLL_BATCH_SIZE companies
 * each), allowing the worker to poll them in parallel via Promise.allSettled.
 * Bulk sources (TheMuse, Arbeitnow, Himalayas) always get a guaranteed slot
 * when they are due, regardless of priority ordering, to ensure source diversity.
 */
export function buildEnqueuePlan(input: BuildEnqueuePlanInput): EnqueueInput[] {
  const { companies, bulkLastPolled, lastDiscoveryByTier, pendingCount, now } = input

  // System safety: pause enqueueing if queue is saturated
  if (pendingCount > QUEUE_PENDING_SOFT_CAP) {
    console.warn(
      `[scheduler] Queue soft cap exceeded (${pendingCount} pending > ${QUEUE_PENDING_SOFT_CAP}). Pausing enqueue.`
    )
    return []
  }

  const perCompanyTasks: EnqueueInput[] = []
  const bulkTasks: EnqueueInput[] = []
  const discoveryTasks: EnqueueInput[] = []

  // ── Per-company poll-batch tasks ──
  // Group due companies into batches of POLL_BATCH_SIZE (default: 5).
  // Each batch is processed in parallel via Promise.allSettled inside the worker,
  // giving ~5x the throughput of sequential single-company tasks.
  const perCompanySchedules = SOURCE_SCHEDULES.filter((s) => s.type === 'per-company')

  for (const schedule of perCompanySchedules) {
    const matching = companies.filter((c) => c.ats === schedule.source && c.isActive)
    const due = matching.filter((c) => isDue(c.lastPolledAt, schedule.intervalMs, now))

    // Chunk due companies into batches
    for (let i = 0; i < due.length; i += POLL_BATCH_SIZE) {
      const batch = due.slice(i, i + POLL_BATCH_SIZE)
      perCompanyTasks.push({
        type: 'poll-batch',
        source: schedule.source as SourceName,
        payload: {
          companies: batch.map((c) => ({
            slug: c.slug,
            source: schedule.source,
          })),
        },
        priority: schedule.priority,
        lastNonEmptyAt:
          batch
            .map((c) => c.lastNonEmptyAt ?? c.lastPolledAt ?? null)
            .filter(Boolean)
            .sort((a, b) => (b as Date).getTime() - (a as Date).getTime())[0] ?? null,
      })
    }
  }

  // ── Bulk source tasks — guaranteed slot when due ──
  // These are always high-value: each call returns 20–100 jobs from diverse companies.
  const bulkSchedules = SOURCE_SCHEDULES.filter((s) => s.type === 'bulk')

  for (const schedule of bulkSchedules) {
    const lastPolled = bulkLastPolled[schedule.source] ?? null
    if (isDue(lastPolled, schedule.intervalMs, now)) {
      bulkTasks.push({
        type: 'poll-bulk',
        source: schedule.source as SourceName,
        payload: { page: 1 },
        priority: schedule.priority,
        lastNonEmptyAt: null,
      })
    }
  }

  // ── Discovery tasks (per tier) ──
  const tiers: DiscoveryTier[] = [1, 2, 3]
  for (const tier of tiers) {
    const schedule = DISCOVERY_TIER_SCHEDULES[tier]
    const lastAt = lastDiscoveryByTier[tier] ?? null
    if (isDue(lastAt, schedule.intervalMs, now)) {
      discoveryTasks.push({
        type: 'discover',
        priority: schedule.priority,
        payload: { tier },
        lastNonEmptyAt: null,
      })
    }
  }

  // ── Assemble with guaranteed diversity ──
  // Bulk tasks always go first (regardless of priority) to guarantee source diversity.
  // Then per-company batches sorted by priority, then discovery.
  perCompanyTasks.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2))

  const allTasks = [...bulkTasks, ...perCompanyTasks, ...discoveryTasks]

  return allTasks.slice(0, ENQUEUE_CAP_PER_TICK)
}

function isDue(lastAt: Date | null, intervalMs: number, now: Date): boolean {
  if (!lastAt) return true
  return now.getTime() - lastAt.getTime() >= intervalMs
}
