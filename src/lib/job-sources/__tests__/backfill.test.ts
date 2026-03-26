import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { inferSourceFromUrl, backfillJobs, type BackfillResult } from '../backfill'
import { hydrateCompanyLogos } from '@/lib/company-backfill'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))
import { prisma } from '@/lib/prisma'
const mockPrisma = vi.mocked(prisma, true)

describe('inferSourceFromUrl', () => {
  it('detects greenhouse from boards.greenhouse.io', () => {
    expect(inferSourceFromUrl('https://boards.greenhouse.io/stripe/jobs/12345')).toBe('greenhouse')
  })

  it('detects greenhouse from job-boards.greenhouse.io', () => {
    expect(inferSourceFromUrl('https://job-boards.greenhouse.io/stripe/jobs/12345')).toBe('greenhouse')
  })

  it('detects lever from jobs.lever.co', () => {
    expect(inferSourceFromUrl('https://jobs.lever.co/netflix/abc-123')).toBe('lever')
  })

  it('detects themuse from www.themuse.com', () => {
    expect(inferSourceFromUrl('https://www.themuse.com/jobs/company/job-title')).toBe('themuse')
  })

  it('detects arbeitnow from www.arbeitnow.com', () => {
    expect(inferSourceFromUrl('https://www.arbeitnow.com/view/some-slug')).toBe('arbeitnow')
  })

  it('detects himalayas from himalayas.app', () => {
    expect(inferSourceFromUrl('https://himalayas.app/companies/acme/jobs/engineer')).toBe('himalayas')
  })

  it('returns imported for manual-import sentinel', () => {
    expect(inferSourceFromUrl('manual-import')).toBe('imported')
  })

  it('returns imported for unknown domains', () => {
    expect(inferSourceFromUrl('https://some-random-company.com/careers/123')).toBe('imported')
  })

  it('returns imported for empty string', () => {
    expect(inferSourceFromUrl('')).toBe('imported')
  })

  it('returns imported for malformed URLs', () => {
    expect(inferSourceFromUrl('not-a-url')).toBe('imported')
  })
})

