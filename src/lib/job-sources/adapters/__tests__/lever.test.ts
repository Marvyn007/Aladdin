import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LeverAdapter } from '../lever'
import type { NormalizedJob } from '../../types'
import fixtureData from '../../../../../__fixtures__/lever-spotify.json'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('LeverAdapter', () => {
  let adapter: LeverAdapter

  beforeEach(() => {
    adapter = new LeverAdapter()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('poll', () => {
    it('parses Lever fixture into correct NormalizedJob[] fields', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'spotify' })

      expect(jobs).toHaveLength(3)

      const first = jobs[0]
      expect(first.title).toBe('Account Executive, Backstage')
      expect(first.company).toBe('spotify')
      expect(first.location).toBe('Toronto')
      expect(first.sourceUrl).toBe(
        'https://jobs.lever.co/spotify/1ff4a4e3-897c-4eab-9ee2-aa7d1d07a9d6'
      )
      expect(first.source).toBe('lever')
      expect(first.externalId).toBe('1ff4a4e3-897c-4eab-9ee2-aa7d1d07a9d6')
      expect(first.postedAt).toBeInstanceOf(Date)
      expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('always sets source to lever', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'spotify' })
      for (const job of jobs) {
        expect(job.source).toBe('lever')
      }
    })

    it('uses Lever posting UUID as externalId', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'spotify' })
      expect(jobs[0].externalId).toBe('1ff4a4e3-897c-4eab-9ee2-aa7d1d07a9d6')
      expect(jobs[1].externalId).toBe('a2b3c4d5-6789-4abc-def0-123456789abc')
      expect(jobs[2].externalId).toBe('b3c4d5e6-7890-4bcd-ef01-23456789abcd')
    })

    it('generates deterministic contentHash', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs1 = await adapter.poll({ type: 'company', slug: 'spotify' })

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs2 = await adapter.poll({ type: 'company', slug: 'spotify' })

      expect(jobs1[0].contentHash).toBe(jobs2[0].contentHash)
    })

    it('returns empty array for board with no postings', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'emptycorp' })
      expect(jobs).toEqual([])
    })

    it('throws on non-array response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ error: 'not found' }),
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

    it('calls the correct Lever API URL with mode=json', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })

      await adapter.poll({ type: 'company', slug: 'spotify' })

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.lever.co/v0/postings/spotify?mode=json',
        expect.objectContaining({ signal: expect.any(AbortSignal) })
      )
    })

    it('includes description from Lever (unlike Greenhouse)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'spotify' })
      const first = jobs[0]

      // Lever provides descriptions — should NOT be null
      expect(first.rawDescriptionHtml).toBeTruthy()
      expect(first.jobDescriptionPlain).toBeTruthy()
    })

    it('extracts salary from additionalPlain when present', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'spotify' })

      // First posting has salary "$126,163 - $157,504"
      expect(jobs[0].salaryMin).toBe(126163)
      expect(jobs[0].salaryMax).toBe(157504)
      expect(jobs[0].salaryCurrency).toBe('USD')

      // Third posting has no salary info
      expect(jobs[2].salaryMin).toBeNull()
      expect(jobs[2].salaryMax).toBeNull()
    })

    it('sets applyUrl from Lever posting applyUrl field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'spotify' })
      expect(jobs[0].applyUrl).toBe(
        'https://jobs.lever.co/spotify/1ff4a4e3-897c-4eab-9ee2-aa7d1d07a9d6/apply'
      )
    })

    it('detects remote from allLocations containing "Remote"', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'spotify' })

      // Second posting has "Remote US" in allLocations
      expect(jobs[1].isRemote).toBe(true)

      // First posting is Toronto only
      expect(jobs[0].isRemote).toBe(false)
    })

    it('converts createdAt timestamp to Date', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'spotify' })
      expect(jobs[0].postedAt).toEqual(new Date(1774778400000))
    })
  })

  describe('healthCheck', () => {
    it('returns healthy when API responds with 200', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      })

      const health = await adapter.healthCheck()
      expect(health.healthy).toBe(true)
      expect(health.source).toBe('lever')
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
    it('is lever', () => {
      expect(adapter.name).toBe('lever')
    })
  })
})
