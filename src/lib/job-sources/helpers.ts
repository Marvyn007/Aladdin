import { createHash } from 'crypto'

/**
 * Normalize a string for deterministic hashing.
 * Trim, lowercase, collapse whitespace.
 */
export function normalizeForHash(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Generate a content hash for cross-source clustering.
 * SHA-256 of normalized (title + company + location + sourceUrl).
 * NOT used for primary dedup — only for detecting the same job across sources.
 */
export function generateContentHash(
  title: string,
  company: string,
  location: string,
  sourceUrl: string
): string {
  const input = [
    normalizeForHash(title),
    normalizeForHash(company),
    normalizeForHash(location),
    normalizeForHash(sourceUrl),
  ].join('|content|')
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Generate a deterministic fallback externalId when the source has no native ID.
 * SHA-256 of normalized (title + company + location + applyUrl).
 * Uses a different join separator than contentHash to avoid collisions.
 */
export function generateFallbackId(
  title: string,
  company: string,
  location: string,
  applyUrl: string | null
): string {
  const input = [
    normalizeForHash(title),
    normalizeForHash(company),
    normalizeForHash(location),
    normalizeForHash(applyUrl ?? ''),
  ].join('|fallback|')
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Strip HTML tags and return plain text.
 * Handles common HTML entities.
 */
export function stripHtmlToPlain(html: string | null): string | null {
  if (html === null) return null
  if (html === '') return ''

  let text = html
    // Replace block-level elements with newlines
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode common HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim()

  return text
}

/**
 * Detect experience level from a job title using high-confidence keywords only.
 * Evaluation order: lead → senior → entry → null
 * Lead/senior are checked first to prevent mislabeling management roles
 * whose team names reference entry-level programs.
 * Returns null when no clear signal is found.
 */
export function categorizeExperienceLevel(
  title: string
): 'entry' | 'mid' | 'senior' | 'lead' | null {
  if (!title) return null
  const t = title.toLowerCase()

  // Unambiguous lead signals — checked first, but excludes "manager" alone
  // ("manager" is checked after senior/entry to avoid misclassifying
  //  "Principal Product Manager" or "Entry-Level Product Manager")
  if (
    /\blead\b/.test(t) ||
    /\bdirector\b/.test(t) ||
    /\bhead of\b/.test(t) ||
    /\bvp\b/.test(t)
  ) return 'lead'

  // Senior — checked before entry to catch "Senior New Grad Program"
  // and before manager to catch "Senior Manager, New Grad Programs"
  if (
    /\bsenior\b/.test(t) ||
    /\bsr\.\s/.test(t) ||
    /\bsr\b/.test(t) ||
    /\bstaff\b/.test(t) ||
    /\bprincipal\b/.test(t)
  ) return 'senior'

  // Explicit entry-level phrases — checked before manager so that
  // "Entry-Level Product Manager" returns entry, not lead
  if (
    /new[\s-]grad/.test(t) ||
    /entry[\s-]level/.test(t) ||
    /\bearly career\b/.test(t) ||
    /\bjunior\b/.test(t) ||
    /\bjr\.\s/.test(t) ||
    /\bjr\b/.test(t) ||
    /\buniversity hire\b/.test(t)
  ) return 'entry'

  // Manager alone (no senior/entry qualifier above) → lead
  // e.g. "Engineering Manager", "Program Manager" without a level prefix
  if (/\bmanager\b/.test(t)) return 'lead'

  // Remaining entry signals (weaker, checked last)
  if (
    /\bintern\b/.test(t) ||
    /\binternship\b/.test(t) ||
    /\bassociate\b/.test(t) ||
    /\bgrad\b/.test(t)
  ) return 'entry'

  return null
}

/**
 * Detect job type from a job title using high-confidence keywords only.
 * Returns null when ambiguous (e.g. a plain "Software Engineer" title).
 * Adapters that have structured job type from the ATS should use this
 * as the primary signal with the ATS value as fallback.
 */
export function categorizeJobType(
  title: string
): 'internship' | 'fulltime' | 'contract' | 'parttime' | null {
  if (!title) return null
  const t = title.toLowerCase()

  if (/\bintern\b/.test(t) || /\binternship\b/.test(t) || /\bco-op\b/.test(t) || /\bcoop\b/.test(t)) return 'internship'
  if (/\bcontract\b/.test(t) || /\bcontractor\b/.test(t) || /\bfreelance\b/.test(t)) return 'contract'
  if (/part[\s-]time/.test(t)) return 'parttime'

  return null
}

/**
 * Detect if a job is "New" or "Reposted" based on its title.
 *
 * Conservative: only fires on high-confidence explicit signals.
 * Mixed-case "New" and standalone "NEW" are excluded — they produce
 * too many false positives ("Brand New", "NEW GRAD", "New York").
 */
export function detectReposted(title: string | null): boolean {
  if (!title) return false

  // 1. Explicit bracket tags — unambiguous operator-added markers
  //    e.g. "[NEW]", "[REPOSTED]", "[URGENT]"
  if (/\[(NEW|URGENT|REPOSTED)\]/i.test(title)) return true

  // 2. All-caps REPOSTED or URGENT as a standalone word — high confidence
  //    e.g. "REPOSTED: Senior Engineer", "Data Analyst URGENT"
  if (/\b(REPOSTED|URGENT)\b/.test(title)) return true

  // 3. "NEW" only as a leading prefix tag followed immediately by a separator.
  //    This catches "NEW - Senior Engineer", "NEW: PM", "NEW | Analyst"
  //    but NOT "NEW GRAD", "NEW YORK", or mid-title uses of "NEW".
  if (/^NEW\s*[:\-–—|]/.test(title)) return true

  return false
}
