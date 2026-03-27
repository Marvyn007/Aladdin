# Onboarding → Modal Flow Design

**Date:** 2026-03-26
**Status:** Approved

---

## Overview

New users land on `/onboarding` immediately after sign-up. They can skip at any step. Once on the dashboard, a persistent "Finish Your Profile" modal appears and stays visible until every required onboarding question is answered. If the user later removes a required answer from the Preferences tab, the modal reappears automatically.

---

## 1. Sign-up Redirect (New Users → /onboarding)

**No changes needed.** Both paths already route new users correctly:

- **Email/password signup:** After `setActive({ session })`, redirects to `/onboarding`
- **OAuth (SSO callback):** Calls `POST /api/user/init`, checks `isNew`, redirects to `/onboarding` if `isNew: true`

**Remove `OnboardingRedirect` component** from `src/components/OnboardingRedirect.tsx` and from `src/app/page.tsx`. This component force-redirected users from `/` to `/onboarding` if `state.complete !== true`, which conflicts with the skip-and-go-to-dashboard behavior.

---

## 2. Skip Behavior on /onboarding

Both Step 1 and Step 2 have a "Skip for now" button. When clicked:

- Save any partial answers collected so far via `POST /api/onboarding` — **without** `complete: true`
- Leave `status` as `in_progress` in the DB (do not mark complete)
- Navigate immediately to `/`

**Key change from previous implementation:** Skip no longer sends `complete: true`. The DB `status` field is decoupled from modal visibility — the modal is driven solely by `allRequiredAnswered`, not by whether the user finished the wizard.

---

## 3. Question `required` Flag

Each question definition in `src/lib/onboarding.ts` gets a `required: boolean` field added to its schema. Example:

```ts
{ key: 'work_areas',  label: '...', step: 1, required: true  }
{ key: 'extra_notes', label: '...', step: 2, required: false }
```

The developer (user) controls which questions are required by toggling this flag. No code changes needed elsewhere when adding/removing required questions.

---

## 4. Server: `allRequiredAnswered` Computation

`GET /api/onboarding` adds a new field to the response:

```ts
allRequiredAnswered: boolean
```

Computed as:
1. Get all questions where `required === true`
2. Check that every such question has an entry in `answersByKey`
3. `allRequiredAnswered = requiredQuestions.every(q => answersByKey[q.key] != null)`

This replaces `profileSetupComplete` as the modal trigger. `profileSetupComplete` (resume + LinkedIn flag) is left intact for any other consumers but is no longer used by the modal.

---

## 5. Modal Trigger: ProfileCompletionWidget

**Trigger condition changes:**

| Before | After |
|--------|-------|
| `profileSetupComplete === false` | `allRequiredAnswered === false` |

**Re-check on window focus:** The widget adds event listeners for `visibilitychange` and `focus`. When the document becomes visible again (e.g., user closes account settings modal), it re-fetches `GET /api/onboarding` and updates its state. If a required answer was removed, `allRequiredAnswered` returns `false` and the modal reappears.

**No permanent dismissal:** The modal has no "close forever" or "dismiss" action. It hides only when `allRequiredAnswered === true`. The existing collapsed-pill / expanded-accordion UI is unchanged.

---

## 6. Data Flow

```
Sign up (email or OAuth)
  └─→ /onboarding

/onboarding
  ├─ Complete all steps → POST /api/onboarding { complete: true } → /
  └─ Skip for now      → POST /api/onboarding (no complete flag)  → /

/ (dashboard)
  └─ ProfileCompletionWidget mounts
       └─ GET /api/onboarding
            ├─ allRequiredAnswered: true  → modal hidden
            └─ allRequiredAnswered: false → modal shown (stays until true)

Account Settings → Preferences tab
  └─ User edits/removes answers → saves to DB
       └─ User closes preferences → window focus event fires
            └─ ProfileCompletionWidget re-fetches GET /api/onboarding
                 ├─ allRequiredAnswered: true  → modal hides
                 └─ allRequiredAnswered: false → modal shows again
```

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/lib/onboarding.ts` | Add `required: boolean` to each question definition |
| `src/app/api/onboarding/route.ts` | Compute and return `allRequiredAnswered` in GET response |
| `src/lib/onboarding-db.ts` | Pass required questions to snapshot computation |
| `src/components/ProfileCompletionWidget.tsx` | Switch trigger to `allRequiredAnswered`; add focus re-fetch |
| `src/components/onboarding/OnboardingWizard.tsx` | Remove `complete: true` from skip handler |
| `src/components/OnboardingRedirect.tsx` | **Delete** |
| `src/app/page.tsx` | Remove `<OnboardingRedirect />` usage |

---

## 8. What Is NOT Changing

- Modal UI (collapsed pill, expanded accordion, step structure) — unchanged
- Sign-up page redirect to `/onboarding` — already correct
- SSO callback `isNew` check — already correct
- Preferences tab data storage — already saves to onboarding answers table
- `profileSetupComplete` DB flag — left intact, just no longer drives the modal
