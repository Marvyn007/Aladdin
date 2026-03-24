# Project State

**Last Updated:** 2026-03-24

## Overview
Job board application with AI-powered features for job searching, application tracking, resume generation, and cover letter creation.

## Current Phase
- Phase 2: Build onboarding questionnaire and per-question preference storage - Plan 02 complete (pending full phase completion)

## Progress
- Phase 1: UI Design Contract complete (6/6 dimensions passed)
- Phase 1: Implementation started (JobList, JobDetail, globals.css updated)
- Phase 2 Plan 01: OnboardingAnswerHistory schema and DB functions implemented
- Phase 2 Plan 02: Auto-versioning on save + UI timestamps (2/2 tasks complete)

## Recent Activity
- 2026-03-24: UI-SPEC.md created and verified (commit 7c73ee4)
- 2026-03-24: UI implementation started - enhanced job cards, job detail styling
- 2026-03-24: Plan 02-01 complete - OnboardingAnswerHistory model, getAnswerHistory, saveAnswerVersion functions added
- 2026-03-24: Plan 02-02 complete - Auto-versioning on answer save, UI displays last updated timestamps per question

## Accumulated Context

### Roadmap Evolution
- Phase 2 added: Build onboarding questionnaire and per-question preference storage
- Phase 2 Plan 01: Answer history schema and functions complete
- Phase 2 Plan 02: Auto-versioning integrated into save flow + UI timestamp display

### Decisions Made
- Used existing multi-DB abstraction pattern (postgres/supabase/sqlite) for history functions
- Auto-incrementing version numbers for answer versioning
- Timestamps sourced from answer.updatedAt in snapshot to avoid client-side Clerk auth calls
- Used 'user_update' change reason for all auto-versioned records

### Key Technical Patterns
- Auto-versioning: saveSingleAnswer calls saveAnswerVersion after upsert for all DB types
- Timestamp propagation: answer.updatedAt surfaced in QuestionShell status area
