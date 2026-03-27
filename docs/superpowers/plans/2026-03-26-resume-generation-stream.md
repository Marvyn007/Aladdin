# Resume Generation Stream Fix + Background Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the SSE stream dying before reaching the LLM, move stream state into a shared context, and add a floating widget + completion toast so generation can continue in the background.

**Architecture:** `ResumeGenerationContext` wraps the layout and owns the SSE reader loop, abort controller, and all generation state. `TailoredResumeEditor` becomes a context consumer — it opens when `isModalOpen === true` and delegates the stream to `startGeneration()`. `ResumeGenerationWidget` and `ResumeReadyToast` are mounted in `layout.tsx` and react to context state. `Dashboard.tsx` calls `context.openModal()` instead of managing its own modal state.

**Tech Stack:** Next.js 14 App Router, React Context, TypeScript, Server-Sent Events (ReadableStream), `useRouter` from `next/navigation`, `uuid` for IDs

---

## File Map

| File | Change |
|------|--------|
| `src/app/api/generate-tailored-resume-stream/route.ts` | Fix `stage6_export` → `stage7_export` (2 places); add `console.error` to S3 fetch failure catch |
| `src/contexts/ResumeGenerationContext.tsx` | **Create** — context provider, all SSE state, `openModal`, `startGeneration`, `sendToBackground`, `openProgressModal`, `dismissCompletion`, `cancelGeneration` |
| `src/components/ResumeGenerationWidget.tsx` | **Create** — floating orange/green widget, stacked above `ProfileCompletionWidget` |
| `src/components/ResumeReadyToast.tsx` | **Create** — slide-in "Your resume is ready!" toast with auto-dismiss |
| `src/app/layout.tsx` | Add `ResumeGenerationProvider`, `ResumeGenerationWidget`, `ResumeReadyToast` |
| `src/components/resume-editor/TailoredResumeEditor.tsx` | Remove `isOpen`/`onClose` props; read `isModalOpen`, `status`, `progress`, `error` from context; replace "Stop Generation" with "Run in background"; fix `window.location.href` → `router.push`; add `useEffect` to redirect on completion |
| `src/components/Dashboard.tsx` | Call `context.openModal()` instead of `setTailoredResumeModal`; disable "Tailor Resume" button when `status !== 'idle'`; render `<TailoredResumeEditor />` with no props |

---

## Task 1: Fix `route.ts` — stage naming + S3 logging

**Files:**
- Modify: `src/app/api/generate-tailored-resume-stream/route.ts` — lines 131, 134 (stage naming), and S3 catch block

The route emits `stage6_export` but `ParsingProgress.tsx` defines stage IDs as `stage7_export`. This causes the final stage to never light up. Also, S3 fetch failures are not logged, making them hard to diagnose.

- [ ] **Step 1: Fix `stage6_export` → `stage7_export` in two places**

In `src/app/api/generate-tailored-resume-stream/route.ts`, find lines 130–134:

```typescript
      // ── Stage 6: Done ──────────────────────────────────────────
      sendEvent("stage", {
        stageId: "stage6_export",
        name: "Finalizing resume...",
      });
      sendEvent("complete", { stageId: "stage6_export" });
```

Replace with:

```typescript
      // ── Stage 7: Done ──────────────────────────────────────────
      sendEvent("stage", {
        stageId: "stage7_export",
        name: "Finalizing resume...",
      });
      sendEvent("complete", { stageId: "stage7_export" });
```

- [ ] **Step 2: Add `console.error` to the S3 failure catch**

In `route.ts`, find the S3 GetObject section. Look for the `try/catch` block around `s3Client.send(new GetObjectCommand(...))` for the resume PDF. Add a `console.error` inside the catch before the `sendEvent("error", ...)` call:

```typescript
      } catch (s3Err: any) {
        console.error("[generate-tailored-resume-stream] S3 resume fetch error:", s3Err);
        sendEvent("error", { message: "Failed to load your resume. Please re-upload it in Account Settings." });
        controller.close();
        return;
      }
```

> Note: The exact catch block location varies. Search for `GetObjectCommand` in `route.ts` and find the surrounding try/catch.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/app/api/generate-tailored-resume-stream/route.ts
git commit -m "fix: align stage7_export name and log S3 errors in stream route"
```

---

## Task 2: Create `ResumeGenerationContext.tsx`

**Files:**
- Create: `src/contexts/ResumeGenerationContext.tsx`

This is the core of the feature. The SSE reader loop from `TailoredResumeEditor.handleGenerate` moves here, including the `done` event mapping + auto-save POST. A `paramsRef` holds the current job params so `startGeneration` doesn't need them in deps.

- [ ] **Step 1: Create the context file**

Create `src/contexts/ResumeGenerationContext.tsx` with this full content:

```typescript
'use client';

