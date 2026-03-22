import type { EnqueueInput, SourceName } from '../queue/types'
import {
  ENQUEUE_CAP_PER_TICK,
  QUEUE_PENDING_SOFT_CAP,
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

  const tasks: EnqueueInput[] = []

  // ── Per-company tasks (Greenhouse/Lever) ──
  const perCompanySchedules = SOURCE_SCHEDULES.filter((s) => s.type === 'per-company')

  for (const schedule of perCompanySchedules) {
    const matching = companies.filter((c) => c.ats === schedule.source && c.isActive)

    for (const company of matching) {
      if (isDue(company.lastPolledAt, schedule.intervalMs, now)) {
        tasks.push({
          type: 'poll',
          source: schedule.source as SourceName,
          payload: { slug: company.slug },
          priority: schedule.priority,
        })
      }
    }
  }

  // ── Bulk source tasks ──
  const bulkSchedules = SOURCE_SCHEDULES.filter((s) => s.type === 'bulk')

  for (const schedule of bulkSchedules) {
    const lastPolled = bulkLastPolled[schedule.source] ?? null
    if (isDue(lastPolled, schedule.intervalMs, now)) {
      tasks.push({
        type: 'poll-bulk',
        source: schedule.source as SourceName,
        payload: { page: 1 },
        priority: schedule.priority,
      })
    }
  }

  // ── Discovery tasks (per tier) ──
  const tiers: DiscoveryTier[] = [1, 2, 3]
  for (const tier of tiers) {
    const schedule = DISCOVERY_TIER_SCHEDULES[tier]
    const lastAt = lastDiscoveryByTier[tier] ?? null
    if (isDue(lastAt, schedule.intervalMs, now)) {
      tasks.push({
        type: 'discover',
        priority: schedule.priority,
        payload: { tier },
      })
    }
  }

  // Sort by priority (ascending = higher priority first) then apply cap
  tasks.sort((a, b) => (a.priority ?? 2) - (b.priority ?? 2))

  return tasks.slice(0, ENQUEUE_CAP_PER_TICK)
}

function isDue(lastAt: Date | null, intervalMs: number, now: Date): boolean {
  if (!lastAt) return true
  return now.getTime() - lastAt.getTime() >= intervalMs
}
