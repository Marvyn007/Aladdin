# Phase 2: Onboarding Questionnaire - Research

**Phase:** 02
**Date:** 2026-03-23
**Status:** Research complete

---

## Current Implementation State

### Architecture Overview

The onboarding system consists of:

1. **UI Component:** `src/components/onboarding/OnboardingWizard.tsx` (830 lines)
2. **Question Definitions:** `src/lib/onboarding.ts` (254 lines)
3. **Database Layer:** `src/lib/onboarding-db.ts` (561 lines)
4. **Routing:** `src/lib/onboarding-routing.ts` (20 lines)

### Question Schema

**10 Questions across 2 Steps:**

| Step | Question Key | Type | Required | Description |
|------|-------------|------|----------|-------------|
| 1 | `work_areas` | multi_select | true | Target role families |
| 1 | `career_levels` | multi_select | true | Career levels open to |
| 1 | `role_types` | multi_select | true | Employment types |
| 1 | `regions` | multi_select | true | Geographic regions |
| 1 | `work_style` | single_select | true | Onsite/hybrid/remote |
| 2 | `visa_sponsorship` | single_select | true | Visa needs |
| 2 | `alert_frequency` | single_select | true | Notification cadence |
| 2 | `job_search_challenges` | multi_select | true | Pain points |
| 2 | `resume_upload` | file | false | Resume PDF upload |
| 2 | `extra_notes` | text | false | Free-form notes |

**Question Types Supported:**
- `multi_select` — Array of string values
- `single_select` — Single string value
- `file` — Object with `resumeId` and `filename`
- `text` — Free-form string

### Storage Mechanism

**Database Tables (Prisma):**

```prisma
model UserOnboardingState {
  userId       String    @unique
  status       String    @default("in_progress")  // "in_progress" | "complete"
  currentStep  Int       @default(1)
  startedAt    DateTime?
  completedAt DateTime?
  updatedAt    DateTime?
}

model OnboardingAnswer {
  id              String   @id @default(uuid())
  userId          String
  questionKey     String
  stepKey         String   // "step_1" | "step_2"
  questionLabel   String
  answerType      String
  answerJson      Json?    // Stores normalized value
  answerText      String?  // Human-readable display
  orderIndex      Int
  questionVersion String   @default("v1")
}
```

**Multi-DB Support:**
- PostgreSQL (via `DATABASE_URL`)
- Supabase (via `USE_SUPABASE_REST=true`)
- SQLite (via `USE_SQLITE=true`)

### Current Functionality

1. **Two-step wizard** with step navigation
2. **Auto-save** — Every answer change persists immediately via `/api/onboarding` POST
3. **Progress tracking** — Shows required answered / total required percentage
4. **Resume upload** — Integrated with `/api/upload-resume`
5. **Post-auth routing** — Redirects based on completion status
6. **Real-time sync** — Snapshot updates reflect immediately in UI

---

## Ambiguity: "Per-Question Preference Storage"

The Phase 2 description states: **"Build onboarding questionnaire and per-question preference storage"**

The current system already stores answers per question. However, "per-question preference storage" is ambiguous:

### Possible Interpretations

| Interpretation | Description | Complexity |
|-----------------|-------------|------------|
| **A. Re-edit answers** | Allow users to edit answers after completion | Medium |
| **B. Multiple attempts** | Store history/versions of answer changes | High |
| **C. Question-level preferences** | Separate preferences outside onboarding (e.g., notification prefs, display prefs) | Medium |
| **D. Granular per-question state** | Each question has independent save/status tracking | Low |

### Current Limitation

The current system:
- Only allows ONE answer per question key per user (upsert behavior)
- Overwrites previous answer on change
- No history or versioning of answer changes
- `questionVersion` field exists but is always "v1" and not used

---

## Gaps & Improvement Opportunities

### 1. Answer Editability
Users cannot easily edit individual questions after completing onboarding. Workaround: Return to onboarding URL directly, but this resets progress view.

### 2. Answer History/Versioning
No track of when answers changed. The `updatedAt` exists but no historical records.

### 3. Question Versioning
`questionVersion` field exists but all questions are hardcoded as "v1". If questions change, existing users' answers aren't migrated.

### 4. Partial Progress Resumption
If a user abandons mid-way, they can resume, but the UI shows "Step 1" or "Step 2" as discrete blocks rather than granular per-question state.

### 5. API Response Size
`/api/onboarding` GET returns full snapshot with all answers. For mobile/bandwidth, consider pagination.

---

## Validation Architecture

For Nyquist validation, the recommended approach:

1. **Unit tests** for question type normalization
2. **Integration tests** for DB layer functions
3. **E2E test** for complete onboarding flow (new user → all answers → complete)
4. **Snapshot test** for question schema stability

---

## Recommendation for Planning

Before creating plans, clarify what "per-question preference storage" means:

- If it means **allowing edits** → Add question edit modal/page
- If it means **storing history** → Add answer version table
- If it means **preferences beyond onboarding** → Add user_preferences table

**Current implementation is solid foundation.** The phase likely adds:
1. Ability to re-edit individual questions
2. Better progress tracking per question
3. Question version migration support

---

## Files Referenced

- `src/components/onboarding/OnboardingWizard.tsx` — UI component
- `src/lib/onboarding.ts` — Question definitions and types
- `src/lib/onboarding-db.ts` — Database operations
- `src/lib/onboarding-routing.ts` — Post-auth routing
- `prisma/schema.prisma` — Database schema (lines 290-321)
- `.agent/skills/skills/hig-patterns/references/onboarding.md` — HIG patterns reference
