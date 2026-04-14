import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock heavy dependencies so unit tests stay fast and offline
vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    onboardingState: {
      findMany: vi.fn(),
    },
    jobScore: {
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@/lib/onboarding-db', () => ({
  getOnboardingSnapshot: vi.fn(),
}))

vi.mock('@/lib/preference-scoring', () => ({
  computePreferenceScore: vi.fn().mockReturnValue(72),
}))

import { prisma } from '@/lib/prisma'
import { getOnboardingSnapshot } from '@/lib/onboarding-db'
import { handleScoreUserPreferences, handleScoreNewJob, handleScoreRefresh } from '@/lib/job-sources/scoring-worker'
import type { QueueTask } from '@/lib/queue/types'

const mockQueue = {
  enqueue: vi.fn(),
  enqueueBatch: vi.fn(),
  dequeue: vi.fn(),
  complete: vi.fn(),
  fail: vi.fn(),
  getStats: vi.fn(),
  recoverStaleLocks: vi.fn(),
}

function makeTask(type: string, payload: Record<string, unknown>): QueueTask {
  return {
    id: 'task-1',
    type: type as QueueTask['type'],
    source: null,
    payload,
    status: 'processing',
    priority: 2,
    runAt: new Date(),
    attempts: 1,
    maxAttempts: 3,
    lastError: null,
    lockedAt: new Date(),
    lockedBy: 'worker-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    completedAt: null,
  }
}

const mockPrismaJob = {
  id: 'job-1',
  title: 'Backend Engineer',
  company: 'Acme',
  location: 'San Francisco',
  sourceUrl: 'https://example.com',
  status: 'fresh',
  jobDescriptionPlain: 'Python REST API role.',
  skills: ['Python', 'REST'],
  jobType: 'fulltime',
  isRemote: false,
}

const mockSnapshot = {
  completed: true,
  answersByKey: {
    job_function: {
      questionKey: 'job_function',
      step: 1,
      order: 1,
      type: 'job_function',
      title: 'Job Function',
      value: { industries: ['Software/Internet/AI'], subcategories: ['Backend Engineering'], roles: ['Backend Engineer'] },
      answerText: null,
    },
  },
  state: { status: 'complete', currentStep: 2, startedAt: null, completedAt: null, updatedAt: null, profileSetupComplete: true },
  answers: [],
  requiredAnswered: 1,
  requiredTotal: 1,
  progress: 100,
  profileSetupComplete: true,
  allRequiredAnswered: true,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleScoreUserPreferences', () => {
  it('skips user with incomplete onboarding', async () => {
    vi.mocked(getOnboardingSnapshot).mockResolvedValue({ ...mockSnapshot, completed: false })

    const task = makeTask('score-user-preferences', { userId: 'user-1' })
    await handleScoreUserPreferences(task, mockQueue)

    expect(prisma.job.findMany).not.toHaveBeenCalled()
    expect(prisma.jobScore.upsert).not.toHaveBeenCalled()
  })

  it('fetches jobs in batches and upserts scores', async () => {
    vi.mocked(getOnboardingSnapshot).mockResolvedValue(mockSnapshot)
    // Return one batch of 2 jobs, then empty to stop
    vi.mocked(prisma.job.findMany)
      .mockResolvedValueOnce([mockPrismaJob, { ...mockPrismaJob, id: 'job-2' }] as never)
      .mockResolvedValueOnce([] as never)

    const task = makeTask('score-user-preferences', { userId: 'user-1' })
    await handleScoreUserPreferences(task, mockQueue)

    expect(prisma.jobScore.upsert).toHaveBeenCalledTimes(2)
    const call = vi.mocked(prisma.jobScore.upsert).mock.calls[0][0]
    expect(call.create.userId).toBe('user-1')
    expect(call.create.score).toBe(72)
  })
})

describe('handleScoreNewJob', () => {
  it('skips if job not found', async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue(null as never)

    const task = makeTask('score-new-job', { jobId: 'job-missing' })
    await handleScoreNewJob(task, mockQueue)

    expect(prisma.jobScore.upsert).not.toHaveBeenCalled()
  })

  it('scores job against all users with completed onboarding', async () => {
    vi.mocked(prisma.job.findUnique).mockResolvedValue(mockPrismaJob as never)
    vi.mocked(prisma.onboardingState.findMany)
      .mockResolvedValueOnce([{ userId: 'user-1' }, { userId: 'user-2' }] as never)
      .mockResolvedValueOnce([] as never)
    vi.mocked(getOnboardingSnapshot).mockResolvedValue(mockSnapshot)

    const task = makeTask('score-new-job', { jobId: 'job-1' })
    await handleScoreNewJob(task, mockQueue)

    expect(prisma.jobScore.upsert).toHaveBeenCalledTimes(2)
  })
})

describe('handleScoreRefresh', () => {
  it('enqueues score-user-preferences for stale users', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ user_id: 'user-1' }, { user_id: 'user-2' }] as never)

    await handleScoreRefresh(mockQueue)

    expect(mockQueue.enqueue).toHaveBeenCalledTimes(2)
    expect(mockQueue.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'score-user-preferences', payload: { userId: 'user-1' } })
    )
  })

  it('enqueues nothing when no stale users', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([] as never)

    await handleScoreRefresh(mockQueue)

    expect(mockQueue.enqueue).not.toHaveBeenCalled()
  })
})
