import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processTask, processTaskBatch, resolveAdapter } from '../worker'
import type { QueueTask } from '../../queue/types'
import type { NormalizedJob } from '../types'

vi.mock('../discovery', () => ({
  discoverNewCompanies: vi.fn(),
}))

import { discoverNewCompanies } from '../discovery'
import { DISCOVERY_TIER_SCHEDULES } from '../types'

function makeTask(overrides: Partial<QueueTask> = {}): QueueTask {
  return {
    id: 'task-1',
    type: 'poll',
    source: 'greenhouse',
    payload: { slug: 'stripe' },
    status: 'processing',
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
    ...overrides,
  }
}

function makeNormalizedJob(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  return {
    title: 'Software Engineer',
    company: 'Stripe',
    location: 'San Francisco, CA',
    sourceUrl: 'https://stripe.com/jobs/1',
    rawDescriptionHtml: null,
    jobDescriptionPlain: null,
    postedAt: new Date(),
    contentHash: 'abc123',
    source: 'greenhouse',
    externalId: '12345',
    metadata: {},
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    jobType: null,
    isRemote: false,
    experienceLevel: null,
    skills: [],
    applyUrl: 'https://stripe.com/jobs/1/apply',
    expiresAt: null,
    ...overrides,
  }
}

describe('resolveAdapter', () => {
  it('returns the greenhouse adapter for greenhouse source', () => {
    const adapter = resolveAdapter('greenhouse')
    expect(adapter.name).toBe('greenhouse')
  })

  it('throws for unknown source', () => {
    expect(() => resolveAdapter('unknown' as any)).toThrow(/unknown source/i)
  })
})

describe('processTask', () => {
  const mockAdapter = {
    name: 'greenhouse' as const,
    poll: vi.fn(),
    healthCheck: vi.fn(),
  }

  const mockQueue = {
    enqueue: vi.fn(),
    enqueueBatch: vi.fn(),
    dequeue: vi.fn(),
    complete: vi.fn(),
    fail: vi.fn(),
    getStats: vi.fn(),
    recoverStaleLocks: vi.fn(),
  }

  const mockDb = {
    upsertJob: vi.fn(),
    updateTrackedCompany: vi.fn(),
    logPoll: vi.fn(),
  }

  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('calls the adapter poll with correct target for per-company tasks', async () => {
    mockAdapter.poll.mockResolvedValue([])

    await processTask(makeTask(), mockAdapter, mockQueue, mockDb)

    expect(mockAdapter.poll).toHaveBeenCalledWith({
      type: 'company',
      slug: 'stripe',
    })
  })

  it('calls adapter poll with bulk target for poll-bulk tasks', async () => {
    mockAdapter.poll.mockResolvedValue([])

    await processTask(
      makeTask({ type: 'poll-bulk', payload: { page: 1 } }),
      mockAdapter,
      mockQueue,
      mockDb
    )

    expect(mockAdapter.poll).toHaveBeenCalledWith({
      type: 'bulk',
      page: 1,
    })
  })

  it('upserts each job returned by the adapter', async () => {
    const jobs = [
      makeNormalizedJob({ externalId: '1' }),
      makeNormalizedJob({ externalId: '2' }),
    ]
    mockAdapter.poll.mockResolvedValue(jobs)
    mockDb.upsertJob.mockResolvedValue({ isNew: true })

    await processTask(makeTask(), mockAdapter, mockQueue, mockDb)

    expect(mockDb.upsertJob).toHaveBeenCalledTimes(2)
  })

  it('completes the queue task on success', async () => {
    mockAdapter.poll.mockResolvedValue([])

    await processTask(makeTask(), mockAdapter, mockQueue, mockDb)

    expect(mockQueue.complete).toHaveBeenCalledWith('task-1')
  })

  it('fails the queue task on adapter error', async () => {
    mockAdapter.poll.mockRejectedValue(new Error('API timeout'))

    await processTask(makeTask(), mockAdapter, mockQueue, mockDb)

    expect(mockQueue.fail).toHaveBeenCalledWith('task-1', 'API timeout')
    expect(mockQueue.complete).not.toHaveBeenCalled()
  })

  it('updates TrackedCompany after per-company poll', async () => {
    const jobs = [makeNormalizedJob()]
    mockAdapter.poll.mockResolvedValue(jobs)
    mockDb.upsertJob.mockResolvedValue({ isNew: true })

    await processTask(makeTask(), mockAdapter, mockQueue, mockDb)

    expect(mockDb.updateTrackedCompany).toHaveBeenCalledWith(
      'stripe',
      'greenhouse',
      expect.objectContaining({
        lastJobCount: 1,
        hasJobs: true,
      })
    )
  })

  it('creates a SourcePollLog entry on success', async () => {
    const jobs = [makeNormalizedJob(), makeNormalizedJob({ externalId: '2' })]
    mockAdapter.poll.mockResolvedValue(jobs)
    mockDb.upsertJob
      .mockResolvedValueOnce({ isNew: true })
      .mockResolvedValueOnce({ isNew: false })

    await processTask(makeTask(), mockAdapter, mockQueue, mockDb)

    expect(mockDb.logPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'greenhouse',
        slug: 'stripe',
        jobsFetched: 2,
        newJobs: 1,
        duplicates: 1,
        error: null,
      })
    )
  })

  it('creates a SourcePollLog entry on error', async () => {
    mockAdapter.poll.mockRejectedValue(new Error('Network fail'))

    await processTask(makeTask(), mockAdapter, mockQueue, mockDb)

    expect(mockDb.logPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'greenhouse',
        slug: 'stripe',
        jobsFetched: 0,
        newJobs: 0,
        duplicates: 0,
        error: 'Network fail',
      })
    )
  })

  it('returns task result with counts', async () => {
    const jobs = [makeNormalizedJob()]
    mockAdapter.poll.mockResolvedValue(jobs)
    mockDb.upsertJob.mockResolvedValue({ isNew: true })

    const result = await processTask(makeTask(), mockAdapter, mockQueue, mockDb)

    expect(result).toMatchObject({
      taskId: 'task-1',
      source: 'greenhouse',
      jobsFetched: 1,
      newJobs: 1,
      duplicates: 0,
      error: null,
    })
  })
})

