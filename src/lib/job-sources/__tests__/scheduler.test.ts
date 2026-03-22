import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildEnqueuePlan } from '../scheduler'
import { DISCOVERY_TIER_SCHEDULES } from '../types'
import type { SourceScheduleConfig, DiscoveryTier } from '../types'

// Minimal TrackedCompany shape for scheduler tests
interface MockCompany {
  id: string
  slug: string
  ats: string
  isActive: boolean
  lastPolledAt: Date | null
}

const FIFTEEN_MIN = 15 * 60 * 1000
const ONE_HOUR = 60 * 60 * 1000

function makeCompany(overrides: Partial<MockCompany> = {}): MockCompany {
  return {
    id: 'company-1',
    slug: 'stripe',
    ats: 'greenhouse',
    isActive: true,
    lastPolledAt: null,
    ...overrides,
  }
}

describe('buildEnqueuePlan', () => {
  const now = new Date('2026-03-21T12:00:00Z')

  it('enqueues tasks for companies that have never been polled', () => {
    const companies = [
      makeCompany({ id: 'c1', slug: 'stripe', lastPolledAt: null }),
      makeCompany({ id: 'c2', slug: 'airbnb', lastPolledAt: null }),
    ]

    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled: {},
      lastDiscoveryByTier: {},
      pendingCount: 0,
      now,
    })

    const pollTasks = plan.filter((t) => t.type === 'poll')
    expect(pollTasks).toHaveLength(2)
    expect(pollTasks[0].source).toBe('greenhouse')
    expect(pollTasks[0].payload).toEqual({ slug: 'stripe' })
    expect(pollTasks[0].priority).toBe(1)
  })

  it('skips companies polled within their interval', () => {
    const recentlyPolled = new Date(now.getTime() - 5 * 60 * 1000) // 5 min ago
    const companies = [
      makeCompany({ slug: 'stripe', lastPolledAt: recentlyPolled }),
    ]

    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled: {},
      lastDiscoveryByTier: {},
      pendingCount: 0,
      now,
    })

    const pollTasks = plan.filter((t) => t.type === 'poll')
    expect(pollTasks).toHaveLength(0)
  })

  it('includes companies whose interval has elapsed', () => {
    const oldPoll = new Date(now.getTime() - 20 * 60 * 1000) // 20 min ago (>15 min interval)
    const companies = [
      makeCompany({ slug: 'stripe', lastPolledAt: oldPoll }),
    ]

    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled: {},
      lastDiscoveryByTier: {},
      pendingCount: 0,
      now,
    })

    expect(plan.filter((t) => t.type === 'poll')).toHaveLength(1)
  })

  it('caps total tasks at 50 per tick', () => {
    const companies = Array.from({ length: 60 }, (_, i) =>
      makeCompany({ id: `c${i}`, slug: `company-${i}`, lastPolledAt: null })
    )

    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled: {},
      lastDiscoveryByTier: {},
      pendingCount: 0,
      now,
    })

    expect(plan.length).toBeLessThanOrEqual(50)
  })

  it('enqueues bulk sources when their interval has elapsed', () => {
    const plan = buildEnqueuePlan({
      companies: [],
      bulkLastPolled: {
        themuse: new Date(now.getTime() - 2 * ONE_HOUR), // 2h ago > 1h interval
        arbeitnow: new Date(now.getTime() - 2 * ONE_HOUR),
        himalayas: null, // never polled
      },
      lastDiscoveryByTier: {},
      pendingCount: 0,
      now,
    })

    const bulkTasks = plan.filter((t) => t.type === 'poll-bulk')
    expect(bulkTasks.length).toBeGreaterThanOrEqual(3)
  })

  it('skips bulk sources polled within their interval', () => {
    const plan = buildEnqueuePlan({
      companies: [],
      bulkLastPolled: {
        themuse: new Date(now.getTime() - 30 * 60 * 1000), // 30 min ago < 1h interval
        arbeitnow: new Date(now.getTime() - 30 * 60 * 1000),
        himalayas: new Date(now.getTime() - 2 * ONE_HOUR), // 2h ago < 24h interval
      },
      lastDiscoveryByTier: { 1: now, 2: now, 3: now },
      pendingCount: 0,
      now,
    })

    const bulkTasks = plan.filter((t) => t.type === 'poll-bulk')
    expect(bulkTasks).toHaveLength(0)
  })

  describe('per-tier discovery scheduling', () => {
    it('enqueues tier 1 discovery at P2 when due (>2h since last)', () => {
      const plan = buildEnqueuePlan({
        companies: [],
        bulkLastPolled: {},
        lastDiscoveryByTier: {
          1: new Date(now.getTime() - 3 * ONE_HOUR), // 3h ago > 2h interval
          2: now,
          3: now,
        },
        pendingCount: 0,
        now,
      })

      const discoverTasks = plan.filter((t) => t.type === 'discover')
      expect(discoverTasks).toHaveLength(1)
      expect(discoverTasks[0].priority).toBe(2)
      expect(discoverTasks[0].payload).toEqual({ tier: 1 })
    })

    it('enqueues tier 2 at P3 when due (>6h)', () => {
      const plan = buildEnqueuePlan({
        companies: [],
        bulkLastPolled: {},
        lastDiscoveryByTier: {
          1: now,
          2: new Date(now.getTime() - 7 * ONE_HOUR),
          3: now,
        },
        pendingCount: 0,
        now,
      })

      const discoverTasks = plan.filter((t) => t.type === 'discover')
      expect(discoverTasks).toHaveLength(1)
      expect(discoverTasks[0].priority).toBe(3)
      expect(discoverTasks[0].payload).toEqual({ tier: 2 })
    })

    it('enqueues tier 3 at P4 when due (>12h)', () => {
      const plan = buildEnqueuePlan({
        companies: [],
        bulkLastPolled: {},
        lastDiscoveryByTier: {
          1: now,
          2: now,
          3: new Date(now.getTime() - 13 * ONE_HOUR),
        },
        pendingCount: 0,
        now,
      })

      const discoverTasks = plan.filter((t) => t.type === 'discover')
      expect(discoverTasks).toHaveLength(1)
      expect(discoverTasks[0].priority).toBe(4)
      expect(discoverTasks[0].payload).toEqual({ tier: 3 })
    })

    it('enqueues all 3 tiers when all are due', () => {
      const plan = buildEnqueuePlan({
        companies: [],
        bulkLastPolled: {},
        lastDiscoveryByTier: {},
        pendingCount: 0,
        now,
      })

      const discoverTasks = plan.filter((t) => t.type === 'discover')
      expect(discoverTasks).toHaveLength(3)
      expect(discoverTasks.map(t => t.priority).sort()).toEqual([2, 3, 4])
    })

    it('skips tiers that ran recently', () => {
      const plan = buildEnqueuePlan({
        companies: [],
        bulkLastPolled: {},
        lastDiscoveryByTier: {
          1: new Date(now.getTime() - 1 * ONE_HOUR),  // 1h ago < 2h
          2: new Date(now.getTime() - 3 * ONE_HOUR),  // 3h ago < 6h
          3: new Date(now.getTime() - 6 * ONE_HOUR),  // 6h ago < 12h
        },
        pendingCount: 0,
        now,
      })

      expect(plan.filter((t) => t.type === 'discover')).toHaveLength(0)
    })
  })

  it('pauses enqueueing when pending count exceeds soft cap (1000)', () => {
    const companies = [
      makeCompany({ slug: 'stripe', lastPolledAt: null }),
    ]

    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled: {},
      lastDiscoveryByTier: {},
      pendingCount: 1001,
      now,
    })

    expect(plan).toHaveLength(0)
  })

  it('prioritizes per-company tasks (P1) before bulk (P2) before discovery (P4)', () => {
    const companies = [
      makeCompany({ slug: 'stripe', lastPolledAt: null }),
    ]

    const plan = buildEnqueuePlan({
      companies,
      bulkLastPolled: {
        themuse: null,
      },
      lastDiscoveryByTier: {},
      pendingCount: 0,
      now,
    })

    const priorities = plan.map((t) => t.priority ?? 2)
    // Should be sorted ascending (highest priority first)
    for (let i = 1; i < priorities.length; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i - 1])
    }
  })
})
