/** Freshness window for job ingestion. Jobs with postedAt older than this are dropped.
 *  Valid range: 24–72 hours. */
export const FRESHNESS_WINDOW_HOURS = 48

/** Number of consecutive all-stale pages before bulk adapters stop paging. */
export const STALE_PAGE_THRESHOLD = 2

/** Soft time ceiling per worker cycle (ms). Stop dequeuing new tasks after this. */
export const CYCLE_BUDGET_MS = 5_000

/** Hard time ceiling per worker cycle (ms). Log a warning if the cycle exceeds this.
 *  A running task is never interrupted — this is diagnostic only. */
export const CYCLE_HARD_LIMIT_MS = 6_500
