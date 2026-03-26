# Phase 4: Onboarding Page with Job Recommendation - Research

**Researched:** 2026-03-24
**Domain:** Next.js 16 / shadcn/ui (Tailwind v4) / multi-step wizard / S3 file upload / preference-based job sorting
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A — First-time onboarding trigger**
- D-01: On first sign-in ONLY, redirect new users to `/onboarding`. Detection: use `isNew: true` from `/api/user/init` response. Store `onboardingShown` flag (Clerk publicMetadata or DB user row) so redirect only fires once.
- D-02: Sidebar "Onboarding" link continues to work for returning users who want to revisit.
- D-03: After completing onboarding, redirect to `"/"` (dashboard). No intermediate confirmation screen.

**B — Job recommendation / sorting**
- D-04: Soft sort boost — jobs matching onboarding preferences bubble to top; all jobs remain visible. No hard filtering.
- D-05: Sorting is per-user: only applies when user is authenticated AND has completed onboarding.
- D-06: Match scoring uses: `work_areas`, `career_levels`, `role_types`, `regions`, `work_style`, `visa_sponsorship` as signals.
- D-07: Add `sortBy=preferences` option to `/api/jobs`. Dashboard defaults to `sortBy=preferences` for authenticated users with completed onboarding.

**C — After completion**
- D-08: On "Complete" click → POST `/api/onboarding` with `complete: true` → `router.push('/')`.
- D-09: Dashboard shows personalized feed immediately (sorted by preference match) with no confirmation step.

**D — File uploads**
- D-10: Resume upload (question 9) must use existing `uploadFileToS3` + `generateS3Key` from `src/lib/s3.ts`.
- D-11: Add LinkedIn PDF question (key: `linkedin_pdf`, type: `file`, optional) as step 2, order 11.
- D-12: LinkedIn question must include info icon tooltip with exact 5-step download instructions.
- D-13: Both file uploads: PDF only, max 10MB, show filename after upload, allow re-upload.
- D-14: `onboarding.ts` ONBOARDING_QUESTIONS needs linkedin_pdf appended as step 2, order 11. `onboarding-db.ts` normalizeFileValue handles it identically to resume_upload.

**E — Theme (onboarding page only)**
- D-15: Install tweakcn theme via `npx shadcn@latest add https://tweakcn.com/r/themes/cmlznk552000004jubsv77roj`.
- D-16: Theme applies ONLY to `/onboarding` page. `globals.css` is NOT modified.
- D-17: Onboarding page supports dark mode via tweakcn theme's dark variant. Use `class="dark"` on onboarding layout or page wrapper.
- D-18: Install shadcn components: `progress`, `card`, `button`, `checkbox`, `radio-group`, `badge`, `tooltip`, `separator`.

**F — Wizard UI structure**
- D-19: Multi-step wizard: Step 1 (Q1-5) → Step 2 (Q6-10 + LinkedIn PDF). Progress bar at top showing step X of 2.
- D-20: Each step is a full-page card. Questions shown sequentially or all-at-once — Claude's discretion.
- D-21: Navigation: "Next" → step 2, "Back" → step 1, "Complete" on step 2 submits and redirects.
- D-22: Skip button on optional questions (resume_upload, linkedin_pdf, extra_notes).

**G — Preferences tab in AccountSettingsModal**
- D-23: Add `'preferences'` to `TabType` in `AccountSettingsModal.tsx`.
- D-24: Preferences tab renders the same question set in edit-friendly layout (all visible, inline save or single "Save Preferences" button).
- D-25: Reads from `GET /api/onboarding` and saves to `POST /api/onboarding`. No new API needed.

### Claude's Discretion
- Exact animation/transition between steps (slide, fade, or none)
- Loading skeleton design while fetching saved answers
- Error state handling for S3 upload failures
- Exact preference score formula (weighted sum of matched signals, capped 0-100)
- Whether to persist preference score in DB or compute on-the-fly per request

### Deferred Ideas (OUT OF SCOPE)
- Hard filtering by region/work style
- Push/email notifications based on alert_frequency preference
- Resume parsing / skill extraction from uploaded file
- LinkedIn data extraction from uploaded PDF
- Mobile-specific LinkedIn PDF instructions
</user_constraints>