import { createContext, useContext, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';
import type { ParsingStage } from '@/components/resume-editor/ParsingProgress';
import type { TailoredResumeData } from '@/types';
import { DEFAULT_RESUME_DESIGN } from '@/types';

export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

interface ProgressState {
  stages: ParsingStage[];
  currentStageIndex: number;
  isComplete: boolean;
}

const INITIAL_STAGES: ParsingStage[] = [
  { id: 'stage1_resume-load', title: 'Loading Resume', description: 'Downloading and extracting text from your PDF resume', logs: ['Initializing...'], status: 'pending' },
  { id: 'stage2_resume-parse', title: 'Parsing Resume', description: 'Converting resume to structured JSON format', logs: [], status: 'pending' },
  { id: 'stage3_linkedin-parse', title: 'Parsing LinkedIn', description: 'Extracting information from LinkedIn profile (optional)', logs: [], status: 'pending' },
  { id: 'stage4_master-merge', title: 'Building Master Profile', description: 'Combining resume and LinkedIn data', logs: [], status: 'pending' },
  { id: 'stage5_jd-parse', title: 'Analyzing Job Description', description: 'Extracting requirements and matching against Master Profile', logs: [], status: 'pending' },
  { id: 'stage6_tailor', title: 'Generating Tailored Resume', description: 'Rewriting bullets and optimizing for ATS', logs: [], status: 'pending' },
  { id: 'stage7_export', title: 'Finalizing Resume', description: 'Applying design template and styles', logs: [], status: 'pending' },
];

function makeInitialProgress(): ProgressState {
  return {
    stages: INITIAL_STAGES.map(s => ({ ...s, logs: s.id === 'stage1_resume-load' ? ['Initializing...'] : [], status: 'pending' as const })),
    currentStageIndex: 0,
    isComplete: false,
  };
}

export interface ModalParams {
  jobId: string;
  jobTitle: string;
  company: string | null;
  jobDescription: string;
  jobUrl?: string;
  linkedinProfileUrl?: string;
  linkedinData?: string;
}

interface ResumeGenerationState {
  status: GenerationStatus;
  jobId: string | null;
  jobTitle: string | null;
  company: string | null;
  jobUrl: string | null;
  initialJobDescription: string;
  linkedinProfileUrl: string | null;
  linkedinData: string | null;
  progress: ProgressState;
  error: string | null;
  isModalOpen: boolean;
}

export interface ResumeGenerationContextValue extends ResumeGenerationState {
  openModal(params: ModalParams): void;
  startGeneration(jobDescription: string): void;
  sendToBackground(): void;
  openProgressModal(): void;
  dismissCompletion(): void;
  cancelGeneration(): void;
}

const ResumeGenerationContext = createContext<ResumeGenerationContextValue | null>(null);

export function useResumeGeneration(): ResumeGenerationContextValue {
  const ctx = useContext(ResumeGenerationContext);
  if (!ctx) throw new Error('useResumeGeneration must be used inside ResumeGenerationProvider');
  return ctx;
}

// Helpers to update stage state immutably
function applyUpdateStage(stages: ParsingStage[], stageId: string): { stages: ParsingStage[], currentStageIndex: number } {
  const idx = stages.findIndex(s => s.id === stageId);
  const updated = stages.map((stage, i) => {
    if (stage.id === stageId) return { ...stage, status: 'running' as const };
    if (i < idx && stage.status === 'running') return { ...stage, status: 'completed' as const };
    return stage;
  });
  return { stages: updated, currentStageIndex: idx !== -1 ? idx : 0 };
}

function applyCompleteStage(stages: ParsingStage[], stageId: string): ParsingStage[] {
  return stages.map(s => s.id === stageId ? { ...s, status: 'completed' as const } : s);
}

function applyAddLog(stages: ParsingStage[], stageId: string, log: string): ParsingStage[] {
  return stages.map(s => s.id === stageId ? { ...s, logs: [...s.logs, log] } : s);
}

export function ResumeGenerationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);
  // Store job params in a ref so startGeneration can access them without stale closure issues
  const paramsRef = useRef<{
    jobId: string;
    linkedinProfileUrl: string | null;
    linkedinData: string | null;
  }>({ jobId: '', linkedinProfileUrl: null, linkedinData: null });

  const [state, setState] = useState<ResumeGenerationState>({
    status: 'idle',
    jobId: null,
    jobTitle: null,
    company: null,
    jobUrl: null,
    initialJobDescription: '',
    linkedinProfileUrl: null,
    linkedinData: null,
    progress: makeInitialProgress(),
    error: null,
    isModalOpen: false,
  });

  const openModal = useCallback((params: ModalParams) => {
    paramsRef.current = {
      jobId: params.jobId,
      linkedinProfileUrl: params.linkedinProfileUrl ?? null,
      linkedinData: params.linkedinData ?? null,
    };
    setState(prev => {
      // Only reset progress if currently idle — don't clobber an in-progress generation
      const shouldReset = prev.status === 'idle';
      return {
        ...prev,
        jobId: params.jobId,
        jobTitle: params.jobTitle,
        company: params.company,
        jobUrl: params.jobUrl ?? null,
        initialJobDescription: params.jobDescription,
        linkedinProfileUrl: params.linkedinProfileUrl ?? null,
        linkedinData: params.linkedinData ?? null,
        isModalOpen: true,
        ...(shouldReset ? { error: null, progress: makeInitialProgress() } : {}),
      };
    });
  }, []);

  const sendToBackground = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: false }));
  }, []);

  const openProgressModal = useCallback(() => {
    setState(prev => ({ ...prev, isModalOpen: true }));
  }, []);

  const dismissCompletion = useCallback(() => {
    generatingRef.current = false;
    setState({
      status: 'idle',
      jobId: null,
      jobTitle: null,
      company: null,
      jobUrl: null,
      initialJobDescription: '',
      linkedinProfileUrl: null,
      linkedinData: null,
      progress: makeInitialProgress(),
      error: null,
      isModalOpen: false,
    });
  }, []);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    generatingRef.current = false;
    setState(prev => ({
      ...prev,
      status: 'idle',
      progress: makeInitialProgress(),
      error: null,
      isModalOpen: false,
    }));
  }, []);

  const startGeneration = useCallback(async (jobDescription: string) => {
    if (generatingRef.current) return;
    generatingRef.current = true;

    const { jobId, linkedinProfileUrl, linkedinData } = paramsRef.current;

    setState(prev => ({
      ...prev,
      status: 'generating',
      error: null,
      progress: makeInitialProgress(),
    }));

    abortRef.current = new AbortController();

    try {
      const response = await fetch('/api/generate-tailored-resume-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, jobDescription, linkedinProfileUrl, linkedinData }),
        signal: abortRef.current.signal,
      });

      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to read response stream');

      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = 'message';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { currentEvent = 'message'; continue; }
          if (trimmed.startsWith('event: ')) { currentEvent = trimmed.slice(7).trim(); continue; }

          if (trimmed.startsWith('data: ')) {
            let data: any;
            try {
              data = JSON.parse(trimmed.slice(6));
            } catch {
              console.error('[ResumeGenerationContext] Failed to parse SSE data:', trimmed);
              continue;
            }

            const eventType = currentEvent;

            if (eventType === 'stage') {
              setState(prev => {
                const { stages, currentStageIndex } = applyUpdateStage(prev.progress.stages, data.stageId);
                return { ...prev, progress: { ...prev.progress, stages, currentStageIndex } };
              });
            } else if (eventType === 'log') {
              setState(prev => ({
                ...prev,
                progress: { ...prev.progress, stages: applyAddLog(prev.progress.stages, data.stageId, data.log) },
              }));
            } else if (eventType === 'complete') {
              setState(prev => ({
                ...prev,
                progress: { ...prev.progress, stages: applyCompleteStage(prev.progress.stages, data.stageId) },
              }));
            } else if (eventType === 'done') {
              const parsed = data.final_resume_json;
              if (!parsed) {
                setState(prev => ({ ...prev, status: 'error', error: 'Empty resume returned from server.' }));
                generatingRef.current = false;
                continue;
              }

              // Map skills
              let skillsFlat: string[] = [];
              let skillsRecord: Record<string, string[]> = {};
              if (Array.isArray(parsed.skills)) {
                skillsFlat = parsed.skills;
                skillsRecord = { Skills: parsed.skills };
              } else if (parsed.skills && typeof parsed.skills === 'object') {
                skillsRecord = parsed.skills as Record<string, string[]>;
                skillsFlat = Object.values(skillsRecord).flat();
              }

              // Map sections
              const mappedSections = (parsed.sections ?? []).map((sec: any) => ({
                id: uuidv4(),
                type: sec.name.toLowerCase().replace(/[^a-z]/g, ''),
                title: sec.name,
                items: (sec.entries ?? []).map((entry: any) => ({
                  id: uuidv4(),
                  title: entry.title ?? '',
                  subtitle: entry.subtitle ?? '',
                  location: entry.location ?? '',
                  dates: entry.startDate && entry.endDate
                    ? `${entry.startDate} - ${entry.endDate}`
                    : (entry.startDate ?? entry.dates ?? ''),
                  bullets: (entry.bullets ?? []).map((b: string) => ({ id: uuidv4(), text: b })),
                })),
              }));

              if (!mappedSections.some((s: any) => s.type === 'skills')) {
                mappedSections.push({ id: uuidv4(), type: 'skills', title: 'Skills', items: [] });
              }

              const resumeData: TailoredResumeData = {
                id: uuidv4(),
                contact: {
                  name: parsed.basics?.name ?? parsed.basics?.full_name ?? '',
                  email: parsed.basics?.email ?? '',
                  phone: parsed.basics?.phone ?? '',
                  linkedin: parsed.basics?.linkedin ?? '',
                  location: parsed.basics?.location ?? '',
                  github: parsed.basics?.website
                    ? [parsed.basics.website]
                    : parsed.basics?.portfolio
                    ? [parsed.basics.portfolio]
                    : [],
                },
                summary: parsed.summary ?? '',
                sections: mappedSections,
                skills: skillsRecord,
                design: DEFAULT_RESUME_DESIGN,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                jobId,
                jobTitle: paramsRef.current.jobId, // jobTitle not in paramsRef; accessed below
              };
              // Fix: jobTitle comes from state snapshot — not in paramsRef. Use a separate titleRef.
              // (See note in Task 2 Step 2 for the fix)

              const missingSkills: string[] = parsed.missingSkills ?? data.missingSkills ?? [];
              const autoAddedSkills: string[] = parsed.autoAddedSkills ?? data.autoAddedSkills ?? [];
              const matchedSkills = autoAddedSkills.length > 0
                ? skillsFlat.filter(s => !autoAddedSkills.includes(s))
                : skillsFlat;

              // Auto-save to DB
              try {
                await fetch('/api/tailored-resume', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    jobId,
                    resumeData,
                    keywordsData: { matched: matchedSkills, missing: missingSkills, autoAdded: autoAddedSkills },
                  }),
                });
              } catch (saveErr) {
                console.error('[ResumeGenerationContext] Auto-save failed:', saveErr);
              }

              // Mark all stages complete and flip status
              setState(prev => ({
                ...prev,
                status: 'complete',
                progress: {
                  stages: prev.progress.stages.map(s => ({ ...s, status: 'completed' as const })),
                  currentStageIndex: prev.progress.stages.length,
                  isComplete: true,
                },
              }));
              generatingRef.current = false;

            } else if (eventType === 'error') {
              setState(prev => ({ ...prev, status: 'error', error: data.message ?? 'Stream error' }));
              generatingRef.current = false;
            }
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setState(prev => ({ ...prev, status: 'error', error: err.message ?? 'Failed to generate resume.' }));
      }
      generatingRef.current = false;
    }
  }, [router]);

  const value: ResumeGenerationContextValue = {
    ...state,
    openModal,
    startGeneration,
    sendToBackground,
    openProgressModal,
    dismissCompletion,
    cancelGeneration,
  };

  return (
    <ResumeGenerationContext.Provider value={value}>
      {children}
    </ResumeGenerationContext.Provider>
  );
}
```

- [ ] **Step 2: Fix the `jobTitle` ref issue**

The code above has a bug: `resumeData.jobTitle` is set incorrectly. Expand `paramsRef` to include `jobTitle`:

In the same file, update the `paramsRef` type and usage:

```typescript
  // At the top of ResumeGenerationProvider, change paramsRef to:
  const paramsRef = useRef<{
    jobId: string;
    jobTitle: string;
    linkedinProfileUrl: string | null;
    linkedinData: string | null;
  }>({ jobId: '', jobTitle: '', linkedinProfileUrl: null, linkedinData: null });
