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
