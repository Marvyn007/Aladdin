# Resume Generation Stream — Fix + Background Mode Design

**Date:** 2026-03-26
**Status:** Approved

---

## Overview

The resume generation SSE stream exists but fails silently before reaching the LLM. This spec covers: fixing the stream reliability bugs, lifting generation state into a shared context, adding a "Run in background" mode with a floating widget, a completion toast, and a global lock preventing concurrent generations.

---

## 1. Root Cause Bugs (Fix First)

These bugs cause the stream to die at Stage 1/2 and never reach the pipeline:

| Bug | Location | Fix |
|-----|----------|-----|
| Button not disabled during generation | `TailoredResumeEditor` | Disable "Generate" when `status !== 'idle'` |
| Double-click fires two concurrent streams | `TailoredResumeEditor` | Guard with ref + disabled button |
| SSE error event silently swallowed | SSE parser `catch(e)` | Propagate error to UI state |
| Stage naming mismatch | `ParsingProgress` vs pipeline | Align `stage6_export` / `stage7_skills` names |
| `window.location.href` on completion | `TailoredResumeEditor` line 191 | Replace with `router.push` |
| Server-side S3 error not logged | `route.ts` catch block | Add `console.error` in S3 failure catch |

---

## 2. Shared State — `ResumeGenerationContext`

**File:** `src/contexts/ResumeGenerationContext.tsx`

A React context that lives at the layout level (wrapping the authenticated dashboard layout). All UI pieces subscribe to it instead of managing local stream state.

### State shape

```typescript
type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

interface ResumeGenerationState {
  status: GenerationStatus;
  jobId: string | null;
  jobTitle: string | null;
  progress: ParsingProgressState;   // stage list — same shape as useParsingProgress()
  error: string | null;
  isModalOpen: boolean;
}
```

### Actions exposed by context

```typescript
interface ResumeGenerationContextValue extends ResumeGenerationState {
  startGeneration(params: GenerationParams): void;  // kicks off SSE stream
  sendToBackground(): void;                          // closes modal, stream continues
  openProgressModal(): void;                         // re-opens modal from widget
  dismissCompletion(): void;                         // resets status to 'idle'
  cancelGeneration(): void;                          // aborts stream, resets
}
```

### Stream lifecycle

The SSE reader loop (currently in `TailoredResumeEditor.handleGenerate`) moves into `startGeneration()` inside the context. The `AbortController` is held in a ref inside the context. Closing the modal (`sendToBackground`) does NOT call `abort()` — the stream keeps reading and updating context state. When `done` event arrives, `status` flips to `'complete'`.

---

## 3. Modal Changes — `TailoredResumeEditor`

**File:** `src/components/resume-editor/TailoredResumeEditor.tsx`

- Reads `status`, `progress`, `error`, `isModalOpen` from context instead of local state
- Calls `startGeneration()` on button click instead of managing fetch locally
- **"Generate" button:** disabled when `status !== 'idle'`
- **"Cancel" button → "Run in background":** calls `sendToBackground()` — closes modal without aborting stream
- On `status === 'complete'` while modal is open: calls `router.push(`/resume-editor/${jobId}`)`
- On `status === 'error'` while modal is open: shows the error message visibly in the modal UI

---

## 4. Floating Widget — `ResumeGenerationWidget`

**File:** `src/components/ResumeGenerationWidget.tsx`

Renders in the bottom-right corner, stacked **above** `ProfileCompletionWidget` when both are present. Hidden when `status === 'idle'`.

### Orange state (`status === 'generating'`)

- Animated pulsing orange dot
- Text: **"Tailoring your resume..."**
- Smaller and less assertive than the Finish Profile widget (no accordion, no steps)
- Click → calls `openProgressModal()` to reopen `TailoredResumeEditor` with live stage progress

### Green state (`status === 'complete'`)

- Solid green dot (no pulse)
- Text: **"Resume ready"**
- Click → `router.push(`/resume-editor/${jobId}`)` then calls `dismissCompletion()` — widget disappears

### Stacking order

```
bottom-right corner (fixed)
│
├── ResumeGenerationWidget   ← higher z / margin-bottom spacing
└── ProfileCompletionWidget  ← existing position
```

---

## 5. Completion Toast

**File:** `src/components/ResumeReadyToast.tsx`

Slides in from the right when `status` flips to `'complete'`. Auto-dismisses after 8 seconds.

### Content

> **Your resume is ready!**
> Open it in the editor to review and fine-tune anything that doesn't look right. You can also click the green widget anytime to jump back.

- **"Open"** button → `router.push(`/resume-editor/${jobId}`)`
- **"✕"** button → dismisses toast (widget stays green)

### Conditions

- Does NOT appear if `isModalOpen === true` when generation completes (the modal handles redirect directly)
- Dismissed toast does not reappear on re-render

---

## 6. Global Generation Lock

All "Tailor Resume" buttons across job cards read `status` from context.

- `status !== 'idle'` → button is visually disabled
- Tooltip on hover: *"Resume generation in progress"*
- One generation at a time, enforced client-side

**File to update:** wherever the "Tailor Resume" / "Parse & Edit Resume" button is rendered on job cards (search for the button that opens `TailoredResumeEditor`).

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/contexts/ResumeGenerationContext.tsx` | **Create** — shared state + SSE stream logic |
| `src/components/resume-editor/TailoredResumeEditor.tsx` | Consume context; replace Cancel with "Run in background"; fix redirect; surface errors |
| `src/components/ResumeGenerationWidget.tsx` | **Create** — floating orange/green widget |
| `src/components/ResumeReadyToast.tsx` | **Create** — slide-in completion notification |
| `src/app/api/generate-tailored-resume-stream/route.ts` | Add `console.error` to S3 failure catch |
| `src/components/resume-editor/ParsingProgress.tsx` | Fix stage ID names to match pipeline output |
| Dashboard layout / job card component | Add `ResumeGenerationContext` provider; disable Tailor Resume button when `status !== 'idle'` |

---

## 8. What Is NOT Changing

- The SSE API route structure (events, headers, pipeline call) — works correctly, just needs the S3 error logging
- `ProfileCompletionWidget` — untouched, just positioned below the new widget
- `FullPageResumeEditor` — unchanged; still loads from DB on navigation
- The pipeline itself (`src/lib/resume-generation/pipeline.ts`) — no changes
