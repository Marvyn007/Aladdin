import type { PrismaClient, Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'
import type {
  QueueAdapter,
  QueueTask,
  QueueStats,
  EnqueueInput,
} from './types'
import { DEFAULT_MAX_ATTEMPTS, STALE_LOCK_MAX_AGE_MS } from './types'

const BACKOFF_CAP_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Exponential backoff: 2^attempts minutes, capped at 30 minutes.
 * Exported for direct unit testing.
 */
export function calculateBackoffMs(attempts: number): number {
  const ms = Math.pow(2, attempts) * 60_000
  return Math.min(ms, BACKOFF_CAP_MS)
}

/**
 * Map a raw SQL row (snake_case) to the QueueTask interface (camelCase).
 */
function mapRowToTask(row: Record<string, unknown>): QueueTask {
  return {
    id: row.id as string,
    type: row.type as QueueTask['type'],
    source: (row.source ?? null) as QueueTask['source'],
    payload: (typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload) as Record<string, unknown>,
    status: row.status as QueueTask['status'],
    priority: row.priority as number,
    runAt: new Date(row.run_at as string | Date),
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
    lastError: (row.last_error ?? null) as string | null,
    lockedAt: row.locked_at ? new Date(row.locked_at as string | Date) : null,
    lockedBy: (row.locked_by ?? null) as string | null,
    createdAt: new Date(row.created_at as string | Date),
    updatedAt: new Date(row.updated_at as string | Date),
    completedAt: row.completed_at ? new Date(row.completed_at as string | Date) : null,
  }
}

/**
 * Neon Postgres-backed queue adapter.
 *
 * Uses Prisma model methods for simple CRUD and raw SQL for the dequeue
 * operation (CTE with FOR UPDATE SKIP LOCKED). This avoids interactive
 * transactions, which are incompatible with Neon's PgBouncer transaction mode.
 */
export class NeonQueueAdapter implements QueueAdapter {
  constructor(private prisma: PrismaClient) {}
  
  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
    let lastError: any;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;
        const msg = error.message || "";
        if ((msg.includes("Server has closed the connection") || msg.includes("Can't reach database server")) && i < maxRetries) {
          console.warn(`[Queue] Database connection issue. Retrying... (${i + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        throw error;
      }
    }
    throw lastError;
  }

  async enqueue(input: EnqueueInput): Promise<void> {
    await this.withRetry(() => this.prisma.jobQueue.create({
      data: {
        type: input.type,
        source: input.source ?? null,
        payload: input.payload as Prisma.InputJsonValue,
        status: 'pending',
        priority: input.priority ?? 2,
        runAt: input.runAt ?? new Date(),
        maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        attempts: 0,
      },
    }))
  }

  async enqueueBatch(inputs: EnqueueInput[]): Promise<void> {
    if (inputs.length === 0) return
    await this.withRetry(() => this.prisma.jobQueue.createMany({
      data: inputs.map((input) => ({
        type: input.type,
        source: input.source ?? null,
        payload: input.payload as Prisma.InputJsonValue,
        status: 'pending',
        priority: input.priority ?? 2,
        runAt: input.runAt ?? new Date(),
        maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
        attempts: 0,
      })),
    }))
  }

  /**
   * Atomically claim and return up to `limit` tasks.
   *
   * Uses a CTE with FOR UPDATE SKIP LOCKED to claim pending tasks in a single
   * statement. This is PgBouncer-safe (no multi-statement transaction needed).
   */
  async dequeue(limit: number): Promise<QueueTask[]> {
    const workerId = randomUUID()

    const rows = await this.withRetry(() => this.prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
      WITH claimed AS (
        SELECT id FROM job_queue
        WHERE status = 'pending' AND run_at <= NOW()
        ORDER BY priority ASC, run_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT $1
      )
      UPDATE job_queue
      SET status = 'processing',
          locked_at = NOW(),
          locked_by = $2,
          updated_at = NOW()
      FROM claimed
      WHERE job_queue.id = claimed.id
      RETURNING job_queue.*
      `,
      limit,
      workerId,
    ))

    if (!rows || rows.length === 0) return []

    return rows.map(mapRowToTask)
  }

  async complete(taskId: string): Promise<void> {
    await this.withRetry(() => this.prisma.jobQueue.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      },
    }))
  }

  async fail(taskId: string, error: string): Promise<void> {
    const task = await this.withRetry(() => this.prisma.jobQueue.findUnique({
      where: { id: taskId },
      select: { attempts: true, maxAttempts: true },
    }))

    if (!task) return

    const newAttempts = task.attempts + 1
    const isDead = newAttempts >= task.maxAttempts

    await this.withRetry(() => this.prisma.jobQueue.update({
      where: { id: taskId },
      data: {
        attempts: newAttempts,
        lastError: error,
        status: isDead ? 'dead' : 'pending',
        lockedAt: null,
        lockedBy: null,
        ...(isDead
          ? {}
          : { runAt: new Date(Date.now() + calculateBackoffMs(newAttempts)) }),
      },
    }))
  }

  async getStats(): Promise<QueueStats> {
    const now = new Date()
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const [pending, processing, completed24h, failed24h, dead] =
      await this.withRetry(() => Promise.all([
        this.prisma.jobQueue.count({ where: { status: 'pending' } }),
        this.prisma.jobQueue.count({ where: { status: 'processing' } }),
        this.prisma.jobQueue.count({
          where: { status: 'completed', completedAt: { gte: oneDayAgo } },
        }),
        this.prisma.jobQueue.count({
          where: { status: 'failed', updatedAt: { gte: oneDayAgo } },
        }),
        this.prisma.jobQueue.count({ where: { status: 'dead' } }),
      ]))

    const oldestPendingTask = await this.withRetry(() => this.prisma.jobQueue.findFirst({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    }))

    // Average processing time for completed tasks in last 24h
    const avgResult = await this.withRetry(() => this.prisma.$queryRawUnsafe<{ avg_ms: number | null }[]>(
      `SELECT EXTRACT(EPOCH FROM AVG(completed_at - locked_at)) * 1000 as avg_ms
       FROM job_queue
       WHERE status = 'completed'
         AND completed_at >= $1`,
      oneDayAgo,
    ))

    return {
      pending,
      processing,
      completed24h,
      failed24h,
      dead,
      avgProcessingMs: avgResult?.[0]?.avg_ms ? Math.round(avgResult[0].avg_ms) : null,
      oldestPending: oldestPendingTask?.createdAt ?? null,
    }
  }

  async recoverStaleLocks(maxAgeMs: number = STALE_LOCK_MAX_AGE_MS): Promise<number> {
    const cutoff = new Date(Date.now() - maxAgeMs)

    const result = await this.withRetry(() => this.prisma.jobQueue.updateMany({
      where: {
        status: 'processing',
        lockedAt: { lt: cutoff },
      },
      data: {
        status: 'pending',
        lockedAt: null,
        lockedBy: null,
      },
    }))

    return result.count
  }
}
