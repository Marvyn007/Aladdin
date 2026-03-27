# Resume Editor Loading Screen — Design Spec

**Date:** 2026-03-27
**Status:** Approved

## Overview

Replace the browser's default loading indicator (shown while the server component fetches resume data from the DB) with a branded, animated loading screen. Implemented as a Next.js `loading.tsx` route segment — one new file, no functional changes.

---

## File

**Create:** `src/app/resume-editor/[jobId]/loading.tsx`

This is Next.js's built-in Suspense fallback for the route segment. It renders while `page.tsx` (a server component) runs `getTailoredResumeByUserJob`. No changes to `page.tsx` or any other file.

---

## Visual Design

### Layout
- Full viewport: `html, body { height: 100dvh }` (dvh for mobile browser chrome)
- Centered via `display: grid; place-items: center` — works across mobile, tablet, desktop
- Content nudged 5% above true center (`transform: translateY(-5%)`) for optical balance
- Mobile adjusts to `-3%` nudge at `max-width: 480px`
- Content width: `min(400px, 100vw - 48px)` — fluid, never clips on small screens

### Colors (uses existing app palette)
| Token | Value | Usage |
|---|---|---|
| Background | `#faf8f5` | Page background (warm cream) |
| Accent | `#2383e2` | Progress bar, cursor, icon tint, dot |
| Text primary | `#37352f` | Heading, active stage text |
| Text secondary | `#8a8884` | Subtitle, percentage |
| Progress track | `rgba(55,53,47,0.08)` | Empty bar |

### Elements (top to bottom, 40px gaps)

1. **Icon** — 56×56px rounded square (`border-radius: 14px`), `rgba(35,131,226,0.1)` background, document SVG in `#2383e2`
2. **Heading block** — `"Opening your resume"` (22px, 700 weight) + `"This only takes a moment"` (14px, `#8a8884`)
3. **Progress bar** — 5px tall, fills left-to-right with smooth transition (`0.6s cubic-bezier`), sheen shimmer overlay, percentage label (`0%→100%`) aligned right above bar
4. **Typewriter line** — Single line, 14px, 600 weight. Stages type in character by character (45ms/char), hold 900ms, backspace (30ms/char), then next stage types in. Blue blinking cursor (`2px × 16px`) sits after text at all times.

### Stages & progress mapping
| Stage text | Bar % |
|---|---|
| `Authenticating…` | 20% |
| `Resume found` | 50% |
| `Preparing editor…` | 80% |
| `Ready` | 100% |

On the real loading screen (not demo loop): stays on last stage text once reached. No looping.

### Animations
- **Sheen:** `linear-gradient` sweeps left→right over progress fill, `1.6s ease-in-out infinite`
- **Cursor blink:** `step-end` at `0.8s`, alternates opacity 1↔0
- **Bar fill:** CSS `transition: width 0.6s cubic-bezier(0.4,0,0.2,1)` triggered by JS `style.width` assignment

---

## Implementation Notes

- `'use client'` directive required (uses `useState`, `useEffect`, `useRef` for typewriter)
- No imports from other project files — self-contained
- `useRef` for interval cleanup on unmount (avoids setState-on-unmounted-component warning)
- Percentage advances in `useEffect` tied to stage index, not a separate timer
- On final stage ("Ready" / 100%), stop the cycle — don't loop