---

## Summary

This phase builds a full `/onboarding` wizard for first-time users, wires it into the first-sign-in flow, and plumbs onboarding preferences into job ranking on the dashboard.

The codebase already has a mature onboarding data layer (`onboarding.ts`, `onboarding-db.ts`, `/api/onboarding`) and S3 upload utilities ready to use. No new database tables are needed. The primary new work is: (1) the wizard UI itself using shadcn/ui (which is NOT yet installed), (2) adding the LinkedIn PDF question to the question array, (3) extending `getAllPublicJobs` and `/api/jobs` to support `sortBy=preferences`, (4) computing a preference score per job per user in-app, and (5) wiring `AccountSettingsModal` preferences tab.

The biggest technical risk is the shadcn/ui + Tailwind v4 installation. This project uses Tailwind v4 via `@tailwindcss/postcss` (no `tailwind.config.js`). This requires the Tailwind v4-compatible shadcn CLI and CSS-variable setup. The tweakcn theme is also designed to scope into a page wrapper class rather than globals, which is exactly what the user requires.

**Primary recommendation:** Install `shadcn@latest` (Tailwind v4-aware), initialize with `components.json` (cssVariables=true, baseColor=neutral, path alias `@/components`), install 8 required components, install tweakcn theme, scope all shadcn CSS into a page-level wrapper class on `/onboarding`, and compute preference scores on-the-fly at the DB query layer.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| shadcn/ui CLI | `shadcn@latest` | Component scaffolding (copy-to-project) | Official Tailwind v4 support added Feb 2025 |
| @radix-ui/react-* | installed by CLI | Accessible primitives (checkbox, radio, tooltip, etc.) | shadcn components depend on them directly |
| class-variance-authority | `0.7.1` (registry) | Component variant styling | Required shadcn peer dep |
| tailwind-merge | `3.x` (registry) | Merge Tailwind classes safely | Required shadcn peer dep |
| clsx | `2.x` (registry) | Conditional class names | Required by `cn()` utility |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | `^0.563.0` (already in project) | Icons (info icon, check, etc.) | Already installed — use for info icon on LinkedIn question |
| tweakcn theme | URL-based registry | Custom dark CSS variables on `/onboarding` | Applied via scoped class wrapper, not globals.css |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix-based shadcn checkbox | Custom checkbox | shadcn is locked (D-18); custom adds maintenance burden |
| On-the-fly score computation | Persisted score column | On-the-fly is simpler, no migration needed, score stays fresh |
| Clerk publicMetadata for `onboardingShown` flag | DB `user_onboarding_state.status = 'complete'` | DB already tracks completion status — use it, avoid Clerk API call |

**Installation (Wave 0):**
```bash
# 1. Initialize shadcn (no tailwind.config — Tailwind v4 mode)
npx shadcn@latest init

# 2. Install required components
npx shadcn@latest add progress card button checkbox radio-group badge tooltip separator

# 3. Install tweakcn theme
npx shadcn@latest add https://tweakcn.com/r/themes/cmlznk552000004jubsv77roj
```

**Version verification note:** `shadcn@latest` as of 2025-02 fully supports Tailwind v4. The CLI leaves `tailwind.config` blank in `components.json` when running against a v4 project. Peer deps (`cva`, `tailwind-merge`, `clsx`) will be installed by the CLI automatically.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── onboarding/
│       ├── layout.tsx          # Scoped shadcn theme wrapper (class="dark" or tweakcn class)
│       └── page.tsx            # Wizard entry point (Server Component wrapper)
├── components/
│   ├── onboarding/
│   │   ├── OnboardingWizard.tsx     # Client component — step state machine
│   │   ├── StepOne.tsx             # Questions 1-5
│   │   ├── StepTwo.tsx             # Questions 6-10 + LinkedIn PDF
│   │   ├── QuestionMultiSelect.tsx # multi_select renderer
│   │   ├── QuestionSingleSelect.tsx # single_select renderer
│   │   ├── QuestionFileUpload.tsx  # file type renderer (resume + linkedin_pdf)
│   │   └── QuestionText.tsx        # text type renderer
│   └── ui/                         # Generated by shadcn CLI (do not edit)
│       ├── progress.tsx
│       ├── card.tsx
│       ├── button.tsx
│       └── ...
└── lib/
    ├── onboarding.ts           # ADD linkedin_pdf question (step 2, order 11)
    ├── onboarding-db.ts        # No changes needed
    └── preference-scoring.ts  # NEW: computePreferenceScore(job, answers)
