import { FRESHNESS_WINDOW_HOURS } from './constants'

/**
 * Returns true if the job's postedAt is within the freshness window.
 * Jobs with null postedAt are treated as unknown age and rejected.
 *
 * @param job   - any object with a nullable `postedAt: Date | null`
 * @param now   - current time (injectable for testing; defaults to Date.now())
 */
export function isFresh(
  job: { postedAt: Date | null },
  now: Date = new Date()
): boolean {
  if (!job.postedAt) return false
  const ageMs = now.getTime() - job.postedAt.getTime()
  return ageMs <= FRESHNESS_WINDOW_HOURS * 3_600_000
}
