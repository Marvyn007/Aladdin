import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateGreenhouseBoard, validateLeverBoard, discoverNewCompanies, BATCH_SIZE } from '../discovery'
import type { DiscoveryCandidate } from '../discovery-candidates'
import type { DiscoveryTier } from '../types'

// Mock the candidate list
vi.mock('../discovery-candidates', () => ({
  getCandidatesByTier: vi.fn(),
}))

import { getCandidatesByTier } from '../discovery-candidates'

function makeMockDb() {
  return {
    getTrackedSlugs: vi.fn<[], Promise<Set<string>>>().mockResolvedValue(new Set()),
    insertTrackedCompany: vi.fn<[DiscoveryCandidate], Promise<void>>().mockResolvedValue(undefined),
  }
}

function makeCandidate(overrides: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    slug: 'testco',
    name: 'Test Co',
    ats: 'greenhouse',
    tier: 1,
    ...overrides,
  }
}

describe('validateGreenhouseBoard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when board has active jobs', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ jobs: [{ id: 1, title: 'Engineer' }] }), { status: 200 })
    )

    const result = await validateGreenhouseBoard('stripe')

    expect(result).toBe(true)
    expect(mockFetch).toHaveBeenCalledWith(
      'https://boards-api.greenhouse.io/v1/boards/stripe/jobs',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('returns false when board has empty jobs array', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ jobs: [] }), { status: 200 })
    )

    expect(await validateGreenhouseBoard('emptyco')).toBe(false)
  })

  it('returns false on non-200 status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Not Found', { status: 404 })
    )

    expect(await validateGreenhouseBoard('fakeco')).toBe(false)
  })

  it('returns false on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'))

    expect(await validateGreenhouseBoard('badco')).toBe(false)
  })
})

describe('validateLeverBoard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns true when board has postings', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ id: '1', text: 'Engineer' }]), { status: 200 })
    )

    const result = await validateLeverBoard('linear')

    expect(result).toBe(true)
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.lever.co/v0/postings/linear?limit=1',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('returns false when postings array is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([]), { status: 200 })
    )

    expect(await validateLeverBoard('emptyco')).toBe(false)
  })

  it('returns false on non-200 status', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Not Found', { status: 404 })
    )

    expect(await validateLeverBoard('fakeco')).toBe(false)
  })

  it('returns false on network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Timeout'))

    expect(await validateLeverBoard('badco')).toBe(false)
  })
})

describe('discoverNewCompanies', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('filters candidates by the requested tier', async () => {
    const candidates = [makeCandidate({ slug: 'a', tier: 1 })]
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ jobs: [{ id: 1 }] }), { status: 200 })
    )

    const db = makeMockDb()
    const resultPromise = discoverNewCompanies(db, 1, 0)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(getCandidatesByTier).toHaveBeenCalledWith(1)
    expect(result.tier).toBe(1)
  })

  it('skips already-tracked companies using composite slug::ats key', async () => {
    const candidates = [
      makeCandidate({ slug: 'tracked', ats: 'greenhouse' }),
      makeCandidate({ slug: 'new', ats: 'greenhouse' }),
    ]
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    const db = makeMockDb()
    db.getTrackedSlugs.mockResolvedValue(new Set(['tracked::greenhouse']))

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ jobs: [{ id: 1 }] }), { status: 200 })
    )

    const resultPromise = discoverNewCompanies(db, 1, 0)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.alreadyTracked).toBe(1)
    expect(result.candidatesChecked).toBe(1)
    expect(db.insertTrackedCompany).toHaveBeenCalledTimes(1)
    expect(db.insertTrackedCompany).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'new' })
    )
  })

  it('inserts valid candidates into TrackedCompany', async () => {
    const candidates = [makeCandidate({ slug: 'valid' })]
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ jobs: [{ id: 1 }] }), { status: 200 })
    )

    const db = makeMockDb()
    const resultPromise = discoverNewCompanies(db, 1, 0)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.added).toBe(1)
    expect(db.insertTrackedCompany).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'valid', ats: 'greenhouse' })
    )
  })

  it('does not insert invalid candidates (no active jobs)', async () => {
    const candidates = [makeCandidate({ slug: 'nojobs' })]
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ jobs: [] }), { status: 200 })
    )

    const db = makeMockDb()
    const resultPromise = discoverNewCompanies(db, 1, 0)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.invalid).toBe(1)
    expect(result.added).toBe(0)
    expect(db.insertTrackedCompany).not.toHaveBeenCalled()
  })

  it('respects BATCH_SIZE cap of 5 per cycle', async () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeCandidate({ slug: `co-${i}` })
    )
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ jobs: [{ id: 1 }] }), { status: 200 })
    )

    const db = makeMockDb()
    const resultPromise = discoverNewCompanies(db, 1, 0)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.candidatesChecked).toBe(BATCH_SIZE)
    expect(result.hasMore).toBe(true)
    expect(result.nextOffset).toBe(BATCH_SIZE)
  })

  it('sets hasMore: false when batch exhausts all candidates', async () => {
    const candidates = [makeCandidate({ slug: 'only' })]
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ jobs: [{ id: 1 }] }), { status: 200 })
    )

    const db = makeMockDb()
    const resultPromise = discoverNewCompanies(db, 1, 0)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.hasMore).toBe(false)
  })

  it('short-circuits when all candidates are already tracked', async () => {
    const candidates = [makeCandidate({ slug: 'done', ats: 'greenhouse' })]
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)

    const db = makeMockDb()
    db.getTrackedSlugs.mockResolvedValue(new Set(['done::greenhouse']))

    const result = await discoverNewCompanies(db, 1, 0)

    expect(result.candidatesChecked).toBe(0)
    expect(result.added).toBe(0)
    expect(result.hasMore).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('collects validation errors without aborting the batch', async () => {
    const candidates = [
      makeCandidate({ slug: 'fail-co' }),
      makeCandidate({ slug: 'ok-co' }),
    ]
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Network fail'))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ jobs: [{ id: 1 }] }), { status: 200 })
      )

    const db = makeMockDb()
    const resultPromise = discoverNewCompanies(db, 1, 0)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('fail-co')
    expect(result.added).toBe(1)
    expect(result.candidatesChecked).toBe(2)
  })

  it('applies offset correctly to the untracked list', async () => {
    const candidates = Array.from({ length: 8 }, (_, i) =>
      makeCandidate({ slug: `co-${i}` })
    )
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ jobs: [{ id: 1 }] }), { status: 200 })
    )

    const db = makeMockDb()
    // Second batch: offset=5, should get remaining 3
    const resultPromise = discoverNewCompanies(db, 1, 5)
    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.candidatesChecked).toBe(3)
    expect(result.hasMore).toBe(false)
  })

  it('validates lever candidates using the lever endpoint', async () => {
    const candidates = [makeCandidate({ slug: 'linear', ats: 'lever' })]
    vi.mocked(getCandidatesByTier).mockReturnValue(candidates)
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify([{ id: '1', text: 'Engineer' }]), { status: 200 })
    )

    const db = makeMockDb()
    const resultPromise = discoverNewCompanies(db, 1, 0)
    await vi.runAllTimersAsync()
    await resultPromise

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      'https://api.lever.co/v0/postings/linear?limit=1',
      expect.any(Object)
    )
  })
})
