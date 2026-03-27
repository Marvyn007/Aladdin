# Onboarding Modal Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New users land on /onboarding after sign-up; skip works freely; the "Finish Your Profile" modal shows whenever any required onboarding question is unanswered and reappears automatically when answers are removed.

**Architecture:** Add `allRequiredAnswered: boolean` to the `OnboardingSnapshot` returned by the DB layer and the API. Switch `ProfileCompletionWidget` to use this field as its trigger instead of `profileSetupComplete`, and add a window-focus re-fetch so changes in the Preferences tab cause the modal to reappear. Remove the `OnboardingRedirect` blocker and the `complete: true` flag from the skip handler.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Clerk auth, PostgreSQL/Supabase/SQLite (via `onboarding-db.ts` abstraction), React hooks

---

## File Map

| File | Change |
|------|--------|
| `src/lib/onboarding-db.ts` | Add `allRequiredAnswered` to `OnboardingSnapshot` interface + compute it in `getOnboardingSnapshot` |
| `src/components/ProfileCompletionWidget.tsx` | Update `Snapshot` interface; switch trigger to `allRequiredAnswered`; add focus/visibilitychange re-fetch; update `prefsDone` |
| `src/components/onboarding/OnboardingWizard.tsx` | Remove `complete: true` from skip handler POST body |
| `src/components/OnboardingRedirect.tsx` | **Delete** |
| `src/app/page.tsx` | Remove `<OnboardingRedirect />` import and JSX |

> `src/app/api/onboarding/route.ts` needs **no changes** — it spreads the full `OnboardingSnapshot` so the new field is automatically included.

---

## Task 1: Add `allRequiredAnswered` to `OnboardingSnapshot`

**Files:**
- Modify: `src/lib/onboarding-db.ts` — `OnboardingSnapshot` interface (line 25) and `getOnboardingSnapshot` function (line 536)

- [ ] **Step 1: Update the `OnboardingSnapshot` interface**

In `src/lib/onboarding-db.ts`, find the `OnboardingSnapshot` interface (around line 25) and add the new field:

```typescript
export interface OnboardingSnapshot {
  state: OnboardingStateRecord;
  answers: OnboardingAnswerRecord[];
  answersByKey: Record<string, OnboardingAnswerRecord>;
  requiredAnswered: number;
  requiredTotal: number;
  progress: number;
  completed: boolean;
  profileSetupComplete: boolean;
  allRequiredAnswered: boolean;   // ← ADD THIS
}
```

- [ ] **Step 2: Compute `allRequiredAnswered` in `getOnboardingSnapshot`**

Find `getOnboardingSnapshot` (around line 536) and add the computation:

```typescript
export async function getOnboardingSnapshot(userId: string): Promise<OnboardingSnapshot> {
  const [state, answers] = await Promise.all([fetchState(userId), fetchAnswers(userId)]);
  const { requiredAnswered, requiredTotal, progress } = computeProgress(answers);

  return {
    state,
    answers,
    answersByKey: Object.fromEntries(answers.map((answer) => [answer.questionKey, answer])),
    requiredAnswered,
    requiredTotal,
    progress,
    completed: state.status === 'complete' || progress >= 100,
    profileSetupComplete: state.profileSetupComplete,
    allRequiredAnswered: requiredTotal > 0 && requiredAnswered === requiredTotal,  // ← ADD THIS
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors related to `OnboardingSnapshot`.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/lib/onboarding-db.ts
git commit -m "feat: add allRequiredAnswered to OnboardingSnapshot"
```

---

## Task 2: Fix skip handler — remove `complete: true`

**Files:**
- Modify: `src/components/onboarding/OnboardingWizard.tsx` — `handleSkip` function (around line 82)

- [ ] **Step 1: Find and update the skip POST body**

In `src/components/onboarding/OnboardingWizard.tsx`, find `handleSkip`. It currently sends `complete: true`. Remove that field so skip only saves partial progress:

```typescript
const handleSkip = async () => {
  setSaving(true);
  try {
    await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentStep,
        // complete: true  ← REMOVED. Skip saves progress but does not mark complete.
        answers: Object.entries(answers).map(([questionKey, value]) => ({ questionKey, value })),
      }),
    });
  } catch {
    // Non-blocking — navigate regardless
  } finally {
    setSaving(false);
  }
  router.push('/');
};
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
git add src/components/onboarding/OnboardingWizard.tsx
git commit -m "fix: skip onboarding does not mark complete"
```

---

## Task 3: Remove `OnboardingRedirect` component

**Files:**
- Delete: `src/components/OnboardingRedirect.tsx`
- Modify: `src/app/page.tsx` — remove import and JSX usage

- [ ] **Step 1: Delete `OnboardingRedirect.tsx`**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
rm src/components/OnboardingRedirect.tsx
```

- [ ] **Step 2: Remove import and JSX from `src/app/page.tsx`**

Current `src/app/page.tsx`:
```typescript
import { OnboardingRedirect } from '@/components/OnboardingRedirect';

export default function Home() {
  return (
    <>
      <OnboardingRedirect />
      <Suspense fallback={...}>
        <Dashboard defaultActiveView="jobs" defaultJobMode="list" />
      </Suspense>
    </>
  );
}
```

Replace with:
```typescript
import React, { Suspense } from 'react';
import { Dashboard } from '@/components/Dashboard';

