---
phase: 04-implement-onboarding-page-with-job-recommendation-using-shadcn-ui
plan: "01"
subsystem: onboarding
tags: [shadcn-ui, tweakcn, preference-scoring, tdd, onboarding]
dependency_graph:
  requires: []
  provides:
    - shadcn/ui components in src/components/ui/*
    - tweakcn theme scoped to .onboarding-theme (src/app/onboarding/theme.css)
    - linkedin_pdf question in ONBOARDING_QUESTIONS (step 2, order 11)
    - computePreferenceScore function (src/lib/preference-scoring.ts)
  affects:
    - 04-02 (uses shadcn components, theme, scoring)
    - 04-03 (uses shadcn components and scoring)
    - 04-04 (uses scoring in recommendation panel)
tech_stack:
  added:
    - shadcn/ui (new-york style, neutral base, Tailwind v4 mode)
    - tweakcn custom theme (scoped via .onboarding-theme CSS class)
    - tailwind-merge + clsx (via cn() utility)
  patterns:
    - TDD red-green: tests written before implementation
    - CSS scoping: tweakcn variables in .onboarding-theme, not :root
    - Generic normalizeFileValue: dispatches on question.type, not question.key (D-14)
key_files:
  created:
    - components.json
    - src/lib/utils.ts
    - src/components/ui/button.tsx
    - src/components/ui/card.tsx
    - src/components/ui/progress.tsx
    - src/components/ui/checkbox.tsx
    - src/components/ui/radio-group.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/tooltip.tsx
    - src/components/ui/separator.tsx
    - src/app/onboarding/theme.css
    - src/lib/preference-scoring.ts
    - tests/onboarding-questions.test.ts
    - tests/preference-scoring.test.ts
  modified:
    - src/lib/onboarding.ts (added linkedin_pdf question at step 2, order 11)
decisions:
  - "Scoped tweakcn theme to .onboarding-theme class only — globals.css untouched per D-16"
  - "normalizeFileValue confirmed generic (dispatches on question.type, not key) — no changes needed per D-14"
  - "preference-scoring uses keyword substring matching for work_areas (underscores-to-spaces, strip trailing 'engineer')"
  - "career_levels uses spaced keywords (' ii', ' iii') to avoid false positives on single-letter matches"
metrics:
  duration: "~15 minutes"
  completed_date: "2026-03-25"
  tasks_completed: 2
  files_created: 14
  files_modified: 1
---

# Phase 04 Plan 01: shadcn/ui Foundation + Preference Scoring Summary

**One-liner:** shadcn/ui new-york components installed with tweakcn theme scoped to .onboarding-theme, linkedin_pdf question added as step 2 order 11, and computePreferenceScore TDD-built with 5 weighted signals (30/25/20/15/10) totaling 100 points.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install shadcn/ui + tweakcn theme, scope theme to onboarding | 211215b | components.json, src/components/ui/*.tsx, src/app/onboarding/theme.css |
| 2 (RED) | Add failing tests for linkedin_pdf + preference scoring | 2bd4ce9 | tests/onboarding-questions.test.ts, tests/preference-scoring.test.ts, src/lib/onboarding.ts |
| 2 (GREEN) | Implement preference scoring module | adf307e | src/lib/preference-scoring.ts |

## What Was Built

### Task 1: shadcn/ui + tweakcn theme

All 8 required shadcn/ui components installed in `src/components/ui/`:
- button, card, progress, checkbox, radio-group, badge, tooltip, separator

`components.json` configured for Tailwind v4 (blank config path, cssVariables: true).

`src/app/onboarding/theme.css` contains the full tweakcn color palette wrapped in `.onboarding-theme { ... }` and `.onboarding-theme.dark { ... }`. The file is NOT imported from `globals.css` — it will be imported from the onboarding layout in Plan 02.

`globals.css` was not modified by Task 1 (no shadcn CSS variable injection into app-wide styles).

### Task 2: LinkedIn PDF Question + Preference Scoring (TDD)

**linkedin_pdf question** added as the last entry in `ONBOARDING_QUESTIONS`:
- key: 'linkedin_pdf', step: 2, order: 11, type: 'file', required: false
- Flows through the generic `normalizeFileValue` function identically to `resume_upload` (D-14 verified: normalizeFileValue dispatches on `question.type === 'file'`, not on `question.key`)

**computePreferenceScore** in `src/lib/preference-scoring.ts`:
| Signal | Points | Logic |
|--------|--------|-------|
| work_areas | 30 | Role family label (underscores→spaces, strip "engineer") in job.title |
| regions | 25 | Region label in job.location; remote_worldwide matches "remote" |
| role_types | 20 | Employment type with map: full_time→fulltime, freelance→contract |
| work_style | 15 | flexible always awards; remote/onsite/hybrid check job.isRemote or location |
| career_levels | 10 | Seniority keywords in job.title per level bracket |

Score capped: `Math.min(100, Math.max(0, score))`

## Test Results

```
tests/onboarding-questions.test.ts  11 tests  PASS
tests/preference-scoring.test.ts    13 tests  PASS
Total: 24 tests, 0 failures
```

## Verification

- `components.json` exists, cssVariables: true, tailwind.config: ""
- `src/app/onboarding/theme.css` contains `.onboarding-theme` selector, no `:root {`
- `globals.css` contains no `--primary: oklch` (shadcn variables not injected)
- `src/lib/onboarding.ts` contains `key: 'linkedin_pdf'`, `step: 2`, `order: 11`, `type: 'file'`, `required: false`
- `src/lib/preference-scoring.ts` exports `computePreferenceScore`, imports `Job` from `@/types`, uses `Math.min(100, Math.max(0, score))`
- `npm test -- --run tests/onboarding-questions.test.ts tests/preference-scoring.test.ts` exits 0

## Deviations from Plan

None — plan executed exactly as written.

The `normalizeFileValue` function in `onboarding-db.ts` was confirmed generic during read_first (no key-specific branching). No changes were needed.

## Known Stubs

None — all created modules have real implementations wired to real data.

## Self-Check: PASSED

Files exist:
- components.json: FOUND
- src/components/ui/button.tsx: FOUND
- src/components/ui/tooltip.tsx: FOUND
- src/app/onboarding/theme.css: FOUND
- src/lib/utils.ts: FOUND
- src/lib/onboarding.ts: FOUND (contains linkedin_pdf)
- src/lib/preference-scoring.ts: FOUND
- tests/onboarding-questions.test.ts: FOUND
- tests/preference-scoring.test.ts: FOUND

Commits exist:
- 211215b: feat(04-01): install shadcn/ui components and scope tweakcn theme — FOUND
- 2bd4ce9: test(04-01): add failing tests for linkedin_pdf question and preference scoring — FOUND
- adf307e: feat(04-01): implement preference scoring module and add linkedin_pdf question — FOUND
