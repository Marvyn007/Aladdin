import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HimalayasAdapter } from '../himalayas'
import type { NormalizedJob } from '../../types'
import fixtureData from '../../../../../__fixtures__/himalayas-bulk.json'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('HimalayasAdapter', () => {
  let adapter: HimalayasAdapter

  beforeEach(() => {
    adapter = new HimalayasAdapter()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('poll', () => {
    it('parses Himalayas fixture into correct NormalizedJob[] fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })

      expect(jobs).toHaveLength(3)

      const first = jobs[0]
      expect(first.title).toBe('Malware Analyst / Reverse Engineer (Latin America, Remote)')
      expect(first.company).toBe('Intel 471')
      expect(first.source).toBe('himalayas')
      expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/)
      expect(first.postedAt).toBeInstanceOf(Date)
    })

    it('always sets source to himalayas', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      for (const job of jobs) {
        expect(job.source).toBe('himalayas')
      }
    })

    it('uses guid as externalId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].externalId).toBe(
        'https://himalayas.app/companies/intel-471/jobs/malware-analyst-reverse-engineer-latin-america-remote'
      )
      expect(jobs[1].externalId).toBe(
        'https://himalayas.app/companies/work-mercor/jobs/lead-software-engineer-100-hr-max'
      )
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

    it('returns empty array when jobs is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobs: [], offset: 0, limit: 50, totalCount: 0 }),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs).toEqual([])
    })

    it('throws on missing jobs array', async () => {
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
        status: 500,
        statusText: 'Internal Server Error',
      })

      await expect(adapter.poll({ type: 'bulk', page: 1 })).rejects.toThrow(/500/)
    })

    it('calls the correct Himalayas API URL with offset from page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jobs: [], offset: 0, limit: 50, totalCount: 0 }),
      })

      await adapter.poll({ type: 'bulk', page: 3 })

      // page 3 → offset 100 (0-based: (page-1) * 50)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://himalayas.app/jobs/api?limit=50&offset=100',
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

    it('extracts salary from minSalary/maxSalary/currency fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })

      // First job has null salary
      expect(jobs[0].salaryMin).toBeNull()
      expect(jobs[0].salaryMax).toBeNull()

      // Second job has salary 200000
      expect(jobs[1].salaryMin).toBe(200000)
      expect(jobs[1].salaryMax).toBe(200000)
      expect(jobs[1].salaryCurrency).toBe('USD')

      // Third job has salary 50000-60000
      expect(jobs[2].salaryMin).toBe(50000)
      expect(jobs[2].salaryMax).toBe(60000)
    })

    it('sets isRemote to true for all Himalayas jobs', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      for (const job of jobs) {
        expect(job.isRemote).toBe(true)
      }
    })

    it('maps seniority to experienceLevel', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      // "Mid-level" → "mid"
      expect(jobs[0].experienceLevel).toBe('mid')
      // "Senior" → "senior"
      expect(jobs[1].experienceLevel).toBe('senior')
      // "Entry-level" → "entry"
      expect(jobs[2].experienceLevel).toBe('entry')
    })

    it('maps employmentType to jobType', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      // "Full Time" → "fulltime"
      expect(jobs[0].jobType).toBe('fulltime')
      expect(jobs[1].jobType).toBe('fulltime')
    })

    it('converts pubDate Unix seconds to Date', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].postedAt).toEqual(new Date(1774130397 * 1000))
    })

    it('sets expiresAt from expiryDate', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].expiresAt).toEqual(new Date(1779314396 * 1000))
    })

    it('joins locationRestrictions as location', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].location).toBe('Argentina; Brazil; Chile; Colombia; Mexico')
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
      expect(health.source).toBe('himalayas')
    })

    it('returns unhealthy on network error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'))

      const health = await adapter.healthCheck()
      expect(health.healthy).toBe(false)
      expect(health.lastError).toBe('network error')
    })
  })

  describe('name', () => {
    it('is himalayas', () => {
      expect(adapter.name).toBe('himalayas')
    })
  })
})
