# Job Hunt Vibe 🚀

> AI-powered job search companion for software engineering internships and entry-level positions.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmarvin%2Fjob-hunt-vibe&env=SUPABASE_URL,SUPABASE_KEY,GEMINI_KEY&envDescription=Required%20environment%20variables%20for%20the%20application&project-name=job-hunt-vibe)

## Features

- 🎯 **Smart Job Matching** - AI-powered scoring using your resume
- 📄 **Resume Parsing** - Auto-extract skills, experience, and education from PDFs
- ✉️ **Cover Letter Generator** - Professional, customized cover letters in seconds
- 🧠 **Tailored Resume** - Two-panel editor with live PDF preview, keyword analysis, and ATS optimization
- 📋 **Kanban Tracker** - 7-column board to track your application progress
- 🔖 **Bookmarklet** - Clip jobs from LinkedIn, Indeed, or any job site
- 🌙 **Premium Dark Theme** - Beautiful, eye-friendly interface


## Quick Start

### Prerequisites

- Node.js 20+
- Supabase account (free tier works) OR set `USE_SQLITE=true` for local dev
- Google Gemini API key

### Installation

```bash
# Clone the repository
git clone https://github.com/marvin/job-hunt-vibe.git
cd job-hunt-vibe

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your credentials
# Then start the development server
npm run dev
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes* | Your Supabase project URL |
| `SUPABASE_KEY` | Yes* | Your Supabase anon/public key |
| `GEMINI_KEY` | Yes | Google Gemini API key |
| `HUGGINGFACE_API_KEY` | No | Fallback provider (Tier 3) |
| `REPLICATE_API_TOKEN` | No | Fallback provider (Tier 4) |
| `USE_SQLITE` | No | Set to `true` for local SQLite instead of Supabase |

### AI Safety Limits (Optional)
| Variable | Default | Description |
|----------|---------|-------------|
| `HUGGINGFACE_MAX_CALLS_PER_DAY` | 20 | Hard stop after N calls |
| `REPLICATE_MAX_CALLS_PER_DAY` | 10 | Hard stop after N calls |
| `OPENROUTER_MAX_CALLS_PER_DAY` | 5 | Hard stop after N calls |

*Required unless `USE_SQLITE=true`

## Database Setup

### Option 1: Supabase (Recommended for Production)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration:

```sql
-- Copy contents from supabase/migrations/001_init.sql
```

3. Copy your project URL and anon key to `.env.local`

### Option 2: SQLite (Local Development)

Set `USE_SQLITE=true` in your `.env.local`. The database will be created automatically at `data/job-hunt-vibe.sqlite`.

## Usage

### Dashboard

The main dashboard has a three-column layout:

1. **Left Sidebar** - Actions: Upload Resume, Find Now, Filters, Export
2. **Middle** - Scrollable list of matched jobs
3. **Right** - Full job details with Generate Cover Letter and Mark Applied buttons

### Bookmarklet Setup

1. Open the app and look for bookmarklet instructions in Settings
2. Drag the "Add to Job Hunt" link to your bookmarks bar
3. Browse to any job posting (LinkedIn, Indeed, company careers page)
4. Highlight the job description text (optional but recommended)
5. Click the bookmarklet to add the job

**Important**: For deployed apps, update the API URL in the bookmarklet.

### Application Tracker

Navigate to `/tracker` to access the Kanban board:

- **7 columns**: Applied → Got OA → Interview R1-R4 → Got Offer
- **Drag and drop** cards between columns
- Each card shows company, title, location, and external link

## Deployment

### Vercel (Recommended)

1. Click the "Deploy with Vercel" button above
2. Add your environment variables in Vercel's dashboard
3. Deploy!

### Manual Deployment

```bash
# Build for production
npm run build

