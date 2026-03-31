/** Freshness window for job ingestion. Jobs with postedAt older than this are dropped.
 *  Valid range: 24–72 hours. */
export const FRESHNESS_WINDOW_HOURS = 48

/** Number of consecutive all-stale pages before bulk adapters stop paging. */
export const STALE_PAGE_THRESHOLD = 2

/** Soft time ceiling per worker cycle (ms). Stop dequeuing new tasks after this.
 *  Increased to 8s: poll-batch fires 5 parallel Greenhouse calls (~2-3s total),
 *  so we can process 2 batches (10 companies) and stay within Vercel Hobby's 10s limit. */
export const CYCLE_BUDGET_MS = 8_000

/** Hard time ceiling per worker cycle (ms). Log a warning if the cycle exceeds this.
 *  Set to 9.5s — just below Vercel Hobby's 10s function timeout. */
export const CYCLE_HARD_LIMIT_MS = 9_500
