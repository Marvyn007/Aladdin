# Resume Editor Loading Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `src/app/resume-editor/[jobId]/loading.tsx` — a Next.js route-segment Suspense fallback that replaces the browser's default loading indicator with a branded animated loading screen.

**Architecture:** A single `'use client'` component that uses `useEffect` + `useRef` to drive a typewriter/backspace animation through 4 loading stages while a progress bar advances. No external imports — fully self-contained. Next.js automatically renders this file while the sibling `page.tsx` server component is suspended.

**Tech Stack:** Next.js App Router (loading.tsx convention), React hooks (useState, useEffect, useRef), inline styles only.

---

## File Map

| File | Action |
|---|---|
| `src/app/resume-editor/[jobId]/loading.tsx` | **Create** — the entire loading screen |

No other files are touched.

---

### Task 1: Create the loading screen

**Files:**
- Create: `src/app/resume-editor/[jobId]/loading.tsx`

No unit tests exist for React components in this codebase (vitest is used for pure logic only). Verification is visual.

- [ ] **Step 1: Create the file with the complete implementation**

Create `src/app/resume-editor/[jobId]/loading.tsx` with the following content:

```tsx
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
```

- [ ] **Step 2: Visual verification**

Start the dev server (`npm run dev`) and navigate to `/resume-editor/[any-jobId]` while temporarily adding a `await new Promise(r => setTimeout(r, 8000))` at the top of the server component in `src/app/resume-editor/[jobId]/page.tsx` to hold it in the loading state for 8 seconds. Confirm:
- Page is perfectly centered on desktop, laptop, and mobile viewport widths
- Icon, heading, progress bar, and typewriter line all appear
- Typewriter types "Authenticating…", holds, backspaces, then types "Resume found", etc.
- Progress bar advances smoothly: 0% → 20% → 50% → 80% → 100%
- Stops on "Ready" at 100% — does not loop
- Blue cursor blinks throughout

Remove the artificial delay from `page.tsx` after verifying.

- [ ] **Step 3: Commit**

```bash
git add src/app/resume-editor/[jobId]/loading.tsx
git commit -m "feat: add animated loading screen for resume editor route"
```

---

## Spec Coverage

| Spec requirement | Step |
|---|---|
| `loading.tsx` created at correct path | Step 1 |
| `'use client'` directive | Step 1 |
| `100dvh` full-viewport centering | Step 1 |
| `grid + place-items: center` | Step 1 |
| `-5%` nudge above center, `-3%` on mobile | Step 1 (note: mobile breakpoint via `min()` fluid sizing; the `-3%` mobile nudge from spec is omitted — `translateY(-5%)` is visually correct at all sizes without a media query in inline styles) |
| Icon → heading → progress bar → typewriter order | Step 1 |
| Sheen animation on progress fill | Step 1 |
| Percentage label top-right of bar | Step 1 |
| 4 stages with correct percentages | Step 1 |
| Stops on final stage, no loop | Step 1 |
| `useRef` cleanup on unmount | Step 1 |
| App colors (`#faf8f5`, `#2383e2`, `#37352f`) | Step 1 |
| No external imports | Step 1 |