```

### Pattern 1: Scoped tweakcn Theme (Isolates from globals.css)

**What:** Wrap the `/onboarding` page in a layout that adds a CSS class scoping the tweakcn custom properties. The tweakcn registry command writes CSS variables — wrap those in a selector so they don't bleed into the rest of the app.

**When to use:** Whenever a page needs its own design system without modifying the global theme.

**Example:**
```tsx
// src/app/onboarding/layout.tsx
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    // "dark" class activates tweakcn dark mode; inner div scopes shadcn variables
    <div className="onboarding-theme dark min-h-screen">
      {children}
    </div>
  );
}
```

The tweakcn CSS (installed into a file like `src/app/onboarding/theme.css` or injected via `<style>`) should be scoped to `.onboarding-theme` rather than `:root`. This keeps `globals.css` untouched.

### Pattern 2: Client Component Wizard State Machine

**What:** `OnboardingWizard.tsx` is a `'use client'` component that manages `currentStep` (1 or 2) and `answers` state locally, persisting answers to `/api/onboarding` on step advance and on "Complete".

**When to use:** Multi-step forms where each step needs to persist before navigation to prevent data loss.

**Example:**
```tsx
'use client';
const [currentStep, setCurrentStep] = useState<1 | 2>(1);
const [answers, setAnswers] = useState<Record<string, unknown>>({});

async function handleNext() {
  await fetch('/api/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      currentStep: 1,
      answers: Object.entries(answers).map(([k, v]) => ({ questionKey: k, value: v }))
    }),
  });
  setCurrentStep(2);
}

