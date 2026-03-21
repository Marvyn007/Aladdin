# Job Aggregation Backend — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Branch:** cleanup/start

---

## Overview

Replace the existing job aggregation system with a queue-based architecture that polls 5 external job sources on independent schedules, using Neon Postgres as both data store and job queue. Designed for Vercel Hobby constraints (10s function timeout, no Redis), but architected so swapping to BullMQ/Redis is a single config change.

**Vercel Hobby constraint:** All route handlers are limited to 10s execution. Do NOT export `maxDuration` values >10 — existing routes with `maxDuration = 60` or `300` only work on Pro/Enterprise and should not be copied as patterns.

## Sources & Polling Cadence

| Source | Type | Auth | Interval | Priority | Endpoint Pattern |
|---|---|---|---|---|---|
| Greenhouse | Per-company | None (public) | 15 min | 1 (high) | `boards-api.greenhouse.io/v1/boards/{slug}/jobs` |
| Lever | Per-company | None (public) | 15 min | 1 (high) | `api.lever.co/v0/postings/{slug}` |
| The Muse | Bulk/paginated | API key (`THEMUSE_API_KEY`) | 1 hr | 2 (medium) | `www.themuse.com/api/public/jobs` |
| Arbeitnow | Bulk/paginated | None | 1 hr | 2 (medium) | `arbeitnow.com/api/job-board-api` |
| Himalayas | Bulk | None | 24 hr | 3 (low) | `himalayas.app/jobs/api` |
| ATS Discovery | Internal crawl | None | 6 hr | 4 (lowest) | Internal task (not an external source) |

**Env config for The Muse:**
```
# .env.local.example
THEMUSE_API_KEY=your_themuse_api_key_here
```

---

## Section 1: Queue Abstraction Layer

### Interface

```typescript
interface QueueAdapter {
  enqueue(task: QueueTask): Promise<void>
  dequeue(limit: number): Promise<QueueTask[]>
  complete(taskId: string): Promise<void>
  fail(taskId: string, error: string): Promise<void>
  getStats(): Promise<QueueStats>
}
```

### Neon implementation (`NeonQueueAdapter`)

- Backed by `JobQueue` Prisma model
- Dequeue uses a **short transaction** to atomically claim tasks:
  ```sql
  BEGIN;
  SELECT id, type, source, payload FROM job_queue
    WHERE status='pending' AND run_at <= NOW()
    ORDER BY priority ASC, run_at ASC
    FOR UPDATE SKIP LOCKED LIMIT $1;
  UPDATE job_queue SET status='processing', locked_at=NOW(), locked_by=$2
    WHERE id = ANY($3);
  COMMIT;
  ```
  The task then executes **outside** the transaction. On completion, a separate UPDATE marks it `completed`. This avoids holding row locks during external API calls — critical for Neon's PgBouncer (transaction mode) pooler.
- Priority values: 1=high, 2=medium, 3=low, 4=lowest (ascending sort = higher priority first)
- Stale lock recovery: tasks stuck in `processing` for >60s get reset to `pending`
- Dead-letter: tasks exceeding `maxAttempts` (default 3) move to `dead` status

### Config switch

```typescript
// src/lib/queue/index.ts
export const queue: QueueAdapter =
  process.env.QUEUE_BACKEND === 'redis'
    ? new BullMQAdapter(process.env.REDIS_URL!)
    : new NeonQueueAdapter()
```

Future Redis/BullMQ implementation: same interface, delegates to BullMQ. Zero changes to scheduler or workers.

---

## Section 2: Source Adapters

### Interface

```typescript
interface SourceAdapter {
  name: string
  poll(target: PollTarget): Promise<NormalizedJob[]>
  healthCheck(): Promise<SourceHealth>
}

type PollTarget =
  | { type: 'company'; slug: string }   // Greenhouse, Lever
  | { type: 'bulk'; page?: number }      // Himalayas, The Muse, Arbeitnow
```

### NormalizedJob

