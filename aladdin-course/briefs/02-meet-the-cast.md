# Module 2: Meet the Cast

### Teaching Arc
- **Metaphor:** A film crew. Every great movie has a director (Dashboard.tsx), camera operators (JobList, JobDetail), a props master (Zustand store), and a sound engineer (the API routes). They each have a specific job; when they collaborate, the film gets made.
- **Opening hook:** You know that three-column layout you scroll through? It's actually five separate React components passing notes to each other through a shared memory called "the store."
- **Key insight:** The codebase is organized into three clear layers: UI components (what you see), a Zustand store (shared state), and API routes (server-side logic). Understanding which layer owns what helps you steer AI to the right file.
- **"Why should I care?":** When you ask AI to "fix the job list" — knowing it's `JobList.tsx` + `useStore.ts` means AI makes the change in the right place instead of guessing.

### Screens (5)

**Screen 1: The Component Map**
Show the three-column layout and annotate which file renders each piece.
- `Dashboard.tsx` — the director, renders all three columns
- `Sidebar.tsx` — left column (upload, import, settings)
- `JobList.tsx` — middle column (list of job cards)
- `JobDetail.tsx` — right column (selected job + generate buttons)
- `CoverLetterModal.tsx` — overlays everything when you click Generate

Use a visual architecture diagram (arch-diagram with zones: "Left Column", "Middle Column", "Right Column", "Overlays") with clickable components.

**Screen 2: The Shared Memory — Zustand Store**
All five components read from and write to one shared store (`useStore.ts`). Think of it as a shared whiteboard in the middle of the room — any component can write to it, any component can read from it.

Code↔English translation block:

File: src/store/useStore.ts (conceptual pattern — show the Zustand create pattern)
```typescript
const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      jobs: [],
      selectedJob: null,
      filters: {},
      setJobs: (jobs) => set({ jobs }),
      setSelectedJob: (job) => set({ selectedJob: job }),
    }),
    { name: 'aladdin-store' }
  )
);
```

Plain English:
- Line 1: Create a global store that any component can subscribe to
- persist(...): Automatically save state to localStorage so it survives page refresh
- jobs: []: Start with an empty list of jobs
- selectedJob: null: Nothing is selected yet
- setJobs / setSelectedJob: Functions components call to update the shared memory
- name: 'aladdin-store': The key used in localStorage

**Screen 3: The API Routes — The Back Room**
The UI components talk to the browser. Behind the scenes, Next.js API routes handle the real work: fetching jobs from the database, calling AI, saving to S3. Show the key routes as a badge-list.

Key routes to list:
- `GET /api/jobs` → Fetch jobs from database
- `POST /api/resume` → Upload and parse resume PDF
- `POST /api/generate-cover-letter-stream` → Stream AI cover letter
- `POST /api/application` → Save to Kanban board
- `POST /api/import-job` → Import a job manually

Use badge-list (route as badge-code, description as badge-desc).

**Screen 4: The File Tree — Where Everything Lives**
Visual file tree showing just the key directories:
```
src/
  app/api/          ← 40+ server routes
  components/
    layout/         ← the 3-column UI
    modals/         ← overlays
  lib/              ← all the smart logic
  store/            ← shared state (Zustand)
```

Use the `.file-tree` visual element.

**Screen 5: Group Chat — How a Click Flows**
Animate the conversation between components when a user clicks on a job card.

Chat actors:
- U (User): clicks a job card
- JL (JobList.tsx): "User clicked job #42!"
- S (Store): "Got it, setting selectedJob = job #42"
- JD (JobDetail.tsx): "Store changed — updating my view with job #42"

This is the core React data flow: user event → component updates store → other component re-renders.

### Interactive Elements

- [x] **Interactive architecture diagram** — Three-column zones with clickable components
- [x] **Code↔English translation** — Zustand store pattern
- [x] **Badge-list** — key API routes
- [x] **Visual file tree** — src/ directory structure
- [x] **Group chat animation** — click-to-detail flow (User → JobList → Store → JobDetail)
- [x] **Quiz** — 3 questions
  - Q1: "You want to add a 'bookmark job' feature. The bookmark count should show in the sidebar AND the job list. Which file is the right place to store that count?" (answer: the Zustand store — because both components need it)
  - Q2: "A user reports the job detail panel is showing the wrong job. Based on what you learned, where would you look first?" (answer: the store's selectedJob — the data pipeline from click to display)
  - Q3: "Which layer handles calling the OpenAI API — components, the store, or API routes?" (answer: API routes — server-side logic)

### Code Snippets (pre-extracted)

File: src/store/useStore.ts — look for the `create(persist(...))` wrapper pattern near the top of the file. Use the outermost ~10 lines that show the structure.

### Reference Files to Read
- `references/content-philosophy.md` → always
- `references/gotchas.md` → always
- `references/interactive-elements.md` → "Group Chat Animation", "Interactive Architecture Diagram", "Code ↔ English Translation Blocks", "Visual File Tree", "Multiple-Choice Quizzes", "Permission/Config Badges"
- `references/design-system.md` → actor colors section (for assigning colors to components in the chat)

### Connections
- **Previous module:** "The Wish List" — covered what the app does and the user journey. Learner knows the product.
- **Next module:** "How Jobs Find You" — dives into the job source adapters and the cleanup filter pipeline.
- **Tone/style notes:** Accent is teal. Module 2 uses `--color-bg-warm`. Actor colors: Dashboard = actor-1 (vermillion), Store = actor-2 (teal), JobDetail = actor-3 (plum), API routes = actor-4 (golden).
