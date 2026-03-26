import { describe, it, expect, vi, beforeEach } from 'vitest'
import { requireRole, type AdminRole } from '../rbac'
import { NextResponse } from 'next/server'

// Mock Clerk's auth()
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}))

// Get the mocked auth function
import { auth } from '@clerk/nextjs/server'
const mockAuth = vi.mocked(auth)

describe('requireRole', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null, sessionClaims: null } as any)

      const result = await requireRole('user')
      expect(result).toHaveProperty('error')
      expect(result.error?.status).toBe(401)
    })

    it('returns 401 when auth() throws', async () => {
      mockAuth.mockRejectedValue(new Error('auth failed'))

      const result = await requireRole('user')
      expect(result).toHaveProperty('error')
      expect(result.error?.status).toBe(401)
    })
  })

  describe('role extraction from publicMetadata', () => {
    it('extracts admin role from sessionClaims.publicMetadata', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_123',
        sessionClaims: { publicMetadata: { role: 'admin' } },
      } as any)

      const result = await requireRole('admin')
      expect(result.userId).toBe('user_123')
      expect(result.role).toBe('admin')
      expect(result.error).toBeUndefined()
    })

    it('extracts moderator role from sessionClaims.publicMetadata', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_456',
        sessionClaims: { publicMetadata: { role: 'moderator' } },
      } as any)

      const result = await requireRole('moderator')
      expect(result.userId).toBe('user_456')
      expect(result.role).toBe('moderator')
      expect(result.error).toBeUndefined()
    })

    it('defaults to user role when publicMetadata has no role', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_789',
        sessionClaims: { publicMetadata: {} },
      } as any)

      const result = await requireRole('user')
      expect(result.role).toBe('user')
    })

    it('defaults to user role when publicMetadata is missing', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_000',
        sessionClaims: {},
      } as any)

      const result = await requireRole('user')
      expect(result.role).toBe('user')
    })

    it('defaults to user role when sessionClaims is null', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_000',
        sessionClaims: null,
      } as any)

      const result = await requireRole('user')
      expect(result.role).toBe('user')
    })
  })

  describe('role hierarchy enforcement', () => {
    it('admin can access admin-required routes', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_admin',
        sessionClaims: { publicMetadata: { role: 'admin' } },
      } as any)

      const result = await requireRole('admin')
      expect(result.error).toBeUndefined()
      expect(result.userId).toBe('user_admin')
    })

    it('admin can access moderator-required routes', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_admin',
        sessionClaims: { publicMetadata: { role: 'admin' } },
      } as any)

      const result = await requireRole('moderator')
      expect(result.error).toBeUndefined()
    })

    it('admin can access user-required routes', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_admin',
        sessionClaims: { publicMetadata: { role: 'admin' } },
      } as any)

      const result = await requireRole('user')
      expect(result.error).toBeUndefined()
    })

    it('moderator can access moderator-required routes', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_mod',
        sessionClaims: { publicMetadata: { role: 'moderator' } },
      } as any)

      const result = await requireRole('moderator')
      expect(result.error).toBeUndefined()
    })

    it('moderator CANNOT access admin-required routes', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_mod',
        sessionClaims: { publicMetadata: { role: 'moderator' } },
      } as any)

      const result = await requireRole('admin')
      expect(result).toHaveProperty('error')
      expect(result.error?.status).toBe(403)
    })

    it('user CANNOT access moderator-required routes', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_plain',
        sessionClaims: { publicMetadata: { role: 'user' } },
      } as any)

      const result = await requireRole('moderator')
      expect(result).toHaveProperty('error')
      expect(result.error?.status).toBe(403)
    })

    it('user CANNOT access admin-required routes', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_plain',
        sessionClaims: { publicMetadata: { role: 'user' } },
      } as any)

      const result = await requireRole('admin')
      expect(result).toHaveProperty('error')
      expect(result.error?.status).toBe(403)
    })

    it('unknown/invalid role defaults to user and is denied admin routes', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_unknown',
        sessionClaims: { publicMetadata: { role: 'superadmin' } },
      } as any)

      const result = await requireRole('admin')
      expect(result).toHaveProperty('error')
      expect(result.error?.status).toBe(403)
    })
  })

  describe('error response format', () => {
    it('401 error includes Unauthorized message', async () => {
      mockAuth.mockResolvedValue({ userId: null, sessionClaims: null } as any)

      const result = await requireRole('user')
      expect(result.error?.body.error).toBe('Unauthorized')
    })

    it('403 error includes Forbidden message with required role', async () => {
      mockAuth.mockResolvedValue({
        userId: 'user_plain',
        sessionClaims: { publicMetadata: { role: 'user' } },
      } as any)

      const result = await requireRole('admin')
      expect(result.error?.body.error).toBe('Forbidden')
      expect(result.error?.body.required).toBe('admin')
    })
  })
})
