import { describe, it, expect } from 'vitest'
import { isFresh } from '../freshness'

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
