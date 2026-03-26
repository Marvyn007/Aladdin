import { describe, it, expect, vi, beforeEach } from 'vitest'
import { castVote, getJobVoteScore, getUserVote } from '../voting-service'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    jobVote: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))
import { prisma } from '@/lib/prisma'
const mockPrisma = vi.mocked(prisma, true)

describe('castVote', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('creates new upvote when no existing vote', async () => {
    mockPrisma.jobVote.findUnique.mockResolvedValue(null)
    mockPrisma.jobVote.upsert.mockResolvedValue({
      id: 'vote-1', userId: 'u1', jobId: 'j1', value: 1,
    } as any)
    mockPrisma.jobVote.aggregate.mockResolvedValue({ _sum: { value: 1 } } as any)

    const result = await castVote({ userId: 'u1', jobId: 'j1', value: 1 })

    expect(result.vote).not.toBeNull()
    expect(result.vote?.value).toBe(1)
    expect(result.netScore).toBe(1)
  })

  it('creates new downvote when no existing vote', async () => {
    mockPrisma.jobVote.findUnique.mockResolvedValue(null)
    mockPrisma.jobVote.upsert.mockResolvedValue({
      id: 'vote-1', userId: 'u1', jobId: 'j1', value: -1,
    } as any)
    mockPrisma.jobVote.aggregate.mockResolvedValue({ _sum: { value: -1 } } as any)

    const result = await castVote({ userId: 'u1', jobId: 'j1', value: -1 })

    expect(result.vote?.value).toBe(-1)
    expect(result.netScore).toBe(-1)
  })

  it('toggles off when same value already exists (removes vote)', async () => {
    mockPrisma.jobVote.findUnique.mockResolvedValue({
      id: 'vote-1', userId: 'u1', jobId: 'j1', value: 1,
    } as any)
    mockPrisma.jobVote.delete.mockResolvedValue({} as any)
    mockPrisma.jobVote.aggregate.mockResolvedValue({ _sum: { value: 0 } } as any)

    const result = await castVote({ userId: 'u1', jobId: 'j1', value: 1 })

    expect(result.vote).toBeNull()
    expect(mockPrisma.jobVote.delete).toHaveBeenCalledTimes(1)
  })

  it('switches from upvote to downvote', async () => {
    mockPrisma.jobVote.findUnique.mockResolvedValue({
      id: 'vote-1', userId: 'u1', jobId: 'j1', value: 1,
    } as any)
    mockPrisma.jobVote.upsert.mockResolvedValue({
      id: 'vote-1', userId: 'u1', jobId: 'j1', value: -1,
    } as any)
    mockPrisma.jobVote.aggregate.mockResolvedValue({ _sum: { value: -1 } } as any)

    const result = await castVote({ userId: 'u1', jobId: 'j1', value: -1 })

    expect(result.vote?.value).toBe(-1)
    expect(mockPrisma.jobVote.upsert).toHaveBeenCalledTimes(1)
    expect(mockPrisma.jobVote.delete).not.toHaveBeenCalled()
  })

  it('switches from downvote to upvote', async () => {
    mockPrisma.jobVote.findUnique.mockResolvedValue({
      id: 'vote-1', userId: 'u1', jobId: 'j1', value: -1,
    } as any)
    mockPrisma.jobVote.upsert.mockResolvedValue({
      id: 'vote-1', userId: 'u1', jobId: 'j1', value: 1,
    } as any)
    mockPrisma.jobVote.aggregate.mockResolvedValue({ _sum: { value: 1 } } as any)

    const result = await castVote({ userId: 'u1', jobId: 'j1', value: 1 })

    expect(result.vote?.value).toBe(1)
  })

  it('rejects invalid vote values', async () => {
    await expect(
      castVote({ userId: 'u1', jobId: 'j1', value: 2 as any })
    ).rejects.toThrow(/Invalid vote value/)

    await expect(
      castVote({ userId: 'u1', jobId: 'j1', value: 0 as any })
    ).rejects.toThrow(/Invalid vote value/)
  })
})

describe('getJobVoteScore', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns net score from aggregate', async () => {
    mockPrisma.jobVote.aggregate.mockResolvedValue({ _sum: { value: 5 } } as any)

    const score = await getJobVoteScore('j1')
    expect(score).toBe(5)
  })

  it('returns 0 when no votes exist', async () => {
    mockPrisma.jobVote.aggregate.mockResolvedValue({ _sum: { value: null } } as any)

    const score = await getJobVoteScore('j1')
    expect(score).toBe(0)
  })
})

describe('getUserVote', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns vote value when vote exists', async () => {
    mockPrisma.jobVote.findUnique.mockResolvedValue({
      id: 'v1', userId: 'u1', jobId: 'j1', value: 1,
    } as any)

    const vote = await getUserVote('u1', 'j1')
    expect(vote).toBe(1)
  })

  it('returns null when no vote exists', async () => {
    mockPrisma.jobVote.findUnique.mockResolvedValue(null)

    const vote = await getUserVote('u1', 'j1')
    expect(vote).toBeNull()
  })
})
