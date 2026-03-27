# Resume Generation UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three UX issues in the resume generation flow: re-enable Tailor buttons on error, move success toast to top-right, and give the generation widget vivid colors + live stage labels.

**Architecture:** Pure UI changes across three existing components. No context state machine changes, no API changes. The context already exposes all needed state (`progress`, `cancelGeneration`) — components just need to consume more of it.

**Tech Stack:** React, Next.js, TypeScript, inline styles (no CSS modules/Tailwind in these components)

---

## File Map

| File | What changes |
|---|---|
| `src/components/layout/JobDetail.tsx` | `disabled` condition, tooltip, opacity, cursor for Tailor Resume button |
| `src/components/ResumeGenerationWidget.tsx` | Colors → vivid solid; add `progress` + `cancelGeneration` from context; stage label map; fixed width; error click-to-dismiss |
| `src/components/ResumeReadyToast.tsx` | Position `top: 24`; animation slide-down from top |

---

## Task 1: Fix Tailor Resume Button Disabled Condition

**Files:**
- Modify: `src/components/layout/JobDetail.tsx` (around line 898–904)

The button is currently disabled for `generating`, `complete`, and `error` states. It should only block during `generating`.

- [ ] **Step 1: Open the file and locate the button**

In `src/components/layout/JobDetail.tsx`, find this block (around line 896–924):

```tsx
<button
    onClick={handleGenerateTailoredResume}
    disabled={isGeneratingResume || resumeStatus !== 'idle'}
    title={resumeStatus !== 'idle' ? 'Resume generation in progress' : undefined}
    className="btn btn-secondary"
    style={{
        ...gatedStyle,
        opacity: resumeStatus !== 'idle' ? 0.5 : undefined,
        cursor: resumeStatus !== 'idle' ? 'not-allowed' : undefined,
    }}
>
```

- [ ] **Step 2: Replace the disabled condition**

Replace that button's opening tag with:

```tsx
<button
    onClick={handleGenerateTailoredResume}
    disabled={isGeneratingResume || resumeStatus === 'generating'}
    title={resumeStatus === 'generating' ? 'Resume generation in progress' : undefined}
    className="btn btn-secondary"
    style={{
        ...gatedStyle,
        opacity: resumeStatus === 'generating' ? 0.5 : undefined,
        cursor: resumeStatus === 'generating' ? 'not-allowed' : undefined,
    }}
>
```

The three occurrences of `resumeStatus !== 'idle'` each become `resumeStatus === 'generating'`. Nothing else in the block changes.

- [ ] **Step 3: Visual verification**

Start dev server (`npm run dev`). Generate a resume and click "Run in background". While generating, confirm all Tailor Resume buttons are disabled (greyed out, cursor not-allowed). Then simulate an error (e.g., disconnect network mid-generation or wait for an error). Confirm the buttons become clickable again immediately without any user action.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/JobDetail.tsx
git commit -m "fix: re-enable Tailor Resume buttons when generation fails (error state no longer blocks)"
```

---

## Task 2: Add Error Click-to-Dismiss on Generation Widget

**Files:**
- Modify: `src/components/ResumeGenerationWidget.tsx`

When generation fails, the widget shows "Generation failed" but clicking it does nothing. This task makes it dismissable.

- [ ] **Step 1: Add `cancelGeneration` to the context destructure**

In `ResumeGenerationWidget.tsx`, find the existing destructure (line ~8):

```tsx
const { status, jobId, openProgressModal, dismissCompletion } = useResumeGeneration();
```

Replace with:

```tsx
const { status, jobId, openProgressModal, dismissCompletion, cancelGeneration } = useResumeGeneration();
```

- [ ] **Step 2: Update `handleClick` to handle the error state**

Find the existing `handleClick` function:

```tsx
const handleClick = () => {
  if (isComplete && jobId) {
    router.push(`/resume-editor/${jobId}`);
    dismissCompletion();
  } else if (isGenerating) {
    openProgressModal();
  }
};
```

Replace with:

```tsx
const handleClick = () => {
  if (isComplete && jobId) {
    router.push(`/resume-editor/${jobId}`);
    dismissCompletion();
  } else if (isGenerating) {
    openProgressModal();
  } else if (isError) {
    cancelGeneration();
  }
};
```

- [ ] **Step 3: Make the error widget show a pointer cursor**

Find this line in the widget's `style` prop:

```tsx
cursor: isGenerating || isComplete ? 'pointer' : 'default',
```

Replace with:

```tsx
cursor: isGenerating || isComplete || isError ? 'pointer' : 'default',
```

- [ ] **Step 4: Visual verification**

Trigger an error state. Confirm the "Generation failed" widget is clickable (cursor changes to pointer on hover). Click it — the widget should disappear and all Tailor Resume buttons should become available again.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResumeGenerationWidget.tsx
git commit -m "fix: clicking error widget dismisses it and resets generation state"
```

---

## Task 3: Vivid Solid Colors + Fixed Width on Generation Widget

**Files:**
- Modify: `src/components/ResumeGenerationWidget.tsx`

Replace pastel backgrounds with solid vivid colors (white text on colored backgrounds) and lock the widget to a fixed width.

- [ ] **Step 1: Replace the color variables**

