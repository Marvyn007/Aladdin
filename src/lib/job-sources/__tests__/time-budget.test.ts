import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CYCLE_BUDGET_MS, CYCLE_HARD_LIMIT_MS } from '../constants'

// Mock the adapter modules at the top level so they're hoisted
vi.mock('../adapters/greenhouse', () => {
  return {
    GreenhouseAdapter: class MockGreenhouseAdapter {
      name = 'greenhouse'
      poll = vi.fn().mockResolvedValue([])
      healthCheck = vi.fn()
    },
  }
})

describe('processTaskBatch — time budget', () => {
  let mockQueue: any
  let mockDb: any

  function makeTask(id: string): import('../../queue/types').QueueTask {
    return {
      id,
      type: 'poll' as const,
      source: 'greenhouse' as const,
      payload: { slug: 'stripe' },
      status: 'processing' as const,
      priority: 1,
      runAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
      lastError: null,
      lockedAt: new Date(),
      lockedBy: 'worker-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
    }
  }

  beforeEach(() => {
    mockQueue = {
      enqueue: vi.fn(),
      enqueueBatch: vi.fn(),
      dequeue: vi.fn(),
      complete: vi.fn().mockResolvedValue(undefined),
      fail: vi.fn().mockResolvedValue(undefined),
      getStats: vi.fn(),
      recoverStaleLocks: vi.fn(),
    }
    mockDb = {
      upsertJob: vi.fn().mockResolvedValue({ isNew: true, stale: false }),
      updateTrackedCompany: vi.fn().mockResolvedValue(undefined),
      logPoll: vi.fn().mockResolvedValue(undefined),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('processes all tasks when they complete before the soft limit', async () => {
    const { processTaskBatch } = await import('../worker')

    const tasks = [makeTask('t1'), makeTask('t2'), makeTask('t3')]
    // startTime = now (well within budget)
    const results = await processTaskBatch(tasks, mockQueue, mockDb, Date.now())
    expect(results).toHaveLength(3)
  })

  it('stops processing when elapsed exceeds soft limit before a task starts', async () => {
    const { processTaskBatch } = await import('../worker')

    const tasks = [makeTask('t1'), makeTask('t2')]
    // startTime = 6 seconds ago → elapsed already > CYCLE_BUDGET_MS (5000ms) before first task
    const pastSoftLimit = Date.now() - (CYCLE_BUDGET_MS + 1)
    const results = await processTaskBatch(tasks, mockQueue, mockDb, pastSoftLimit)
    // Should process 0 tasks because elapsed is already past budget
    expect(results).toHaveLength(0)
  })

  it('logs a warning when cycle exceeds the hard limit after a task completes', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { processTaskBatch } = await import('../worker')

    // Simulate time: soft check passes (elapsed < CYCLE_BUDGET_MS), then after task
    // completes Date.now() returns a value that puts elapsed > CYCLE_HARD_LIMIT_MS.
    const fakeNow = Date.now()
    // Sequence: first call (soft check) returns fakeNow (elapsed = 0, passes budget)
    // Subsequent calls (after task) return fakeNow + CYCLE_HARD_LIMIT_MS + 500
    let callCount = 0
    vi.spyOn(Date, 'now').mockImplementation(() => {
      callCount++
      // First call is the soft-limit check at loop start — return fakeNow (elapsed=0)
      // After that, simulate time has advanced past the hard limit
      if (callCount <= 1) return fakeNow
      return fakeNow + CYCLE_HARD_LIMIT_MS + 500
    })

    const tasks = [makeTask('t1')]
    await processTaskBatch(tasks, mockQueue, mockDb, fakeNow)

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('hard limit')
    )
  })
})