```typescript
interface NormalizedJob {
  title: string
  company: string
  location: string
  sourceUrl: string
  rawDescriptionHtml: string | null
  jobDescriptionPlain: string | null
  postedAt: Date | null
  contentHash: string                    // SHA-256 of normalized (title+company+location+sourceUrl) — for cross-source clustering only
  source: 'greenhouse' | 'lever' | 'himalayas' | 'themuse' | 'arbeitnow' | 'imported'
  externalId: string                     // native source ID, or deterministic fallback hash
  metadata: Record<string, unknown>      // source-specific extras
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  jobType: 'fulltime' | 'parttime' | 'contract' | 'internship' | null
  isRemote: boolean
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | null
  skills: string[]                       // extracted keywords e.g. ['React', 'TypeScript']
  applyUrl: string | null                 // direct application URL (nullable — some sources only have sourceUrl)
  expiresAt: Date | null
}
```

### Fallback externalId generation

When a source does not provide a native ID, generate a deterministic fallback:

```typescript
function generateFallbackId(title: string, company: string, location: string, applyUrl: string | null): string {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const input = [normalize(title), normalize(company), normalize(location), normalize(applyUrl ?? '')].join('|')
  return sha256(input)
}
```

### Per-adapter details

| Adapter | Endpoint | Auth | Response Shape | Notes |
|---|---|---|---|---|
| Greenhouse | `GET boards-api.greenhouse.io/v1/boards/{slug}/jobs` | None | `{ jobs: [{ id, title, location, departments, ... }] }` | One call per company slug. Returns all open jobs. |
| Lever | `GET api.lever.co/v0/postings/{slug}` | None | `[{ id, text, categories, ... }]` | Array of postings per company. |
| The Muse | `GET www.themuse.com/api/public/jobs` | API key in `api_key` query param | `{ results: [{ name, company, locations, ... }], page_count }` | Paginated. |
| Arbeitnow | `GET arbeitnow.com/api/job-board-api` | None | `{ data: [{ title, company_name, location, ... }], ... }` | Paginated. Europe/Germany-heavy, adds geographic diversity. |
| Himalayas | `GET himalayas.app/jobs/api` | None | `{ jobs: [{ title, companyName, location, ... }] }` | Bulk endpoint, paginated. |

### Directory structure

```
src/lib/job-sources/
  adapters/
    greenhouse.ts
    lever.ts
    himalayas.ts
    themuse.ts
    arbeitnow.ts
  types.ts          # SourceAdapter, NormalizedJob, PollTarget
  index.ts          # adapter registry/factory
  seeds.ts          # 93 verified seed companies
```

---

## Section 3: Scheduler & Worker

### Scheduler: `/api/cron/tick`

Triggered externally every 5 minutes (cron-job.org, free). Authenticated via `CRON_SECRET` bearer token (same pattern as existing `/api/cron/process-queue`). Three phases per invocation, with an internal time budget that exits early if elapsed > 7s to stay within Vercel Hobby's 10s limit:

**Phase 1 — Enqueue tasks (capped at 50 per tick):**

```
for each source config:
  if source.type === 'per-company':
    for each company where lastPolledAt + interval < now() AND isActive:
      queue.enqueue({ type: 'poll', source, payload: { slug }, priority, runAt: now() })
  if source.type === 'bulk':
    if lastBulkPollAt + interval < now():
      queue.enqueue({ type: 'poll-bulk', source, payload: { page: 1 }, priority, runAt: now() })

if lastDiscoveryAt + 6hrs < now():
  queue.enqueue({ type: 'discover', priority: 4, runAt: now() })
```

Cap: max 50 tasks enqueued per tick. Remaining companies catch up on subsequent ticks since `lastPolledAt` won't update until they're actually processed.

**Phase 2 — Process tasks (up to 3, sequentially):**

Dequeues and executes up to 3 tasks sequentially in the same invocation. Higher priority tasks dequeue first. Each task runs one external API call + DB writes. If the 7s time budget is exceeded after any task, stop processing and let burst workers handle the rest.

**Phase 3 — Burst mode (if queue > 20 pending):**

Fire up to 3 additional async fetch calls to `/api/worker/process` (fire-and-forget). Max 9 tasks processed per tick. Burst cap is hard-limited at 3 parallel calls to prevent runaway invocations on Vercel Hobby.

### Worker endpoint: `/api/worker/process`

