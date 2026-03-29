import { prisma } from '@/lib/prisma'
import { NeonQueueAdapter } from './neon-adapter'
import type { QueueAdapter } from './types'

/**
 * Queue adapter singleton.
 *
 * Default: NeonQueueAdapter (Postgres-backed).
 * Set QUEUE_BACKEND=redis + REDIS_URL to switch to BullMQ.
 * The BullMQ adapter implements the same QueueAdapter interface —
 * zero changes needed in scheduler or workers.
 */
export function createQueueAdapter(): QueueAdapter {
  const backend = process.env.QUEUE_BACKEND ?? 'neon'

  if (backend === 'redis') {
    // Future: return new BullMQAdapter(process.env.REDIS_URL!)
    throw new Error(
      'Redis/BullMQ queue backend not yet implemented. Set QUEUE_BACKEND=neon or remove the env var.'
    )
  }

  return new NeonQueueAdapter(prisma)
}

// Lazy singleton — created on first access
let _queue: QueueAdapter | null = null

export function getQueue(): QueueAdapter {
  if (!_queue) {
    _queue = createQueueAdapter()
  }
  return _queue
}

// Re-export types for convenience
export type { QueueAdapter, QueueTask, QueueStats, EnqueueInput } from './types'
export {
  QUEUE_PENDING_SOFT_CAP,
  ENQUEUE_CAP_PER_TICK,
  BURST_THRESHOLD,
  BURST_MAX_WORKERS,
  STALE_LOCK_MAX_AGE_MS,
  DEFAULT_MAX_ATTEMPTS,
} from './types'