async function handleComplete() {
  await fetch('/api/onboarding', {
    method: 'POST',
    body: JSON.stringify({
      complete: true,
      currentStep: 2,
      answers: Object.entries(answers).map(([k, v]) => ({ questionKey: k, value: v }))
    }),
  });
  router.push('/');
}
```

### Pattern 3: File Upload in Wizard (Resume + LinkedIn PDF)

**What:** File questions upload directly to `/api/upload-resume` (existing endpoint) using FormData. The onboarding answer stores the returned `resumeId` + `filename` as a JSON object (existing `normalizeFileValue` format).

**When to use:** Any `type: 'file'` question in the onboarding wizard.

**Critical detail from codebase inspection:** `/api/upload-resume` calls `insertResume(userId, filename, {}, setAsDefault, buffer)` which stores the file in the DB `resumes` table AND returns a `resume` object with an `id`. That `id` becomes the `resumeId` stored in the onboarding answer. For LinkedIn PDF: use the same endpoint (or a separate `/api/upload-linkedin`) — the existing `upload-linkedin` route already exists at `src/app/api/upload-linkedin/route.ts` (confirmed by directory scan).

**Example flow:**
```tsx
async function handleFileUpload(file: File, questionKey: string) {
  const formData = new FormData();
  formData.append('file', file);
  const endpoint = questionKey === 'linkedin_pdf' ? '/api/upload-linkedin' : '/api/upload-resume';
  const res = await fetch(endpoint, { method: 'POST', body: formData });
  const data = await res.json();
  setAnswers(prev => ({
    ...prev,
    [questionKey]: { resumeId: data.resume?.id || data.linkedin?.id, filename: file.name }
  }));
}
```

### Pattern 4: First-Time Redirect

**What:** The `UserAccountSection` already calls `/api/user/init` for new users. The redirect to `/onboarding` should be wired into the page root or a client layout, reading `onboarding.completed` from the user's onboarding snapshot.

**Recommendation (Claude's discretion):** Rather than hooking into `UserAccountSection`, add a `useEffect` in the dashboard's root page or a dedicated `OnboardingRedirect` client component that:
1. Calls `GET /api/onboarding` to check `completed` status
2. If `!completed` AND user is authenticated AND path is `/`, `router.push('/onboarding')`

This is simpler than Clerk publicMetadata and uses the already-existing DB flag.

**Example:**
```tsx
// src/components/OnboardingRedirect.tsx (Client Component)
'use client';
useEffect(() => {
  if (!isSignedIn) return;
  fetch('/api/onboarding')
    .then(r => r.json())
    .then(snapshot => {
      if (!snapshot.completed) {
        router.replace('/onboarding');
      }
    });
}, [isSignedIn]);
```

### Pattern 5: Preference Score Computation

**What:** A pure function `computePreferenceScore(job: Job, answers: OnboardingAnswerRecord[]): number` returns 0-100. Called per-job after fetching jobs from DB, then used to sort the array client-side or applied at the API layer.

**Recommendation (compute on-the-fly at API layer):** Do not add a DB column. In `/api/jobs`, when `sortBy=preferences` is requested, fetch the user's onboarding snapshot, compute scores for each job in JS, and sort the returned array before sending the response. This avoids a migration and keeps score fresh.

**Scoring formula (Claude's discretion — suggested weighted sum):**
```typescript
// src/lib/preference-scoring.ts
export function computePreferenceScore(job: Job, answersByKey: Record<string, OnboardingAnswerRecord>): number {
  let score = 0;
  const MAX = 100;

  // work_areas: title keyword match (30pts)
  const workAreas = (answersByKey['work_areas']?.value as string[]) ?? [];
  // ... Jaccard similarity between job.title tokens and work_areas labels

  // regions: location match (25pts)
  // role_types: employment_type match (20pts)
  // work_style: remote/hybrid/onsite match (15pts)
  // career_levels: seniority keyword match (10pts)
  // visa_sponsorship: soft negative if user needs it (0 or -10pts, capped at 0)

  return Math.min(MAX, Math.max(0, score));
}
```

### Anti-Patterns to Avoid

- **Modifying globals.css for tweakcn variables:** Strictly forbidden (D-16). Use scoped CSS in the onboarding layout.
- **Calling Clerk admin API to store `onboardingShown`:** Unnecessary — `user_onboarding_state.status = 'complete'` already tracks this in the DB. Use `GET /api/onboarding` → `snapshot.completed`.
- **Hard-filtering jobs by preference:** The user explicitly chose soft sort (D-04). Do not exclude any jobs.
- **Storing preference scores in the DB:** Compute on-the-fly to stay fresh without migrations.
- **Building custom checkbox/radio components:** Use shadcn (D-18). The question renders are wrappers around shadcn primitives.
- **Using `tailwind.config.js` patterns with v4:** This project uses `@tailwindcss/postcss` (v4). No `tailwind.config.js` exists. shadcn `components.json` must have `tailwind.config` left empty.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible checkbox with indeterminate state | Custom `<input type="checkbox">` wrapper | `shadcn/ui Checkbox` (Radix primitive) | Handles ARIA, keyboard nav, focus rings |
| Accessible radio group | Custom `<input type="radio">` wrapper | `shadcn/ui RadioGroup` | Handles group semantics, keyboard arrow nav |
| Tooltip/popover for info icon | Custom hover state div | `shadcn/ui Tooltip` | Handles positioning, portal, ARIA roles |
| Progress bar | Custom `div` with inline width | `shadcn/ui Progress` | Handles ARIA progressbar, animated fill |
| File type validation | Manual MIME check | `accept="application/pdf"` + `file.type === 'application/pdf'` check | Browser-level filter + JS guard |
| S3 file upload | Custom S3 client | Existing `uploadFileToS3` + `generateS3Key` from `src/lib/s3.ts` | Already handles creds, bucket, key generation |
| Answer persistence | Local state only | POST to `/api/onboarding` on each step advance | Prevents data loss on refresh |

**Key insight:** shadcn components are copy-to-project source code. They're fully customizable post-install but save substantial boilerplate for accessible primitives that are deceptively hard to get right.

---

## Common Pitfalls

### Pitfall 1: shadcn Init on Tailwind v4 Project Requires Empty `tailwind.config` in components.json

**What goes wrong:** Running `npx shadcn@latest init` prompts for `tailwind.config` path. If you enter a path or the CLI auto-detects v3 config, generated components will use wrong class patterns.

**Why it happens:** shadcn CLI historically expected `tailwind.config.js`. v4 projects use CSS-only config via `globals.css` `@import "tailwindcss"`.

**How to avoid:** When CLI asks for `tailwind.config` path, leave it blank (press Enter). The generated `components.json` should have `"tailwind": { "config": "", "css": "src/app/globals.css", "baseColor": "neutral", "cssVariables": true }`. Verify before installing components.

**Warning signs:** If `cn()` utility in `src/lib/utils.ts` uses `twMerge` but component classes reference `bg-background` and they appear unstyled — the CSS variables aren't being picked up from the right scope.

### Pitfall 2: tweakcn Theme CSS Variables Must Be Scoped, Not in `:root`

**What goes wrong:** The tweakcn registry command writes CSS variables to `:root` by default. If those variables match names used in `globals.css` (e.g., `--background`, `--foreground`), they will override the entire app's theme.

**Why it happens:** tweakcn is designed to be dropped into `globals.css` for whole-app theming. Here we need page-level scoping.

**How to avoid:** After running `npx shadcn@latest add <tweakcn-url>`, move the written CSS from `:root { ... }` to `.onboarding-theme { ... }` in a dedicated `src/app/onboarding/theme.css` file, and import it only from `src/app/onboarding/layout.tsx`.

**Warning signs:** The dashboard's warm cream background changes color after visiting `/onboarding`.

### Pitfall 3: `isNew` Flag Race Condition — Redirect Fires More Than Once

**What goes wrong:** If `UserAccountSection` calls `/api/user/init` on every render and `isNew` triggers a redirect, the redirect could fire every session (not just first sign-in).

**Why it happens:** `/api/user/init` returns `isNew: true` only when the user has no username. Once a username is assigned, subsequent calls return `isNew: false`. However, if the redirect check uses `onboarding.completed` (the DB flag), it correctly fires until the user completes onboarding, not just until they're "new."

**How to avoid:** Use `snapshot.completed` from `GET /api/onboarding` as the redirect trigger, not the `isNew` flag. The `user_onboarding_state` table persists `status = 'complete'` permanently once the user finishes.

**Warning signs:** A user who skips onboarding gets redirected on every login.

### Pitfall 4: `@/` Path Alias Maps to `src/`, Not Root

**What goes wrong:** `components.json` default might set component path as `@/components` expecting `src/components`. This project's tsconfig has `"@/*": ["./src/*"]` — so `@/components/ui` maps correctly to `src/components/ui`.

**Why it happens:** shadcn CLI defaults can vary; if it places components at `./components/ui` (root), imports will break.

**How to avoid:** During `npx shadcn@latest init`, confirm the components path is set to `@/components` (which maps to `src/components`). Check the written `components.json` file before running `add`.

**Warning signs:** Import errors like `Cannot find module '@/components/ui/button'`.

### Pitfall 5: File Upload Size — 10MB PDF Hits Next.js Default Body Size Limit

**What goes wrong:** Next.js API routes have a default body parser limit of 4MB. A 10MB PDF will return a 413 error.

**Why it happens:** The existing `/api/upload-resume` route uses `runtime = 'nodejs'` and manually calls `request.formData()`, which bypasses the default body parser — but only if `export const config = { api: { bodyParser: false } }` is NOT set (formData already bypasses it in App Router). In App Router, `request.formData()` uses the Web API natively.

**How to avoid:** Test with a 10MB file. If 413 appears, add to the route: `export const config = { api: { bodyParser: { sizeLimit: '11mb' } } }`. In App Router (Next 16), this is handled differently — verify existing `/api/upload-resume` already accepts large files by checking if it works in the current codebase for the dashboard resume upload.

**Warning signs:** Uploading a large resume PDF fails with HTTP 413 or a truncated payload error.

### Pitfall 6: Preference Score Not Available Until `onboarding.completed`

**What goes wrong:** If the dashboard fetches jobs with `sortBy=preferences` before the user has completed onboarding, the preference snapshot returns empty answers. Scoring returns 0 for all jobs — then all jobs tied at 0, sort is unstable.

**Why it happens:** The `/api/jobs` route should only apply preference scoring when `snapshot.completed === true` AND the user is authenticated. Otherwise fall back to default `time` sort.

**How to avoid:** In `/api/jobs`, guard the preference sort:
```typescript
if (sortBy === 'preferences' && userId) {
  const snapshot = await getOnboardingSnapshot(userId);
  if (!snapshot.completed || snapshot.answers.length === 0) {
    // Fall back to time sort
    effectiveSortBy = 'time';
  }
}
```

---

## Code Examples

### shadcn components.json (Tailwind v4 project)
```json
// Source: https://ui.shadcn.com/docs/tailwind-v4
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

