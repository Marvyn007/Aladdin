# Module 4: Your AI Genie

### Teaching Arc
- **Metaphor:** A personal ghostwriter who has read your entire portfolio AND the job posting — and writes every document from scratch, tailored to the specific audience. Not copy-paste with find/replace. Actually tailored.
- **Opening hook:** That cover letter took 3 seconds to generate. Here's everything that happened in those 3 seconds — including why the AI knows to mention your specific skills that match this specific job.
- **Key insight:** AI in Aladdin isn't one call — it's a multi-step pipeline. For cover letters: load context → merge profile → stream output. For tailored resumes: parse PDF → embed chunks → retrieve relevant sections → rewrite each bullet → validate. Understanding this pipeline helps you debug it and improve it.
- **"Why should I care?":** When AI-generated cover letters feel generic, knowing the context-injection step means you can ask AI to "improve the master profile building step in the cover letter pipeline" — not just "make cover letters better."

### Screens (6)

**Screen 1: Three AI Superpowers**
Aladdin uses AI for three main tasks. Show as pattern cards:

1. **Resume Parsing** — Upload a PDF, get back structured JSON (name, skills, work history, etc.)
2. **Cover Letter Generation** — Tell AI: here's the resume, here's the job → get a tailored HTML cover letter, word by word
3. **Resume Tailoring** — A two-pass pipeline that rewrites every bullet point on your resume to match the job description

**Screen 2: How Resume Parsing Works**
When you upload a PDF, two things happen:
1. `pdf-parse` library extracts raw text from the PDF
2. An LLM (OpenAI or Gemini) reads that text and converts it to structured JSON

The JSON includes: contact info, skills, work history, education, frameworks, languages. This structured data is what powers the scoring algorithm.

Callout: "This is called 'structured extraction' — taking messy human text and pulling out machine-readable fields. It's one of the most useful things you can do with an LLM."

**Screen 3: Cover Letter Streaming — Live Code**
Cover letters don't wait for the full response — they stream word by word using a technology called Server-Sent Events (SSE). The server sends a continuous stream of text chunks; the client assembles them in real-time.

Code↔English translation block:

File: src/app/api/generate-cover-letter-stream/route.ts (lines 25-56)
```typescript
function createSSEStream(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        const { userId } = await auth();
        if (!userId) {
          sendEvent("error", { message: "Unauthorized" });
          controller.close();
          return;
        }

        const body = await req.json();
        const { job_id, job_description } = body;

        sendEvent("stage", {
          stageId: "stage1_load-job",
          name: "Loading job details...",
        });

        const job = await getJobById(userId, job_id);
```

Plain English:
- `createSSEStream`: Creates a live data channel — like opening a walkie-talkie connection
- `new TextEncoder()`: Converts text strings to bytes the network can send
- `new ReadableStream({ start(controller) {...} })`: Open a "pipe" — we'll push data through it as it becomes available
- `sendEvent(event, data)`: Format a message in the SSE format: event type + JSON data + blank line separator
- `controller.enqueue(...)`: Send one chunk of data through the pipe right now
- `await auth()`: Confirm this user is logged in before we do any work
- `sendEvent("stage", {...})`: Tell the browser "we're starting stage 1 now" — this updates the progress indicator

**Screen 4: Group Chat — The Cover Letter Pipeline**
Animate the conversation between the pipeline stages:

Actors:
- Browser: "Generate cover letter for job #42!"
- API: "Loading job details... Done. Loading your resume... Done."
- LLM: "Building master profile combining resume + LinkedIn..."
- LLM: "Writing cover letter... [streams first paragraph]"
- Browser: "Received chunk: 'Dear Hiring Manager...' — displaying"
- LLM: "[streams second paragraph]"
- Browser: "Received chunk — appending to preview"
- API: "Done! Cover letter saved. PDF ready."

5 messages minimum to show the SSE streaming feel.

