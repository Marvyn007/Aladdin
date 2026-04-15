// src/lib/auto-apply/pusher-events.ts
import Pusher from 'pusher';

// ── Typed event definitions ────────────────────────────────────────────────

export type AutoApplyEventName =
  | 'session_started'
  | 'navigating'
  | 'field_filled'
  | 'page_advanced'
  | 'stalled'
  | 'awaiting_review'
  | 'failed'
  | 'completed';

export interface SessionStartedPayload  { liveViewUrl: string }
export interface FieldFilledPayload     { label: string; source: 'profile' | 'ai' }
export interface PageAdvancedPayload    { pageNumber: number }
export interface StalledPayload         { reason: string; attempt: number }
export interface FailedPayload          { reason: string }
export interface AwaitingReviewPayload  { pagesVisited: number; fieldsFilledCount: number }

export type AutoApplyPayload =
  | SessionStartedPayload
  | FieldFilledPayload
  | PageAdvancedPayload
  | StalledPayload
  | FailedPayload
  | AwaitingReviewPayload
  | Record<string, never>;

// ── Server-side Pusher singleton ──────────────────────────────────────────

let _pusher: Pusher | null = null;

function getPusherServer(): Pusher {
  if (_pusher) return _pusher;
  _pusher = new Pusher({
    appId:   process.env.PUSHER_APP_ID!,
    key:     process.env.PUSHER_KEY!,
    secret:  process.env.PUSHER_SECRET!,
    cluster: process.env.PUSHER_CLUSTER!,
    useTLS:  true,
  });
  return _pusher;
}

/**
 * Trigger a typed event on a session's private Pusher channel.
 * Channel name: private-apply-{sessionId}
 */
export async function triggerAutoApplyEvent(
  sessionId: string,
  event: AutoApplyEventName,
  payload: AutoApplyPayload
): Promise<void> {
  const pusher = getPusherServer();
  await pusher.trigger(`private-apply-${sessionId}`, event, payload);
}