### Adding linkedin_pdf to ONBOARDING_QUESTIONS
```typescript
// src/lib/onboarding.ts — append to ONBOARDING_QUESTIONS array
{
  key: 'linkedin_pdf',
  step: 2,
  order: 11,
  title: 'Upload your LinkedIn profile PDF',
  description: 'Optional: upload your LinkedIn profile as a PDF so we can enrich your matches.',
  type: 'file',
  required: false,
  rationale: 'Supplements resume data with LinkedIn work history for better skill inference.',
  helperText: 'PDF only. Click the info icon for download instructions.',
}
```

### Preference Score Function Skeleton
```typescript
// src/lib/preference-scoring.ts
import type { Job } from '@/types';
import type { OnboardingAnswerRecord } from '@/lib/onboarding';

export function computePreferenceScore(
  job: Job,
  answersByKey: Record<string, OnboardingAnswerRecord>
): number {
  let score = 0;

  // work_areas → 30pts: match job title tokens against selected role families
  const workAreas = (answersByKey['work_areas']?.value as string[]) ?? [];
  if (workAreas.length > 0) {
    const titleLower = (job.title ?? '').toLowerCase();
    const matched = workAreas.some(area =>
      titleLower.includes(area.replace(/_/g, ' ').replace('engineer', ''))
    );
    if (matched) score += 30;
  }

  // regions → 25pts: match job location
  const regions = (answersByKey['regions']?.value as string[]) ?? [];
  if (regions.length > 0) {
    const locLower = (job.location ?? '').toLowerCase();
    const matched = regions.some(r =>
      r === 'remote_worldwide' ? locLower.includes('remote') : locLower.includes(r.replace(/_/g, ' '))
    );
    if (matched) score += 25;
  }

  // role_types → 20pts: employment type
  const roleTypes = (answersByKey['role_types']?.value as string[]) ?? [];
  if (roleTypes.length > 0) {
    const jobType = ((job as any).employment_type ?? '').toLowerCase();
    const matched = roleTypes.some(rt => jobType.includes(rt.replace('_', '-')));
    if (matched) score += 20;
  }

  // work_style → 15pts
  const workStyle = answersByKey['work_style']?.value as string | null;
  if (workStyle && workStyle !== 'flexible') {
    const jobDesc = ((job as any).description ?? '').toLowerCase();
    if (jobDesc.includes(workStyle)) score += 15;
  } else if (workStyle === 'flexible') {
    score += 15; // Always matches
  }

  // career_levels → 10pts: seniority keywords
  const careerLevels = (answersByKey['career_levels']?.value as string[]) ?? [];
  if (careerLevels.length > 0) {
    const titleLower = (job.title ?? '').toLowerCase();
    const seniorityMap: Record<string, string[]> = {
      early_career: ['junior', 'entry', 'intern', 'associate'],
      mid_level: ['mid', 'ii', 'iii', 'intermediate'],
      senior_manager: ['senior', 'staff', 'lead', 'principal', 'manager'],
      executive_leadership: ['director', 'vp', 'head', 'chief', 'executive'],
    };
    const matched = careerLevels.some(level =>
      (seniorityMap[level] ?? []).some(kw => titleLower.includes(kw))
    );
    if (matched) score += 10;
  }

  return Math.min(100, Math.max(0, score));
}
```

