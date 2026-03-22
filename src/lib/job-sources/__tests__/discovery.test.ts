import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateGreenhouseBoard, validateLeverBoard } from '../discovery'

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
