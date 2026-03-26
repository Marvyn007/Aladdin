import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GreenhouseAdapter } from '../greenhouse'
import type { NormalizedJob } from '../../types'
import fixtureData from '../../../../../__fixtures__/greenhouse-stripe.json'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('GreenhouseAdapter', () => {
  let adapter: GreenhouseAdapter

  beforeEach(() => {
    adapter = new GreenhouseAdapter()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('poll', () => {
    it('parses Greenhouse fixture into correct NormalizedJob[] fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'stripe' })

      expect(jobs).toHaveLength(3)

      const first = jobs[0]
      expect(first.title).toBe('Account Executive, AI Sales')
      expect(first.company).toBe('Stripe')
      expect(first.location).toBe('San Francisco, CA')
      expect(first.sourceUrl).toBe('https://stripe.com/jobs/search?gh_jid=7532733')
      expect(first.source).toBe('greenhouse')
      expect(first.externalId).toBe('7532733')
      expect(first.postedAt).toBeInstanceOf(Date)
      expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(first.isRemote).toBe(false)
      expect(first.metadata).toHaveProperty('internal_job_id', 3336216)
    })

    it('always sets source to greenhouse', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'stripe' })
      for (const job of jobs) {
        expect(job.source).toBe('greenhouse')
      }
    })

    it('uses Greenhouse job id as externalId (number → string)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'stripe' })
      expect(jobs[0].externalId).toBe('7532733')
      expect(jobs[1].externalId).toBe('7546284')
      expect(jobs[2].externalId).toBe('7547809')
    })

    it('generates deterministic contentHash', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs1 = await adapter.poll({ type: 'company', slug: 'stripe' })

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs2 = await adapter.poll({ type: 'company', slug: 'stripe' })

      expect(jobs1[0].contentHash).toBe(jobs2[0].contentHash)
    })

    it('returns empty array for board with no jobs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobs: [] }),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'emptycorp' })
      expect(jobs).toEqual([])
    })

    it('throws a typed error on malformed JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ unexpected: 'shape' }),
      })

      await expect(
        adapter.poll({ type: 'company', slug: 'badcorp' })
      ).rejects.toThrow()
    })

    it('throws on HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })

      await expect(
        adapter.poll({ type: 'company', slug: 'nonexistent' })
      ).rejects.toThrow(/404/)
    })

    it('calls the correct Greenhouse API URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobs: [] }),
      })

      await adapter.poll({ type: 'company', slug: 'stripe' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://boards-api.greenhouse.io/v1/boards/stripe/jobs',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('populates NormalizedJob fields with correct defaults', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'stripe' })
      const job = jobs[0]

      // Greenhouse listing endpoint doesn't include descriptions or salary
      expect(job.rawDescriptionHtml).toBeNull()
      expect(job.jobDescriptionPlain).toBeNull()
      expect(job.salaryMin).toBeNull()
      expect(job.salaryMax).toBeNull()
      expect(job.salaryCurrency).toBeNull()
      expect(job.jobType).toBeNull()
      expect(job.experienceLevel).toBeNull()
      expect(job.skills).toEqual([])
      expect(job.applyUrl).toBe('https://stripe.com/jobs/search?gh_jid=7532733')
      expect(job.expiresAt).toBeNull()
    })
  })

  describe('healthCheck', () => {
    it('returns healthy when API responds with 200', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobs: [] }),
      })

      const health = await adapter.healthCheck()
      expect(health.healthy).toBe(true)
      expect(health.source).toBe('greenhouse')
      expect(health.latencyMs).toBeTypeOf('number')
      expect(health.lastError).toBeNull()
    })

    it('returns unhealthy on network error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'))

      const health = await adapter.healthCheck()
      expect(health.healthy).toBe(false)
      expect(health.lastError).toBe('network error')
    })
  })

  describe('name', () => {
    it('is greenhouse', () => {
      expect(adapter.name).toBe('greenhouse')
    })
  })
})