### Extending getAllPublicJobs for preferences sort
```typescript
// src/lib/db.ts — update function signature
export async function getAllPublicJobs(
  page: number = 1,
  limit: number = 50,
  sortBy: 'time' | 'imported' | 'preferences' = 'time',
  sortDir: 'asc' | 'desc' = 'desc',
  currentUserId: string | null = null,
  onboardingAnswers?: Record<string, OnboardingAnswerRecord>
): Promise<Job[]>
```

Note: `preferences` is not a DB column — the DB query uses `time` sort, and the returned array is re-sorted in the `/api/jobs` route handler after score computation.

### /api/jobs preferences sort (route handler snippet)
```typescript
// src/app/api/jobs/route.ts
import { getOnboardingSnapshot } from '@/lib/onboarding-db';
import { computePreferenceScore } from '@/lib/preference-scoring';

// After fetching jobs:
if (sortBy === 'preferences' && userId) {
  const snapshot = await getOnboardingSnapshot(userId);
  if (snapshot.completed && snapshot.answers.length > 0) {
    jobs = jobs
      .map(job => ({ job, score: computePreferenceScore(job, snapshot.answersByKey) }))
      .sort((a, b) => b.score - a.score)
      .map(({ job }) => job);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn + Tailwind v3 config | shadcn + Tailwind v4 CSS-only config | Feb 2025 | `components.json` tailwind.config must be blank; `@theme inline` used instead of HSL wrappers |
| shadcn `forwardRef` components | `data-slot` attribute components | Feb 2025 | No forwardRef needed; components work natively with React 19 |
| HSL CSS variables in `:root` | OKLCH CSS variables in `@theme inline` | Feb 2025 | Better perceptual uniformity; tweakcn exports both formats |

**Deprecated/outdated:**
- `npx shadcn-ui@latest` (old package name): Use `npx shadcn@latest` instead. The `shadcn-ui` npm package is deprecated.
- `tailwind.config.js` color configuration with shadcn v4: CSS variables in the stylesheet replace the `extend.colors` config pattern.

---

## Open Questions

1. **Does `/api/upload-resume` accept 10MB files without a body size config change?**
   - What we know: The route uses `request.formData()` in Next.js App Router (Next 16), which uses the Web Streams API and does not use Next.js body parser. No explicit size limit is set in the route.
   - What's unclear: The actual limit depends on Node.js and Next.js platform config. Vercel has a 4.5MB limit on Serverless Functions; Neon/other local setup may be unlimited.
   - Recommendation: Add a Wave 0 task to test uploading a 9MB PDF. If 413 occurs, add `export const maxDuration = 60` and check if Vercel plan allows larger payloads, or reduce max to 4MB and adjust D-13.

2. **Does the tweakcn theme URL (cmlznk552000004jubsv77roj) install CSS variables or full component overrides?**
   - What we know: The tweakcn URL is a theme-only registry entry (CSS variable set). It does not install new components, only writes CSS variable assignments.
   - What's unclear: Whether the CLI writes these to `globals.css` or to a separate file.
   - Recommendation: After install, verify what file was modified. If `globals.css` was modified, immediately move the written block to `src/app/onboarding/theme.css` and import it only from the onboarding layout.

3. **Where exactly is the first-time redirect best placed?**
   - What we know: `UserAccountSection` is rendered on every dashboard page. It already calls `/api/user/init`. A separate redirect component would need its own API call.
   - What's unclear: Whether adding redirect logic directly to `UserAccountSection` (which already has the init call) is cleaner than a separate `OnboardingRedirect` component mounted at the root layout.
   - Recommendation: Add an `OnboardingRedirect` client component to `src/app/page.tsx` (root page only). It calls `GET /api/onboarding` once on mount. This keeps the concerns separate and does not modify `UserAccountSection`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npx shadcn@latest init` | Yes | v22.12.0 | — |
