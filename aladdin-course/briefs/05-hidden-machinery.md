# Module 5: The Hidden Machinery

### Teaching Arc
- **Metaphor:** A Swiss Army knife — one tool, many blades. `db.ts` is a single interface that works with three completely different databases depending on which "blade" the environment unlocks. The app doesn't care which database it's running on — it just calls the same functions, and the right backend answers.
- **Opening hook:** There's one file in this codebase that's over 10,000 lines long and quietly powers every single feature. It's called `db.ts` — and most people never read it.
- **Key insight:** The codebase is designed with swappable backends: any database (Postgres/Supabase/SQLite), any LLM (OpenRouter/OpenAI/Ollama), any queue (Postgres/Redis). This isn't accidental — it's a deliberate architectural choice that makes the app work in any environment.
- **"Why should I care?":** Understanding abstraction layers helps you request better architecture from AI. "Add a new database backend" or "swap the LLM provider" becomes precise, not guesswork.

### Screens (6)

**Screen 1: The 10,000-Line File**
`src/lib/db.ts` is the biggest file in the codebase. It's a complete data access layer — every function that reads or writes data goes through here. Why one big file instead of many small ones? Simplicity: one place to look for any database operation.

Use a visual file tree showing what the db.ts interface contains:
```
db.ts (10,000+ lines)
  ├── Job operations (getJobs, upsertJob, deleteJob...)
  ├── Resume operations (getResumes, insertResume...)
  ├── Application operations (getApplications, upsertApplication...)
  ├── Cover letter operations (insertCoverLetter, getCoverLetter...)
  ├── User operations (getUserProfile, updateUserEmbedding...)
  └── Onboarding operations (saveOnboardingAnswers...)
```

**Screen 2: Three Databases, One Interface**
The same `getJobs()` function works whether you're running PostgreSQL, Supabase, or SQLite. The function detects which backend is configured and calls the right implementation.

Like a universal TV remote — the same "volume up" button sends a different signal depending on which TV it's pointed at.

Code↔English translation — the database detection pattern (show the conceptual pattern from db.ts):

```typescript
function getDbType(): 'postgres' | 'supabase' | 'sqlite' {
  if (process.env.DATABASE_URL?.includes('neon.tech')) return 'postgres';
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return 'supabase';
  return 'sqlite';
}

export async function getAllPublicJobs(userId: string, options: GetJobsOptions) {
  const dbType = getDbType();
  if (dbType === 'postgres') return getJobsFromPostgres(userId, options);
  if (dbType === 'supabase') return getJobsFromSupabase(userId, options);
  return getJobsFromSQLite(userId, options);
}
```

Plain English:
- `getDbType()`: Look at environment variables to figure out which database we're connected to
- `process.env.DATABASE_URL?.includes('neon.tech')`: Is our database URL pointing at Neon (a Postgres cloud provider)?
- `return 'sqlite'`: If neither Postgres nor Supabase is configured, fall back to SQLite (works locally with no setup)
- `getAllPublicJobs(userId, options)`: One clean function, called the same way everywhere
- The if/else chain: Route to the right implementation without the caller ever knowing which backend ran

**Screen 3: Preference Scoring — Weighted Decisions**
User preferences from onboarding (what kind of jobs you want) are translated into a mathematical score added to every job. Each preference category has a point value.

Show as a visual scoring breakdown with point values:

Code↔English translation:

File: src/lib/preference-scoring.ts (lines 16-50)
```typescript
export function computePreferenceScore(
  job: Job,
  answersByKey: Record<string, OnboardingAnswerRecord>
): number {
  let score = 0;

  const workAreasAnswer = answersByKey['work_areas'];
  if (workAreasAnswer) {
    const selected = toStringArray(workAreasAnswer.value);
    const titleLower = (job.title ?? '').toLowerCase();
    const matched = selected.some((value) => {
      const keyword = value.replace(/_/g, ' ').replace(/\s+engineer$/, '').trim();
      return keyword.length > 0 && titleLower.includes(keyword);
    });
    if (matched) score += 30;
  }
```

Plain English:
- `computePreferenceScore(job, answersByKey)`: Given a job and your onboarding answers, calculate how well the job matches your preferences
- `let score = 0`: Start at zero — we add points for each match
- `answersByKey['work_areas']`: Look up your "work areas" preference (Frontend, Backend, Full Stack, etc.)
- `toStringArray(...)`: Convert the stored preference value to a list of strings
- `selected.some((value) => ...)`: Does ANY of your preferred work areas match this job title?
- `value.replace(/_/g, ' ')`: Convert "full_stack" → "full stack" (match how it appears in job titles)
- `if (matched) score += 30`: Add 30 points if work area matches — the highest-weighted preference

**Screen 4: The Postgres Queue — Deep Dive**
The job queue uses the database as a message broker. This avoids an external Redis dependency while still getting reliable task processing.

The key trick: `FOR UPDATE SKIP LOCKED` — a SQL clause that atomically claims a row for one worker without blocking others. Like a ticket dispenser where each person grabs the next number, but the machine guarantees no two people get the same number.

Code↔English translation:

File: src/lib/queue/neon-adapter.ts (lines 74-88)
```typescript
async enqueue(input: EnqueueInput): Promise<void> {
  await this.withRetry(() => this.prisma.jobQueue.create({
    data: {
      type: input.type,
      source: input.source ?? null,
      payload: input.payload as Prisma.InputJsonValue,
      status: 'pending',
      priority: input.priority ?? 2,
      runAt: input.runAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      attempts: 0,
    },
  }))
}
```

