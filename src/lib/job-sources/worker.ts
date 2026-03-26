import type { QueueAdapter, QueueTask, SourceName } from '../queue/types'
import { EXECUTION_BUDGET_MS } from '../queue/types'
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
    default:
      throw new Error(`Unknown source adapter: "${source}"`)
  }

  adapterCache.set(source, adapter)
  return adapter
}

// ── Database abstraction for worker ──
// Keeps worker logic testable without coupling to Prisma directly.

export interface WorkerDb {
  upsertJob(job: NormalizedJob): Promise<{ isNew: boolean }>
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
  durationMs: number
  error: string | null
}

// ── Core: process a single task ──

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

    // Upsert each job, track new vs duplicate
    let newJobs = 0
    let duplicates = 0

    for (const job of jobs) {
      const result = await db.upsertJob(job)
      if (result.isNew) newJobs++
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
    // Check execution budget before starting each task
    if (Date.now() - startTime >= EXECUTION_BUDGET_MS) {
      console.warn(
        `[worker] Execution budget exceeded (${Date.now() - startTime}ms >= ${EXECUTION_BUDGET_MS}ms). Stopping after ${results.length} tasks.`
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
          durationMs: Date.now() - start,
          error: errorMsg,
        })
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
        durationMs: 0,
        error: null,
      })
      continue
    }

    const adapter = resolveAdapter(task.source)
    const result = await processTask(task, adapter, queue, db)
    results.push(result)
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
