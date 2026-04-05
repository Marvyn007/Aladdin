import { FRESHNESS_WINDOW_HOURS, STALE_PAGE_THRESHOLD, ENTRY_LEVEL_FRESHNESS_WINDOW_HOURS } from './constants'

/**
 * Returns true if the job's postedAt is within the freshness window.
 * - Any job within 48h is fresh.
 * - Internship or entry-level jobs within 168h (7 days) are also fresh.
 * - Jobs with null postedAt are treated as unknown age and rejected.
 *
 * @param job   - any object with a nullable `postedAt: Date | null`
 * @param now   - current time (injectable for testing; defaults to Date.now())
 */
export function isFresh(
  job: {
    postedAt: Date | null
    isReposted?: boolean
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | null
    jobType?: 'fulltime' | 'parttime' | 'contract' | 'internship' | null
  },
  now: Date = new Date()
): boolean {
  if (job.isReposted) return true // Bypass window for "NEW" or manually bumped tags
  if (!job.postedAt) return false

  const ageMs = now.getTime() - job.postedAt.getTime()

  // Standard window: all jobs
  if (ageMs <= FRESHNESS_WINDOW_HOURS * 3_600_000) return true

  // Extended window: entry-level and internship roles only
  const isEntryOrIntern = job.jobType === 'internship' || job.experienceLevel === 'entry'
  if (isEntryOrIntern && ageMs <= ENTRY_LEVEL_FRESHNESS_WINDOW_HOURS * 3_600_000) return true

  return false
}

/**
 * Determines whether a bulk adapter should stop paging.
 *
 * Two-phase logic:
 * - Phase 1 (any job ≤ 48h): standard behavior — stop after STALE_PAGE_THRESHOLD
 *   consecutive all-stale pages.
 * - Phase 2 (all jobs 48–168h): continue paging but only count pages with
 *   zero entry-level/internship hits toward the stop counter.
 * - Immediate stop: all jobs are older than 168h.
 *
 * NOTE: Only applies to bulk adapters (TheMuse, Arbeitnow, Himalayas).
 * Greenhouse and Lever are single-fetch — this function is never called for them.
 *
 * @param page             - normalized jobs from current API page (experienceLevel/jobType populated)
 * @param stalePagesInARow - counter of consecutive pages with no qualifying fresh jobs
 * @param now              - current time (injectable for testing)
 */
export function shouldStopPaging(
  page: {
    postedAt: Date | null
    isReposted?: boolean
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | null
    jobType?: 'fulltime' | 'parttime' | 'contract' | 'internship' | null
  }[],
  stalePagesInARow: number,
  now: Date = new Date()
): { stop: boolean; newCounter: number } {
  if (page.length === 0) return { stop: false, newCounter: stalePagesInARow }

  const STANDARD_MS = FRESHNESS_WINDOW_HOURS * 3_600_000
  const EXTENDED_MS = ENTRY_LEVEL_FRESHNESS_WINDOW_HOURS * 3_600_000

  const ages = page.map((job) =>
    job.postedAt ? now.getTime() - job.postedAt.getTime() : Infinity
  )

  // Immediate stop: all jobs beyond the extended window
  if (ages.every((age) => age > EXTENDED_MS)) {
    return { stop: true, newCounter: stalePagesInARow + 1 }
  }

  // Phase 1: at least one job within 48h — standard fresh page, reset counter
  if (ages.some((age) => age <= STANDARD_MS)) {
    return { stop: false, newCounter: 0 }
  }

  // Phase 2: all jobs are 48–168h old — check for entry/internship hits
  const hasEntryOrIntern = page.some(
    (job) => job.jobType === 'internship' || job.experienceLevel === 'entry'
  )

  if (hasEntryOrIntern) {
    return { stop: false, newCounter: 0 }
  }

  // No entry/internship hits on this page — increment counter
  const newCounter = stalePagesInARow + 1
  return { stop: newCounter >= STALE_PAGE_THRESHOLD, newCounter }
}