Plain English:
- `enqueue(input)`: Add a new task to the queue — like dropping a ticket into the box
- `this.withRetry(...)`: If the database connection drops, try again once before giving up
- `this.prisma.jobQueue.create({...})`: Insert a new row into the job_queue table
- `status: 'pending'`: New tasks start as "waiting to be picked up"
- `priority: input.priority ?? 2`: Default priority is 2 — higher numbers = higher priority
- `runAt: input.runAt ?? new Date()`: When should this run? Default: right now
- `attempts: 0`: Fresh task — hasn't been tried yet

**Screen 5: Auth with Clerk**
Authentication is handled by Clerk — a third-party service that manages user accounts, sessions, and tokens. The app calls `auth()` at the start of every API route to verify the user.

Pattern: Trust but verify. Every API route starts with `const { userId } = await auth()`. If `userId` is null, the request is rejected before any database work happens.

Show as a data flow animation (simple 3-actor flow):
1. Browser sends request with session cookie
2. Clerk middleware validates the token
3. API route receives `userId` and proceeds (or 401s)

**Screen 6: The Big Picture — Why These Patterns Matter**
Final callout tying everything together. The patterns in this app — abstraction layers, adapter interfaces, streaming responses, content hashing — are not fancy tricks. They're standard production patterns used at every major tech company.

When you ask an AI to build something "production-grade," these are the patterns it should reach for:
- Database abstraction → run anywhere
- Adapter pattern → swap dependencies without rewriting
- Queue-based processing → don't block the web server
- Streaming responses → user sees progress, not a spinner
- Content deduplication → no garbage in the database

Use pattern cards (one per pattern) with a one-liner on why it matters.

Quiz at the end.

### Interactive Elements

- [x] **Visual file tree** — db.ts contents overview
- [x] **Code↔English translation** — database detection / routing pattern
- [x] **Code↔English translation** — preference-scoring.ts (computePreferenceScore)
- [x] **Code↔English translation** — neon-adapter.ts (enqueue method)
- [x] **Data flow animation** — Clerk auth flow (Browser → Clerk → API)
- [x] **Pattern cards** — 5 production patterns (abstraction, adapter, queue, streaming, deduplication)
- [x] **Callout** — why these patterns matter
- [x] **Quiz** — 4 questions
  - Q1: "You want to deploy Aladdin on a server that only supports MySQL (not PostgreSQL). What would need to change?" (answer: add a MySQL backend implementation to db.ts and update the getDbType() detection)
  - Q2: "Two workers accidentally pick up the same queue task. Which SQL feature prevents this?" (answer: FOR UPDATE SKIP LOCKED — row locking)
  - Q3: "A user's preference score is 0 for every job even though they set preferences. Where would you look first?" (answer: computePreferenceScore / answersByKey — the preference answers might not be loading from the DB correctly)
  - Q4: "You want to add Anthropic Claude as a direct integration (not via OpenRouter). Based on the patterns you learned, what's the right way to do it?" (answer: add a new adapter — follow the same pattern as the existing LLM adapters in src/lib/adapters/)

### Code Snippets (pre-extracted)

Database detection pattern (conceptual — look in db.ts for the backend routing logic, or use this representative pattern):
```typescript
function getDbType() {
  if (process.env.DATABASE_URL?.includes('neon.tech')) return 'postgres';
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return 'supabase';
  return 'sqlite';
}
```

File: src/lib/preference-scoring.ts (lines 16-36)
```typescript
export function computePreferenceScore(
  job: Job,
  answersByKey: Record<string, OnboardingAnswerRecord>
): number {
  let score = 0;

  const workAreasAnswer = answersByKey['work_areas'];
  if (workAreasAnswer) {
    const selected = toStringArray(workAreasAnswer.value);
    const titleLower = (job.title ?? '').toLowerCase();
    const matched = selected.some((value) => {
      const keyword = value.replace(/_/g, ' ').replace(/\s+engineer$/, '').trim();
      return keyword.length > 0 && titleLower.includes(keyword);
    });
    if (matched) score += 30;
  }
```

File: src/lib/queue/neon-adapter.ts (lines 74-88)
```typescript
async enqueue(input: EnqueueInput): Promise<void> {
  await this.withRetry(() => this.prisma.jobQueue.create({
    data: {
      type: input.type,
      source: input.source ?? null,
      payload: input.payload as Prisma.InputJsonValue,
      status: 'pending',
      priority: input.priority ?? 2,
      runAt: input.runAt ?? new Date(),
      maxAttempts: input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS,
      attempts: 0,
    },
  }))
}
```

### Reference Files to Read
- `references/content-philosophy.md` → always
- `references/gotchas.md` → always
- `references/interactive-elements.md` → "Code ↔ English Translation Blocks", "Message Flow / Data Flow Animation", "Pattern/Feature Cards", "Multiple-Choice Quizzes", "Visual File Tree", "Callout Boxes"

### Connections
- **Previous module:** "Your AI Genie" — covered resume parsing, cover letter generation, resume tailoring, and scoring.
- **Next module:** None (this is the last module). End with a "What to build next" callout.
- **Tone/style notes:** Accent is teal. Module 5 uses `--color-bg`. This module should feel like the curtain being pulled back — the "aha" of seeing how the pieces connect. End on an empowering note: you now understand how production apps are built.
