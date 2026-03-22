import type { DiscoveryTier } from './types'
import type { DiscoveryCandidate } from './discovery-candidates'

// ── Constants ──

export const BATCH_SIZE = 5
export const VALIDATION_DELAY_MS = 1000
export const VALIDATION_TIMEOUT_MS = 5000

// ── ATS Validation ──

export async function validateGreenhouseBoard(slug: string): Promise<boolean> {
  try {
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
  } catch {
    return false
  }
}

export async function validateLeverBoard(slug: string): Promise<boolean> {
  try {
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
  } catch {
    return false
  }
}

/** Route validation to the correct ATS function */
export async function validateCandidate(candidate: DiscoveryCandidate): Promise<boolean> {
  if (candidate.ats === 'greenhouse') return validateGreenhouseBoard(candidate.slug)
  if (candidate.ats === 'lever') return validateLeverBoard(candidate.slug)
  return false
}
