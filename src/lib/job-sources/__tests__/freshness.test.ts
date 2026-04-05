import { describe, it, expect } from 'vitest'
import { isFresh, shouldStopPaging } from '../freshness'

describe('isFresh', () => {
  const now = new Date('2026-03-29T12:00:00Z')

  it('passes a job posted right now', () => {
    expect(isFresh({ postedAt: now }, now)).toBe(true)
  })

  it('passes a job posted 47 hours ago', () => {
    const postedAt = new Date(now.getTime() - 47 * 3600 * 1000)
    expect(isFresh({ postedAt }, now)).toBe(true)
  })

  it('passes a job posted exactly 48 hours ago (inclusive boundary)', () => {
    const postedAt = new Date(now.getTime() - 48 * 3600 * 1000)
    expect(isFresh({ postedAt }, now)).toBe(true)
  })

  it('rejects a job posted 49 hours ago', () => {
    const postedAt = new Date(now.getTime() - 49 * 3600 * 1000)
    expect(isFresh({ postedAt }, now)).toBe(false)
  })

  it('rejects a job with null postedAt', () => {
    expect(isFresh({ postedAt: null }, now)).toBe(false)
  })
})

describe('isFresh — extended window for entry-level/internship', () => {
  const now = new Date('2026-03-29T12:00:00Z')

  it('keeps an entry-level job posted 100 hours ago (within 168h window)', () => {
    const postedAt = new Date(now.getTime() - 100 * 3600 * 1000)
    expect(isFresh({ postedAt, experienceLevel: 'entry' }, now)).toBe(true)
  })

  it('keeps an internship posted 100 hours ago (within 168h window)', () => {
    const postedAt = new Date(now.getTime() - 100 * 3600 * 1000)
    expect(isFresh({ postedAt, jobType: 'internship' }, now)).toBe(true)
  })

  it('drops a senior job posted 100 hours ago (outside 48h window)', () => {
    const postedAt = new Date(now.getTime() - 100 * 3600 * 1000)
    expect(isFresh({ postedAt, experienceLevel: 'senior' }, now)).toBe(false)
  })

  it('drops a job with no level posted 100 hours ago', () => {
    const postedAt = new Date(now.getTime() - 100 * 3600 * 1000)
    expect(isFresh({ postedAt }, now)).toBe(false)
  })

  it('drops an internship posted 169 hours ago (outside 168h window)', () => {
    const postedAt = new Date(now.getTime() - 169 * 3600 * 1000)
    expect(isFresh({ postedAt, jobType: 'internship' }, now)).toBe(false)
  })

  it('keeps an internship posted exactly 168 hours ago (boundary inclusive)', () => {
    const postedAt = new Date(now.getTime() - 168 * 3600 * 1000)
    expect(isFresh({ postedAt, jobType: 'internship' }, now)).toBe(true)
  })

  it('isReposted still bypasses the window', () => {
    const postedAt = new Date(now.getTime() - 200 * 3600 * 1000)
    expect(isFresh({ postedAt, isReposted: true }, now)).toBe(true)
  })
})

describe('shouldStopPaging — two-phase logic', () => {
  const now = new Date('2026-03-29T12:00:00Z')

  const freshJob = (hoursAgo: number, opts: { experienceLevel?: 'entry' | null; jobType?: 'internship' | null } = {}) => ({
    postedAt: new Date(now.getTime() - hoursAgo * 3_600_000),
    ...opts,
  })

  it('does not stop when page has fresh jobs (phase 1)', () => {
    const page = [freshJob(10), freshJob(20)]
    const result = shouldStopPaging(page, 0, now)
    expect(result.stop).toBe(false)
    expect(result.newCounter).toBe(0)
  })

  it('stops after STALE_PAGE_THRESHOLD consecutive all-stale pages (phase 1)', () => {
    const stalePage = [freshJob(60), freshJob(72)]
    const r1 = shouldStopPaging(stalePage, 0, now)
    expect(r1.stop).toBe(false)
    expect(r1.newCounter).toBe(1)

    const r2 = shouldStopPaging(stalePage, r1.newCounter, now)
    expect(r2.stop).toBe(true)
  })

  it('does not stop when page has entry-level jobs in 48-168h window (phase 2)', () => {
    const page = [
      freshJob(60, { experienceLevel: 'entry' }),
      freshJob(72, { jobType: 'internship' }),
    ]
    const result = shouldStopPaging(page, 0, now)
    expect(result.stop).toBe(false)
    expect(result.newCounter).toBe(0)
  })

  it('increments counter when page is 48-168h but has no entry/internship jobs', () => {
    const page = [freshJob(60), freshJob(72)]
    const result = shouldStopPaging(page, 0, now)
    expect(result.stop).toBe(false)
    expect(result.newCounter).toBe(1)
  })

  it('stops after threshold of pages with no entry/internship in extended window', () => {
    const noEntryPage = [freshJob(60), freshJob(72)]
    const r1 = shouldStopPaging(noEntryPage, 0, now)
    const r2 = shouldStopPaging(noEntryPage, r1.newCounter, now)
    expect(r2.stop).toBe(true)
  })

  it('stops immediately when all jobs are older than 168h', () => {
    const page = [freshJob(200), freshJob(250)]
    const result = shouldStopPaging(page, 0, now)
    expect(result.stop).toBe(true)
  })

  it('resets counter when a fresh job appears on the page', () => {
    const mixedPage = [freshJob(10), freshJob(60)]
    const result = shouldStopPaging(mixedPage, 1, now)
    expect(result.stop).toBe(false)
    expect(result.newCounter).toBe(0)
  })
})
