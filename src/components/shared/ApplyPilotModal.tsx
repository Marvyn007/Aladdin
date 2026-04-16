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
  /** When true, renders as an absolute overlay over the parent container
   *  instead of a fixed full-screen modal. The parent must have
   *  position: relative (or similar) for this to work correctly. */
  inline?:   boolean;
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

export function ApplyPilotModal({ sessionId, jobTitle, company, onClose, inline = false }: ApplyPilotModalProps) {
  const [session, setSession]       = useState<SessionState | null>(null);
  const [statusLine, setStatusLine] = useState<StatusLine>({ text: 'Connecting…' });
  const [pageNum, setPageNum]       = useState(0);
  const [stalled, setStalled]       = useState(false);
  const [completing, setCompleting] = useState(false);
  const [closing, setClosing]       = useState(false);
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

  async function handleClose() {
    if (closing) return;
    setClosing(true);

    // If the user closes the modal while the agent is queued/running, cancel it
    // so we don't leave stray work in the system.
    if (status === 'queued' || status === 'running' || status === 'stalled') {
      try {
        await fetch('/api/auto-apply/cancel', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ sessionId }),
        });
      } catch {
        // Best-effort cancellation — closing the UI should never be blocked.
      }
    }

    onClose();
  }

  // ── Inline mode: absolute overlay that covers the parent container ──────────
  // Agent is considered "active" (border pulses) while queued, running, or stalled.
  const isAgentActive = status === 'queued' || status === 'running' || status === 'stalled';

  if (inline) {
    return (
      <>
        {/* Keyframes for the rotating gradient border */}
        <style>{`
          @keyframes applyPilotBorderSpin {
            0%   { background-position: 0%   50%; }
            50%  { background-position: 100% 50%; }
            100% { background-position: 0%   50%; }
          }
          .apply-pilot-border-active {
            background: linear-gradient(270deg, #3b82f6, #6366f1, #06b6d4, #3b82f6);
            background-size: 400% 400%;
            animation: applyPilotBorderSpin 3s ease infinite;
          }
          /* Scale iframe content down to ~80% without shrinking the element */
          .apply-pilot-iframe-zoom {
            width:  125%;
            height: 125%;
            transform: scale(0.8);
            transform-origin: top left;
            border: none;
          }
        `}</style>

        {/* Outer wrapper — zIndex 100 beats the sticky action-bar (zIndex 10) */}
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 100,
            display: 'flex', flexDirection: 'column',
            background: 'var(--background)',
            overflow: 'hidden',
          }}
        >
          {/* X close button — floats top-right above everything */}
          <button
            onClick={handleClose}
            title="Cancel auto-apply and show job details"
            style={{
              position:      'absolute',
              top:           '10px',
              right:         '12px',
              zIndex:        110,
              background:    'rgba(0,0,0,0.55)',
              border:        '1px solid rgba(255,255,255,0.15)',
              borderRadius:  '50%',
              width:         '30px',
              height:        '30px',
              display:       'flex',
              alignItems:    'center',
              justifyContent:'center',
              cursor:        'pointer',
              color:         '#fff',
              fontSize:      '14px',
              lineHeight:    1,
              backdropFilter:'blur(4px)',
              transition:    'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.85)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.55)')}
          >
            ✕
          </button>

          {/* Mini header strip */}
          <div style={{
            padding:      '10px 48px 10px 16px',
            borderBottom: '1px solid var(--border)',
            display:      'flex',
            alignItems:   'center',
            gap:          '8px',
            flexShrink:   0,
            background:   'var(--background)',
          }}>
            {/* Animated dot while active */}
            {isAgentActive && (
              <span style={{
                display:      'inline-block',
                width:        '7px',
                height:       '7px',
                borderRadius: '50%',
                background:   '#3b82f6',
                animation:    'applyPilotBorderSpin 1.5s ease infinite',
                flexShrink:   0,
              }} />
            )}
            <span style={{ fontSize: '13px', fontWeight: 600 }}>✦ Apply Pilot</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              {company} — {jobTitle}
            </span>
          </div>

          {/* Live view iframe wrapper — gradient border ring while agent is active */}
          <div
            style={{
              flex:     1,
              position: 'relative',
              overflow: 'hidden',
              /* 3-px padding acts as the "border" gap when active */
              padding:  isAgentActive ? '3px' : '0',
              background: '#0a0a0a',
            }}
          >
            {/* Animated gradient border layer (rendered behind iframe via z-index) */}
            {isAgentActive && (
              <div
                className="apply-pilot-border-active"
                style={{
                  position:     'absolute',
                  inset:        0,
                  zIndex:       1,
                  borderRadius: '2px',
                }}
              />
            )}

            {/* Inner container that clips the iframe — zIndex 2 keeps it above the border layer but below the X button */}
            <div style={{
              position:   'absolute',
              inset:      isAgentActive ? '3px' : '0',
              zIndex:     2,
              background: '#0a0a0a',
              overflow:   'hidden',
            }}>
              {session?.liveViewUrl ? (
                <iframe
                  src={session.liveViewUrl}
                  className="apply-pilot-iframe-zoom"
                  title="Apply Pilot Live View"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-pointer-lock"
                />
              ) : (
                <div style={{
                  display:       'flex',
                  alignItems:    'center',
                  justifyContent:'center',
                  height:        '100%',
                  color:         '#666',
                  fontSize:      '13px',
                  flexDirection: 'column',
                  gap:           '8px',
                }}>
                  <div style={{ fontSize: '24px' }}>✦</div>
                  Starting browser session…
                </div>
              )}
            </div>
          </div>

          {/* Status Footer */}
          <div style={{
            padding:       '8px 16px',
            borderTop:     '1px solid var(--border)',
            display:       'flex',
            justifyContent:'space-between',
            alignItems:    'center',
            gap:           '12px',
            flexShrink:    0,
            minHeight:     '48px',
            background:    'var(--background)',
          }}>
            <div style={{
              fontSize:     '12px',
              color:        stalled ? 'var(--warning, #fbbf24)' : 'var(--text-secondary)',
              flex:         1,
              overflow:     'hidden',
              textOverflow: 'ellipsis',
              whiteSpace:   'nowrap',
            }}>
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
                <button onClick={handleTakeOver} className="btn btn-primary" style={{ fontSize: '12px', padding: '5px 12px' }}>
                  Take Over &amp; Submit
                </button>
              )}

              {status === 'taken_over' && (
                <button
                  onClick={handleMarkDone}
                  disabled={completing}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '5px 12px' }}
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
      </>
    );
  }

  // ── Original full-screen overlay mode ────────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
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
            onClick={handleClose}
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