Stateless. Authenticated via `CRON_SECRET` bearer token (same as `/api/cron/tick`). Dequeues up to 3 tasks, executes them sequentially (with 7s time budget), returns. Can be called by:
- The scheduler (burst mode)
- Manually via admin (for debugging — requires admin auth OR cron secret)
- Future: a Redis-backed BullMQ worker (same task shapes)

### Task execution flow

```
dequeue task →
  resolve adapter (greenhouse/lever/etc) →
    adapter.poll(target) → NormalizedJob[] →
      for each job:
        check: source + externalId exists?
          yes → skip (or update if postedAt changed)
          no  → INSERT into Job table
      update TrackedCompany (lastPolledAt, lastJobCount, lastNonEmptyAt)
      insert SourcePollLog row
      complete(taskId)

on error →
  fail(taskId, error.message) →
    if attempts >= maxAttempts → move to dead status
```

### Concurrency model

Single-threaded per invocation. `FOR UPDATE SKIP LOCKED` ensures concurrent workers never grab the same task.

### TrackedCompany model

```prisma
model TrackedCompany {
  id             String    @id @default(uuid())
  slug           String
  name           String
  ats            String                       // 'greenhouse' | 'lever'
  industry       String?
  country        String?
  websiteUrl     String?
  logoUrl        String?
  addedBy        String    @default("seed")   // 'seed' | 'discovery' | 'user' | 'admin'
  isActive       Boolean   @default(true)
  suspectEmpty   Boolean   @default(false)
  lastPolledAt   DateTime?
  lastNonEmptyAt DateTime?
  lastJobCount   Int       @default(0)
  errorCount     Int       @default(0)
  createdAt      DateTime  @default(now())

  @@unique([slug, ats])
  @@index([ats, isActive])
  @@index([isActive, lastPolledAt])
}
```

Auto-deactivation: `errorCount >= 5` → `isActive = false`.
Suspect-empty detection: `lastNonEmptyAt < now() - 7 days` → `suspectEmpty = true` (for admin review, not auto-deactivation).

---

## Section 4: ATS Discovery Crawler

Automatically finds companies using Greenhouse and Lever, adding them to `TrackedCompany`.

### Discovery strategies

**Strategy 1 — Known directory endpoints:**
- Greenhouse company directory at `boards-api.greenhouse.io/v1/boards` (undocumented but functional)
- Lever boards follow pattern `jobs.lever.co/{slug}` — scrape known directories

**Strategy 2 — Curated list sourcing (replaces search engine scraping):**
- Y Combinator companies list from `https://www.ycombinator.com/companies` (public, no auth)
- Fortune 500 lists available as free static JSON/CSV on GitHub
- Extract company names, generate likely slugs, validate against Greenhouse/Lever APIs

**Strategy 3 — Referral chain:**
- When fetching jobs from a known company's board, job descriptions sometimes reference partner companies. Extract slugs from cross-references.

### Discovery task flow

```
dequeue 'discover' task →
  run Strategy 1 (directory scrape) → candidate slugs[] →
  run Strategy 2 (curated list sourcing) → more slugs[] →
  deduplicate against existing TrackedCompany →
  for each new slug (max 10 per cycle):
    validate (hit the API, confirm it returns jobs) →
    insert TrackedCompany { slug, ats, addedBy: 'discovery', isActive: true }
```

### Rate limiting & growth

- Max 10 new companies added per discovery cycle
- Discovery runs every 6 hours (priority 4, lowest)
- 1s delay between validation requests
- Starting with 93 verified seed companies, discovery adds ~5-10 per cycle
- Projected: ~150-300 tracked companies after one month

### Seed list

93 API-verified companies across 14 industries. Full list in `src/lib/job-sources/seeds.ts`.

