---
phase: 04-implement-onboarding-page-with-job-recommendation-using-shadcn-ui
plan: "02"
subsystem: onboarding
tags: [onboarding, shadcn-ui, wizard, multi-step, file-upload, react, nextjs]

requires:
  - phase: 04-01
    provides: shadcn/ui components (Button, Card, Progress, Checkbox, RadioGroup, Badge, Tooltip), tweakcn theme.css, linkedin_pdf question in ONBOARDING_QUESTIONS, onboarding-db.ts with getOnboardingSnapshot/saveOnboardingAnswers

provides:
  - /onboarding page with dark-themed 2-step wizard (layout + page)
  - OnboardingWizard.tsx: client wizard with GET/POST /api/onboarding state machine
  - StepOne.tsx: renders step 1 questions (multi_select, single_select)
  - StepTwo.tsx: renders step 2 questions (all 4 types)
  - QuestionMultiSelect, QuestionSingleSelect, QuestionFileUpload, QuestionText components
  - /api/onboarding route (GET snapshot, POST answers + complete)

affects:
  - 04-03 (recommendation panel can be added to this wizard)
  - 04-04 (job recommendation uses preference score computed from wizard answers)

tech-stack:
  added: []
  patterns:
    - Wizard state machine with currentStep local state and useEffect for snapshot load
    - Step container components (StepOne/StepTwo) delegating to type-specific renderers
    - QuestionFileUpload handles both upload-resume (data.resume.id) and upload-linkedin (data.profile.id) response shapes

key-files:
  created:
    - src/app/onboarding/layout.tsx
    - src/app/onboarding/page.tsx
    - src/components/onboarding/OnboardingWizard.tsx
    - src/components/onboarding/StepOne.tsx
    - src/components/onboarding/StepTwo.tsx
    - src/components/onboarding/QuestionMultiSelect.tsx
    - src/components/onboarding/QuestionSingleSelect.tsx
    - src/components/onboarding/QuestionFileUpload.tsx
    - src/components/onboarding/QuestionText.tsx
    - src/app/api/onboarding/route.ts
  modified: []

key-decisions:
  - "OnboardingWizard uses useEffect GET on mount then redirects to / if snapshot.completed — avoids completed users re-doing onboarding"
  - "QuestionFileUpload normalizes response shapes: data.resume?.id || data.profile?.id covers both upload-resume and upload-linkedin"
  - "TooltipTrigger used without asChild prop — base-ui does not support asChild pattern unlike Radix"
  - "/api/onboarding route created as Rule 3 deviation — prerequisite API missing from context but required for wizard to function"

patterns-established:
  - "Step containers (StepOne/StepTwo) receive questions + answers + setAnswers; render type-appropriate sub-component"
  - "Question renderers are standalone 'use client' components with typed props"

requirements-completed:
  - D-01
  - D-02
  - D-03
  - D-08
  - D-10
  - D-11
  - D-12
  - D-13
  - D-16
  - D-17
  - D-19
  - D-20
  - D-21
  - D-22

duration: 3min
completed: "2026-03-25"
---

# Phase 04 Plan 02: Onboarding Wizard UI Summary

**Dark-themed /onboarding wizard with 2-step multi-question form using shadcn/ui components, file upload with PDF/10MB validation, LinkedIn tooltip with 5-step instructions, and /api/onboarding persistence route.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-25T13:10:32Z
- **Completed:** 2026-03-25T13:13:52Z
- **Tasks:** 2 (Task 3 is human-verify checkpoint)
- **Files modified:** 10

## Accomplishments

- Built complete /onboarding wizard: layout with scoped dark theme, server page entry, client wizard with step state machine
- Created all 4 question renderer components (MultiSelect/Checkbox, SingleSelect/RadioGroup, FileUpload/PDF-validation, Text/textarea)
- Created /api/onboarding route (GET snapshot, POST answers with complete flag) using onboarding-db.ts functions

## Task Commits

1. **Task 1: Layout, page, wizard, StepOne, StepTwo** - `f0b0733` (feat)
2. **Task 2: Question renderers + API route** - `22b8522` (feat)

## Files Created/Modified