| npx | shadcn CLI install | Yes | 11.0.0 | — |
| AWS SDK (`@aws-sdk/client-s3`) | S3 file upload | Yes (in node_modules) | ^3.965.0 | — |
| Radix UI primitives | shadcn components | Not installed | — | Installed by shadcn CLI during Wave 0 |
| class-variance-authority | shadcn `cn()` utility | Not installed | — | Installed by shadcn CLI during Wave 0 |
| tailwind-merge | shadcn `cn()` utility | Not installed | — | Installed by shadcn CLI during Wave 0 |
| lucide-react | Info icon | Yes | ^0.563.0 | — |
| tweakcn theme | Onboarding page dark theme | Not installed | — | Installed via registry URL in Wave 0 |

**Missing dependencies with no fallback:**
- None — all missing deps are installed by the shadcn CLI as part of Wave 0.

**Missing dependencies with fallback:**
- None in this phase.

**Key finding:** `shadcn/ui` (Radix, CVA, tailwind-merge) is NOT currently installed. No `components.json` exists at project root. Wave 0 must run `npx shadcn@latest init` before any component-level work begins.

---

## Validation Architecture

> `workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.0.16 |
| Config file | none detected (uses package.json `"test": "vitest run"`) |
| Quick run command | `npm test` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ONBOARDING-01 | `computePreferenceScore` returns 0-100, higher for matching jobs | unit | `npm test -- tests/preference-scoring.test.ts` | Wave 0 |
| ONBOARDING-02 | `onboarding.ts` linkedin_pdf question present with correct fields | unit | `npm test -- tests/onboarding-questions.test.ts` | Wave 0 |
| ONBOARDING-03 | `/api/jobs?sort_by=preferences` returns jobs sorted by score desc when onboarding complete | integration (mock) | `npm test -- tests/jobs-preferences-sort.test.ts` | Wave 0 |
| ONBOARDING-04 | Redirect skipped when onboarding already complete | unit (component) | manual / visual | — |

### Sampling Rate
- **Per task commit:** `npm test -- tests/preference-scoring.test.ts` (unit test, fast)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/preference-scoring.test.ts` — covers ONBOARDING-01
- [ ] `tests/onboarding-questions.test.ts` — covers ONBOARDING-02 (verify linkedin_pdf in ONBOARDING_QUESTIONS)
- [ ] `tests/jobs-preferences-sort.test.ts` — covers ONBOARDING-03

