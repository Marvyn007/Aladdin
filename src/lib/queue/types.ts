// ── Queue Abstraction Layer Types ──
// Spec: Section 1 — Queue Abstraction Layer
// Designed for Neon Postgres now, swappable to BullMQ/Redis via config.

export type TaskType = 'poll' | 'poll-bulk' | 'discover'

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead'

export type SourceName =
  | 'greenhouse'
  | 'lever'
  | 'themuse'
  | 'arbeitnow'
  | 'himalayas'
  | 'workday'

export interface QueueTask {
  id: string
  type: TaskType
  source: SourceName | null
  payload: Record<string, unknown>
  status: TaskStatus
  priority: number // 1=high, 2=medium, 3=low, 4=lowest
  runAt: Date
  attempts: number
  maxAttempts: number
  lastError: string | null
  lockedAt: Date | null
  lockedBy: string | null
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
}

export interface EnqueueInput {
  type: TaskType
  source?: SourceName
  payload: Record<string, unknown>
  priority?: number
  runAt?: Date
  maxAttempts?: number
  lastNonEmptyAt?: Date | null
}

export interface QueueStats {
  pending: number
  processing: number
  completed24h: number
  failed24h: number
  dead: number
  avgProcessingMs: number | null
  oldestPending: Date | null
}

export interface QueueAdapter {
  enqueue(input: EnqueueInput): Promise<void>
  enqueueBatch(inputs: EnqueueInput[]): Promise<void>
  dequeue(limit: number): Promise<QueueTask[]>
  complete(taskId: string): Promise<void>
  fail(taskId: string, error: string): Promise<void>
  getStats(): Promise<QueueStats>
  recoverStaleLocks(maxAgeMs?: number): Promise<number>
}

// Soft cap: pause enqueueing if pending > this value (system safety)
export const QUEUE_PENDING_SOFT_CAP = 1000

// Max tasks enqueued per scheduler tick
export const ENQUEUE_CAP_PER_TICK = 50

// Burst mode threshold and cap
export const BURST_THRESHOLD = 20
export const BURST_MAX_WORKERS = 3

// Stale lock recovery: tasks processing longer than this get reset
export const STALE_LOCK_MAX_AGE_MS = 60_000

// Dead-letter: tasks exceeding this many attempts move to 'dead'
export const DEFAULT_MAX_ATTEMPTS = 3
