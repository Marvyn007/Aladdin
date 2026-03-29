import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ArbeitnowAdapter } from '../arbeitnow'
import type { NormalizedJob } from '../../types'
import fixtureData from '../../../../../__fixtures__/arbeitnow-page1.json'

vi.mock('../../freshness', () => ({
  isFresh: () => true,
  shouldStopPaging: () => ({ stop: false, newCounter: 0 }),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('ArbeitnowAdapter', () => {
  let adapter: ArbeitnowAdapter

  beforeEach(() => {
    adapter = new ArbeitnowAdapter()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('poll', () => {
    it('parses Arbeitnow fixture into correct NormalizedJob[] fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })

      expect(jobs).toHaveLength(3)

      const first = jobs[0]
      expect(first.title).toBe('HR Project & People Manager (m/w/d) - Teilzeit')
      expect(first.company).toBe('FMC Human Ressource')
      expect(first.location).toBe('Stuttgart')
      expect(first.sourceUrl).toBe(
        'https://www.arbeitnow.com/jobs/companies/fmc-human-ressource/hr-project-people-manager-teilzeit-stuttgart-86397'
      )
      expect(first.source).toBe('arbeitnow')
      expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(first.postedAt).toBeInstanceOf(Date)
    })

    it('always sets source to arbeitnow', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      for (const job of jobs) {
        expect(job.source).toBe('arbeitnow')
      }
    })

    it('uses slug as externalId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].externalId).toBe('hr-project-people-manager-teilzeit-stuttgart-86397')
      expect(jobs[1].externalId).toBe('remote-technical-account-manager-dach-munich-214173')
      expect(jobs[2].externalId).toBe('senior-software-engineer-berlin-345678')
    })

    it('generates deterministic contentHash', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs1 = await adapter.poll({ type: 'bulk', page: 1 })

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs2 = await adapter.poll({ type: 'bulk', page: 1 })

      expect(jobs1[0].contentHash).toBe(jobs2[0].contentHash)
    })

    it('returns empty array when data is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [], links: {}, meta: {} }),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs).toEqual([])
    })

    it('throws on missing data array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ unexpected: true }),
      })

      await expect(adapter.poll({ type: 'bulk', page: 1 })).rejects.toThrow()
    })

    it('throws on HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      })

      await expect(adapter.poll({ type: 'bulk', page: 1 })).rejects.toThrow(/429/)
    })

    it('calls the correct Arbeitnow API URL with page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [], links: {}, meta: {} }),
      })

      await adapter.poll({ type: 'bulk', page: 2 })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.arbeitnow.com/api/job-board-api?page=2',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('includes HTML description', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].rawDescriptionHtml).toBeTruthy()
      expect(jobs[0].jobDescriptionPlain).toBeTruthy()
    })

    it('uses remote boolean from API response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })

      // First job: remote = false
      expect(jobs[0].isRemote).toBe(false)
      // Second job: remote = true
      expect(jobs[1].isRemote).toBe(true)
      // Third job: remote = true
      expect(jobs[2].isRemote).toBe(true)
    })

    it('converts created_at Unix seconds to Date', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].postedAt).toEqual(new Date(1774778400 * 1000))
    })

    it('maps job_types to jobType field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      // "Full-time" → "fulltime"
      expect(jobs[1].jobType).toBe('fulltime')
    })

    it('stores tags in metadata', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].metadata).toHaveProperty('tags')
      expect((jobs[0].metadata as { tags: string[] }).tags).toContain('Administration')
    })
  })

  describe('healthCheck', () => {
    it('returns healthy when API responds with 200', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      })

      const health = await adapter.healthCheck()
      expect(health.healthy).toBe(true)
      expect(health.source).toBe('arbeitnow')
    })

    it('returns unhealthy on network error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'))

      const health = await adapter.healthCheck()
      expect(health.healthy).toBe(false)
      expect(health.lastError).toBe('network error')
    })
  })

  describe('name', () => {
    it('is arbeitnow', () => {
      expect(adapter.name).toBe('arbeitnow')
    })
  })
})
