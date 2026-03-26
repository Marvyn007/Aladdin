import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NeonQueueAdapter, calculateBackoffMs } from '../neon-adapter'
import type { QueueTask } from '../types'
import { DEFAULT_MAX_ATTEMPTS, STALE_LOCK_MAX_AGE_MS } from '../types'

// ── Pure logic tests (no mocks needed) ──

describe('calculateBackoffMs', () => {
  it('returns exponential backoff capped at 30 minutes', () => {
    expect(calculateBackoffMs(0)).toBe(60_000)        // 2^0 = 1 min
    expect(calculateBackoffMs(1)).toBe(120_000)       // 2^1 = 2 min
    expect(calculateBackoffMs(2)).toBe(240_000)       // 2^2 = 4 min
    expect(calculateBackoffMs(3)).toBe(480_000)       // 2^3 = 8 min
    expect(calculateBackoffMs(4)).toBe(960_000)       // 2^4 = 16 min
    expect(calculateBackoffMs(5)).toBe(1_800_000)     // capped at 30 min
    expect(calculateBackoffMs(10)).toBe(1_800_000)    // still capped
  })
})

// ── Mock Prisma factory ──

function createMockPrisma() {
  return {
    jobQueue: {
      create: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    $queryRawUnsafe: vi.fn(),
    $executeRawUnsafe: vi.fn(),
  }
}

type MockPrisma = ReturnType<typeof createMockPrisma>

function makeAdapter(prisma: MockPrisma): NeonQueueAdapter {
  return new NeonQueueAdapter(prisma as any)
}

// Helper: create a fake QueueTask-like row as raw SQL would return
function fakeTaskRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'task-1',
    type: 'poll',
    source: 'greenhouse',
    payload: { slug: 'stripe' },
    status: 'processing',
    priority: 1,
    run_at: new Date('2026-03-21T10:00:00Z'),
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    locked_at: new Date(),
    locked_by: 'worker-1',
    created_at: new Date('2026-03-21T09:00:00Z'),
    updated_at: new Date(),
    completed_at: null,
    ...overrides,
  }
}

// ── Adapter tests ──