- `src/app/onboarding/layout.tsx` - Scoped theme wrapper: imports theme.css, wraps children in `.onboarding-theme.dark`
- `src/app/onboarding/page.tsx` - Server component entry point, centered max-w-2xl layout
- `src/components/onboarding/OnboardingWizard.tsx` - Client wizard: step state machine, GET/POST /api/onboarding, loading spinner, Progress bar, Next/Back/Complete navigation
- `src/components/onboarding/StepOne.tsx` - Step 1 container: Card-per-question, delegates to QuestionMultiSelect/QuestionSingleSelect
- `src/components/onboarding/StepTwo.tsx` - Step 2 container: Card-per-question, delegates to all 4 renderers
- `src/components/onboarding/QuestionMultiSelect.tsx` - Checkbox-based multi-select with toggle logic
- `src/components/onboarding/QuestionSingleSelect.tsx` - RadioGroup-based single-select
- `src/components/onboarding/QuestionFileUpload.tsx` - PDF+10MB validation, dual endpoint dispatch, filename badge, LinkedIn 5-step tooltip
- `src/components/onboarding/QuestionText.tsx` - Textarea with placeholder and helperText
- `src/app/api/onboarding/route.ts` - GET returns snapshot, POST saves answers and optionally marks complete

## Decisions Made

- `OnboardingWizard` replaced the previous complex implementation (from old codebase) with the simpler plan-specified version that delegates rendering to StepOne/StepTwo and type-specific renderers.
- `TooltipTrigger` used without `asChild` — base-ui tooltip does not support the asChild pattern (Radix pattern). Fixed TypeScript error by removing `asChild`.
- `QuestionFileUpload` handles both API response shapes via `data.resume?.id ?? data.profile?.id` (upload-resume returns `resume`, upload-linkedin returns `profile`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Created missing /api/onboarding route**
- **Found during:** Task 1 (wizard uses GET/POST to /api/onboarding)
- **Issue:** /api/onboarding route did not exist — referenced in plan interfaces as a prerequisite but never created in Plan 01
- **Fix:** Created `src/app/api/onboarding/route.ts` using `getOnboardingSnapshot` and `saveOnboardingAnswers` from `onboarding-db.ts`
- **Files modified:** src/app/api/onboarding/route.ts
- **Verification:** No TypeScript errors in the new route file
- **Committed in:** 22b8522 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TooltipTrigger asChild prop**
- **Found during:** Task 2 TypeScript check
- **Issue:** TooltipTrigger from @base-ui/react/tooltip does not support `asChild` prop (Radix pattern only)
- **Fix:** Removed `asChild` and moved className directly to TooltipTrigger
- **Files modified:** src/components/onboarding/QuestionFileUpload.tsx
- **Verification:** `npx tsc --noEmit` shows no errors in QuestionFileUpload.tsx
- **Committed in:** 22b8522 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Issues Encountered

None beyond the auto-fixed deviations above.

## Known Stubs

None — all components have real implementations wired to real API endpoints. The /api/onboarding route uses real DB functions from onboarding-db.ts.

## Next Phase Readiness

- /onboarding page complete with full wizard UI and API persistence
- Task 3 is a human-verify checkpoint — visual/functional review of the wizard at http://localhost:3000/onboarding
- Plan 04-03 can build the recommendation panel on top of the wizard foundation

## Self-Check: PASSED

Files exist:
- src/app/onboarding/layout.tsx: FOUND
- src/app/onboarding/page.tsx: FOUND
- src/components/onboarding/OnboardingWizard.tsx: FOUND
- src/components/onboarding/StepOne.tsx: FOUND
- src/components/onboarding/StepTwo.tsx: FOUND
- src/components/onboarding/QuestionMultiSelect.tsx: FOUND
- src/components/onboarding/QuestionSingleSelect.tsx: FOUND
- src/components/onboarding/QuestionFileUpload.tsx: FOUND
- src/components/onboarding/QuestionText.tsx: FOUND
- src/app/api/onboarding/route.ts: FOUND

Commits exist:
- f0b0733: feat(04-02): create onboarding layout, page, wizard state machine, and step containers — FOUND
- 22b8522: feat(04-02): create question renderer components (multi-select, single-select, file upload, text) — FOUND

---
*Phase: 04-implement-onboarding-page-with-job-recommendation-using-shadcn-ui*
*Completed: 2026-03-25*