**Breakdown by industry:**
- Tech: 42 (Stripe, Airbnb, Figma, Cloudflare, Spotify, Palantir, ...)
- Finance/Fintech: 11 (Coinbase, Robinhood, Affirm, Brex, ...)
- Retail/E-commerce: 8 (Instacart, Coupang, Gopuff, ...)
- Media/Gaming: 7 (NYT, Roku, Roblox, Epic Games, ...)
- Healthcare: 5 (Zocdoc, Flatiron Health, ...)
- AI/ML: 3 (Anthropic, Scale AI, AppLovin)
- Security: 3 (Zscaler, Abnormal Security, Liftoff)
- HR/Workforce: 3 (Toast, Gusto, Justworks)
- Enterprise/Data: 3 (Celonis, Braze, Relativity)
- Mobility: 2 (Lyft, Waymo)
- Education: 2 (Khan Academy, Coursera)
- Defense: 1 (Anduril)
- Logistics: 1 (Flexport)
- Real Estate: 1 (Opendoor)
- Consulting: 1 (ThoughtWorks)

**ATS split:** 90 Greenhouse, 3 Lever. ~11,000+ combined open jobs at time of verification (2026-03-21).

One-time `/api/admin/seed-companies` endpoint upserts these into `TrackedCompany`.

---

## Section 5: Error Handling, Observability & Admin

### Error handling

**Per-task errors:**

| Error | Action |
|---|---|
| Network timeout / 5xx | Increment `attempts`, re-enqueue with exponential backoff (`runAt = now + 2^attempts min`, capped at 30 min) |
| 404 on company slug | Increment `TrackedCompany.errorCount`. At 5 consecutive failures, auto-deactivate |
| Rate limited (429) | Re-enqueue with `runAt = now + retryAfter` header (or 5 min default) |
| Malformed response | Log error, mark task failed, don't retry (likely API change requiring code fix) |

**Scheduler-level:**
- If `/api/cron/tick` throws, external cron retries in 5 min — stateless, self-healing
- Stale lock recovery runs at start of every tick: tasks in `processing` for >60s reset to `pending`

**Data integrity:**
- `@@unique([source, externalId])` prevents duplicate jobs from the same source
- `contentHash` used only for cross-source clustering (detecting the same job posted on multiple platforms)
- Idempotent inserts: `INSERT ... ON CONFLICT (source, externalId) DO NOTHING`

### Observability

**Queue stats endpoint:** `GET /api/admin/queue-stats`
```json
{
  "pending": 47,
  "processing": 3,
  "completed_24h": 1204,
  "failed_24h": 12,
  "dead": 2,
  "avgProcessingMs": 1850,
  "oldestPending": "2026-03-20T14:23:00Z"
}
```

**Source health endpoint:** `GET /api/admin/source-health`
```json
{
  "greenhouse": { "activeCompanies": 90, "lastPollAt": "...", "errorRate": 0.02 },
  "lever":      { "activeCompanies": 3,  "lastPollAt": "...", "errorRate": 0.0  },
  "himalayas":  { "lastPollAt": "...", "jobsFetched": 2400, "status": "healthy" },
  "themuse":    { "lastPollAt": "...", "jobsFetched": 800,  "status": "healthy" },
  "arbeitnow":  { "lastPollAt": "...", "jobsFetched": 1200, "status": "healthy" }
}
```

**Structured logging:** Each task execution logs:
```json
{ "taskId": "...", "type": "poll", "source": "greenhouse", "slug": "stripe", "duration_ms": 1850, "jobsFetched": 500, "newJobs": 3, "duplicates": 497, "error": null }
```

### SourcePollLog model

```prisma
model SourcePollLog {
  id          String   @id @default(uuid())
  source      String
  slug        String?
  jobsFetched Int
  newJobs     Int
  duplicates  Int
  durationMs  Int
  error       String?
  createdAt   DateTime @default(now())

  @@index([source, createdAt])
  @@index([createdAt])
}
```

Pruned after 30 days.

### Admin endpoints

| Endpoint | Method | Purpose | Access |
|---|---|---|---|
| `/api/admin/seed-companies` | POST | Upsert seed list | admin |
| `/api/admin/queue-stats` | GET | Queue health | admin, moderator |
| `/api/admin/source-health` | GET | Per-source metrics | admin, moderator |
| `/api/admin/companies` | GET | List tracked companies | admin, moderator |
| `/api/admin/companies` | POST | Add company manually | admin |
| `/api/admin/companies/[id]` | PATCH | Activate/deactivate, update | admin |
| `/api/admin/queue/retry-dead` | POST | Re-enqueue dead-letter tasks | admin |
| `/api/admin/queue/drain` | POST | Cancel all pending tasks | admin only |

