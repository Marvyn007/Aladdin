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
  | 'failed';

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
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
