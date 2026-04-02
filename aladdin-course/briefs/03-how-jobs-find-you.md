# Module 3: How Jobs Find You

### Teaching Arc
- **Metaphor:** A news wire service — Reuters doesn't write the news, it collects dispatches from correspondents in 6 different cities, runs each story through an editorial filter, and only publishes what meets the standard. Aladdin has 6 "correspondents" (adapters) reporting from different job boards, and a ruthless editor (the cleanup filter) who rejects anything not entry-level.
- **Opening hook:** You didn't upload those 2,000+ jobs. Aladdin's background processes discovered them automatically — every few minutes, 6 different robots are out there scraping job boards on your behalf.
- **Key insight:** Job discovery is a pipeline: poll → normalize → filter → deduplicate → store. Each step has a specific job and a specific file. The "ruthless cleanup filter" is the heart of the product's value proposition.
- **"Why should I care?":** When you ask AI to "add LinkedIn as a job source," knowing it needs a new adapter file in `src/lib/job-sources/adapters/` means AI knows exactly where to add it.

### Screens (6)

**Screen 1: The 6 Correspondents**
Show the 6 job source adapters as pattern cards:
- Greenhouse — polls company career pages via their public API
- Lever — same concept, different ATS
- The Muse — REST API (requires API key)
- Arbeitnow — open REST API, 2K+ jobs
- Himalayas — open REST API, 5K+ jobs
- Workday — scrapes Workday cloud portals via XPath

Each card: adapter name, target, type (Public API / REST / Scrape).

**Screen 2: The Adapter Pattern**
All 6 adapters speak the same language — they all implement a `SourceAdapter` interface. Like a universal power adapter: the wall socket is different in every country, but the adapter converts it to the same plug.

Code↔English translation block:

File: src/lib/job-sources/adapters/greenhouse.ts (lines 29-53)
```typescript
export class GreenhouseAdapter implements SourceAdapter {
  name = 'greenhouse' as const

  private lastRequestAt = 0

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_INTERVAL_MS - elapsed))
    }
    this.lastRequestAt = Date.now()
  }

  async poll(target: PollTarget): Promise<NormalizedJob[]> {
    await this.rateLimit()
```

Plain English:
- `implements SourceAdapter`: This class promises to follow the SourceAdapter contract — it will have a `poll()` method
- `name = 'greenhouse'`: Self-identification — useful for logs and routing
- `lastRequestAt = 0`: Tracks when we last made a request to be polite to Greenhouse's servers
- `rateLimit()`: Pause if we called too recently — prevents getting banned
- `elapsed < RATE_LIMIT_INTERVAL_MS`: Has enough time passed since the last request?
- `await new Promise(...)`: Sleep for the remaining wait time
- `poll(target)`: The main method — given a company, fetch all their jobs

**Screen 3: The Data Flow Animation — From Poll to Database**
Animated flow showing the full pipeline:

Actors: Cron Job, Queue, Adapter, Filter, Database

Steps:
1. "Cron timer fires: POST /api/cron/tick"
2. "Scheduler checks which companies need re-polling"
3. "New tasks added to Postgres queue"
4. "Worker dequeues task: 'poll Stripe on Greenhouse'"
5. "GreenhouseAdapter fetches Stripe's job board"
6. "32 jobs returned, normalized to common format"
7. "Cleanup filter runs: 8 jobs are senior/lead — deleted"
8. "Content hash check: 5 already in database — skipped"
9. "19 new jobs saved to database"
10. "Task marked complete"

Use the data flow animation element with 5 actors (Cron, Queue, Adapter, Filter, DB).

**Screen 4: The Ruthless Cleanup Filter**
The cleanup filter is the product's most opinionated feature. It auto-deletes any job with:
- Senior/Lead/Principal/Manager/Director in the title
- More than 2 years of experience required
- Non-CS fields (healthcare, finance, HR, sales, marketing)

Philosophy: False negatives (missing a good job) are acceptable. False positives (keeping a bad job) are not.

Use a callout-accent: "The filter is intentionally aggressive. It's better to miss one good job than to show you 50 irrelevant ones."

Show the validation config as a code↔English block:

File: src/lib/job-validation.ts (lines 30-52)
```typescript
export const MIN_DESCRIPTION_LENGTH = 3000;

export const CONFIDENCE_THRESHOLDS = {
    description: 0.6,
    date: 0.5,
    location: 0.4,
} as const;

const PLACEHOLDER_PATTERNS = [
    /view full description/i,
    /click to apply/i,
    /please log in/i,
    /sign in to view/i,
] as const;
```