### RBAC

Role-based access via Clerk metadata: `publicMetadata.role`.

| Role | Access |
|---|---|
| `admin` | Full access to all admin endpoints |
| `moderator` | Read + non-destructive actions (stats, list, retry). No queue drain, no company deletion |
| `user` | No admin access |

Roles derived from `publicMetadata.role` — no hardcoded user IDs or emails.

---

## Section 6: Database Schema Changes

### New models

```prisma
model JobQueue {
  id          String   @id @default(uuid())
  type        String                          // 'poll' | 'discover' | 'poll-bulk'
  source      String?                         // 'greenhouse' | 'lever' | 'himalayas' | 'themuse' | 'arbeitnow'
  payload     Json                            // { slug?, page?, etc. }
  status      String   @default("pending")    // pending | processing | completed | failed | dead
  priority    Int      @default(2)            // 1=high, 2=medium, 3=low, 4=lowest
  runAt       DateTime @default(now())
  attempts    Int      @default(0)
  maxAttempts Int      @default(3)
  lastError   String?
  lockedAt    DateTime?
  lockedBy    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?

  @@index([status, runAt, priority])
  @@index([status, createdAt])
}

model TrackedCompany {
  id             String    @id @default(uuid())
  slug           String
  name           String
  ats            String
  industry       String?
  country        String?
  websiteUrl     String?
  logoUrl        String?
  addedBy        String    @default("seed")
  isActive       Boolean   @default(true)
  suspectEmpty   Boolean   @default(false)
  lastPolledAt   DateTime?
  lastNonEmptyAt DateTime?
  lastJobCount   Int       @default(0)
  errorCount     Int       @default(0)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  @@unique([slug, ats])
  @@index([ats, isActive])
  @@index([isActive, lastPolledAt])
}

model SourcePollLog {
  id          String   @id @default(uuid())
  source      String
  slug        String?
  jobsFetched Int
  newJobs     Int
  duplicates  Int
  durationMs  Int
  error       String?
  createdAt   DateTime @default(now())

  @@index([source, createdAt])
  @@index([createdAt])
}

model JobVote {
  id        String   @id @default(uuid())
  userId    String
  jobId     String
  value     Int                               // 1 = upvote, -1 = downvote
  createdAt DateTime @default(now())

  user      User     @relation(fields: [userId], references: [id])
  job       Job      @relation(fields: [jobId], references: [id])

  @@unique([userId, jobId])
  @@index([jobId])
}

// NOTE: The existing User model must also add: jobVotes JobVote[]
// The existing Company model serves a different purpose (interview experiences).
// TrackedCompany tracks ATS polling state. Do NOT unify them — they may share
// a name but have different lifecycles and fields. A future linking table can
// associate TrackedCompany → Company if needed for logo/domain reuse.
```

### Modifications to existing Job model

```prisma
model Job {
  // ... existing fields ...

  // ── Source identity (primary dedupe key) ──
  source         String                       // REQUIRED: 'greenhouse' | 'lever' | 'himalayas' | 'themuse' | 'arbeitnow' | 'imported'
  externalId     String                       // REQUIRED: native source ID or deterministic fallback hash

  // ── Enriched fields ──
  salaryMin       Float?                      // whole currency units (e.g., 75000.50 USD)
  salaryMax       Float?                      // whole currency units
  salaryCurrency  String?
  jobType         String?                     // 'fulltime' | 'parttime' | 'contract' | 'internship'
  isRemote        Boolean  @default(false)
  experienceLevel String?                     // 'entry' | 'mid' | 'senior' | 'lead'
  skills          Json     @default("[]")     // string[] — Prisma 5.22+ handles this default for Postgres jsonb
  applyUrl        String?
  expiresAt       DateTime?

  // ── Relations ──
  jobVotes        JobVote[]

  // contentHash remains for cross-source clustering ONLY, not primary dedupe

  @@unique([source, externalId])
  // ... existing indexes ...
}
```