describe('processTaskBatch — discovery tasks', () => {
  const mockQueue = {
    enqueue: vi.fn().mockResolvedValue(undefined),
    enqueueBatch: vi.fn(),
    dequeue: vi.fn(),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn(),
    recoverStaleLocks: vi.fn(),
  }

  const mockDb = {
    upsertJob: vi.fn(),
    updateTrackedCompany: vi.fn(),
    logPoll: vi.fn().mockResolvedValue(undefined),
  }

  beforeEach(() => {
    vi.resetAllMocks()
    mockQueue.complete.mockResolvedValue(undefined)
    mockQueue.enqueue.mockResolvedValue(undefined)
    mockDb.logPoll.mockResolvedValue(undefined)
  })

  it('calls discoverNewCompanies with correct tier and offset', async () => {
    vi.mocked(discoverNewCompanies).mockResolvedValue({
      tier: 2,
      candidatesChecked: 3,
      added: 2,
      alreadyTracked: 0,
      invalid: 1,
      errors: [],
      hasMore: false,
      nextOffset: 5,
    })

    const task = makeTask({
      type: 'discover',
      source: null,
      payload: { tier: 2, offset: 0 },
    })

    await processTaskBatch([task], mockQueue, mockDb)

    expect(discoverNewCompanies).toHaveBeenCalledWith(
      expect.any(Object),
      2,
      0
    )
  })

  it('completes the task after discovery', async () => {
    vi.mocked(discoverNewCompanies).mockResolvedValue({
      tier: 1,
      candidatesChecked: 0,
      added: 0,
      alreadyTracked: 5,
      invalid: 0,
      errors: [],
      hasMore: false,
      nextOffset: 0,
    })

    const task = makeTask({
      type: 'discover',
      source: null,
      payload: { tier: 1, offset: 0 },
    })

    await processTaskBatch([task], mockQueue, mockDb)

    expect(mockQueue.complete).toHaveBeenCalledWith(task.id)
  })

  it('re-enqueues with correct tier and priority when hasMore is true', async () => {
    vi.mocked(discoverNewCompanies).mockResolvedValue({
      tier: 2,
      candidatesChecked: 5,
      added: 3,
      alreadyTracked: 0,
      invalid: 2,
      errors: [],
      hasMore: true,
      nextOffset: 5,
    })

    const task = makeTask({
      type: 'discover',
      source: null,
      payload: { tier: 2, offset: 0 },
    })

    await processTaskBatch([task], mockQueue, mockDb)

    expect(mockQueue.enqueue).toHaveBeenCalledWith({
      type: 'discover',
      priority: DISCOVERY_TIER_SCHEDULES[2].priority,
      payload: { tier: 2, offset: 5 },
    })
  })

  it('does not re-enqueue when hasMore is false', async () => {
    vi.mocked(discoverNewCompanies).mockResolvedValue({
      tier: 1,
      candidatesChecked: 3,
      added: 3,
      alreadyTracked: 0,
      invalid: 0,
      errors: [],
      hasMore: false,
      nextOffset: 5,
    })

    const task = makeTask({
      type: 'discover',
      source: null,
      payload: { tier: 1, offset: 0 },
    })

    await processTaskBatch([task], mockQueue, mockDb)

    expect(mockQueue.enqueue).not.toHaveBeenCalled()
  })

  it('logs discovery results via db.logPoll', async () => {
    vi.mocked(discoverNewCompanies).mockResolvedValue({
      tier: 1,
      candidatesChecked: 5,
      added: 3,
      alreadyTracked: 1,
      invalid: 1,
      errors: [],
      hasMore: false,
      nextOffset: 5,
    })

    const task = makeTask({
      type: 'discover',
      source: null,
      payload: { tier: 1, offset: 0 },
    })

    await processTaskBatch([task], mockQueue, mockDb)

    expect(mockDb.logPoll).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'discovery',
        slug: 'tier:1',
        jobsFetched: 5,
        newJobs: 3,
        duplicates: 1,
        error: null,
      })
    )
  })

  it('defaults tier to 3 when payload.tier is missing', async () => {
    vi.mocked(discoverNewCompanies).mockResolvedValue({
      tier: 3,
      candidatesChecked: 0,
      added: 0,
      alreadyTracked: 0,
      invalid: 0,
      errors: [],
      hasMore: false,
      nextOffset: 0,
    })

    const task = makeTask({
      type: 'discover',
      source: null,
      payload: {},
    })

    await processTaskBatch([task], mockQueue, mockDb)

    expect(discoverNewCompanies).toHaveBeenCalledWith(
      expect.any(Object),
      3,
      0
    )
  })
})