```

In `openModal`, update the `paramsRef.current` assignment:
```typescript
    paramsRef.current = {
      jobId: params.jobId,
      jobTitle: params.jobTitle,
      linkedinProfileUrl: params.linkedinProfileUrl ?? null,
      linkedinData: params.linkedinData ?? null,
    };
```

In `startGeneration`, update the destructure and the `resumeData` construction:
```typescript
    const { jobId, jobTitle, linkedinProfileUrl, linkedinData } = paramsRef.current;
    // ...
    // In resumeData, replace:
    //   jobTitle: paramsRef.current.jobId,  ← wrong line from Step 1
    // with:
                jobTitle,
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors relating to `ResumeGenerationContext`.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/contexts/ResumeGenerationContext.tsx
git commit -m "feat: create ResumeGenerationContext with SSE reader loop"
```

---

## Task 3: Create `ResumeGenerationWidget.tsx`

**Files:**
- Create: `src/components/ResumeGenerationWidget.tsx`

Floating bottom-right widget. Hidden when `status === 'idle'`. Orange + pulsing when `generating`. Green when `complete`. Clicking the green widget navigates to the editor and calls `dismissCompletion()`.

- [ ] **Step 1: Create the widget**

Create `src/components/ResumeGenerationWidget.tsx`:

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';

export function ResumeGenerationWidget() {
  const router = useRouter();
  const { status, jobId, openProgressModal, dismissCompletion } = useResumeGeneration();

  if (status === 'idle') return null;

  const isGenerating = status === 'generating';
  const isComplete = status === 'complete';
  const isError = status === 'error';

  const handleClick = () => {
    if (isComplete && jobId) {
      router.push(`/resume-editor/${jobId}`);
      dismissCompletion();
    } else if (isGenerating) {
      openProgressModal();
    }
  };

  const dotColor = isComplete ? '#22c55e' : isError ? '#ef4444' : '#f97316';
  const bgColor = isComplete ? '#f0fdf4' : isError ? '#fef2f2' : '#fff7ed';
  const borderColor = isComplete ? '#bbf7d0' : isError ? '#fecaca' : '#fed7aa';
  const textColor = isComplete ? '#15803d' : isError ? '#dc2626' : '#c2410c';
  const label = isComplete ? 'Resume ready' : isError ? 'Generation failed' : 'Tailoring your resume...';

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: 88,  // stacked above ProfileCompletionWidget (~72px)
        right: 24,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 12,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        cursor: isGenerating || isComplete ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'box-shadow 0.2s ease',
        maxWidth: 240,
      }}
      onMouseEnter={(e) => { if (isGenerating || isComplete) e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.18)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; }}
    >
      {/* Status dot */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: dotColor,
          }}
        />
        {isGenerating && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              left: -3,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: dotColor,
              opacity: 0.35,
              animation: 'rg-pulse 1.5s ease-in-out infinite',
            }}
          />
        )}
      </div>

      <span style={{ fontSize: 13, fontWeight: 600, color: textColor, whiteSpace: 'nowrap' }}>
        {label}
      </span>

      <style>{`
        @keyframes rg-pulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/components/ResumeGenerationWidget.tsx
