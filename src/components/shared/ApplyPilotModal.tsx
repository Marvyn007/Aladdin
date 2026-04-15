'use client';

import { useEffect, useRef, useState } from 'react';
import PusherClient from 'pusher-js';
import type {
  SessionStartedPayload,
  FieldFilledPayload,
  PageAdvancedPayload,
  StalledPayload,
  FailedPayload,
  AwaitingReviewPayload,
} from '@/lib/auto-apply/pusher-events';

interface ApplyPilotModalProps {
  sessionId: string;
  jobTitle:  string;
  company:   string;
  onClose:   () => void;
}

interface SessionState {
  status:            string;
  liveViewUrl:       string | null;
  fieldsFilledCount: number;
  pagesVisited:      number;
  errorMessage:      string | null;
}

interface StatusLine {
  text:    string;
  source?: 'profile' | 'ai';
}

export function ApplyPilotModal({ sessionId, jobTitle, company, onClose }: ApplyPilotModalProps) {
  const [session, setSession]       = useState<SessionState | null>(null);
  const [statusLine, setStatusLine] = useState<StatusLine>({ text: 'Connecting…' });
  const [pageNum, setPageNum]       = useState(0);
  const [stalled, setStalled]       = useState(false);
  const [completing, setCompleting] = useState(false);
  const pusherRef                   = useRef<PusherClient | null>(null);

  // Fetch initial session state on mount (handles tab-close/reopen reconnect)
  useEffect(() => {
    async function loadSession() {
      const res = await fetch(`/api/auto-apply/session/${sessionId}`);
      if (!res.ok) return;
      const data = await res.json() as SessionState;
      setSession(data);
      setPageNum(data.pagesVisited);
      if (data.status === 'awaiting_review') setStatusLine({ text: 'Application ready for review' });
      if (data.status === 'failed')          setStatusLine({ text: data.errorMessage ?? 'Agent failed' });
    }
    loadSession();
  }, [sessionId]);

  // Subscribe to Pusher for real-time agent events
  useEffect(() => {
    const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster:         process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint:    '/api/pusher/auth',
      authTransport:   'ajax',
    });

    const channel = pusher.subscribe(`private-apply-${sessionId}`);

    channel.bind('session_started', (p: SessionStartedPayload) => {
      setSession(prev => prev ? { ...prev, liveViewUrl: p.liveViewUrl, status: 'running' } : null);
      setStatusLine({ text: 'Agent navigating to application…' });
    });

    channel.bind('field_filled', (p: FieldFilledPayload) => {
      setStalled(false);
      setStatusLine({ text: `Filling: ${p.label}`, source: p.source });
    });

    channel.bind('page_advanced', (p: PageAdvancedPayload) => {
      setPageNum(p.pageNumber);
      setStatusLine({ text: `Page ${p.pageNumber} complete` });
    });

    channel.bind('stalled', (p: StalledPayload) => {
      setStalled(true);
      setStatusLine({ text: `Recovering: ${p.reason} (attempt ${p.attempt})` });
    });

    channel.bind('awaiting_review', (p: AwaitingReviewPayload) => {
      setStalled(false);
      setSession(prev => prev ? {
        ...prev,
        status:            'awaiting_review',
        fieldsFilledCount: p.fieldsFilledCount,
        pagesVisited:      p.pagesVisited,
      } : null);
      setStatusLine({ text: 'Application filled — ready for your review' });
    });

    channel.bind('failed', (p: FailedPayload) => {
      setSession(prev => prev ? { ...prev, status: 'failed', errorMessage: p.reason } : null);
      setStatusLine({ text: `Failed: ${p.reason}` });
    });

    pusherRef.current = pusher;
    return () => {
      pusher.unsubscribe(`private-apply-${sessionId}`);
      pusher.disconnect();
    };
  }, [sessionId]);

  async function handleTakeOver() {
    await fetch('/api/auto-apply/takeover', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId }),
    });
    setSession(prev => prev ? { ...prev, status: 'taken_over' } : null);
    setStatusLine({ text: 'You have control — submit when ready' });
  }

  async function handleMarkDone() {
    setCompleting(true);
    await fetch('/api/auto-apply/complete', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ sessionId }),
    });
    setSession(prev => prev ? { ...prev, status: 'completed' } : null);
    setStatusLine({ text: 'Application submitted!' });
    setCompleting(false);
  }

  const status = session?.status ?? 'queued';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background:    'var(--background)',
          border:        '1px solid var(--border)',
          borderRadius:  '12px',
          width:         'min(920px, 95vw)',
          height:        'min(680px, 90vh)',
          display:       'flex',
          flexDirection: 'column',
          overflow:      'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding:       '14px 20px',
          borderBottom:  '1px solid var(--border)',
          display:       'flex',
          justifyContent:'space-between',
          alignItems:    'center',
          flexShrink:    0,
        }}>
          <div>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>✦ Apply Pilot</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginLeft: '8px' }}>
              {company} — {jobTitle}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>

        {/* Live View Iframe */}
        <div style={{ flex: 1, background: '#0a0a0a', position: 'relative', overflow: 'hidden' }}>
          {session?.liveViewUrl ? (
            <iframe
              src={session.liveViewUrl}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Apply Pilot Live View"
              sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock"
            />
          ) : (
            <div style={{
              display:         'flex',
              alignItems:      'center',
              justifyContent:  'center',
              height:          '100%',
              color:           '#666',
              fontSize:        '13px',
              flexDirection:   'column',
              gap:             '8px',
            }}>
              <div style={{ fontSize: '24px' }}>✦</div>
              Starting browser session…
            </div>
          )}
        </div>

        {/* Status Footer */}
        <div style={{
          padding:        '10px 20px',
          borderTop:      '1px solid var(--border)',
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'center',
          gap:            '12px',
          flexShrink:     0,
          minHeight:      '52px',
        }}>
          <div style={{ fontSize: '12px', color: stalled ? 'var(--warning, #fbbf24)' : 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {stalled && <span style={{ marginRight: '6px' }}>⚠</span>}
            {statusLine.text}
            {statusLine.source && (
              <span style={{ marginLeft: '6px', opacity: 0.5 }}>[{statusLine.source}]</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {pageNum > 0 && status === 'running' && (
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Page {pageNum}
              </span>
            )}

            {status === 'failed' && (
              <span style={{ fontSize: '12px', color: 'var(--error, #f87171)' }}>
                Agent failed — close and retry
              </span>
            )}

            {status === 'awaiting_review' && (
              <button onClick={handleTakeOver} className="btn btn-primary" style={{ fontSize: '13px' }}>
                Take Over &amp; Submit
              </button>
            )}

            {status === 'taken_over' && (
              <button
                onClick={handleMarkDone}
                disabled={completing}
                className="btn btn-primary"
                style={{ fontSize: '13px' }}
              >
                {completing ? 'Saving…' : 'Done, I Submitted ✓'}
              </button>
            )}

            {status === 'completed' && (
              <span style={{ fontSize: '12px', color: 'var(--success, #4ade80)', fontWeight: 600 }}>
                ✓ Application submitted
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
