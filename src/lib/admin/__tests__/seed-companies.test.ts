import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SEED_COMPANIES } from '../../job-sources/seeds'

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
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))
import { prisma } from '@/lib/prisma'
const mockPrisma = vi.mocked(prisma, true)

describe('seed-companies endpoint', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('seed data integrity', () => {
    it('contains exactly 93 companies', () => {
      expect(SEED_COMPANIES).toHaveLength(93)
    })

    it('has 90 Greenhouse and 3 Lever companies', () => {
      const greenhouse = SEED_COMPANIES.filter((c) => c.ats === 'greenhouse')
      const lever = SEED_COMPANIES.filter((c) => c.ats === 'lever')
      expect(greenhouse).toHaveLength(90)
      expect(lever).toHaveLength(3)
    })

    it('has no duplicate slug+ats pairs', () => {
      const keys = SEED_COMPANIES.map((c) => `${c.slug}:${c.ats}`)
      const unique = new Set(keys)
      expect(unique.size).toBe(SEED_COMPANIES.length)
    })

    it('every company has required fields', () => {
      for (const company of SEED_COMPANIES) {
        expect(company.slug).toBeTruthy()
        expect(company.name).toBeTruthy()
        expect(company.ats).toMatch(/^(greenhouse|lever)$/)
        expect(company.industry).toBeTruthy()
        expect(company.country).toBeTruthy()
      }
    })

    it('covers 15 industries', () => {
      const industries = new Set(SEED_COMPANIES.map((c) => c.industry))
      expect(industries.size).toBe(15)
    })

    it('includes key companies from spec', () => {
      const slugs = SEED_COMPANIES.map((c) => c.slug)
      expect(slugs).toContain('stripe')
      expect(slugs).toContain('airbnb')
      expect(slugs).toContain('figma')
      expect(slugs).toContain('anthropic')
      expect(slugs).toContain('coinbase')
      expect(slugs).toContain('netflix')
    })
  })

  describe('POST /api/admin/seed-companies', () => {
    // Import the route handler lazily to avoid module-level side effects
    let POST: (req: Request) => Promise<Response>

    beforeEach(async () => {
      const mod = await import('../../../app/api/admin/seed-companies/route')
      POST = mod.POST
    })

    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null, sessionClaims: null } as any)

      const response = await POST(new Request('http://localhost/api/admin/seed-companies', { method: 'POST' }))
      expect(response.status).toBe(401)
    })

    it('returns 403 when user is not admin', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_mod',
        sessionClaims: { publicMetadata: { role: 'moderator' } },
      } as any)

      const response = await POST(new Request('http://localhost/api/admin/seed-companies', { method: 'POST' }))
      expect(response.status).toBe(403)
    })

    it('returns 403 for regular users', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_plain',
        sessionClaims: { publicMetadata: { role: 'user' } },
      } as any)

      const response = await POST(new Request('http://localhost/api/admin/seed-companies', { method: 'POST' }))
      expect(response.status).toBe(403)
    })

    it('upserts all 93 seed companies when admin', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_admin',
        sessionClaims: { publicMetadata: { role: 'admin' } },
      } as any)

      mockPrisma.$transaction.mockResolvedValue(
        SEED_COMPANIES.map((c) => ({ id: 'uuid', slug: c.slug, name: c.name }))
      )

      const response = await POST(new Request('http://localhost/api/admin/seed-companies', { method: 'POST' }))
      const body = await response.json()

      expect(response.status).toBe(200)
      expect(body.ok).toBe(true)
      expect(body.upserted).toBe(93)
    })

    it('uses upsert with slug+ats as unique key', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_admin',
        sessionClaims: { publicMetadata: { role: 'admin' } },
      } as any)

      mockPrisma.$transaction.mockImplementation(async (ops: any) => {
        // The transaction receives an array of promises
        return ops
      })

      await POST(new Request('http://localhost/api/admin/seed-companies', { method: 'POST' }))

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1)
      const txArg = mockPrisma.$transaction.mock.calls[0][0]
      // Should be an array of 93 upsert promises
      expect(txArg).toHaveLength(93)
    })

    it('returns 500 on database error', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_admin',
        sessionClaims: { publicMetadata: { role: 'admin' } },
      } as any)

      mockPrisma.$transaction.mockRejectedValue(new Error('DB connection failed'))

      const response = await POST(new Request('http://localhost/api/admin/seed-companies', { method: 'POST' }))
      expect(response.status).toBe(500)
    })
  })
})