describe('backfillJobs', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns zero counts when no jobs need backfill', async () => {
    mockPrisma.job.findMany.mockResolvedValue([])

    const result = await backfillJobs()

    expect(result.updated).toBe(0)
    expect(result.duplicatesRemoved).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('backfills source from sourceUrl for jobs missing source', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Engineer',
        company: 'Stripe',
        location: 'SF',
        sourceUrl: 'https://boards.greenhouse.io/stripe/jobs/12345',
        source: null,
        externalId: null,
        applyUrl: null,
      } as any,
    ])
    mockPrisma.job.update.mockResolvedValue({} as any)
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))

    const result = await backfillJobs()

    expect(result.updated).toBe(1)
    expect(mockPrisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          source: 'greenhouse',
        }),
      })
    )
  })

  it('generates externalId via fallback hash for jobs missing it', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        sourceUrl: 'https://example.com/job/1',
        source: null,
        externalId: null,
        applyUrl: 'https://example.com/apply/1',
      } as any,
    ])
    mockPrisma.job.update.mockResolvedValue({} as any)
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))

    const result = await backfillJobs()

    expect(result.updated).toBe(1)
    const updateCall = mockPrisma.job.update.mock.calls[0][0]
    expect(updateCall.data.externalId).toBeDefined()
    expect(typeof updateCall.data.externalId).toBe('string')
    expect((updateCall.data.externalId as string).length).toBe(64) // SHA-256 hex
  })

  it('preserves existing source when already set', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        sourceUrl: 'https://boards.greenhouse.io/acme/jobs/1',
        source: 'greenhouse',
        externalId: null,
        applyUrl: null,
      } as any,
    ])
    mockPrisma.job.update.mockResolvedValue({} as any)
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))

    await backfillJobs()

    const updateCall = mockPrisma.job.update.mock.calls[0][0]
    expect(updateCall.data.source).toBe('greenhouse') // preserved, not overwritten
  })

  it('preserves existing externalId when already set', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-1',
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        sourceUrl: 'https://boards.greenhouse.io/acme/jobs/1',
        source: null,
        externalId: 'existing-ext-id',
        applyUrl: null,
      } as any,
    ])
    mockPrisma.job.update.mockResolvedValue({} as any)
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))

    await backfillJobs()

    const updateCall = mockPrisma.job.update.mock.calls[0][0]
    expect(updateCall.data.externalId).toBe('existing-ext-id')
  })

  it('detects and removes duplicates, keeping the richer row', async () => {
    // Two jobs with same (source, externalId) — keep the one with longer description
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-sparse',
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        sourceUrl: 'https://boards.greenhouse.io/acme/jobs/1',
        source: null,
        externalId: null,
        applyUrl: null,
        jobDescriptionPlain: 'Short',
        rawDescriptionHtml: null,
      } as any,
      {
        id: 'job-rich',
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        sourceUrl: 'https://boards.greenhouse.io/acme/jobs/1',
        source: null,
        externalId: null,
        applyUrl: null,
        jobDescriptionPlain: 'A much longer description with more detail about the role.',
        rawDescriptionHtml: '<p>Full HTML</p>',
      } as any,
    ])
    mockPrisma.job.update.mockResolvedValue({} as any)
    mockPrisma.job.delete.mockResolvedValue({} as any)
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))

    const result = await backfillJobs()

    expect(result.duplicatesRemoved).toBe(1)
    // The sparse one should be deleted
    expect(mockPrisma.job.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-sparse' } })
    )
    // The rich one should be updated
    expect(mockPrisma.job.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-rich' } })
    )
  })

  it('tracks errors for individual job failures without aborting', async () => {
    mockPrisma.job.findMany.mockResolvedValue([
      {
        id: 'job-ok',
        title: 'Engineer',
        company: 'Acme',
        location: 'Remote',
        sourceUrl: 'https://example.com/1',
        source: null,
        externalId: null,
        applyUrl: null,
      } as any,
      {
        id: 'job-bad',
        title: 'Engineer',
        company: 'Bad Corp',
        location: 'Remote',
        sourceUrl: 'https://example.com/2',
        source: null,
        externalId: null,
        applyUrl: null,
      } as any,
    ])
    // First call succeeds, second fails
    mockPrisma.job.update
      .mockResolvedValueOnce({} as any)
      .mockRejectedValueOnce(new Error('DB error'))
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma))

    const result = await backfillJobs()

    expect(result.updated).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('job-bad')
  })
})

describe('company logo backfill script', () => {
  afterEach(() => {
    vi.resetAllMocks()
    vi.restoreAllMocks()
  })

  it('iterates rows, calls helper, and logs summary counts', async () => {
    const rows = [
      { id: '1', name: 'Acme', domain: 'Acme.com', website_url: 'https://acme.com', logo_url: '' },
      { id: '2', name: 'Beta', domain: null, website_url: 'https://beta.com', logo_url: null },
    ]

    const ensureCompanyProfile = vi
      .fn()
      .mockResolvedValueOnce({ logoUrl: 'https://acme.com/logo.png', source: 'mask-icon', confidence: 'metadata', domain: 'acme.com' })
      .mockResolvedValueOnce({ logoUrl: null, source: 'none', confidence: 'none', domain: 'beta.com' })

    const logSpy = vi.fn()
    const errorSpy = vi.fn()

    await hydrateCompanyLogos(rows, ensureCompanyProfile, {
      logger: { log: logSpy, error: errorSpy },
      throttleMs: 0,
      sleeper: async () => {},
    })

    expect(ensureCompanyProfile).toHaveBeenCalledTimes(rows.length)
    expect(ensureCompanyProfile.mock.calls[0][0]).toMatchObject({
      name: 'Acme',
      domain: 'Acme.com',
      websiteUrl: 'https://acme.com',
    })
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('OK   Acme'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('MISS Beta'))
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Done. Updated=1 Skipped=0 Missed=1 Errors=0'))
    expect(errorSpy).not.toHaveBeenCalled()
  })
})