export default function Home() {
  return (
    <Suspense fallback={
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '8px' }}>
        <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Loading Dashboard...</span>
      </div>
    }>
      <Dashboard defaultActiveView="jobs" defaultJobMode="list" />
    </Suspense>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/app/page.tsx
git commit -m "fix: remove OnboardingRedirect blocker from dashboard"
```

---

## Task 4: Update `ProfileCompletionWidget` trigger + focus re-fetch

**Files:**
- Modify: `src/components/ProfileCompletionWidget.tsx`

This task has three sub-changes: (a) update the `Snapshot` interface, (b) switch the trigger to `allRequiredAnswered`, (c) add window focus re-fetch.

- [ ] **Step 1: Update the `Snapshot` interface**

Find the `Snapshot` interface near the top of `src/components/ProfileCompletionWidget.tsx` (around line 17):

```typescript
interface Snapshot {
  completed: boolean;
  profileSetupComplete: boolean;
  allRequiredAnswered: boolean;   // ← ADD THIS
  answersByKey?: Record<string, { value: unknown }>;
}
```

- [ ] **Step 2: Switch the modal trigger from `profileSetupComplete` to `allRequiredAnswered`**

In the `checkStatus` function (around line 479), find:

```typescript
// Source of truth: DB flag
if (snapshot.profileSetupComplete) {
  setSetupComplete(true);
  return;
}
```

Replace with:

```typescript
// Source of truth: all required preference questions answered
if (snapshot.allRequiredAnswered) {
  setSetupComplete(true);
  return;
}
```

- [ ] **Step 3: Update `prefsDone` to use `allRequiredAnswered`**

In the same `checkStatus` function (around line 527), find:

```typescript
const prefsDone = snapshot.completed;
```

Replace with:

```typescript
const prefsDone = snapshot.allRequiredAnswered;
```

- [ ] **Step 4: Add window focus re-fetch**

In `ProfileCompletionWidget`, find the existing `useEffect` that calls `checkStatus` on mount (around line 541):

```typescript
useEffect(() => {
  if (!isLoaded) return;
  if (!isSignedIn) { setSetupComplete(true); return; }
  void checkStatus();
}, [isLoaded, isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
```

Add a **second** `useEffect` immediately after it that listens for window focus and document visibility changes:

```typescript
// Re-check when the user returns to this tab/window (e.g. after editing preferences)
useEffect(() => {
  if (!isSignedIn) return;

  const handleFocus = () => { void checkStatus(); };

  window.addEventListener('focus', handleFocus);
  document.addEventListener('visibilitychange', handleFocus);

  return () => {
    window.removeEventListener('focus', handleFocus);
    document.removeEventListener('visibilitychange', handleFocus);
  };
}, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git add src/components/ProfileCompletionWidget.tsx
git commit -m "feat: modal triggers on allRequiredAnswered with focus re-fetch"
```

---

## Task 5: End-to-end smoke test

- [ ] **Step 1: Start the dev server**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
npm run dev
```

- [ ] **Step 2: Test new-user sign-up flow**

1. Open an incognito window → go to `/sign-up`
2. Create a new account (email or OAuth)
3. Verify you land on `/onboarding` — not `/`

- [ ] **Step 3: Test skip behavior**

1. On `/onboarding` step 1, click "Skip for now"
2. Verify you land on `/` (not redirected back to `/onboarding`)
3. Verify the "Finish Your Profile" modal appears within ~500ms

- [ ] **Step 4: Test modal persistence**

1. Open Account Settings → Preferences tab
2. Fill in all required questions (work_areas, career_levels, role_types, regions, work_style, visa_sponsorship, alert_frequency, job_search_challenges)
3. Save
4. Return to the dashboard
5. Verify the modal disappears

- [ ] **Step 5: Test modal reappearance**

1. Open Account Settings → Preferences tab
2. Clear one of the required answers (e.g. remove all work_areas)
3. Save
4. Click back to the dashboard tab / switch windows
5. Verify the modal reappears within a second (window focus triggers re-fetch)

- [ ] **Step 6: Commit smoke test sign-off**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin"
git tag smoke-test-onboarding-modal-$(date +%Y%m%d)
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|-----------------|------------|
| New user → /onboarding after sign-up | Already working; no code change needed (confirmed in exploration) |
| Skip → goes to / without redirect | Task 2 (remove `complete: true`) + Task 3 (remove `OnboardingRedirect`) |
| Modal shows when any required question unanswered | Task 1 (`allRequiredAnswered`) + Task 4 (trigger switch) |
| Modal disappears only when all required answered | Task 4 (trigger switch to `allRequiredAnswered`) |
| Modal reappears when answers removed in Preferences | Task 4 (window focus re-fetch) |
| No permanent dismissal | Task 4 (no dismiss-forever logic added) |

**Placeholder scan:** No TBDs, no "implement later", all code blocks are complete.

**Type consistency:** `allRequiredAnswered` added to both `OnboardingSnapshot` (Task 1) and `Snapshot` interface in widget (Task 4). `prefsDone` uses `snapshot.allRequiredAnswered` in Task 4, consistent with the field added in Task 1. All consistent.