**`source` and `externalId` are both required (non-nullable).** When a source doesn't provide a native ID, generate a deterministic fallback using SHA-256 of normalized `(title + company + location + applyUrl)`. Normalization: trim, lowercase, collapse whitespace.

### Migration strategy

1. **Drop `@unique` on `contentHash`.** The existing schema has `contentHash String @unique` — this MUST be changed to a non-unique index. Cross-source clustering requires multiple jobs with the same contentHash (e.g., same job on Greenhouse and Arbeitnow). Change to `@@index([contentHash])`.
2. Add new columns (`source`, `externalId`, enriched fields including `salaryMin Float?`, `salaryMax Float?`) as nullable first
3. Add `JobQueue`, `TrackedCompany`, `SourcePollLog`, `JobVote` models. Add `jobVotes JobVote[]` relation to existing `User` model.
4. Backfill `source` and `externalId` on existing jobs:
   - Derive `source` from `sourceUrl` host (e.g., `boards.greenhouse.io` → `'greenhouse'`)
   - For jobs with `isImported = 1`, set `source = 'imported'`
   - Generate `externalId` from native IDs where available, fallback hash otherwise
5. Make `source` and `externalId` non-nullable after backfill
6. Add `@@unique([source, externalId])` composite index
7. **Deprecate `isImported` field.** After backfill, `isImported` is redundant (replaced by `source = 'imported'`). Add `@deprecated` comment. Refactor the ~6 files referencing `isImported`/`is_imported` to use `source === 'imported'` instead. Drop the column in a subsequent migration after all references are removed.
8. Refactor `insertJob()` in `src/lib/db.ts` — currently deduplicates via `SELECT id FROM jobs WHERE content_hash = $1`. Change to use `source + externalId` as the primary dedupe key: `INSERT ... ON CONFLICT (source, external_id) DO NOTHING`.

### Bootstrap sequence

After migration, the system must be initialized in this order:
1. Run Prisma migration (`npx prisma migrate deploy`)
2. Set `CRON_SECRET` env var on Vercel
3. POST `/api/admin/seed-companies` to populate `TrackedCompany` with 93 seed companies
4. Configure external cron (cron-job.org) to hit `/api/cron/tick` every 5 min
5. First tick will enqueue bulk sources (Himalayas, Muse, Arbeitnow) immediately. Per-company tasks start flowing once seed companies have `lastPolledAt = null` (which means "never polled" → due immediately)

---

## Section 7: User-Imported Jobs

### Flow

Users can paste job URLs or descriptions from external sources. Imported jobs are stored alongside fetched jobs with `source = 'imported'`.

### Fields

| Field | Value |
|---|---|
| `source` | `'imported'` |
| `externalId` | Deterministic hash of `(title + company + location + applyUrl)` |
| `postedByUserId` | The importing user's ID |
| `contentHash` | Same algorithm as fetched jobs |

### Duplicate handling on import

If an imported job's `contentHash` matches an existing job from any source:
- Do NOT insert a duplicate
- Return the existing job to the user
- Optionally allow attaching the user as a contributor to the existing job

### Reputation system

**Job-level voting** (new `JobVote` model):
- Any authenticated user can upvote or downvote an imported job
- One vote per user per job (`@@unique([userId, jobId])`)
- Upvote/downvote UI appears at the bottom of the job description page (imported jobs only)

**Ranking logic:**
- Fetched jobs are slightly prioritized over imported jobs by default
- Imported jobs with strong positive net votes can rise above fetched jobs
- Ranking considers: job match score (primary signal) → job-level net votes → poster user reputation (secondary signal)
- Imported jobs with negative net score are deprioritized but not hidden
- Admin/moderator can flag or remove problematic imported jobs

**No promotion/monetization fields.** Will be handled via separate migration later.

---

## Section 8: Testing Strategy

### Unit tests

**Adapters** (one test file per adapter):
- Parse real API response fixtures into `NormalizedJob[]`
- Verify all required fields populated (source, externalId, title, company)
- Verify fallback externalId generation when source has no native ID
- Verify contentHash generation is deterministic
- Test malformed response handling

**Queue adapter:**
- `NeonQueueAdapter`: enqueue, dequeue ordering (priority then runAt), concurrent dequeue with SKIP LOCKED simulation, stale lock recovery, dead-letter promotion
- Interface contract tests reusable for BullMQ adapter

