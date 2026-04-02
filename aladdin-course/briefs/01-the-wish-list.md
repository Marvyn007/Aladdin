# Module 1: The Wish List

### Teaching Arc
- **Metaphor:** A personal talent scout — you describe what you want, they go search the entire market and bring back only the best matches. Aladdin is that scout for junior dev jobs.
- **Opening hook:** You've probably applied to jobs by scrolling LinkedIn for an hour and guessing which listings are actually entry-level. Aladdin solves that exact frustration.
- **Key insight:** Aladdin is a full-stack AI job search engine that combines job aggregation, resume analysis, AI writing tools, and application tracking into one opinionated system — with a ruthless filter that auto-deletes anything not meant for new grads.
- **"Why should I care?":** Understanding the product from a technical angle helps you explain it to AI agents precisely — "add a feature to the job aggregation layer" rather than "add something to the job part."

### Screens (5)

**Screen 1: What Is Aladdin?**
Aladdin is an AI-powered job search assistant for entry-level software engineers. It does 5 things: 1) Automatically discovers jobs from 6 sources, 2) Scores each job against your resume, 3) Generates tailored cover letters, 4) Rewrites your resume to match each job, 5) Tracks your applications on a drag-and-drop Kanban board.

Use pattern cards (one per feature) with icons.

**Screen 2: The Problem It Solves**
Classic job search problems: job boards are flooded with "senior" roles, cover letters take 30 minutes each, applications are forgotten. Aladdin's answer: a ruthless filter that deletes senior/lead roles automatically, plus AI generation for every piece of writing.

Use step cards showing the "old way" vs "Aladdin's way".

**Screen 3: The Journey — Click by Click**
Trace the full user journey from signup to hired:
1. Sign up → Onboarding questionnaire (work areas, regions, work style)
2. Upload resume PDF → AI parses it
3. Dashboard shows scored job matches
4. Click job → View match score + matched/missing skills
5. "Generate Cover Letter" → AI writes it in real-time
6. "Mark as Applied" → Card appears on Kanban board

Use a numbered step flow (static flow diagram with arrows).

**Screen 4: The Tech Stack at a Glance**
Don't go deep — just orient the learner to what technologies are used and WHY.
- Next.js: the framework that handles both website and server
- PostgreSQL: the database storing all jobs, resumes, applications
- OpenRouter / Gemini: the AI provider that writes cover letters
- Clerk: handles login (so they don't have to build it)
- AWS S3: stores uploaded PDF files

Use icon-label rows (one per technology with a brief "why" description).

**Screen 5: The Three-Column Dashboard**
The UI is three columns: Left sidebar (upload resume, import jobs), Middle column (scrollable list of jobs with match scores), Right panel (full job details + generation buttons). This layout is the mental map learners will use throughout the course.

Use a callout-accent box: "The column layout is the heartbeat of the app — every feature lives in one of these three columns."

### Interactive Elements

- [x] **Flow diagram (static)** — the 5-step user journey (sign up → onboard → upload → browse → apply)
- [x] **Pattern cards** — 5 main features with icons
- [x] **Icon-label rows** — tech stack
- [x] **Quiz** — 3 questions (scenario/architecture style)
  - Q1: "You want to add a 'company watchlist' feature. Based on the product overview, which existing system would this connect to?" (answer: the job discovery/scoring pipeline — not a separate thing)
  - Q2: "Aladdin deletes senior roles automatically. What type of system would you call this?" (answer: a filter / content validation layer)
  - Q3: "A user uploads their resume. What's the NEXT thing the system needs to do with it?" (answer: parse it with AI so it can be used for scoring)

### Code Snippets (pre-extracted)

None needed for this module — it's the product overview. No translation blocks.

### Reference Files to Read
- `references/content-philosophy.md` → always include
- `references/gotchas.md` → always include
- `references/interactive-elements.md` → "Pattern/Feature Cards", "Flow Diagrams", "Icon-Label Rows", "Multiple-Choice Quizzes", "Callout Boxes"
- `references/design-system.md` → not needed beyond what is in this brief

### Connections
- **Previous module:** None (this is the first)
- **Next module:** "Meet the Cast" — introduces the main React components and where each lives in the folder structure
- **Tone/style notes:** Accent color is teal (#2A7B9B). Module 1 uses `--color-bg` (off-white). Keep tone friendly and relatable — this is for someone who has used AI tools to build software but hasn't looked at the code.
