'use client';

import { useEffect, useRef, useState } from 'react';

const STAGES = [
  { label: 'Authenticating\u2026', pct: 20 },
  { label: 'Resume found',         pct: 50 },
  { label: 'Preparing editor\u2026', pct: 80 },
  { label: 'Ready',                pct: 100 },
] as const;

const TYPE_SPEED      = 45;   // ms per character typed
const BACKSPACE_SPEED = 30;   // ms per character deleted
const HOLD_MS         = 900;  // ms to hold after fully typed
const PAUSE_MS        = 180;  // ms pause between backspace end and next type

export default function ResumeEditorLoading() {
  const [stageIndex, setStageIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [pct, setPct] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const mountedRef  = useRef(true);

  function clearTimers() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (timeoutRef.current)  { clearTimeout(timeoutRef.current);   timeoutRef.current  = null; }
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; clearTimers(); };
  }, []);

  useEffect(() => {
    clearTimers();

    const { label, pct: targetPct } = STAGES[stageIndex];
    let charIndex = 0;

    // Phase 1: type characters in
    intervalRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      charIndex += 1;
      setDisplayText(label.slice(0, charIndex));

      if (charIndex === label.length) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        setPct(targetPct);

        // Final stage — stop here
        if (stageIndex === STAGES.length - 1) return;

        // Phase 2: hold, then backspace
        timeoutRef.current = setTimeout(() => {
          if (!mountedRef.current) return;
          let remaining = label.length;

          intervalRef.current = setInterval(() => {
            if (!mountedRef.current) return;
            remaining -= 1;
            setDisplayText(label.slice(0, remaining));

            if (remaining === 0) {
              clearInterval(intervalRef.current!);
              intervalRef.current = null;

              // Phase 3: brief pause, then advance to next stage
              timeoutRef.current = setTimeout(() => {
                if (!mountedRef.current) return;
                setStageIndex(i => i + 1);
              }, PAUSE_MS);
            }
          }, BACKSPACE_SPEED);
        }, HOLD_MS);
      }
    }, TYPE_SPEED);

    return clearTimers;
  }, [stageIndex]);

  return (
    <>
      <style>{`
        html, body { height: 100%; height: 100dvh; }

        @keyframes re-sheen {
          0%   { left: -60%; }
          100% { left: 110%; }
        }
        @keyframes re-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
      `}</style>

      <div
        style={{
          display: 'grid',
          placeItems: 'center',
          height: '100dvh',
          background: '#faf8f5',
          fontFamily: '-apple-system, "Segoe UI", Inter, system-ui, sans-serif',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 40,
            width: 'min(400px, calc(100vw - 48px))',
            textAlign: 'center',
            transform: 'translateY(-5%)',
          }}
        >
          {/* Icon */}
          <div
            style={{
              width: 56, height: 56,
              background: 'rgba(35,131,226,0.1)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="#2383e2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>

          {/* Heading */}
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#37352f', letterSpacing: '-0.4px', marginBottom: 8 }}>
              Opening your resume
            </h2>
            <p style={{ fontSize: 14, color: '#8a8884' }}>
              This only takes a moment
            </p>
          </div>

          {/* Progress bar */}
          <div style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: '#8a8884', fontVariantNumeric: 'tabular-nums' }}>
                {pct}%
              </span>
            </div>
            <div
              style={{
                height: 5,
                background: 'rgba(55,53,47,0.08)',
                borderRadius: 99,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: '#2383e2',
                  borderRadius: 99,
                  width: `${pct}%`,
                  transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute', top: 0, left: '-60%',
                    width: '50%', height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                    animation: 're-sheen 1.6s ease-in-out infinite',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Typewriter line */}
          <div
            style={{
              fontSize: 14, fontWeight: 600, color: '#37352f',
              height: 22,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
            }}
          >
            <span>{displayText}</span>
            <span
              style={{
                display: 'inline-block',
                width: 2, height: 16,
                background: '#2383e2',
                borderRadius: 1,
                marginLeft: 1,
                verticalAlign: 'middle',
                animation: 're-blink 0.8s step-end infinite',
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}
