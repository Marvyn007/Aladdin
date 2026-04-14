import type { QueueAdapter, QueueTask, SourceName } from '../queue/types'
import { CYCLE_BUDGET_MS, CYCLE_HARD_LIMIT_MS } from './constants'
import type { SourceAdapter, NormalizedJob, PollTarget } from './types'
import { DISCOVERY_TIER_SCHEDULES } from './types'
import type { DiscoveryTier } from './types'
import { discoverNewCompanies } from './discovery'
import type { DiscoveryDb } from './discovery'
import { GreenhouseAdapter } from './adapters/greenhouse'
import { LeverAdapter } from './adapters/lever'
import { TheMuseAdapter } from './adapters/themuse'
import { ArbeitnowAdapter } from './adapters/arbeitnow'
import { HimalayasAdapter } from './adapters/himalayas'
import { WorkdayAdapter } from './adapters/workday'
import { AshbyAdapter } from './adapters/ashby'

// ── Adapter Registry ──

const adapterCache = new Map<string, SourceAdapter>()

export function resolveAdapter(source: SourceName): SourceAdapter {
  if (adapterCache.has(source)) return adapterCache.get(source)!

  let adapter: SourceAdapter

  switch (source) {
    case 'greenhouse':
      adapter = new GreenhouseAdapter()
      break
    case 'lever':
      adapter = new LeverAdapter()
      break
    case 'themuse': {
      const apiKey = process.env.THEMUSE_API_KEY
      if (!apiKey) throw new Error('THEMUSE_API_KEY is not set')
      adapter = new TheMuseAdapter(apiKey)
      break
    }
    case 'arbeitnow':
      adapter = new ArbeitnowAdapter()
      break
    case 'himalayas':
      adapter = new HimalayasAdapter()
      break
    case 'workday':
      adapter = new WorkdayAdapter()
      break
    case 'ashby':
      adapter = new AshbyAdapter()
      break
    default:
      throw new Error(`Unknown source adapter: "${source}"`)
  }

  adapterCache.set(source, adapter)
  return adapter
}

/**
 * Create a FRESH (non-cached) adapter instance for a given source.
 * Used by poll-batch so each parallel company poll has its own
 * per-instance rate-limit state and doesn't serialize through a shared adapter.
 */
function createFreshAdapter(source: SourceName): SourceAdapter {
  switch (source) {
    case 'greenhouse': return new GreenhouseAdapter()
    case 'lever':      return new LeverAdapter()
    case 'workday':    return new WorkdayAdapter()
    case 'themuse': {
      const apiKey = process.env.THEMUSE_API_KEY
      if (!apiKey) throw new Error('THEMUSE_API_KEY is not set')
      return new TheMuseAdapter(apiKey)
    }
    case 'arbeitnow':  return new ArbeitnowAdapter()
    case 'himalayas':  return new HimalayasAdapter()
    case 'ashby':      return new AshbyAdapter()
    default: throw new Error(`Unknown source: "${source}"`)
  }
}

// ── Database abstraction for worker ──
// Keeps worker logic testable without coupling to Prisma directly.

export interface WorkerDb {
  upsertJob(job: NormalizedJob): Promise<{ isNew: boolean; stale: boolean; jobId: string | null }>
  updateTrackedCompany(
    slug: string,
    ats: string,
    update: { lastJobCount: number; hasJobs: boolean }
  ): Promise<void>
  logPoll(log: {
    source: string
    slug: string | null
    jobsFetched: number
    newJobs: number
    duplicates: number
    stale: number
    durationMs: number
    error: string | null
  }): Promise<void>
}

// ── Task result ──

export interface TaskResult {
  taskId: string
  source: string
  slug: string | null
  jobsFetched: number
  newJobs: number
  duplicates: number
  stale: number
  durationMs: number
  error: string | null
}

// ── Core: process a single task (poll / poll-bulk) ──