**Screen 5: The Tailored Resume Pipeline**
This is the most sophisticated AI feature. Two passes, not one.

Show as numbered step cards:

Pass 1 — Per-Bullet Rewrites (Parallel):
1. Parse PDF → extract each work experience bullet
2. Embed job description into vector chunks
3. For each bullet: retrieve the most relevant job description chunks
4. Call LLM: "Rewrite this bullet using these job keywords"

Pass 2 — Role Assembly:
5. Combine all rewritten bullets for each job role
6. Call LLM: "Polish this role section for consistency and tone"
7. Run validators: no fabricated experience, no deleted bullets

Code↔English translation:

File: src/lib/resume-generation/pipeline.ts (lines 24-53)
```typescript
export async function generateTailoredResume(
  params: GenerateTailoredResumeParams
): Promise<TailoredResumeOutput> {
  const { resumePdf, linkedinPdf, linkedinData, jobDescription } = params;
  const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

  const resumeBuffer = Buffer.isBuffer(resumePdf)
    ? resumePdf
    : Buffer.from(await (resumePdf as File).arrayBuffer());
  const resumeParseResult: ParseResult = await parsePdfToDynamicResume(resumeBuffer);

  if (params.onProgress) {
    params.onProgress("complete", { stageId: "stage2_resume-parse" });
  }
```

Plain English:
- `GenerateTailoredResumeParams`: Everything needed: your resume PDF, optional LinkedIn PDF, and the job description
- `const model = process.env.LLM_MODEL`: Which AI to use — read from the environment config so it can be swapped without code changes
- `Buffer.isBuffer(resumePdf) ? resumePdf : Buffer.from(...)`: Handle two cases — PDF already loaded in memory, or PDF needs to be read from a File object
- `parsePdfToDynamicResume(resumeBuffer)`: Extract text from PDF and structure it into JSON
- `params.onProgress("complete", {...})`: Send a progress update to the streaming client — "step 2 is done!"

**Screen 6: The Scoring Algorithm**
Before AI writes anything, a simpler algorithm scores each job 0-100 against your resume. No LLM needed — pure math.

Components:
- Role match (30pts): How similar is the job title to your past roles?
- Skill match (50pts): How many of your skills appear in the job description?
- Location match (10pts): Remote job? +10. Your city? +10. Elsewhere? +5.
- Base score (10pts): You have a resume. That's worth something.

Use a visual scoring breakdown (badge-list or step cards showing each component).

Code↔English:

File: src/lib/scoring.ts (lines 32-93)
```typescript
export function calculateMatchScore(
    job: Job,
    resume: ParsedResume,
    linkedin: ParsedResume | null = null
): number {
    // 3. ROLE MATCHING (30 Points)
    const titleSimilarity = calculateTextSimilarity(jobTitle, targetRoles);
    components.roleMatch = Math.min(30, Math.ceil(titleSimilarity * 100));

    // 4. SKILL MATCHING (50 Points)
    let foundSkills = 0;
    allSkills.forEach(skill => {
        if (jobText.includes(skill)) {
            foundSkills++;
        }
    });
    components.skillMatch = Math.min(50, Math.ceil(foundSkills * 3.5));
```

Plain English:
- `calculateMatchScore(job, resume, linkedin)`: Takes the job and your profiles, returns a number 0-100
- `calculateTextSimilarity(jobTitle, targetRoles)`: "How similar are these two phrases?" — uses Jaccard set intersection (fancy term for: count shared words, divide by total unique words)
- `Math.min(30, ...)`: Cap the role score at 30 points — can't exceed the max
- `allSkills.forEach(skill => if(jobText.includes(skill)))`: For each skill on your resume, check if it appears anywhere in the job description
- `Math.ceil(foundSkills * 3.5)`: 1 matching skill = 3.5 pts. 10 skills = 35 pts. 15+ = capped at 50.

### Interactive Elements

