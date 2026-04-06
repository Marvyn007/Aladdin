import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AshbyAdapter } from '../ashby'
import fixtureData from '../../../../../__fixtures__/ashby-openai.json'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('AshbyAdapter', () => {
  let adapter: AshbyAdapter

  beforeEach(() => {
    adapter = new AshbyAdapter()
    mockFetch.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('poll', () => {
    it('populates rawDescriptionHtml from descriptionHtml field (bug regression)', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'openai' })
      for (const job of jobs) {
        expect(job.rawDescriptionHtml).not.toBeNull()
        expect(job.jobDescriptionPlain).not.toBeNull()
      }
    })

    it('detects internship jobType and entry experienceLevel from intern title', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'openai' })
      const intern = jobs.find((j) => j.title === 'Software Engineer Intern')
      expect(intern?.jobType).toBe('internship')
      expect(intern?.experienceLevel).toBe('entry')
    })

    it('detects senior experienceLevel from senior title', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'openai' })
      const senior = jobs.find((j) => j.title === 'Senior Machine Learning Engineer')
      expect(senior?.experienceLevel).toBe('senior')
    })

    it('falls back to employmentType when title has no jobType signal', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'openai' })
      const senior = jobs.find((j) => j.title === 'Senior Machine Learning Engineer')
      expect(senior?.jobType).toBe('fulltime')
    })

    it('sets source to ashby', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'openai' })
      for (const job of jobs) {
        expect(job.source).toBe('ashby')
      }
    })

    it('parses salary from compensation array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(fixtureData),
      })

      const jobs = await adapter.poll({ type: 'company', slug: 'openai' })
      const senior = jobs.find((j) => j.title === 'Senior Machine Learning Engineer')
      expect(senior?.salaryMin).toBe(200000)
      expect(senior?.salaryMax).toBe(280000)
      expect(senior?.salaryCurrency).toBe('USD')
    })

    it('throws on HTTP error', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' })
      await expect(adapter.poll({ type: 'company', slug: 'nonexistent' })).rejects.toThrow(/404/)
    })
  })

  describe('name', () => {
    it('is ashby', () => {
      expect(adapter.name).toBe('ashby')
    })
  })
})
