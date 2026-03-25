---
phase: 04-implement-onboarding-page-with-job-recommendation-using-shadcn-ui
plan: 03
subsystem: api, ui
tags: [preference-scoring, job-sorting, onboarding-redirect, clerk, nextjs, vitest]

# Dependency graph
requires:
  - phase: 04-01
    provides: computePreferenceScore function and onboarding-db.getOnboardingSnapshot
  - phase: 04-02
    provides: onboarding answer storage and state management
provides:
  - GET /api/jobs?sort_by=preferences returns jobs sorted by preference score for users with completed onboarding
  - Graceful time-sort fallback for unauthenticated users and users without completed onboarding
  - OnboardingRedirect component that sends first-time users to /onboarding exactly once (D-01)
  - onboardingShown localStorage flag persistence so redirect never repeats (D-01)
affects: [job-feed, dashboard, onboarding-flow, 04-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "API-layer re-sort: DB sorts by time, API re-sorts by preference score in-memory after fetch"
    - "Graceful score fallback: errors/incomplete onboarding silently fall back to time sort"
    - "One-time redirect via isNew flag + localStorage: fires ONCE on first browser visit, never again"

key-files:
  created:
    - src/components/OnboardingRedirect.tsx
    - tests/jobs-preferences-sort.test.ts
  modified:
    - src/app/api/jobs/route.ts
    - src/lib/db.ts
    - src/app/page.tsx

key-decisions:
  - "DB sorts by fetched_at for sortBy=preferences; API re-sorts by score in-memory to avoid complex DB changes"
  - "sortBy type normalized before DB calls: 'preferences'/'score' map to 'time' at getJobs level"
  - "OnboardingRedirect uses isNew from /api/user/init (not snapshot.completed) per D-01 to detect first-time users"
  - "localStorage onboardingShown flag checked before API call — early exit for all returning users"
  - "router.replace (not push) for onboarding redirect so browser back button goes to dashboard"

patterns-established:
  - "Preference sort: fetch all jobs in time order, then score+sort in-memory (no DB JOIN complexity)"
  - "Redirect-once pattern: isNew flag + localStorage persistence = exactly one redirect per browser lifetime"

requirements-completed: [D-04, D-05, D-07, D-09, D-01, D-02, D-03]

# Metrics
duration: 8min
completed: 2026-03-25
---

# Phase 04 Plan 03: Wire Preference Sort and Onboarding Redirect Summary

**Preference-based job sorting via in-memory score re-rank in /api/jobs, plus one-time first-visit onboarding redirect using isNew flag and localStorage persistence**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-25T08:07:29Z
- **Completed:** 2026-03-25T08:13:36Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- GET /api/jobs?sort_by=preferences now sorts jobs by computePreferenceScore DESC for users with completed onboarding; all other cases fall back to time sort gracefully
- OnboardingRedirect.tsx component added to dashboard: redirects first-time users (isNew=true from /api/user/init) to /onboarding exactly once, persisting onboardingShown in localStorage
- 6 TDD tests (vitest) cover: score-sorted order, score called per job, fallback for incomplete onboarding, fallback for unauthenticated, no-filter, and graceful error recovery

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Failing preference sort tests** - `cef0cc2` (test)
2. **Task 1 GREEN: Add sortBy=preferences to /api/jobs** - `295b859` (feat)
3. **Task 2: OnboardingRedirect + page.tsx update** - `b27851e` (feat)

## Files Created/Modified

- `src/app/api/jobs/route.ts` - Added getOnboardingSnapshot + computePreferenceScore imports, dbSortBy normalization, preference re-sort block with graceful fallback
- `src/lib/db.ts` - Updated getAllPublicJobs signature to accept 'preferences' as sortBy (maps to fetched_at)
- `src/components/OnboardingRedirect.tsx` - New invisible client component: checks localStorage, calls /api/user/init, redirects first-time users once
- `src/app/page.tsx` - Added <OnboardingRedirect /> as sibling of <Dashboard /> inside fragment
- `tests/jobs-preferences-sort.test.ts` - 6 vitest integration tests for preference sort behavior

## Decisions Made

- DB always returns jobs in time order; API layer does the re-sort in-memory. This avoids adding score computation to DB queries and keeps the DB layer generic.
- `sortBy` type is normalized before being passed to `getJobs` (which only accepts `'time' | 'imported'`) — new `dbSortBy` variable carries the safe value.
- OnboardingRedirect uses `isNew` from `/api/user/init` rather than `snapshot.completed` (per D-01). This is correct: `snapshot.completed` would redirect on every visit until onboarding is done, while `isNew` fires exactly once per user lifetime.
- localStorage is checked before making any API call — early exit for all returning users with zero network overhead.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript type mismatch in sortBy parameter**
- **Found during:** Task 1 (GREEN phase - TS check)
- **Issue:** `getJobs` and `getAllPublicJobs` had incompatible sortBy type unions; passing `'preferences' | 'score'` to `getJobs` (which only accepts `'time' | 'imported'`) caused TS errors
- **Fix:** Introduced `dbSortBy: 'time' | 'imported'` normalized variable for DB calls; `sortByRaw` retains the full union for the preference re-sort branch
- **Files modified:** src/app/api/jobs/route.ts
- **Verification:** `npx tsc --noEmit` shows no errors for src/app/api/jobs/route.ts
- **Committed in:** 295b859 (Task 1 feat commit)

**2. [Rule 1 - Bug] Fixed test helper using native Request instead of NextRequest**
- **Found during:** Task 1 (test run - all 6 tests returning 500)
- **Issue:** Route uses `request.nextUrl.searchParams` (Next.js NextRequest API); native `Request` has no `nextUrl` property, causing TypeError inside the route handler which was caught by the try/catch and returned 500
- **Fix:** Changed `makeRequest()` helper to return `NextRequest` (from `next/server`) instead of native `Request`
- **Files modified:** tests/jobs-preferences-sort.test.ts
- **Verification:** All 6 tests pass after fix
- **Committed in:** 295b859 (Task 1 feat commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for correctness. No scope creep.

## Issues Encountered

None beyond the two auto-fixed TypeScript and test infrastructure bugs above.

## Next Phase Readiness

- /api/jobs?sort_by=preferences is live and functional
- OnboardingRedirect will guide new users to the onboarding wizard (Plan 04-02)
- Ready for Plan 04-04: final integration, polish, and e2e verification

---
*Phase: 04-implement-onboarding-page-with-job-recommendation-using-shadcn-ui*
*Completed: 2026-03-25*