**Scheduler logic:**
- Given N companies with various `lastPolledAt`, verify correct tasks enqueued
- Verify 50-task-per-tick cap
- Verify burst mode triggers at >20 pending, capped at 3 parallel calls

**Dedupe logic:**
- Same source + externalId → skip
- Same contentHash, different source → on import: return existing job, don't insert
- Fallback ID determinism: same inputs → same hash, different whitespace/casing → same hash

**Imported jobs:**
- User-pasted content → NormalizedJob with `source: 'imported'`
- contentHash collision → return existing job, no duplicate insert
- Job-level voting: upvote/downvote updates, no double-voting

### Integration tests

Run against a real Neon test database (not mocks).

- Full poll cycle: enqueue → dequeue → adapter fetches from mock HTTP server (MSW) → jobs inserted → task complete → TrackedCompany updated
- Dedupe end-to-end: poll same company twice → second run inserts 0 new
- Error recovery: adapter throws → task failed → retry → succeeds
- Queue drain under load: seed 100 tasks → run multiple worker invocations → all complete, no duplicates
- Import flow: paste → insert → appears in feed with "imported" badge
- Reputation voting: upvote/downvote, net score affects sort order

### API/E2E tests

- `/api/cron/tick`: verify tasks enqueued and processed
- Admin RBAC: admin=200, moderator=200 on read / 403 on destructive, user=403
- `/api/admin/queue-stats`: stats reflect actual queue state

### Test fixtures

Static JSON snapshots of real API responses, stored in `__fixtures__/`:
```
__fixtures__/
  greenhouse-stripe.json
  lever-spotify.json
  himalayas-bulk.json
  themuse-page1.json
  arbeitnow-page1.json
```

### Out of scope for tests

- Live API availability (monitored via healthCheck + SourcePollLog in production)
- Vercel timeout behavior (tested manually in staging)
- External cron delivery (we test what happens when the endpoint is hit)

---

## Architecture Summary

```
                    cron-job.org (every 5 min)
                           │
                           ▼
                   /api/cron/tick
                    ┌──────┴──────┐
                    │  Scheduler  │ ── enqueues up to 50 tasks
                    │  + Worker   │ ── processes up to 3 tasks
                    └──────┬──────┘
                           │ (burst: up to 3x)
                    ┌──────┴──────┐
                    │  /api/worker │
                    │  /process   │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         Greenhouse    Lever      Bulk Sources
         Adapter       Adapter    (Himalayas, Muse, Arbeitnow)
              │            │            │
              └────────────┼────────────┘
                           │
                    NormalizedJob[]
                           │
                    ┌──────┴──────┐
                    │   Dedupe    │ ── source + externalId
                    │   Insert    │ ── ON CONFLICT DO NOTHING
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  Neon DB    │
                    │  (Job table)│
                    └─────────────┘

    User Import ──→ Normalize ──→ contentHash check ──→ Insert or return existing
```

---

## Key Decisions Log

| Decision | Rationale |
|---|---|
| Neon as job queue | Vercel Hobby has no Redis; Neon is free and already in stack |
| Queue adapter interface | Single config swap to BullMQ/Redis when budget allows |
| Workable dropped for Arbeitnow | Workable public API requires 2 requests per job; Arbeitnow returns full descriptions in one bulk call |
| source + externalId as primary dedupe | More precise than contentHash; enables tracking individual jobs across updates |
| contentHash for cross-source clustering only | Same job on Greenhouse and Arbeitnow can be linked without blocking inserts |
| 50-task enqueue cap per tick | Prevents scheduler from consuming entire 10s timeout on enqueue alone |
| Burst mode capped at 3 | Prevents runaway Vercel invocations on Hobby tier |
| ATS Discovery via curated lists, not search scraping | Search engine scraping is fragile and violates ToS; YC/Fortune 500 lists are reliable |
| 93 verified seed companies | All slugs confirmed live via API as of 2026-03-21 |
| Job-level reputation separate from user reputation | Allows ranking imported jobs by community trust independently of poster reputation |
| No promotion/monetization fields | Will be added via separate migration when ready |
