import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Clerk
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))
import { auth } from '@clerk/nextjs/server'
const mockAuth = vi.mocked(auth)

// Mock voting service
vi.mock('../voting-service', () => ({
  castVote: vi.fn(),
  getJobVoteScore: vi.fn(),
  getUserVote: vi.fn(),
}))
import { castVote, getJobVoteScore, getUserVote } from '../voting-service'
const mockCastVote = vi.mocked(castVote)
const mockGetScore = vi.mocked(getJobVoteScore)
const mockGetUserVote = vi.mocked(getUserVote)

describe('POST /api/job/[id]/vote', () => {
  let POST: (req: Request, ctx: any) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/job/[id]/vote/route')
    POST = mod.POST
  })

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)

    const res = await POST(
      new Request('http://localhost/api/job/j1/vote', {
        method: 'POST',
        body: JSON.stringify({ value: 1 }),
      }),
      { params: Promise.resolve({ id: 'j1' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid vote value', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)

    const res = await POST(
      new Request('http://localhost/api/job/j1/vote', {
        method: 'POST',
        body: JSON.stringify({ value: 5 }),
      }),
      { params: Promise.resolve({ id: 'j1' }) }
    )
    expect(res.status).toBe(400)
  })

  it('casts upvote and returns result', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)
    mockCastVote.mockResolvedValue({
      vote: { id: 'v1', userId: 'u1', jobId: 'j1', value: 1 },
      netScore: 3,
    })

    const res = await POST(
      new Request('http://localhost/api/job/j1/vote', {
        method: 'POST',
        body: JSON.stringify({ value: 1 }),
      }),
      { params: Promise.resolve({ id: 'j1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.vote.value).toBe(1)
    expect(body.netScore).toBe(3)
  })

  it('casts downvote and returns result', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)
    mockCastVote.mockResolvedValue({
      vote: { id: 'v1', userId: 'u1', jobId: 'j1', value: -1 },
      netScore: -2,
    })

    const res = await POST(
      new Request('http://localhost/api/job/j1/vote', {
        method: 'POST',
        body: JSON.stringify({ value: -1 }),
      }),
      { params: Promise.resolve({ id: 'j1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.vote.value).toBe(-1)
    expect(body.netScore).toBe(-2)
  })

  it('returns null vote when toggled off', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)
    mockCastVote.mockResolvedValue({
      vote: null,
      netScore: 0,
    })

    const res = await POST(
      new Request('http://localhost/api/job/j1/vote', {
        method: 'POST',
        body: JSON.stringify({ value: 1 }),
      }),
      { params: Promise.resolve({ id: 'j1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.vote).toBeNull()
    expect(body.netScore).toBe(0)
  })

  it('passes correct userId and jobId to castVote', async () => {
    mockAuth.mockResolvedValue({ userId: 'user_abc' } as any)
    mockCastVote.mockResolvedValue({ vote: null, netScore: 0 })

    await POST(
      new Request('http://localhost/api/job/job_xyz/vote', {
        method: 'POST',
        body: JSON.stringify({ value: -1 }),
      }),
      { params: Promise.resolve({ id: 'job_xyz' }) }
    )

    expect(mockCastVote).toHaveBeenCalledWith({
      userId: 'user_abc',
      jobId: 'job_xyz',
      value: -1,
    })
  })
})

describe('GET /api/job/[id]/vote', () => {
  let GET: (req: Request, ctx: any) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/job/[id]/vote/route')
    GET = mod.GET
  })

  it('returns score and user vote when authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: 'u1' } as any)
    mockGetScore.mockResolvedValue(5)
    mockGetUserVote.mockResolvedValue(1)

    const res = await GET(
      new Request('http://localhost/api/job/j1/vote'),
      { params: Promise.resolve({ id: 'j1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.netScore).toBe(5)
    expect(body.userVote).toBe(1)
  })

  it('returns score with null userVote when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as any)
    mockGetScore.mockResolvedValue(3)

    const res = await GET(
      new Request('http://localhost/api/job/j1/vote'),
      { params: Promise.resolve({ id: 'j1' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.netScore).toBe(3)
    expect(body.userVote).toBeNull()
  })
})
