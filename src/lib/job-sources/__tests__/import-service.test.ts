import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importJob, type ImportJobInput } from '../import-service'
import { generateContentHash, generateFallbackId } from '../helpers'

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    job: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))
import { prisma } from '@/lib/prisma'
const mockPrisma = vi.mocked(prisma, true)

const BASE_INPUT: ImportJobInput = {
  title: 'Frontend Engineer',
  company: 'Acme Corp',
  location: 'New York, NY',
  sourceUrl: 'https://acme.com/jobs/frontend',
  applyUrl: 'https://acme.com/jobs/frontend/apply',
  rawDescriptionHtml: '<p>Build great UIs</p>',
  jobDescriptionPlain: 'Build great UIs',
  postedByUserId: 'user_123',
}

describe('importJob', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('duplicate detection via contentHash', () => {
    it('returns existing job when contentHash matches (no new insert)', async () => {
      const expectedHash = generateContentHash(
        BASE_INPUT.title,
        BASE_INPUT.company,
        BASE_INPUT.location,
        BASE_INPUT.sourceUrl
      )

      const existingJob = {
        id: 'existing-job-id',
        title: 'Frontend Engineer',
        company: 'Acme Corp',
        source: 'greenhouse',
        contentHash: expectedHash,
      }

      mockPrisma.job.findFirst.mockResolvedValue(existingJob as any)

      const result = await importJob(BASE_INPUT)

      expect(result.isDuplicate).toBe(true)
      expect(result.job.id).toBe('existing-job-id')
      // Should NOT call create
      expect(mockPrisma.job.create).not.toHaveBeenCalled()
    })

    it('inserts new job when no contentHash match exists', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)

      const newJob = {
        id: 'new-job-id',
        title: BASE_INPUT.title,
        company: BASE_INPUT.company,
        source: 'imported',
      }
      mockPrisma.job.create.mockResolvedValue(newJob as any)

      const result = await importJob(BASE_INPUT)

      expect(result.isDuplicate).toBe(false)
      expect(result.job.id).toBe('new-job-id')
      expect(mockPrisma.job.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('source and externalId', () => {
    it('sets source to "imported"', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)

      const createCall = mockPrisma.job.create.mock.calls[0][0]
      expect(createCall.data.source).toBe('imported')
    })

    it('generates deterministic externalId from fallback hash', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)

      const expectedId = generateFallbackId(
        BASE_INPUT.title,
        BASE_INPUT.company,
        BASE_INPUT.location,
        BASE_INPUT.applyUrl
      )

      const createCall = mockPrisma.job.create.mock.calls[0][0]
      expect(createCall.data.externalId).toBe(expectedId)
    })

    it('generates same externalId for same inputs (deterministic)', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)
      const id1 = mockPrisma.job.create.mock.calls[0][0].data.externalId

      vi.resetAllMocks()
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j2' } as any)

      await importJob(BASE_INPUT)
      const id2 = mockPrisma.job.create.mock.calls[0][0].data.externalId

      expect(id1).toBe(id2)
    })

    it('generates different externalId for different inputs', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)
      const id1 = mockPrisma.job.create.mock.calls[0][0].data.externalId

      vi.resetAllMocks()
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j2' } as any)

      await importJob({ ...BASE_INPUT, title: 'Backend Engineer' })
      const id2 = mockPrisma.job.create.mock.calls[0][0].data.externalId

      expect(id1).not.toBe(id2)
    })
  })

  describe('contentHash generation', () => {
    it('sets contentHash on created job', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)

      const createCall = mockPrisma.job.create.mock.calls[0][0]
      expect(createCall.data.contentHash).toMatch(/^[a-f0-9]{64}$/)
    })

    it('searches by contentHash for dedup', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)

      expect(mockPrisma.job.findFirst).toHaveBeenCalledWith({
        where: {
          contentHash: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      })
    })
  })

  describe('job fields', () => {
    it('sets postedByUserId', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)

      const createCall = mockPrisma.job.create.mock.calls[0][0]
      expect(createCall.data.postedByUserId).toBe('user_123')
    })

    it('sets isImported to 1 for backward compatibility', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)

      const createCall = mockPrisma.job.create.mock.calls[0][0]
      expect(createCall.data.isImported).toBe(1)
    })

    it('passes through description fields', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob(BASE_INPUT)

      const createCall = mockPrisma.job.create.mock.calls[0][0]
      expect(createCall.data.rawDescriptionHtml).toBe('<p>Build great UIs</p>')
      expect(createCall.data.jobDescriptionPlain).toBe('Build great UIs')
    })

    it('handles null applyUrl gracefully', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null)
      mockPrisma.job.create.mockResolvedValue({ id: 'j1' } as any)

      await importJob({ ...BASE_INPUT, applyUrl: null })

      const createCall = mockPrisma.job.create.mock.calls[0][0]
      // Should still generate externalId (null applyUrl → empty string in hash)
      expect(createCall.data.externalId).toMatch(/^[a-f0-9]{64}$/)
    })
  })
})
