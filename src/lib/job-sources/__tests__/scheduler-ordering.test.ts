import { describe, it, expect } from 'vitest'
import { buildEnqueuePlan } from '../scheduler'
import type { BuildEnqueuePlanInput } from '../scheduler'

function makeInput(overrides: Partial<BuildEnqueuePlanInput> = {}): BuildEnqueuePlanInput {
  return {
    companies: [],
    bulkLastPolled: {},
    lastDiscoveryByTier: {},
    pendingCount: 0,
    now: new Date('2026-03-29T12:00:00Z'),
    ...overrides,
  }
}

describe('buildEnqueuePlan — lastNonEmptyAt population', () => {
  const now = new Date('2026-03-29T12:00:00Z')
  const recentlyActive = new Date(now.getTime() - 5 * 60 * 1000)   // 5 min ago
  const lessActive     = new Date(now.getTime() - 60 * 60 * 1000)  // 1h ago

  it('populates lastNonEmptyAt from TrackedCompany when available', () => {
    const dueLastPolled = new Date(now.getTime() - 20 * 60 * 1000) // 20 min ago > 15 min interval
    const input = makeInput({
      now,
      companies: [
        {
          id: 'c1', slug: 'stripe', ats: 'greenhouse', isActive: true,
          lastPolledAt: dueLastPolled,
          lastNonEmptyAt: recentlyActive,
        },
      ],
    })
    const tasks = buildEnqueuePlan(input)
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks[0].lastNonEmptyAt).toEqual(recentlyActive)
  })

  it('falls back to lastPolledAt when lastNonEmptyAt is null', () => {
    const input = makeInput({
      now,
      companies: [
        {
          id: 'c1', slug: 'lever-co', ats: 'lever', isActive: true,
          lastPolledAt: lessActive,
          lastNonEmptyAt: null,
        },
      ],
    })
    const tasks = buildEnqueuePlan(input)
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks[0].lastNonEmptyAt).toEqual(lessActive)
  })

  it('sets lastNonEmptyAt to null for bulk tasks', () => {
    const input = makeInput({
      now,
      bulkLastPolled: { themuse: null },
    })
    const tasks = buildEnqueuePlan(input)
    const bulkTask = tasks.find((t) => t.source === 'themuse')
    expect(bulkTask).toBeDefined()
    expect(bulkTask!.lastNonEmptyAt).toBeNull()
  })
})
