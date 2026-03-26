import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Clerk
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))
import { auth } from '@clerk/nextjs/server'
const mockAuth = vi.mocked(auth)

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    trackedCompany: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    sourcePollLog: {
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    jobQueue: {
      updateMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))
import { prisma } from '@/lib/prisma'
const mockPrisma = vi.mocked(prisma, true)

// Mock queue
vi.mock('@/lib/queue', () => ({
  getQueue: vi.fn(),
}))
import { getQueue } from '@/lib/queue'
const mockGetQueue = vi.mocked(getQueue)

function mockAdmin() {
  mockAuth.mockResolvedValue({
    userId: 'user_admin',
    sessionClaims: { publicMetadata: { role: 'admin' } },
  } as any)
}

function mockModerator() {
  mockAuth.mockResolvedValue({
    userId: 'user_mod',
    sessionClaims: { publicMetadata: { role: 'moderator' } },
  } as any)
}

function mockUser() {
  mockAuth.mockResolvedValue({
    userId: 'user_plain',
    sessionClaims: { publicMetadata: { role: 'user' } },
  } as any)
}

function mockUnauth() {
  mockAuth.mockResolvedValue({ userId: null, sessionClaims: null } as any)
}

// ────────────────────────────────────────────
// Queue Stats
// ────────────────────────────────────────────
describe('GET /api/admin/queue-stats', () => {
  let GET: (req: Request) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/admin/queue-stats/route')
    GET = mod.GET
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauth()
    const res = await GET(new Request('http://localhost/api/admin/queue-stats'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for regular users', async () => {
    mockUser()
    const res = await GET(new Request('http://localhost/api/admin/queue-stats'))
    expect(res.status).toBe(403)
  })

  it('returns stats for moderator', async () => {
    mockModerator()
    const mockQueue = {
      getStats: vi.fn().mockResolvedValue({
        pending: 5,
        processing: 2,
        completed: 100,
        failed: 3,
        dead: 1,
        avgProcessingMs: 1200,
        oldestPending: new Date('2026-03-22T10:00:00Z'),
      }),
    }
    mockGetQueue.mockReturnValue(mockQueue as any)

    const res = await GET(new Request('http://localhost/api/admin/queue-stats'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.pending).toBe(5)
    expect(body.processing).toBe(2)
    expect(body.dead).toBe(1)
  })

  it('returns stats for admin', async () => {
    mockAdmin()
    const mockQueue = {
      getStats: vi.fn().mockResolvedValue({
        pending: 0, processing: 0, completed: 0, failed: 0, dead: 0,
        avgProcessingMs: null, oldestPending: null,
      }),
    }
    mockGetQueue.mockReturnValue(mockQueue as any)

    const res = await GET(new Request('http://localhost/api/admin/queue-stats'))
    expect(res.status).toBe(200)
  })
})

// ────────────────────────────────────────────
// Source Health
// ────────────────────────────────────────────
describe('GET /api/admin/source-health', () => {
  let GET: (req: Request) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/admin/source-health/route')
    GET = mod.GET
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauth()
    const res = await GET(new Request('http://localhost/api/admin/source-health'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for regular users', async () => {
    mockUser()
    const res = await GET(new Request('http://localhost/api/admin/source-health'))
    expect(res.status).toBe(403)
  })

  it('returns per-source metrics for moderator', async () => {
    mockModerator()
    mockPrisma.sourcePollLog.findMany.mockResolvedValue([
      {
        id: '1', source: 'greenhouse', jobsFound: 10, durationMs: 500,
        error: null, createdAt: new Date(),
      } as any,
    ])

    const res = await GET(new Request('http://localhost/api/admin/source-health'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.sources).toBeDefined()
    expect(Array.isArray(body.sources)).toBe(true)
  })
})

// ────────────────────────────────────────────
// Companies CRUD
// ────────────────────────────────────────────
describe('GET /api/admin/companies', () => {
  let GET: (req: Request) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/admin/companies/route')
    GET = mod.GET
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauth()
    const res = await GET(new Request('http://localhost/api/admin/companies'))
    expect(res.status).toBe(401)
  })

  it('returns 403 for regular users', async () => {
    mockUser()
    const res = await GET(new Request('http://localhost/api/admin/companies'))
    expect(res.status).toBe(403)
  })

  it('returns companies list for moderator', async () => {
    mockModerator()
    mockPrisma.trackedCompany.findMany.mockResolvedValue([
      { id: '1', slug: 'stripe', name: 'Stripe', ats: 'greenhouse', isActive: true } as any,
    ])

    const res = await GET(new Request('http://localhost/api/admin/companies'))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.companies).toHaveLength(1)
    expect(body.companies[0].slug).toBe('stripe')
  })
})