export async function processTask(
  task: QueueTask,
  adapter: SourceAdapter,
  queue: QueueAdapter,
  db: WorkerDb
): Promise<TaskResult> {
  const start = Date.now()
  const slug = (task.payload as Record<string, unknown>).slug as string | undefined

  try {
    // Build the poll target from the task
    const target = buildPollTarget(task)

    // Call the source adapter
    const jobs = await adapter.poll(target)

    // Ensure all jobs have a postedAt and strictly sort by newest prior to DB insertion
    jobs.forEach(job => {
      if (!job.postedAt) {
        job.postedAt = new Date();
      }
    });
    jobs.sort((a, b) => (b.postedAt?.getTime() || 0) - (a.postedAt?.getTime() || 0));

    // Upsert each job, track new vs duplicate
    let newJobs = 0
    let duplicates = 0
    let stale = 0

    for (const job of jobs) {
      const result = await db.upsertJob(job)
      if (result.stale) stale++
      else if (result.isNew) newJobs++
      else duplicates++
    }

    // Update TrackedCompany for per-company tasks
    if (task.type === 'poll' && slug) {
      await db.updateTrackedCompany(slug, task.source as string, {
        lastJobCount: jobs.length,
        hasJobs: jobs.length > 0,
      })
    }

    const durationMs = Date.now() - start

    // Log the poll
    await db.logPoll({
      source: task.source as string,
      slug: slug ?? null,
      jobsFetched: jobs.length,
      newJobs,
      duplicates,
      stale,
      durationMs,
      error: null,
    })

    // Mark task complete
    await queue.complete(task.id)

    return {
      taskId: task.id,
      source: task.source as string,
      slug: slug ?? null,
      jobsFetched: jobs.length,
      newJobs,
      duplicates,
      stale,
      durationMs,
      error: null,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - start

    // Log the failed poll
    await db.logPoll({
      source: task.source as string,
      slug: slug ?? null,
      jobsFetched: 0,
      newJobs: 0,
      duplicates: 0,
      stale: 0,
      durationMs,
      error: errorMsg,
    })

    // Mark task failed (handles retry/dead-letter)
    await queue.fail(task.id, errorMsg)

    return {
      taskId: task.id,
      source: task.source as string,
      slug: slug ?? null,
      jobsFetched: 0,
      newJobs: 0,
      duplicates: 0,
      stale: 0,
      durationMs,
      error: errorMsg,
    }
  }
}

// ── Core: process a poll-batch task (parallel multi-company) ──

export async function processBatchTask(
  task: QueueTask,
  queue: QueueAdapter,
  db: WorkerDb
): Promise<TaskResult> {
  const start = Date.now()

  interface BatchCompany { slug: string; source: SourceName }
  const companies = ((task.payload as Record<string, unknown>).companies ?? []) as BatchCompany[]

  try {
    // Fire all company polls in parallel — each with its own fresh adapter instance
    // so rate-limit state is not shared and all requests go out simultaneously.
    const settled = await Promise.allSettled(
      companies.map(({ slug, source }) =>
        createFreshAdapter(source).poll({ type: 'company', slug })
      )
    )

    // Merge results from all parallel polls
    const allJobs: NormalizedJob[] = []
    const errors: string[] = []

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i]
      if (r.status === 'fulfilled') {
        allJobs.push(...r.value)
      } else {
        errors.push(`${companies[i].slug}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`)
      }
    }

    // Ensure all jobs have a postedAt and strictly sort by newest prior to DB insertion
    allJobs.forEach(job => {
      if (!job.postedAt) {
        job.postedAt = new Date();
      }
    });
    allJobs.sort((a, b) => (b.postedAt?.getTime() || 0) - (a.postedAt?.getTime() || 0));

    // Upsert all collected jobs
    let newJobs = 0
    let duplicates = 0
    let stale = 0

    for (const job of allJobs) {
      const result = await db.upsertJob(job)
      if (result.stale) stale++
      else if (result.isNew) newJobs++
      else duplicates++
    }

    // Update TrackedCompany metadata for each successfully polled company
    const successfulSlugs = new Set(
      settled
        .map((r, i) => (r.status === 'fulfilled' ? companies[i].slug : null))
        .filter(Boolean) as string[]
    )
    await Promise.allSettled(
      companies
        .filter((c) => successfulSlugs.has(c.slug))
        .map((c) =>
          db.updateTrackedCompany(c.slug, c.source, {
            lastJobCount: settled
              .filter((_, i) => companies[i].slug === c.slug && settled[i].status === 'fulfilled')
              .reduce((acc, r) => acc + (r.status === 'fulfilled' ? r.value.length : 0), 0),
            hasJobs: allJobs.some((j) => j.company?.toLowerCase() === c.slug.toLowerCase()),
          })
        )
    )

    const durationMs = Date.now() - start
    const batchSlug = companies.map((c) => c.slug).join(',')

    await db.logPoll({
      source: task.source as string,
      slug: `batch(${companies.length}):${companies[0]?.slug ?? '?'}`,
      jobsFetched: allJobs.length,
      newJobs,
      duplicates,
      stale,
      durationMs,
      error: errors.length > 0 ? errors.join(' | ') : null,
    })

    await queue.complete(task.id)

    return {
      taskId: task.id,
      source: task.source as string,
      slug: batchSlug,
      jobsFetched: allJobs.length,
      newJobs,
      duplicates,
      stale,
      durationMs,
      error: errors.length > 0 ? errors.join(' | ') : null,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - start

    await db.logPoll({
      source: task.source as string,
      slug: `batch(${companies.length})`,
      jobsFetched: 0,
      newJobs: 0,
      duplicates: 0,
      stale: 0,
      durationMs,
      error: errorMsg,
    })

    await queue.fail(task.id, errorMsg)

    return {
      taskId: task.id,
      source: task.source as string,
      slug: `batch(${companies.length})`,
      jobsFetched: 0,
      newJobs: 0,
      duplicates: 0,
      stale: 0,
      durationMs,
      error: errorMsg,
    }
  }
}

// ── Process multiple tasks with execution budget ──