Find these four `const` declarations (lines ~25–28):

```tsx
const dotColor = isComplete ? '#22c55e' : isError ? '#ef4444' : '#f97316';
const bgColor = isComplete ? '#f0fdf4' : isError ? '#fef2f2' : '#fff7ed';
const borderColor = isComplete ? '#bbf7d0' : isError ? '#fecaca' : '#fed7aa';
const textColor = isComplete ? '#15803d' : isError ? '#dc2626' : '#c2410c';
```

Replace with:

```tsx
const dotColor = '#ffffff';
const bgColor = isComplete ? '#22c55e' : isError ? '#ef4444' : '#f97316';
const borderColor = isComplete ? '#16a34a' : isError ? '#dc2626' : '#ea580c';
const textColor = '#ffffff';
```

- [ ] **Step 2: Fix the container width**

In the widget's outer `div` style, find:

```tsx
maxWidth: 240,
```

Replace with:

```tsx
width: 200,
```

- [ ] **Step 3: Visual verification**

Confirm the widget appears as solid orange (generating), solid green (complete), solid red (error) — all with white text and white dot. Confirm the widget width stays constant regardless of label length.

- [ ] **Step 4: Commit**

```bash
git add src/components/ResumeGenerationWidget.tsx
git commit -m "feat: vivid solid colors and fixed width on resume generation widget"
```

---

## Task 4: Dynamic Stage Labels on Generation Widget

**Files:**
- Modify: `src/components/ResumeGenerationWidget.tsx`

Show 2-word stage-based labels while generating instead of a static "Tailoring your resume..." string.

- [ ] **Step 1: Add `progress` to the context destructure**

Find the destructure you updated in Task 2:

```tsx
const { status, jobId, openProgressModal, dismissCompletion, cancelGeneration } = useResumeGeneration();
```

Replace with:

```tsx
const { status, jobId, progress, openProgressModal, dismissCompletion, cancelGeneration } = useResumeGeneration();
```

- [ ] **Step 2: Add the stage label map and derived label**

Add this block immediately after the `isError` / `isComplete` / `isGenerating` declarations (after line ~14):

```tsx
const STAGE_LABELS: Record<number, string> = {
  0: 'Loading resume',
  1: 'Parsing resume',
  2: 'Reading LinkedIn',
  3: 'Building profile',
  4: 'Analyzing job',
  5: 'Tailoring resume',
  6: 'Finalizing…',
};

const generatingLabel = STAGE_LABELS[progress.currentStageIndex] ?? 'Tailoring resume';
```

- [ ] **Step 3: Use the dynamic label**

Find the existing `label` const:

```tsx
const label = isComplete ? 'Resume ready' : isError ? 'Generation failed' : 'Tailoring your resume...';
```

Replace with:

```tsx
const label = isComplete ? 'Resume ready' : isError ? 'Generation failed' : generatingLabel;
```

- [ ] **Step 4: Visual verification**

Run a full resume generation. Confirm the widget label updates as each pipeline stage advances: "Loading resume" → "Parsing resume" → "Reading LinkedIn" → "Building profile" → "Analyzing job" → "Tailoring resume" → "Finalizing…". Confirm the widget width stays fixed throughout.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResumeGenerationWidget.tsx
git commit -m "feat: show live stage labels in generation widget"
```

---

## Task 5: Move Success Toast to Top-Right with Slide-Down Animation

**Files:**
- Modify: `src/components/ResumeReadyToast.tsx`

Move the toast from bottom-right to top-right and replace the slide-from-right animation with a slide-down-from-top animation (macOS notification style).

- [ ] **Step 1: Update the keyframe animation**

Find the `<style>` block inside the component's return:

```tsx
<style>{`
  @keyframes rg-toast-in {
    from { opacity: 0; transform: translateX(calc(100% + 24px)); }
    to   { opacity: 1; transform: translateX(0); }
  }
`}</style>
```

Replace with:

```tsx
<style>{`
  @keyframes rg-toast-in {
    from { opacity: 0; transform: translateY(calc(-100% - 24px)); }
    to   { opacity: 1; transform: translateY(0); }
  }
`}</style>
```

- [ ] **Step 2: Update the position**

In the toast container's `style` prop, find:

```tsx
bottom: 24,
right: 24,
```

Replace with:

```tsx
top: 24,
right: 24,
```

- [ ] **Step 3: Visual verification**

Complete a resume generation. Confirm the toast drops in from the top-right corner (not slides from the right, not from the bottom). Confirm the animation feels snappy (0.32s, cubic-bezier easing). Confirm the toast does not overlap the page header/navbar — if it does, increase `top` to `72` to clear the header height.

- [ ] **Step 4: Commit**

```bash
git add src/components/ResumeReadyToast.tsx
git commit -m "feat: success toast slides in from top-right (macOS notification style)"
```

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| Re-enable buttons when generation fails | Task 1 |
| Error widget click-to-dismiss | Task 2 |
| Vivid solid colors (orange/green/red, white text) | Task 3 |
| Fixed widget width | Task 3 |
| Dynamic 2-word stage labels during generation | Task 4 |
| Toast appears from top | Task 5 |
| Toast slide-down animation | Task 5 |

All requirements covered. ✓