describe('POST /api/admin/companies', () => {
  let POST: (req: Request) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/admin/companies/route')
    POST = mod.POST
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauth()
    const res = await POST(new Request('http://localhost/api/admin/companies', {
      method: 'POST',
      body: JSON.stringify({ slug: 'test', name: 'Test', ats: 'greenhouse' }),
    }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for moderators (admin-only)', async () => {
    mockModerator()
    const res = await POST(new Request('http://localhost/api/admin/companies', {
      method: 'POST',
      body: JSON.stringify({ slug: 'test', name: 'Test', ats: 'greenhouse' }),
    }))
    expect(res.status).toBe(403)
  })

  it('creates company when admin', async () => {
    mockAdmin()
    mockPrisma.trackedCompany.create.mockResolvedValue({
      id: 'new-uuid', slug: 'newco', name: 'NewCo', ats: 'greenhouse',
    } as any)

    const res = await POST(new Request('http://localhost/api/admin/companies', {
      method: 'POST',
      body: JSON.stringify({ slug: 'newco', name: 'NewCo', ats: 'greenhouse' }),
    }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(body.company.slug).toBe('newco')
  })

  it('returns 400 when required fields are missing', async () => {
    mockAdmin()
    const res = await POST(new Request('http://localhost/api/admin/companies', {
      method: 'POST',
      body: JSON.stringify({ slug: 'test' }),
    }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid ats value', async () => {
    mockAdmin()
    const res = await POST(new Request('http://localhost/api/admin/companies', {
      method: 'POST',
      body: JSON.stringify({ slug: 'test', name: 'Test', ats: 'invalid' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/admin/companies/[id]', () => {
  let PATCH: (req: Request, ctx: any) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/admin/companies/[id]/route')
    PATCH = mod.PATCH
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauth()
    const res = await PATCH(
      new Request('http://localhost/api/admin/companies/123', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: '123' }) }
    )
    expect(res.status).toBe(401)
  })

  it('returns 403 for moderators (admin-only)', async () => {
    mockModerator()
    const res = await PATCH(
      new Request('http://localhost/api/admin/companies/123', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: '123' }) }
    )
    expect(res.status).toBe(403)
  })

  it('updates company when admin', async () => {
    mockAdmin()
    mockPrisma.trackedCompany.findUnique.mockResolvedValue({ id: '123' } as any)
    mockPrisma.trackedCompany.update.mockResolvedValue({
      id: '123', slug: 'stripe', isActive: false,
    } as any)

    const res = await PATCH(
      new Request('http://localhost/api/admin/companies/123', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: '123' }) }
    )
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.company.isActive).toBe(false)
  })

  it('returns 404 when company not found', async () => {
    mockAdmin()
    mockPrisma.trackedCompany.findUnique.mockResolvedValue(null)

    const res = await PATCH(
      new Request('http://localhost/api/admin/companies/nonexistent', {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: 'nonexistent' }) }
    )
    expect(res.status).toBe(404)
  })
})

// ────────────────────────────────────────────
// Dead-letter Retry
// ────────────────────────────────────────────
describe('POST /api/admin/queue/retry-dead', () => {
  let POST: (req: Request) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/admin/queue/retry-dead/route')
    POST = mod.POST
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauth()
    const res = await POST(new Request('http://localhost/api/admin/queue/retry-dead', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for regular users', async () => {
    mockUser()
    const res = await POST(new Request('http://localhost/api/admin/queue/retry-dead', { method: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('allows moderator to retry dead tasks', async () => {
    mockModerator()
    mockPrisma.jobQueue.updateMany.mockResolvedValue({ count: 5 })

    const res = await POST(new Request('http://localhost/api/admin/queue/retry-dead', { method: 'POST' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.retried).toBe(5)
  })

  it('allows admin to retry dead tasks', async () => {
    mockAdmin()
    mockPrisma.jobQueue.updateMany.mockResolvedValue({ count: 0 })

    const res = await POST(new Request('http://localhost/api/admin/queue/retry-dead', { method: 'POST' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.retried).toBe(0)
  })
})

// ────────────────────────────────────────────
// Queue Drain
// ────────────────────────────────────────────
describe('POST /api/admin/queue/drain', () => {
  let POST: (req: Request) => Promise<Response>

  beforeEach(async () => {
    vi.resetAllMocks()
    const mod = await import('../../../app/api/admin/queue/drain/route')
    POST = mod.POST
  })

  it('returns 401 when unauthenticated', async () => {
    mockUnauth()
    const res = await POST(new Request('http://localhost/api/admin/queue/drain', { method: 'POST' }))
    expect(res.status).toBe(401)
  })

  it('returns 403 for moderators (admin-only)', async () => {
    mockModerator()
    const res = await POST(new Request('http://localhost/api/admin/queue/drain', { method: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('returns 403 for regular users', async () => {
    mockUser()
    const res = await POST(new Request('http://localhost/api/admin/queue/drain', { method: 'POST' }))
    expect(res.status).toBe(403)
  })

  it('drains all pending tasks when admin', async () => {
    mockAdmin()
    mockPrisma.jobQueue.updateMany.mockResolvedValue({ count: 42 })

    const res = await POST(new Request('http://localhost/api/admin/queue/drain', { method: 'POST' }))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.drained).toBe(42)
  })
})
