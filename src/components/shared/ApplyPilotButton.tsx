'use client';

import { useState, useEffect } from 'react';
import { Plane, Loader2 } from 'lucide-react';

interface ApplyPilotButtonProps {
  jobId: string;
  onSessionStart: (sessionId: string) => void;
}

type SessionStatus =
  | 'none'
  | 'queued'
  | 'running'
  | 'stalled'
  | 'awaiting_review'
  | 'taken_over'
  | 'completed'
  | 'failed'
  | 'cancelled';

const ACTIVE_STATUSES: SessionStatus[] = ['queued', 'running', 'stalled', 'awaiting_review', 'taken_over'];

const STATUS_LABELS: Record<SessionStatus, string> = {
  none:            '',
  queued:          'Queued…',
  running:         'Applying…',
  stalled:         'Recovering…',
  awaiting_review: 'Review Ready ✓',
  taken_over:      'In Your Control',
  completed:       'Submitted ✓',
  failed:          'Failed',
  cancelled:       'Cancelled',
};

export function ApplyPilotButton({ jobId, onSessionStart }: ApplyPilotButtonProps) {
  const [status, setStatus]       = useState<SessionStatus>('none');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  // On mount: check for an existing session for this job
  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch(`/api/auto-apply/session/by-job?jobId=${encodeURIComponent(jobId)}`);
        if (res.ok) {
          const data = await res.json() as { sessionId: string; status: SessionStatus };
          setSessionId(data.sessionId);
          setStatus(data.status);
        }
      } catch {
        // no existing session — ignore
      }
    }
    checkExisting();
  }, [jobId]);

  // While a session is active, poll for status changes so the UI can recover
  // from cancellations, failures, or tab refreshes.
  useEffect(() => {
    if (!sessionId || status === 'none') return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/auto-apply/session/${sessionId}`);
        if (!res.ok) {
          // If session was deleted (e.g. cancel during queued), clear state.
          if (!cancelled) {
            setSessionId(null);
            setStatus('none');
          }
          return;
        }
        const data = await res.json() as { status: SessionStatus };
        if (!cancelled) setStatus(data.status);
      } catch {
        // ignore transient network failures
      }
    };

    tick();
    const id = setInterval(tick, 2500);
    return () => { cancelled = true; clearInterval(id); };
  }, [sessionId, status]);

  async function handleCancel() {
    if (!sessionId) return;
    setLoading(true);
    try {
      await fetch('/api/auto-apply/cancel', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      });
      // The cancel endpoint may delete the session if it never started.
      setSessionId(null);
      setStatus('none');
    } catch (err) {
      console.error('Failed to cancel Apply Pilot session', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClick() {
    // Re-open modal if active session already exists
    if (sessionId && ACTIVE_STATUSES.includes(status)) {
      onSessionStart(sessionId);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auto-apply/start', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jobId }),
      });
      if (!res.ok) {
        const err = await res.json() as { error: string };
        console.error('Apply Pilot error:', err.error);
        return;
      }
      const data = await res.json() as { sessionId: string };
      setSessionId(data.sessionId);
      setStatus('queued');
      onSessionStart(data.sessionId);
    } catch (err) {
      console.error('Failed to start Apply Pilot session', err);
    } finally {
      setLoading(false);
    }
  }

  const isDisabled = loading || ACTIVE_STATUSES.includes(status);
  const badge = status !== 'none' ? STATUS_LABELS[status] : null;
  const canCancel = Boolean(sessionId && (status === 'queued' || status === 'running' || status === 'stalled'));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          onClick={handleClick}
          disabled={isDisabled}
          className="btn btn-secondary"
          style={{ whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          {loading
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <Plane size={14} />
          }
          Apply Pilot
        </button>

        {canCancel && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="btn btn-ghost"
            style={{ fontSize: '12px', padding: '6px 10px', opacity: 0.9 }}
            title="Remove from queue"
          >
            Cancel
          </button>
        )}
      </div>
      {badge && (
        <span
          style={{
            fontSize: '11px',
            color:
              status === 'completed'       ? 'var(--success, #4ade80)' :
              status === 'failed'          ? 'var(--error,   #f87171)' :
              status === 'awaiting_review' ? 'var(--accent)'           :
              'var(--text-secondary)',
          }}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