- [x] **Pattern cards** — 3 AI superpowers
- [x] **Code↔English translation** — SSE stream setup (cover-letter-stream/route.ts)
- [x] **Code↔English translation** — pipeline.ts start
- [x] **Code↔English translation** — scoring.ts algorithm
- [x] **Group chat animation** — cover letter pipeline (Browser ↔ API ↔ LLM)
- [x] **Numbered step cards** — two-pass resume tailoring pipeline
- [x] **Callout** — structured extraction insight
- [x] **Quiz** — 4 questions
  - Q1: "Cover letter generation feels slow. You want to show a loading spinner between stages. Based on the SSE stream, what event type would you listen for?" (answer: the 'stage' event — it fires when each stage starts)
  - Q2: "A user reports their tailored resume removed a key bullet point. Which validation step is supposed to prevent this?" (answer: the enforceNoDrops validator in pass 2)
  - Q3: "The match score for every job is suspiciously round (50, 60, 70). Where in the scoring algorithm might you add small randomness to make scores feel more natural?" (answer: the total score calculation — add a small jitter)
  - Q4: "You want to use Claude instead of GPT for cover letters. Which part of the code would you change?" (answer: the LLM_MODEL environment variable / the model config line in pipeline.ts)

### Code Snippets (pre-extracted)

File: src/app/api/generate-cover-letter-stream/route.ts (lines 25-59)
```typescript
function createSSEStream(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        const { userId } = await auth();
        if (!userId) {
          sendEvent("error", { message: "Unauthorized" });
          controller.close();
          return;
        }

        const body = await req.json();
        const { job_id, job_description } = body;

        sendEvent("stage", {
          stageId: "stage1_load-job",
          name: "Loading job details...",
        });

        const job = await getJobById(userId, job_id);
```

File: src/lib/resume-generation/pipeline.ts (lines 24-53)
```typescript
export async function generateTailoredResume(
  params: GenerateTailoredResumeParams
): Promise<TailoredResumeOutput> {
  const { resumePdf, linkedinPdf, linkedinData, jobDescription } = params;
  const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

  const resumeBuffer = Buffer.isBuffer(resumePdf)
    ? resumePdf
    : Buffer.from(await (resumePdf as File).arrayBuffer());
  const resumeParseResult: ParseResult = await parsePdfToDynamicResume(resumeBuffer);

  if (params.onProgress) {
    params.onProgress("complete", { stageId: "stage2_resume-parse" });
  }
```

File: src/lib/scoring.ts (lines 32-93, condensed key lines)
```typescript
export function calculateMatchScore(
    job: Job,
    resume: ParsedResume,
    linkedin: ParsedResume | null = null
): number {
    // 3. ROLE MATCHING (30 Points)
    const titleSimilarity = calculateTextSimilarity(jobTitle, targetRoles);
    components.roleMatch = Math.min(30, Math.ceil(titleSimilarity * 100));

    // 4. SKILL MATCHING (50 Points)
    let foundSkills = 0;
    allSkills.forEach(skill => {
        if (jobText.includes(skill)) {
            foundSkills++;
        }
    });
    components.skillMatch = Math.min(50, Math.ceil(foundSkills * 3.5));
```

### Reference Files to Read
- `references/content-philosophy.md` → always
- `references/gotchas.md` → always
- `references/interactive-elements.md` → "Group Chat Animation", "Code ↔ English Translation Blocks", "Multiple-Choice Quizzes", "Callout Boxes", "Pattern/Feature Cards", "Numbered Step Cards"

### Connections
- **Previous module:** "How Jobs Find You" — covered job discovery, adapters, cleanup filter, queue.
- **Next module:** "The Hidden Machinery" — covers the database abstraction layer, auth, and clever engineering patterns.
- **Tone/style notes:** Accent is teal. Module 4 uses `--color-bg-warm`. This module should feel exciting — these are the features that make users go "whoa." The SSE streaming and two-pass pipeline are genuinely impressive engineering.