Plain English:
- `MIN_DESCRIPTION_LENGTH = 3000`: Any job without at least 3,000 characters of description text gets rejected — it probably has placeholder text
- `CONFIDENCE_THRESHOLDS`: Minimum confidence scores required for scraped data fields — 0.6 means "we need to be at least 60% sure this is the real description"
- `PLACEHOLDER_PATTERNS`: Regex patterns that identify fake/partial descriptions — "click to apply" means the real content didn't load

**Screen 5: Content Deduplication**
Every job gets a "fingerprint" — a SHA-256 hash of its title + company + location + text. If the same job shows up from two different sources, the hash matches and the duplicate is silently skipped. Like checking if a photo is already in your camera roll by its exact pixel data.

Use a simple numbered step flow showing: raw job data → normalize text → hash → check DB → unique? save : skip.

**Screen 6: The Postgres Queue**
Instead of Redis, Aladdin uses the database itself as a task queue. Each task is a row. "Claiming" a task means locking that row so no other worker picks it up.

Show this as a badge-list:
- `status = 'pending'` → Task waiting to be picked up
- `status = 'processing'` → A worker has the lock
- `status = 'completed'` → Done
- `status = 'failed'` → Error occurred, will retry
- `locked_by` → Which worker instance claimed this task

### Interactive Elements

- [x] **Pattern cards** — 6 adapters
- [x] **Code↔English translation** — GreenhouseAdapter.poll() snippet
- [x] **Code↔English translation** — job-validation.ts config snippet
- [x] **Data flow animation** — full pipeline from cron to DB (5 actors, 10 steps)
- [x] **Numbered step flow** — content deduplication steps
- [x] **Badge-list** — queue task statuses
- [x] **Callout** — ruthless filter philosophy
- [x] **Quiz** — 4 questions
  - Q1: "You want to add support for Indeed as a job source. Where would you add the new code?" (answer: a new adapter file in src/lib/job-sources/adapters/)
  - Q2: "A company posts the same internship on both Greenhouse and Lever. What prevents it from appearing twice?" (answer: the content hash deduplication check)
  - Q3: "Jobs are disappearing too quickly and users can't see recent postings. Based on the pipeline, where would you look?" (answer: the cleanup filter — it might be too aggressive)
  - Q4: "The Greenhouse adapter is making too many requests and getting rate-limited. Which part of the code controls this?" (answer: the rateLimit() method / RATE_LIMIT_INTERVAL_MS config)

### Code Snippets (pre-extracted)

File: src/lib/job-sources/adapters/greenhouse.ts (lines 29-53)
```typescript
export class GreenhouseAdapter implements SourceAdapter {
  name = 'greenhouse' as const

  private lastRequestAt = 0

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_INTERVAL_MS - elapsed))
    }
    this.lastRequestAt = Date.now()
  }

  async poll(target: PollTarget): Promise<NormalizedJob[]> {
    await this.rateLimit()
```

File: src/lib/job-validation.ts (lines 30-52)
```typescript
export const MIN_DESCRIPTION_LENGTH = 3000;

export const CONFIDENCE_THRESHOLDS = {
    description: 0.6,
    date: 0.5,
    location: 0.4,
} as const;

const PLACEHOLDER_PATTERNS = [
    /view full description/i,
    /click to apply/i,
    /please log in/i,
    /sign in to view/i,
    /login to continue/i,
    /view complete details/i,
    /see full details/i,
] as const;
```

### Reference Files to Read
- `references/content-philosophy.md` → always
- `references/gotchas.md` → always
- `references/interactive-elements.md` → "Code ↔ English Translation Blocks", "Message Flow / Data Flow Animation", "Pattern/Feature Cards", "Multiple-Choice Quizzes", "Callout Boxes", "Flow Diagrams", "Permission/Config Badges"

### Connections
- **Previous module:** "Meet the Cast" — covered React components, the Zustand store, and API route structure.
- **Next module:** "Your AI Genie" — covers how AI is used to parse resumes, score jobs, generate cover letters, and tailor resumes.
- **Tone/style notes:** Accent is teal. Module 3 uses `--color-bg`. The pipeline flow should feel systematic and satisfying — like watching a well-oiled machine.