# The output is in .next/
# Deploy to your preferred platform
```

### GitHub Actions (Daily Job Fetch)

The repository includes a GitHub Actions workflow that runs daily at 08:00 America/Chicago:

1. Go to Settings → Secrets and add:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `GEMINI_KEY`
   - `VERCEL_APP_URL` (your deployed app URL)

2. The workflow will:
   - Archive jobs older than 24 hours
   - Purge archives older than 7 days
   - Trigger job scoring


## Configuring Job Sources (Phase 12)

To enable the automated job finder, you need API keys for the job aggregators.

### 1. Adzuna (Primary Source)
- **Sign up**: [developer.adzuna.com](https://developer.adzuna.com/)
- **Get Keys**: Create an app to get your `App ID` and `App Key`.
- **Env**: Add to `.env.local`:
  ```bash
  ADZUNA_APP_ID=your_id
  ADZUNA_API_KEY=your_key
  ```

### 2. USAJOBS
- **Sign up**: [developer.usajobs.gov](https://developer.usajobs.gov/)
- **Get Key**: Request an API key.
- **Env**: `USAJOBS_API_KEY=your_key`

### 3. Jooble, Careerjet, ZipRecruiter (Secondary)
- **Jooble**: [jooble.org/api/about](https://jooble.org/api/about)
- **Careerjet**: [careerjet.com/partners/api/](https://www.careerjet.com/partners/api/)
- **ZipRecruiter**: [ziprecruiter.com/publishers](https://www.ziprecruiter.com/publishers/program-overview)
- **Env**: Add `JOOBLE_KEY`, `CAREERJET_KEY`, `ZIPRECRUITER_KEY` respectively.

### 4. ATS Polling (Greenhouse/Lever)
- No keys required.
- The system polls public JSON endpoints for companies defined in `src/lib/job-sources/ats.ts`.
- Customize the `targetCompanies` list in code directly for now.

## Tech Stack


- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Custom CSS
- **State**: Zustand
- **Database**: Supabase (PostgreSQL) / SQLite
- **AI**: Google Gemini Pro
- **Drag & Drop**: dnd-kit
- **PDF**: pdf-parse, jsPDF

## Project Structure

```
job-hunt-vibe/
├── src/
│   ├── app/           # Next.js App Router pages & API routes
│   ├── components/    # React components
│   ├── lib/           # Utilities, DB, Gemini client
│   ├── store/         # Zustand state management
│   └── types/         # TypeScript type definitions
├── supabase/          # Database migrations
├── public/            # Static assets, bookmarklet
└── .github/           # GitHub Actions workflows
```

---

## ⚠️ Legal Notice

### Scraping Policy

**This application does NOT automatically scrape any website.** 

- ❌ No server-side scraping of LinkedIn, Indeed, Glassdoor, or any restricted sites
- ❌ No stored request logs or raw HTML beyond transient processing
- ✅ Uses bookmarklet for manual job clipping (user-initiated)
- ✅ Respects robots.txt and site terms of service

### Data Sources

The app relies on:
- **User-submitted jobs** via bookmarklet
- **Public RSS feeds** (if configured)
- **Manual entry**

You are responsible for:
- Respecting the terms of service of any site you bookmark from
- Only using the bookmarklet for personal, non-commercial use
- Not using this tool to circumvent any access restrictions

### Your Data

- All data is stored in YOUR Supabase instance or local SQLite
- No data is shared with external services except for Gemini API calls (resume parsing, job scoring, cover letter generation)
- Gemini API calls send only the necessary text content

---

## Troubleshooting

### AI Provider Configuration

The app uses a multi-tier AI provider fallback system:

1. **Gemini A** (default) - Primary provider
2. **Gemini B** - First fallback  
3. **OpenRouter** - Second fallback
4. **HuggingFace** - Third fallback (rate limited)

To switch provider priorities, modify `src/lib/ai-router.ts`:
```typescript
const PROVIDER_PRIORITY = ['gemini-a', 'gemini-b', 'openrouter', 'huggingface'];
```

### Input Truncation Limits

To adjust input truncation (for long job descriptions):
```typescript
// In src/lib/adapters/ollama.ts
export const INPUT_LIMITS = {
    JOB_TEXT: 6000,      // Max chars for job description
    RESUME_TEXT: 8000,   // Max chars for resume JSON
    LINKEDIN_TEXT: 4000, // Max chars for LinkedIn data
};
```

### Log Locations

| Log File | Description |
|----------|-------------|
| `logs/ai-providers.log` | AI provider usage, tokens, latency, errors |
| Terminal output | Real-time debug logs |

### Tailored Resume Feature

- **Drafts saved to**: `data/resumes/<user-id>/`
- **PDF filename**: `marvin_chaudhary_resume.pdf`
- **Rate limit**: 20 requests/day per user

---

## Contributing

This is a single-user personal project. Feel free to fork and customize!

## License

MIT License - See [LICENSE](LICENSE) for details.

---

Built with ❤️ for job seekers pursuing their dream software engineering roles.