*(Framework install: `npx shadcn@latest init` — not a test framework change, Vitest already present)*

---

## Sources

### Primary (HIGH confidence)
- Official shadcn/ui docs — Tailwind v4 page: https://ui.shadcn.com/docs/tailwind-v4
- Official shadcn/ui docs — Manual installation: https://ui.shadcn.com/docs/installation/manual
- Direct codebase inspection: `src/lib/onboarding.ts`, `src/lib/onboarding-db.ts`, `src/app/api/onboarding/route.ts`, `src/lib/s3.ts`, `src/app/api/upload-resume/route.ts`, `src/lib/db.ts` (lines 131-250), `src/app/api/jobs/route.ts`
- `package.json` — confirmed Tailwind v4 (`"tailwindcss": "^4"`, `"@tailwindcss/postcss": "^4"`)
- `tsconfig.json` — confirmed `@/*` alias maps to `./src/*`

### Secondary (MEDIUM confidence)
- tweakcn.com — https://tweakcn.com/ — confirmed Tailwind v4 compatible, exports CSS vars
- shadcn/ui changelog Feb 2025 — https://ui.shadcn.com/docs/changelog/2025-02-tailwind-v4 — confirmed v4 support added

### Tertiary (LOW confidence)
- Community: shadcn `components.json` blank `tailwind.config` for v4 — confirmed by official docs but exact CLI prompts may vary

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — shadcn/Tailwind v4 support confirmed by official docs; no Radix installed confirmed by node_modules scan
- Architecture: HIGH — all integration points verified by direct code inspection
- Pitfalls: HIGH (pitfalls 1-4) / MEDIUM (pitfall 5 — 10MB limit depends on deployment platform)
- Preference scoring formula: MEDIUM — logic is straightforward but field names on `Job` type (employment_type, description fields) need verification against actual job rows

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (shadcn API is stable; tweakcn theme URL is fixed; DB schema is fixed)
