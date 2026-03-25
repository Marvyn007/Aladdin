# Project Roadmap

## Phase 1: Frontend UI Redesign

**Status:** complete

**Goal:** Fix the frontend to look professional and polished like simplify.jobs and LinkedIn

### Requirements
- [x] Improve job listing cards (Dashboard.tsx)
- [x] Improve job detail view (JobDetail.tsx)
- [x] Better typography and professional font for job descriptions
- [x] Make UI minimal, polished, and premium
- [x] Fix buttons and overall UX

### Context
User wants the job board to look like simplify.jobs (job cards + job details) and LinkedIn's job descriptions. The current frontend looks like "AI slop".

### Plans
- [x] 1-01-PLAN.md - Set up Inter font and design foundation
- [x] 1-02-PLAN.md - Redesign job listing cards (JobList.tsx)
- [x] 1-03-PLAN.md - Redesign job detail view (JobDetail.tsx)


### Phase 2: Build onboarding questionnaire and per-question preference storage

**Goal:** Add answer history and versioning to onboarding, allow users to edit and view their response history
**Requirements**: TBD
**Depends on:** Phase 1
**Status:** in_progress

Plans:
- [x] 02-01-PLAN.md — Add answer history schema and DB layer functions
- [x] 02-02-PLAN.md — Integrate versioning into save flow and UI timestamps

### Phase 3: Implement company logo scraping/backfill so companies.logoUrl uses the actual company logo, backfill all existing companies, and fetch/update logos whenever jobs or companies are imported

**Goal:** Canonicalize `companies.logoUrl` by discovering actual logos from company websites, backfilling all existing companies, and wiring every ingestion/admin path through a single resolver so job responses surface verified company logos instead of provider artifacts.
**Requirements:**
- `LOGO-01`: `companies.logoUrl` stores the actual company logo sourced from the company domain or metadata before falling back to provider assets.
- `LOGO-02`: Existing companies are backfilled and ingestion flows rely on the shared resolver so canonical rows stay current.
- `LOGO-03`: Admin/tracked-company CRUD updates synchronize with the canonical helper and tracked records expose the verified logos.
**Depends on:** Phase 2
**Status:** in_progress

Plans:
- [ ] 03-01-PLAN.md — Build canonical logo resolver + backfill foundation
- [ ] 03-02-PLAN.md — Update ingestion and admin flows to use the canonical resolver

### Phase 4: Implement onboarding page with job recommendation using shadcn-ui

**Goal:** Build a /onboarding wizard page using shadcn/ui with scoped tweakcn dark theme, collect job preferences through 11 questions (including LinkedIn PDF upload), wire preference-based soft sorting into the job feed, and add a Preferences tab to Account Settings for editing answers post-onboarding.
**Requirements:**
- D-01 through D-25: See 04-CONTEXT.md for full decision list covering first-time redirect, wizard UI, file uploads, theme scoping, preference sorting, and preferences tab.
**Depends on:** Phase 3
**Status:** in_progress
**Plans:** 4 plans

Plans:
- [x] 04-01-PLAN.md — Install shadcn/ui + tweakcn theme, add LinkedIn PDF question, create preference scoring module
- [ ] 04-02-PLAN.md — Build onboarding wizard UI (/onboarding page with 2-step form)
- [ ] 04-03-PLAN.md — Wire preference sort into /api/jobs + first-time onboarding redirect
- [ ] 04-04-PLAN.md — Add Preferences tab to Account Settings + default dashboard to preference sort
