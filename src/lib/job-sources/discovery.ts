import type { DiscoveryTier } from './types'
import type { DiscoveryCandidate } from './discovery-candidates'
import { getCandidatesByTier } from './discovery-candidates'

// ── Constants ──

export const BATCH_SIZE = 5
export const VALIDATION_DELAY_MS = 1000
export const VALIDATION_TIMEOUT_MS = 5000

// ── ATS Validation (core — may throw on network errors) ──

async function validateGreenhouseBoardCore(slug: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)

  const res = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`,
    { signal: controller.signal }
  )
  clearTimeout(timeout)

  if (!res.ok) return false

  const data = await res.json()
  return Array.isArray(data.jobs) && data.jobs.length > 0
}

async function validateLeverBoardCore(slug: string): Promise<boolean> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), VALIDATION_TIMEOUT_MS)

  const res = await fetch(
    `https://api.lever.co/v0/postings/${slug}?limit=1`,
    { signal: controller.signal }
  )
  clearTimeout(timeout)

  if (!res.ok) return false

  const data = await res.json()
  return Array.isArray(data) && data.length > 0
}

// ── Safe wrappers (return false on error, used by external callers) ──

export async function validateGreenhouseBoard(slug: string): Promise<boolean> {
  try {
    return await validateGreenhouseBoardCore(slug)
  } catch {
    return false
  }
}

export async function validateLeverBoard(slug: string): Promise<boolean> {
  try {
    return await validateLeverBoardCore(slug)
  } catch {
    return false
  }
}

/** Route validation to the correct ATS function (safe — never throws) */
export async function validateCandidate(candidate: DiscoveryCandidate): Promise<boolean> {
  if (candidate.ats === 'greenhouse') return validateGreenhouseBoard(candidate.slug)
  if (candidate.ats === 'lever') return validateLeverBoard(candidate.slug)
  return false
}

/** Route validation to the correct ATS function (throws on network errors) */
function validateCandidateOrThrow(candidate: DiscoveryCandidate): Promise<boolean> {
  if (candidate.ats === 'greenhouse') return validateGreenhouseBoardCore(candidate.slug)
  if (candidate.ats === 'lever') return validateLeverBoardCore(candidate.slug)
  return Promise.resolve(false)
}

// ── Database abstraction for discovery ──

export interface DiscoveryDb {
  getTrackedSlugs(): Promise<Set<string>>
  insertTrackedCompany(candidate: DiscoveryCandidate): Promise<void>
}

// ── Discovery Result ──

export interface DiscoveryResult {
  tier: DiscoveryTier
  candidatesChecked: number
  added: number
  alreadyTracked: number
  invalid: number
  errors: string[]
  hasMore: boolean
  nextOffset: number
}

// ── Delay helper ──

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Core discovery function ──

export async function discoverNewCompanies(
  db: DiscoveryDb,
  tier: DiscoveryTier,
  offset: number = 0
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    tier,
    candidatesChecked: 0,
    added: 0,
    alreadyTracked: 0,
    invalid: 0,
    errors: [],
    hasMore: false,
    nextOffset: 0,
  }

  // Load candidates for this tier
  const allCandidates = getCandidatesByTier(tier)

  // Fetch already-tracked slugs
  const tracked = await db.getTrackedSlugs()

  // Filter out already-tracked
  const untracked = allCandidates.filter(
    c => !tracked.has(`${c.slug}::${c.ats}`)
  )

  result.alreadyTracked = allCandidates.length - untracked.length

  // Short-circuit if nothing to check
  if (untracked.length === 0) return result

  // Slice batch from offset
  const batch = untracked.slice(offset, offset + BATCH_SIZE)

  // Check if more remain after this batch
  const remaining = untracked.length - (offset + batch.length)
  result.hasMore = remaining > 0
  result.nextOffset = offset + BATCH_SIZE

  // Validate each candidate
  for (let i = 0; i < batch.length; i++) {
    const candidate = batch[i]

    // Rate limit: delay between validations (skip before first)
    if (i > 0) await delay(VALIDATION_DELAY_MS)

    try {
      const isValid = await validateCandidateOrThrow(candidate)
      result.candidatesChecked++

      if (isValid) {
        await db.insertTrackedCompany(candidate)
        result.added++
      } else {
        result.invalid++
      }
    } catch (err) {
      result.candidatesChecked++
      result.errors.push(
        `${candidate.slug}::${candidate.ats}: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  }

  return result
}
