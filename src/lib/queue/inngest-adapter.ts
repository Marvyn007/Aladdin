import { inngest } from '@/lib/inngest'
import type { QueueAdapter, QueueTask, QueueStats, EnqueueInput } from './types'

/**
 * Inngest-backed queue adapter.
 *
 * Replaces the Postgres job_queue table with Inngest events for task dispatch.
 * Each enqueued task becomes a `crawler/process-task` event that Inngest
 * fans out, retries automatically, and enforces concurrency limits on.
 *
 * Lifecycle methods (dequeue, complete, fail) are handled by Inngest's
 * function execution model rather than database rows:
 *   - dequeue()  → no-op; Inngest pushes tasks via events
 *   - complete() → no-op; Inngest marks success when the function returns
 *   - fail()     → throws the error so Inngest sees the step as failed
 *                  and schedules an automatic retry with exponential backoff
 */
export class InngestQueueAdapter implements QueueAdapter {
  async enqueue(input: EnqueueInput): Promise<void> {
    await inngest.send({
      name: 'crawler/process-task',
      data: input,
    })
  }

  async enqueueBatch(inputs: EnqueueInput[]): Promise<void> {
    if (inputs.length === 0) return

    // Inngest accepts batches of up to 512 KB total payload.
    // Split into chunks of 100 to stay well within limits.
    const CHUNK = 100
    for (let i = 0; i < inputs.length; i += CHUNK) {
      const chunk = inputs.slice(i, i + CHUNK)
      await inngest.send(
        chunk.map((input) => ({
          name: 'crawler/process-task' as const,
          data: input,
        }))
      )
    }
  }

  /**
   * Not applicable for Inngest — tasks are pushed via events, not pulled.
   * Returns an empty array so callers that fall back to dequeue get nothing.
   */
  async dequeue(_limit: number): Promise<QueueTask[]> {
    return []
  }

  /**
   * Inngest tracks function success automatically when the handler returns.
   * No explicit completion needed.
   */
  async complete(_taskId: string): Promise<void> {
    // no-op
  }

  /**
   * Re-throws the error so that the calling Inngest step sees a failure and
   * Inngest schedules an automatic retry with exponential backoff.
   */
  async fail(_taskId: string, error: string): Promise<void> {
    throw new Error(error)
  }

  /**
   * Stats are visible in the Inngest Cloud dashboard.
   * Returns zeroed values so callers that check stats before enqueueing
   * do not hit the soft cap gate.
   */
  async getStats(): Promise<QueueStats> {
    return {
      pending: 0,
      processing: 0,
      completed24h: 0,
      failed24h: 0,
      dead: 0,
      avgProcessingMs: null,
      oldestPending: null,
    }
  }

  /**
   * No stale locks exist in the Inngest model — Inngest owns retry state.
   */
  async recoverStaleLocks(_maxAgeMs?: number): Promise<number> {
    return 0
  }
}
