import { describe, it, expect } from 'vitest'
import { shouldStopPaging } from '../freshness'

describe('shouldStopPaging', () => {
  const now = new Date('2026-03-29T12:00:00Z')
  const fresh = { postedAt: new Date(now.getTime() - 1 * 3600 * 1000) }       // 1h ago
  const stale = { postedAt: new Date(now.getTime() - 49 * 3600 * 1000) }      // 49h ago

  it('returns stop:false, counter:0 for a page of all-fresh jobs', () => {
    const result = shouldStopPaging([fresh, fresh, fresh], 0, now)
    expect(result).toEqual({ stop: false, newCounter: 0 })
  })

  it('returns stop:false, counter:1 for a first all-stale page', () => {
    const result = shouldStopPaging([stale, stale, stale], 0, now)
    expect(result).toEqual({ stop: false, newCounter: 1 })
  })

  it('returns stop:true, counter:2 for a second consecutive all-stale page', () => {
    const result = shouldStopPaging([stale, stale], 1, now)
    expect(result).toEqual({ stop: true, newCounter: 2 })
  })

  it('resets counter and returns stop:false when a fresh page follows stale pages', () => {
    const result = shouldStopPaging([fresh, stale], 1, now)
    expect(result).toEqual({ stop: false, newCounter: 0 })
  })

  it('returns stop:false for a mixed page (some fresh, some stale)', () => {
    const result = shouldStopPaging([fresh, stale, fresh], 0, now)
    expect(result).toEqual({ stop: false, newCounter: 0 })
  })

  it('treats a page with null postedAt as stale for the counter', () => {
    const result = shouldStopPaging([{ postedAt: null }, { postedAt: null }], 0, now)
    expect(result).toEqual({ stop: false, newCounter: 1 })
  })
})
