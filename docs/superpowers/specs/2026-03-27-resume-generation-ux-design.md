# Resume Generation UX — Design Spec

**Date:** 2026-03-27
**Status:** Approved

## Overview

Three UX improvements to the resume generation flow:
1. Re-enable Tailor Resume buttons instantly when background generation fails
2. Success toast slides in from the top (macOS-style)
3. Generation widget uses vivid solid colors and shows live stage labels in a fixed-width container

---

## Feature 1 — Re-enable Tailor Resume Buttons on Error

### Problem
`JobDetail.tsx:898` disables all Tailor Resume buttons when `resumeStatus !== 'idle'`. This blocks `generating`, `complete`, and `error` states. When generation fails in the background, users cannot click any Tailor Resume button until they manually reset the error widget — but the widget doesn't offer a clear reset path.

### Solution

**`src/components/layout/JobDetail.tsx`**
- Change `disabled={isGeneratingResume || resumeStatus !== 'idle'}` → `disabled={isGeneratingResume || resumeStatus === 'generating'}`
- Change title tooltip condition: `resumeStatus !== 'idle'` → `resumeStatus === 'generating'`
- Change inline opacity/cursor styles to match the new condition

**`src/components/ResumeGenerationWidget.tsx`**
- Add a click handler for `isError` state: clicking the "Generation failed" widget calls `cancelGeneration()`, resetting status to `idle` and cleaning up the widget

### Behavior
- During generation: all Tailor Resume buttons disabled (no queuing)
- On error: buttons unlock immediately; error widget is clickable to dismiss
- On complete: buttons still locked until user dismisses (existing behavior, unchanged)

---

## Feature 2 — Toast Slides In From the Top

### Problem
`ResumeReadyToast` is positioned `bottom: 24, right: 24` and slides in from the right. The user wants it to drop down from the top-right like a macOS notification banner.

### Solution

**`src/components/ResumeReadyToast.tsx`**
- Change position: `bottom: 24` → `top: 24`
- Replace animation keyframes:
  - Old: `translateX(calc(100% + 24px))` → `translateX(0)`
  - New: `translateY(calc(-100% - 24px))` → `translateY(0)`
- Keep same easing: `cubic-bezier(0.22, 1, 0.36, 1)` and duration `0.32s`
- No z-index changes needed (widget is at `bottom: 88`, no conflict)

---

## Feature 3 — Vivid Widget Colors + Fixed-Width Stage Labels

### Problem
The widget uses light pastel backgrounds that look washed out. During generation it shows a static "Tailoring your resume..." label regardless of actual progress. The widget width changes as label text changes.

### Solution

**`src/components/ResumeGenerationWidget.tsx`**

#### Colors (solid, vivid)
| State | Background | Border | Text | Dot |
|---|---|---|---|---|
| Generating | `#f97316` | `#ea580c` | `#ffffff` | `#ffffff` |
| Complete | `#22c55e` | `#16a34a` | `#ffffff` | `#ffffff` |
| Error | `#ef4444` | `#dc2626` | `#ffffff` | `#ffffff` |

#### Dynamic stage labels
Read `progress.currentStageIndex` from `useResumeGeneration()`. Map index to a fixed 2-word label:

| Index | Stage ID | Label |
|---|---|---|
| 0 | resume-load | "Loading resume" |
| 1 | resume-parse | "Parsing resume" |
| 2 | linkedin-parse | "Reading LinkedIn" |
| 3 | master-merge | "Building profile" |
| 4 | jd-parse | "Analyzing job" |
| 5 | tailor | "Tailoring resume" |
| 6 | export | "Finalizing…" |

Fallback when index is out of range: `"Tailoring resume"`.

#### Fixed width
- Remove `maxWidth: 240`
- Add `width: 200px` so container never resizes when label changes
- Text is `whiteSpace: 'nowrap'` and `overflow: 'hidden'` (already present)

---

## Files Changed

| File | Change |
|---|---|
| `src/components/layout/JobDetail.tsx` | Disabled condition: `=== 'generating'` only |
| `src/components/ResumeGenerationWidget.tsx` | Vivid colors, fixed width, stage labels, error click-to-dismiss |
| `src/components/ResumeReadyToast.tsx` | Position top-right, slide-down animation |

## Out of Scope
- No changes to generation logic, API routes, or context state machine
- No changes to the modal or progress panel UI
- No queuing mechanism
