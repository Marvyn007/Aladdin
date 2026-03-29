import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TheMuseAdapter } from '../themuse'
import type { NormalizedJob } from '../../types'
import fixtureData from '../../../../../__fixtures__/themuse-page1.json'

vi.mock('../../freshness', () => ({
  isFresh: () => true,
  shouldStopPaging: () => ({ stop: false, newCounter: 0 }),
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('TheMuseAdapter', () => {
  let adapter: TheMuseAdapter

  beforeEach(() => {
    adapter = new TheMuseAdapter('test-api-key')
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('poll', () => {
    it('parses Muse fixture into correct NormalizedJob[] fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })

      expect(jobs).toHaveLength(3)

      const first = jobs[0]
      expect(first.title).toBe('Software Engineer, Frontend')
      expect(first.company).toBe('Acme Corp')
      expect(first.location).toBe('New York, NY')
      expect(first.sourceUrl).toBe(
        'https://www.themuse.com/jobs/acme/software-engineer-frontend-5847293'
      )
      expect(first.source).toBe('themuse')
      expect(first.externalId).toBe('5847293')
      expect(first.postedAt).toEqual(new Date('2026-03-15T12:00:00Z'))
      expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('always sets source to themuse', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      for (const job of jobs) {
        expect(job.source).toBe('themuse')
      }
    })

    it('uses Muse numeric id as externalId (number → string)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs[0].externalId).toBe('5847293')
      expect(jobs[1].externalId).toBe('5847301')
      expect(jobs[2].externalId).toBe('5847310')
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

    it('returns empty array when results is empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ page: 1, page_count: 0, total: 0, results: [] }),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      expect(jobs).toEqual([])
    })

    it('throws on non-object or missing results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve('not json'),
      })

      await expect(adapter.poll({ type: 'bulk', page: 1 })).rejects.toThrow()
    })

    it('throws on HTTP error responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await expect(adapter.poll({ type: 'bulk', page: 1 })).rejects.toThrow(/401/)
    })

    it('calls the correct Muse API URL with api_key and page', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ page: 1, page_count: 0, total: 0, results: [] }),
      })

      await adapter.poll({ type: 'bulk', page: 3 })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://www.themuse.com/api/public/jobs?page=3&api_key=test-api-key',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('defaults to page 1 when page is not provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ page: 1, page_count: 0, total: 0, results: [] }),
      })

      await adapter.poll({ type: 'bulk' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('page=1'),
        expect.any(Object)
      )
    })

    it('includes HTML description from contents field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })
      const first = jobs[0]

      expect(first.rawDescriptionHtml).toBeTruthy()
      expect(first.rawDescriptionHtml).toContain('Frontend Engineer')
      expect(first.jobDescriptionPlain).toBeTruthy()
    })

    it('maps experience level from levels field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })

      // "mid" short_name → "mid"
      expect(jobs[0].experienceLevel).toBe('mid')
      // "senior" short_name → "senior"
      expect(jobs[1].experienceLevel).toBe('senior')
    })

    it('detects remote from locations containing "Remote"', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })

      // Second job has "Remote" in locations
      expect(jobs[1].isRemote).toBe(true)
      // First job is "New York, NY" only
      expect(jobs[0].isRemote).toBe(false)
    })

    it('joins multiple locations with semicolon', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'bulk', page: 1 })

      // Second job has two locations
      expect(jobs[1].location).toBe('San Francisco, CA; Remote')
    })
  })

  describe('healthCheck', () => {
    it('returns healthy when API responds with 200', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ page: 1, results: [] }),
      })

      const health = await adapter.healthCheck()
      expect(health.healthy).toBe(true)
      expect(health.source).toBe('themuse')
      expect(health.latencyMs).toBeTypeOf('number')
    })

    it('returns unhealthy on network error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'))

      const health = await adapter.healthCheck()
      expect(health.healthy).toBe(false)
      expect(health.lastError).toBe('network error')
    })
  })

  describe('name', () => {
    it('is themuse', () => {
      expect(adapter.name).toBe('themuse')
    })
  })
})