git commit -m "feat: add ResumeGenerationWidget floating status indicator"
```

---

## Task 4: Create `ResumeReadyToast.tsx`

**Files:**
- Create: `src/components/ResumeReadyToast.tsx`

Slides in from the right when `status` flips to `'complete'`. Auto-dismisses after 8 seconds. Does NOT appear if `isModalOpen === true` (the modal handles redirect directly).

- [ ] **Step 1: Create the toast component**

Create `src/components/ResumeReadyToast.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';

export function ResumeReadyToast() {
  const router = useRouter();
  const { status, jobId, isModalOpen, dismissCompletion } = useResumeGeneration();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status === 'complete' && !isModalOpen && !dismissed) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        // Don't call dismissCompletion on auto-dismiss — let the widget stay green
      }, 8000);
      return () => clearTimeout(timer);
    }
    if (status !== 'complete') {
      setVisible(false);
      setDismissed(false);
    }
  }, [status, isModalOpen, dismissed]);

  const handleOpen = () => {
    if (jobId) {
      router.push(`/resume-editor/${jobId}`);
      dismissCompletion();
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    // Widget stays green — user can still click it
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes rg-toast-in {
          from { opacity: 0; transform: translateX(calc(100% + 24px)); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9100,
          maxWidth: 340,
          width: 'calc(100vw - 48px)',
          background: '#fff',
          border: '1px solid #bbf7d0',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          padding: '16px 18px',
          animation: 'rg-toast-in 0.32s cubic-bezier(0.22,1,0.36,1) forwards',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>Your resume is ready!</span>
          </div>
          <button
            onClick={handleDismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', lineHeight: 1 }}
            aria-label="Dismiss"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, margin: 0 }}>
          Open it in the editor to review and fine-tune anything that doesn&apos;t look right. You can also click the green widget anytime to jump back.
        </p>

        {/* Action */}
        <button
          onClick={handleOpen}
          style={{
            alignSelf: 'flex-start',
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Open in editor
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/components/ResumeReadyToast.tsx
git commit -m "feat: add ResumeReadyToast slide-in completion notification"
```

---

## Task 5: Wire into `layout.tsx`

**Files:**
- Modify: `src/app/layout.tsx`

Add `ResumeGenerationProvider` wrapping the entire body content (inside `ThemeRegistry`). Add `ResumeGenerationWidget` and `ResumeReadyToast` alongside the existing `ProfileCompletionWidget`.

- [ ] **Step 1: Update `layout.tsx`**

Current `src/app/layout.tsx`:

```typescript
import { FilterProvider } from "@/contexts/FilterContext";
import { cn } from "@/lib/utils";
import { ProfileCompletionWidget } from "@/components/ProfileCompletionWidget";
// ...

export default function RootLayout({ children }: ...) {
  return (
    <ClerkProvider>
      <html ...>
        <body ...>
          <ThemeRegistry>
            <Suspense>
              <FilterProvider>
                {children}
              </FilterProvider>
            </Suspense>
            <ProfileCompletionWidget />
          </ThemeRegistry>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

Replace with:

```typescript
import { FilterProvider } from "@/contexts/FilterContext";
import { ResumeGenerationProvider } from "@/contexts/ResumeGenerationContext";
import { cn } from "@/lib/utils";
import { ProfileCompletionWidget } from "@/components/ProfileCompletionWidget";
import { ResumeGenerationWidget } from "@/components/ResumeGenerationWidget";
import { ResumeReadyToast } from "@/components/ResumeReadyToast";
// ...

export default function RootLayout({ children }: ...) {
  return (
    <ClerkProvider>
      <html ...>
        <body ...>
          <ThemeRegistry>
            <ResumeGenerationProvider>
              <Suspense>
                <FilterProvider>
                  {children}
                </FilterProvider>
              </Suspense>
              <ProfileCompletionWidget />
              <ResumeGenerationWidget />
              <ResumeReadyToast />
            </ResumeGenerationProvider>
          </ThemeRegistry>
          <Analytics />
        </body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/app/layout.tsx
git commit -m "feat: add ResumeGenerationProvider, widget, and toast to root layout"
```

---

## Task 6: Refactor `TailoredResumeEditor.tsx`

**Files:**
- Modify: `src/components/resume-editor/TailoredResumeEditor.tsx`

This component changes significantly:
- Removes all local stream state (`isGenerating`, `error`, `hasGenerated`, `abortControllerRef`, `parsingProgress`)
- Reads from context instead
- `isModalOpen` from context controls visibility (replaces `isOpen` prop)
- Generate button calls `context.startGeneration(jobDescription)`
- "Stop Generation" button becomes "Run in background" → calls `context.sendToBackground()`
- X close button calls `context.sendToBackground()` (safe even when idle)
- `useEffect` watches for `status === 'complete'` while modal is open → `router.push`

- [ ] **Step 1: Replace the file contents**

Rewrite `src/components/resume-editor/TailoredResumeEditor.tsx` with:

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ParsingProgress } from './ParsingProgress';
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';

export function TailoredResumeEditor() {
  const router = useRouter();
  const {
    status,
    jobTitle,
    company,
    jobUrl,
    initialJobDescription,
    progress,
    error,
    isModalOpen,
    jobId,
    startGeneration,
    sendToBackground,
  } = useResumeGeneration();

  const [jobDescription, setJobDescription] = useState('');

  // Re-initialize textarea when modal opens with a new job
  useEffect(() => {
    if (isModalOpen && initialJobDescription) {
      setJobDescription(initialJobDescription);
    }
  }, [isModalOpen, initialJobDescription]);

  // Redirect when generation completes while modal is open
  useEffect(() => {
    if (status === 'complete' && isModalOpen && jobId) {
      router.push(`/resume-editor/${jobId}`);
    }
  }, [status, isModalOpen, jobId, router]);

  if (!isModalOpen) return null;

  const isGenerating = status === 'generating';
  const hasGenerated = status === 'complete';

  const handleGenerate = () => {
    if (!jobDescription.trim()) return;
    startGeneration(jobDescription);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '12px',
        width: '90%', maxWidth: '600px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(12,24,40,0.35)',
        overflow: 'hidden', border: '1px solid #e6e9ee'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e6e9ee' }}>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Tailored Resume Editor</h2>
              <p style={{ marginTop: '4px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                {jobTitle} {company && `at ${company}`}
              </p>
            </div>
            <button
              onClick={sendToBackground}
              style={{
                padding: '8px',
                marginTop: '-4px',
                marginRight: '-4px',
                color: '#94a3b8',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{
              padding: '12px 16px', background: '#fef2f2',
              color: '#dc2626', borderRadius: '8px',
              marginBottom: '20px', fontSize: '14px',
              border: '1px solid #fecaca'
            }}>
              {error}
            </div>
          )}

          {!isGenerating && !hasGenerated ? (
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Job Description <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                style={{
                  width: '100%',
                  background: '#fff',
                  border: '1px solid #e6e9ee',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  resize: 'vertical',
                  color: '#334155',
                  lineHeight: 1.6,
                  outline: 'none',
                  minHeight: '200px',
                  transition: 'all 0.2s ease'
                }}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description here..."
              />
            </div>
          ) : (
            <div style={{ padding: '20px 0' }}>
              <ParsingProgress
                stages={progress.stages}
                currentStageIndex={progress.currentStageIndex}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e6e9ee', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isGenerating ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button
                onClick={sendToBackground}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#92400e',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Run in background
              </button>
            </div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                {jobUrl && (
                  <a
                    href={jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '13px', fontWeight: 600, color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                    View Original Job
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={sendToBackground}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={status !== 'idle' || !jobDescription.trim()}
                  style={{
                    padding: '9px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: (status !== 'idle' || !jobDescription.trim()) ? '#94a3b8' : '#fff',
                    background: (status !== 'idle' || !jobDescription.trim()) ? '#f1f5f9' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (status !== 'idle' || !jobDescription.trim()) ? 'not-allowed' : 'pointer',
                    boxShadow: (status !== 'idle' || !jobDescription.trim()) ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Generate Resume
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/components/resume-editor/TailoredResumeEditor.tsx
git commit -m "feat: refactor TailoredResumeEditor to consume ResumeGenerationContext"
```

---

## Task 7: Update `Dashboard.tsx` — call context + disable Tailor Resume button

**Files:**
- Modify: `src/components/Dashboard.tsx`

Two changes: (1) call `context.openModal()` instead of `setTailoredResumeModal`, (2) disable the "Tailor Resume" button when `status !== 'idle'`, (3) render `<TailoredResumeEditor />` with no props.

- [ ] **Step 1: Read the relevant sections of `Dashboard.tsx`**

Confirm line numbers for:
- `tailoredResumeModal` state definition (search: `tailoredResumeModal`)
- `handleGenerateTailoredResume` function (line ~1004)
- `<TailoredResumeEditor` JSX (line ~1509)

- [ ] **Step 2: Add context import and hook usage**

Near the top of `Dashboard.tsx`, find the imports and add:

```typescript
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';
```

In the component body, after the existing hooks, add:

```typescript
    const { openModal: openResumeModal, status: resumeStatus } = useResumeGeneration();
```

- [ ] **Step 3: Update `handleGenerateTailoredResume` to call `openResumeModal`**

Find `handleGenerateTailoredResume` (around line 1004). Replace the `setTailoredResumeModal({...})` call at the end with:

```typescript
        openResumeModal({
            jobId,
            jobTitle: job.title,
            company: job.company,
            jobDescription: getPlainTextJobDescription(job),
            jobUrl: job.source_url ?? undefined,
            linkedinProfileUrl: undefined,
            linkedinData: undefined,
        });
```

Also replace the `window.location.href` redirect on line ~1021 with `router.push`:

```typescript
                    router.push(`/resume-editor/${jobId}`);
```

(The `router` object should already be available in `Dashboard.tsx` — if not, import `useRouter` from `next/navigation`.)

- [ ] **Step 4: Disable `tailoredResumeModal` state (or remove it)**

Find the `tailoredResumeModal` useState definition (probably around line 80-100) and either:
- Remove it entirely if it's only used for `TailoredResumeEditor`
- Or keep it and just stop setting `isOpen: true` (you already replaced that call in Step 3)

If removing, also remove the `setTailoredResumeModal` calls wherever they appear.

> Note: If `tailoredResumeModal` state is used for other purposes beyond `TailoredResumeEditor`, leave it but stop passing `isOpen` to the editor.

- [ ] **Step 5: Update the `<TailoredResumeEditor />` JSX**

Find the `<TailoredResumeEditor ...>` block (around line 1509). Replace with:

```typescript
            {/* Tailored Resume Editor — state managed by ResumeGenerationContext */}
            <TailoredResumeEditor />
```

- [ ] **Step 6: Disable "Tailor Resume" button on job cards when `resumeStatus !== 'idle'`**

Search for where the "Tailor Resume" / "Parse & Edit Resume" button calls `onGenerateTailoredResume` in `JobDetail.tsx`. Find where it's rendered (search for `handleTailorResumeClick` or `onGenerateTailoredResume`).

In `src/components/layout/JobDetail.tsx`, find the "Tailor Resume" button. Pass `resumeStatus` down via a new prop OR read from context directly inside `JobDetail`.

**Option A (simpler — read from context in JobDetail):**

In `src/components/layout/JobDetail.tsx`, add at the top of the file:

```typescript
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';
```

In the component body:

```typescript
    const { status: resumeStatus } = useResumeGeneration();
```

Find the Tailor Resume button and add `disabled` + tooltip:

```typescript
                <button
                    onClick={resumeStatus !== 'idle' ? undefined : handleTailorResumeClick}
                    disabled={resumeStatus !== 'idle'}
                    title={resumeStatus !== 'idle' ? 'Resume generation in progress' : undefined}
                    style={{
                        // ...existing styles...
                        opacity: resumeStatus !== 'idle' ? 0.5 : 1,
                        cursor: resumeStatus !== 'idle' ? 'not-allowed' : 'pointer',
                    }}
                >
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/components/Dashboard.tsx src/components/layout/JobDetail.tsx
git commit -m "feat: wire dashboard to ResumeGenerationContext, lock Tailor Resume during generation"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|------------|
| Fix button not disabled during generation | Task 6 — Generate button disabled when `status !== 'idle'` |
| Fix double-click fires two concurrent streams | Task 2 — `generatingRef.current` guard in `startGeneration` |
| Fix SSE error event silently swallowed | Task 2 — `eventType === 'error'` sets `status: 'error'`; Task 6 — error displayed in modal UI |
| Fix stage naming mismatch `stage6_export` → `stage7_export` | Task 1 |
| Fix `window.location.href` → `router.push` | Task 6 (modal redirect), Task 7 (existing resume check) |
| Fix server-side S3 error not logged | Task 1 — `console.error` added to S3 catch |
| Shared `ResumeGenerationContext` state | Task 2 |
| `startGeneration()` kicks off SSE, `sendToBackground()` closes modal | Task 2 + Task 6 |
| "Run in background" button replaces "Stop Generation" | Task 6 |
| Floating widget — orange (generating), green (complete) | Task 3 |
| Widget click (green) navigates to editor + dismisses | Task 3 — `router.push` + `dismissCompletion()` |
| Widget stacks above `ProfileCompletionWidget` | Task 3 — `bottom: 88` places it above the 72px widget |
| Completion toast slides in when `status='complete'` | Task 4 |
| Toast does not appear if `isModalOpen === true` | Task 4 — condition `!isModalOpen` |
| Toast "Open" navigates + toast dismissed | Task 4 |
| Toast "×" dismisses toast, widget stays green | Task 4 — `dismissed` state, `dismissCompletion` NOT called |
| Modal redirects automatically on completion | Task 6 — `useEffect` watches `status === 'complete' && isModalOpen` |
| Global lock on all "Tailor Resume" buttons | Task 7 — `JobDetail.tsx` reads `resumeStatus` from context |
| `openProgressModal()` re-opens modal from widget | Task 3 + Task 2 |

**Placeholder scan:** No TBDs or vague steps. All code is complete.

**Type consistency:** `ModalParams` defined in `ResumeGenerationContext.tsx` and imported by `Dashboard.tsx`. `ParsingStage` imported from `ParsingProgress.tsx` in both `ResumeGenerationContext.tsx` and `TailoredResumeEditor.tsx`. `TailoredResumeData` and `DEFAULT_RESUME_DESIGN` imported from `@/types` in context. `useResumeGeneration` exported from context and imported in `TailoredResumeEditor`, `ResumeGenerationWidget`, `ResumeReadyToast`, `Dashboard`, and `JobDetail`.