describe('NeonQueueAdapter', () => {
  let prisma: MockPrisma
  let adapter: NeonQueueAdapter

  beforeEach(() => {
    prisma = createMockPrisma()
    adapter = makeAdapter(prisma)
  })

  // ── Test 1: enqueue ──
  describe('enqueue', () => {
    it('creates a task with status=pending and correct fields', async () => {
      prisma.jobQueue.create.mockResolvedValue({})

      await adapter.enqueue({
        type: 'poll',
        source: 'greenhouse',
        payload: { slug: 'stripe' },
        priority: 1,
      })

      expect(prisma.jobQueue.create).toHaveBeenCalledOnce()
      const callArg = prisma.jobQueue.create.mock.calls[0][0]
      expect(callArg.data).toMatchObject({
        type: 'poll',
        source: 'greenhouse',
        payload: { slug: 'stripe' },
        status: 'pending',
        priority: 1,
      })
      expect(callArg.data.maxAttempts).toBe(DEFAULT_MAX_ATTEMPTS)
    })

    it('uses defaults for optional fields', async () => {
      prisma.jobQueue.create.mockResolvedValue({})

      await adapter.enqueue({
        type: 'poll-bulk',
        payload: { page: 1 },
      })

      const data = prisma.jobQueue.create.mock.calls[0][0].data
      expect(data.priority).toBe(2)
      expect(data.source).toBeNull()
      expect(data.runAt).toBeInstanceOf(Date)
    })
  })

  // ── Test 2: enqueueBatch ──
  describe('enqueueBatch', () => {
    it('creates multiple tasks in a single call', async () => {
      prisma.jobQueue.createMany.mockResolvedValue({ count: 2 })

      await adapter.enqueueBatch([
        { type: 'poll', source: 'greenhouse', payload: { slug: 'stripe' }, priority: 1 },
        { type: 'poll', source: 'greenhouse', payload: { slug: 'airbnb' }, priority: 1 },
      ])

      expect(prisma.jobQueue.createMany).toHaveBeenCalledOnce()
      const data = prisma.jobQueue.createMany.mock.calls[0][0].data
      expect(data).toHaveLength(2)
      expect(data[0].status).toBe('pending')
      expect(data[1].status).toBe('pending')
    })
  })

  // ── Tests 3-6: dequeue ──
  describe('dequeue', () => {
    it('returns tasks mapped from raw SQL rows', async () => {
      const row = fakeTaskRow()
      prisma.$queryRawUnsafe.mockResolvedValue([row])

      const tasks = await adapter.dequeue(1)

      expect(tasks).toHaveLength(1)
      expect(tasks[0].id).toBe('task-1')
      expect(tasks[0].type).toBe('poll')
      expect(tasks[0].source).toBe('greenhouse')
      expect(tasks[0].status).toBe('processing')
      expect(tasks[0].priority).toBe(1)
    })

    it('uses raw SQL with FOR UPDATE SKIP LOCKED and correct ordering', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([])

      await adapter.dequeue(3)

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledOnce()
      const sql = prisma.$queryRawUnsafe.mock.calls[0][0] as string
      expect(sql).toContain('FOR UPDATE SKIP LOCKED')
      expect(sql).toContain('ORDER BY priority ASC, run_at ASC')
      expect(sql).toContain("status = 'pending'")
      expect(sql).toContain('run_at <= NOW()')
    })

    it('passes the limit parameter to the SQL query', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([])

      await adapter.dequeue(5)

      const args = prisma.$queryRawUnsafe.mock.calls[0]
      // limit should be passed as a parameter
      expect(args).toContain(5)
    })

    it('returns empty array when no eligible tasks exist', async () => {
      prisma.$queryRawUnsafe.mockResolvedValue([])

      const tasks = await adapter.dequeue(3)

      expect(tasks).toEqual([])
    })
  })

  // ── Test 7: complete ──
  describe('complete', () => {
    it('sets status=completed and completedAt', async () => {
      prisma.jobQueue.update.mockResolvedValue({})

      await adapter.complete('task-1')

      expect(prisma.jobQueue.update).toHaveBeenCalledOnce()
      const call = prisma.jobQueue.update.mock.calls[0][0]
      expect(call.where.id).toBe('task-1')
      expect(call.data.status).toBe('completed')
      expect(call.data.completedAt).toBeInstanceOf(Date)
    })
  })

  // ── Tests 8-9: fail ──
  describe('fail', () => {
    it('increments attempts, sets lastError, resets to pending with backoff when under maxAttempts', async () => {
      prisma.jobQueue.findUnique.mockResolvedValue({
        id: 'task-1',
        attempts: 1,
        maxAttempts: 3,
      })
      prisma.jobQueue.update.mockResolvedValue({})

      await adapter.fail('task-1', 'network timeout')

      expect(prisma.jobQueue.update).toHaveBeenCalledOnce()
      const data = prisma.jobQueue.update.mock.calls[0][0].data
      expect(data.status).toBe('pending')
      expect(data.attempts).toBe(2)
      expect(data.lastError).toBe('network timeout')
      expect(data.lockedAt).toBeNull()
      expect(data.lockedBy).toBeNull()
      // Backoff: 2^(2-1) = 2 minutes from now (approx)
      expect(data.runAt).toBeInstanceOf(Date)
      expect(data.runAt.getTime()).toBeGreaterThan(Date.now())
    })

    it('sets status=dead when attempts reach maxAttempts', async () => {
      prisma.jobQueue.findUnique.mockResolvedValue({
        id: 'task-1',
        attempts: 2,
        maxAttempts: 3,
      })
      prisma.jobQueue.update.mockResolvedValue({})

      await adapter.fail('task-1', 'persistent error')

      const data = prisma.jobQueue.update.mock.calls[0][0].data
      expect(data.status).toBe('dead')
      expect(data.attempts).toBe(3)
      expect(data.lastError).toBe('persistent error')
    })
  })

  // ── Test 10: getStats ──
  describe('getStats', () => {
    it('returns correct counts for each status', async () => {
      // Mock count calls — adapter calls count() multiple times with different where clauses
      prisma.jobQueue.count
        .mockResolvedValueOnce(47)   // pending
        .mockResolvedValueOnce(3)    // processing
        .mockResolvedValueOnce(1204) // completed_24h
        .mockResolvedValueOnce(12)   // failed_24h
        .mockResolvedValueOnce(2)    // dead

      // Mock for average processing time
      prisma.jobQueue.findFirst.mockResolvedValue(null) // no oldest pending

      // Mock raw query for avg processing time
      prisma.$queryRawUnsafe.mockResolvedValue([{ avg_ms: 1850 }])

      const stats = await adapter.getStats()

      expect(stats.pending).toBe(47)
      expect(stats.processing).toBe(3)
      expect(stats.completed24h).toBe(1204)
      expect(stats.failed24h).toBe(12)
      expect(stats.dead).toBe(2)
      expect(stats.avgProcessingMs).toBe(1850)
    })
  })

  // ── Test 11: recoverStaleLocks ──
  describe('recoverStaleLocks', () => {
    it('resets tasks stuck in processing longer than maxAge to pending', async () => {
      prisma.jobQueue.updateMany.mockResolvedValue({ count: 2 })

      const recovered = await adapter.recoverStaleLocks(STALE_LOCK_MAX_AGE_MS)

      expect(prisma.jobQueue.updateMany).toHaveBeenCalledOnce()
      const call = prisma.jobQueue.updateMany.mock.calls[0][0]
      expect(call.where.status).toBe('processing')
      expect(call.where.lockedAt.lt).toBeInstanceOf(Date)
      expect(call.data.status).toBe('pending')
      expect(call.data.lockedAt).toBeNull()
      expect(call.data.lockedBy).toBeNull()
      expect(recovered).toBe(2)
    })

    it('uses default maxAge when none provided', async () => {
      prisma.jobQueue.updateMany.mockResolvedValue({ count: 0 })

      await adapter.recoverStaleLocks()

      const where = prisma.jobQueue.updateMany.mock.calls[0][0].where
      const cutoff = where.lockedAt.lt as Date
      // Default is 60s ago — should be within a few ms of expected
      const expectedCutoff = new Date(Date.now() - STALE_LOCK_MAX_AGE_MS)
      expect(Math.abs(cutoff.getTime() - expectedCutoff.getTime())).toBeLessThan(100)
    })
  })
})
