import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkerDb } from '../worker-db'

function makeJob(overrides: Partial<import('../types').NormalizedJob> = {}): import('../types').NormalizedJob {
  return {
    title: 'Engineer',
    company: 'Acme',
    location: 'Remote',
    sourceUrl: 'https://acme.com/jobs/1',
    rawDescriptionHtml: null,
    jobDescriptionPlain: 'We are looking for an engineer to join our team and build cool stuff. '.repeat(50),
    postedAt: new Date(), // fresh by default
    contentHash: 'hash-abc',
    source: 'greenhouse',
    externalId: 'ext-1',
    metadata: {},
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    jobType: null,
    isRemote: true,
    experienceLevel: null,
    skills: [],
    applyUrl: null,
    expiresAt: null,
    ...overrides,
  }
}

describe('upsertJob freshness gate', () => {
  let prisma: any

  function makeMockPrisma() {
    return {
      $queryRawUnsafe: vi.fn().mockResolvedValue([{ is_new: true }]),
      company: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
      sourcePollLog: { create: vi.fn() },
      trackedCompany: { updateMany: vi.fn() },
    } as unknown as import('@prisma/client').PrismaClient
  }

  beforeEach(() => {
    prisma = makeMockPrisma()
  })

  it('inserts a fresh job and returns isNew:true, stale:false', async () => {
    const db = createWorkerDb(prisma)
    const result = await db.upsertJob(makeJob({ postedAt: new Date() }))
    expect(result).toEqual({ isNew: true, stale: false })
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled()
  })

  it('returns isNew:false, stale:false for a fresh duplicate (ON CONFLICT returns empty)', async () => {
    prisma.$queryRawUnsafe.mockResolvedValue([])
    const db = createWorkerDb(prisma)
    const result = await db.upsertJob(makeJob({ postedAt: new Date() }))
    expect(result).toEqual({ isNew: false, stale: false })
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled()
  })

  it('drops a stale job without hitting the DB, returns isNew:false, stale:true', async () => {
    const db = createWorkerDb(prisma)
    const stalePostedAt = new Date(Date.now() - 49 * 3600 * 1000)
    const result = await db.upsertJob(makeJob({ postedAt: stalePostedAt }))
    expect(result).toEqual({ isNew: false, stale: true })
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled()
  })

  it('drops a null-postedAt job (unknown age), returns isNew:false, stale:true', async () => {
    const db = createWorkerDb(prisma)
    const result = await db.upsertJob(makeJob({ postedAt: null }))
    expect(result).toEqual({ isNew: false, stale: true })
    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled()
  })

  it('inserts greenhouse and lever variants of same content as two separate rows', async () => {
    const db = createWorkerDb(prisma)
    const ghJob = makeJob({ source: 'greenhouse', externalId: 'gh-1', contentHash: 'same-hash' })
    const lvJob = makeJob({ source: 'lever', externalId: 'lv-1', contentHash: 'same-hash' })
    await db.upsertJob(ghJob)
    await db.upsertJob(lvJob)
    // Both hit the DB — dedup is (source, externalId), not contentHash
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledTimes(2)
  })
})