export async function processTaskBatch(
  tasks: QueueTask[],
  queue: QueueAdapter,
  db: WorkerDb,
  startTime: number = Date.now(),
  createDiscoveryDbFn?: () => DiscoveryDb
): Promise<TaskResult[]> {
  const results: TaskResult[] = []

  for (const task of tasks) {
    // Check soft budget before starting each task — never interrupt a running task
    const elapsed = Date.now() - startTime
    if (elapsed >= CYCLE_BUDGET_MS) {
      console.warn(
        `[worker] Cycle soft limit reached (${elapsed}ms >= ${CYCLE_BUDGET_MS}ms). Stopping after ${results.length} tasks.`
      )
      break
    }

    if (task.type === 'discover') {
      const tier = ((task.payload as Record<string, unknown>).tier as DiscoveryTier) ?? 3
      const offset = ((task.payload as Record<string, unknown>).offset as number) ?? 0
      const start = Date.now()

      try {
        const discoveryDb = createDiscoveryDbFn
          ? createDiscoveryDbFn()
          : { getTrackedSlugs: async () => new Set<string>(), insertTrackedCompany: async () => {} }

        const result = await discoverNewCompanies(discoveryDb, tier, offset)

        if (result.hasMore) {
          await queue.enqueue({
            type: 'discover',
            priority: DISCOVERY_TIER_SCHEDULES[tier].priority,
            payload: { tier, offset: result.nextOffset },
          })
        }

        const durationMs = Date.now() - start

        await db.logPoll({
          source: 'discovery',
          slug: `tier:${tier}`,
          jobsFetched: result.candidatesChecked,
          newJobs: result.added,
          duplicates: result.alreadyTracked,
          stale: 0,
          durationMs,
          error: result.errors.length > 0 ? result.errors.join('; ') : null,
        })

        await queue.complete(task.id)
        results.push({
          taskId: task.id,
          source: 'discovery',
          slug: `tier:${tier}`,
          jobsFetched: result.candidatesChecked,
          newJobs: result.added,
          duplicates: result.alreadyTracked,
          stale: 0,
          durationMs,
          error: null,
        })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        await queue.fail(task.id, errorMsg)
        results.push({
          taskId: task.id,
          source: 'discovery',
          slug: `tier:${tier}`,
          jobsFetched: 0,
          newJobs: 0,
          duplicates: 0,
          stale: 0,
          durationMs: Date.now() - start,
          error: errorMsg,
        })
      }

      // Hard limit check — diagnostic, ends cycle after current task
      const totalElapsedAfterDiscover = Date.now() - startTime
      if (totalElapsedAfterDiscover > CYCLE_HARD_LIMIT_MS) {
        console.warn(
          `[worker] Cycle hard limit exceeded (${totalElapsedAfterDiscover}ms > ${CYCLE_HARD_LIMIT_MS}ms). Ending cycle.`
        )
        break
      }
      continue
    }

    // poll-batch: parallel multi-company fetching
    if (task.type === 'poll-batch') {
      const result = await processBatchTask(task, queue, db)
      results.push(result)

      const totalElapsedAfterBatch = Date.now() - startTime
      if (totalElapsedAfterBatch > CYCLE_HARD_LIMIT_MS) {
        console.warn(
          `[worker] Cycle hard limit exceeded (${totalElapsedAfterBatch}ms > ${CYCLE_HARD_LIMIT_MS}ms). Ending cycle.`
        )
        break
      }
      continue
    }

    if (!task.source) {
      // Unknown task type without source — skip
      await queue.complete(task.id)
      results.push({
        taskId: task.id,
        source: 'unknown',
        slug: null,
        jobsFetched: 0,
        newJobs: 0,
        duplicates: 0,
        stale: 0,
        durationMs: 0,
        error: null,
      })

      // Hard limit check
      const totalElapsedAfterUnknown = Date.now() - startTime
      if (totalElapsedAfterUnknown > CYCLE_HARD_LIMIT_MS) {
        console.warn(
          `[worker] Cycle hard limit exceeded (${totalElapsedAfterUnknown}ms > ${CYCLE_HARD_LIMIT_MS}ms). Ending cycle.`
        )
        break
      }
      continue
    }

    const adapter = resolveAdapter(task.source)
    const result = await processTask(task, adapter, queue, db)
    results.push(result)

    // Hard limit check — diagnostic only, never interrupts a running task
    const totalElapsed = Date.now() - startTime
    if (totalElapsed > CYCLE_HARD_LIMIT_MS) {
      console.warn(
        `[worker] Cycle hard limit exceeded (${totalElapsed}ms > ${CYCLE_HARD_LIMIT_MS}ms). Ending cycle.`
      )
      break
    }
  }

  return results
}

// ── Helpers ──

function buildPollTarget(task: QueueTask): PollTarget {
  const payload = task.payload as Record<string, unknown>

  if (task.type === 'poll') {
    return { type: 'company', slug: payload.slug as string }
  }

  if (task.type === 'poll-bulk') {
    return { type: 'bulk', page: (payload.page as number) ?? 1 }
  }

  // Discovery tasks don't use PollTarget
  throw new Error(`Cannot build PollTarget for task type: ${task.type}`)
}
