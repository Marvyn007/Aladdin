import { FRESHNESS_WINDOW_HOURS, STALE_PAGE_THRESHOLD } from './constants'

/**
 * Returns true if the job's postedAt is within the freshness window.
 * Jobs with null postedAt are treated as unknown age and rejected.
 *
 * @param job   - any object with a nullable `postedAt: Date | null`
 * @param now   - current time (injectable for testing; defaults to Date.now())
 */
export function isFresh(
  job: { postedAt: Date | null; isReposted?: boolean },
  now: Date = new Date()
): boolean {
  if (job.isReposted) return true // Bypass window for "NEW" or manually bumped tags
  if (!job.postedAt) return false
  const ageMs = now.getTime() - job.postedAt.getTime()
  return ageMs <= FRESHNESS_WINDOW_HOURS * 3_600_000
}

/**
 * Determines whether a bulk adapter should stop paging based on
 * the staleness of the current page's results.
 *
 * A page is "all stale" if every job on it fails isFresh().
 * Two consecutive all-stale pages trigger a stop.
 *
 * @param page             - array of jobs returned from current API page
 * @param stalePagesInARow - counter of consecutive all-stale pages so far
 * @param now              - current time (injectable for testing)
 */
export function shouldStopPaging(
  page: { postedAt: Date | null; isReposted?: boolean }[],
  stalePagesInARow: number,
  now: Date = new Date()
): { stop: boolean; newCounter: number } {
  const allStale = page.length > 0 && page.every((job) => !isFresh(job, now))

  if (allStale) {
    const newCounter = stalePagesInARow + 1
    return { stop: newCounter >= STALE_PAGE_THRESHOLD, newCounter }
  }

  return { stop: false, newCounter: 0 }
}
