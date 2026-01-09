# Aladdin - The Job Finder 🧞‍♂️

> AI-powered job search companion for entry-level software engineering roles. Your wish for the perfect job starts here.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14+-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)

## ✨ Features

### 🎯 Smart Job Matching
- **AI-powered scoring** using your resume and LinkedIn profile
- **Zero-tolerance cleanup filter** that removes Senior/Lead roles and non-CS positions
- **Precise match scores** (73, 86, not rounded to 70, 80)

### 📄 Resume & Profile Management
- **PDF Resume Parsing** - Auto-extract skills, experience, and education
- **LinkedIn Profile Upload** - Import your professional data
- **Tailored Resume Editor** - Two-panel live editor with keyword optimization

### ✉️ AI Cover Letter Generator
- **Fully editable** cover letters with real-time preview
- **PDF export** with your exact edits preserved
- **Company-specific** and role-tailored content

### 📋 Ultra-Smooth Kanban Tracker
- **7-column board**: Applied → Got OA → Interview R1-R4 → Got Offer
- **Butter-smooth drag-and-drop** with zero resistance (3px activation)
- **Visual feedback** with scale animations and drop zone highlights

### 🔖 Job Import Tools
- **Bookmarklet** - Clip jobs from LinkedIn, Indeed, or any job site
- **Manual Import** - Paste job descriptions directly

### 🌙 Premium Dark Theme
- Beautiful, eye-friendly interface
- Glassmorphism effects
- Smooth animations

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+**
- **Supabase account** (free tier works) OR set `USE_SQLITE=true` for local dev
- **OpenRouter API key** (for Gemini Flash 1.5 - primary AI)
- **Ollama** (optional, local fallback AI)

### Installation

```bash
# Clone the repository
git clone https://github.com/Marvyn007/Aladdin.git
cd Aladdin

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your credentials
# Then start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to start finding jobs!

---

## ⚙️ Configuration

### Environment Variables

Create a `.env.local` file with the following:

```bash
# Database (choose one)
USE_SQLITE=true                    # Local SQLite (recommended for dev)
# OR
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

# AI Providers (OpenRouter-first architecture)
OPENROUTER_API_KEY=your_key        # Primary (Gemini Flash 1.5)
GEMINI_KEY_A=your_gemini_key       # Backup (optional)
GEMINI_KEY_B=your_gemini_key_2     # Backup 2 (optional)

# Ollama (local AI fallback - optional)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=phi3:mini

# Rate Limits (optional)
OPENROUTER_MAX_CALLS_PER_DAY=50
```

### Database Setup

#### Option 1: SQLite (Recommended for Development)

Set `USE_SQLITE=true` in your `.env.local`. The database will be created automatically at `data/job-hunt-vibe.sqlite`.

#### Option 2: Supabase (Recommended for Production)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the migration from `supabase/migrations/001_init.sql`
3. Copy your project URL and anon key to `.env.local`

---

## 📖 Usage Guide

### Main Dashboard

**Three-column layout:**

1. **Left Sidebar**
   - Upload Resume (PDF)
   - Upload LinkedIn Profile (PDF)
   - Find Jobs (AI cleanup + scoring)
   - Import Job (from any site)
   - Settings

2. **Middle Column**
   - Scrollable list of matched jobs
   - Match scores (color-coded)
   - Skill badges

3. **Right Column**
   - Full job details
   - Generate Cover Letter
   - Generate Tailored Resume
   - Mark as Applied

### Application Tracker (Kanban Board)

Navigate to `/tracker` or click the tracker icon to access the Kanban board.

**Features:**
- Drag cards between columns with ultra-smooth animations
- Visual drop zone feedback
- Track your application pipeline

**Columns:**
1. Applied
2. Got OA (Online Assessment)
3. Interview R1
4. Interview R2
5. Interview R3
6. Interview R4
7. Got Offer

### Bookmarklet Setup

1. Open the app and look for bookmarklet in sidebar
2. Drag the "Add to Aladdin" link to your bookmarks bar
3. Browse to any job posting
4. Click the bookmarklet to import the job

---

## 🧠 AI Cleanup Logic

Aladdin uses a **RUTHLESS, ZERO-TOLERANCE** filter to ensure only relevant jobs survive:

### DELETE BY DEFAULT Philosophy
- If there's ANY ambiguity or doubt → DELETE
- False negatives (missing good jobs) are acceptable
- False positives (keeping bad jobs) are NOT acceptable

### Exclusion Rules

**❌ Non-CS Fields (Auto-Delete):**
- Healthcare, Finance, HR, Sales, Marketing, Operations, Legal, etc.

**❌ Seniority Keywords (Auto-Delete):**
- Senior, Sr., Lead, Principal, Staff, Manager, Director, VP, Architect, etc.

**❌ Experience Requirements:**
- Anything requiring >2 years is deleted

**❌ Specialized Roles:**
- DevOps (unless "Junior DevOps"), SRE, Cybersecurity, Data Scientist, Embedded, etc.

**✅ ONLY Keep:**
- Intern, Entry Level, Junior, New Grad, Associate
- Software Engineer, Developer, Full Stack, Frontend, Backend, Web Dev, Mobile Dev

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **Styling**: Vanilla CSS with CSS Variables
- **State**: Zustand
- **Database**: Supabase (PostgreSQL) / SQLite
- **AI**: 
  - Primary: OpenRouter (Gemini Flash 1.5)
  - Fallback: Ollama (phi3:mini)
- **Drag & Drop**: @dnd-kit/core
- **PDF**: pdf-parse, jsPDF

---

## 📁 Project Structure

```
Aladdin/
├── src/
│   ├── app/              # Next.js pages & API routes
│   │   ├── api/          # Backend endpoints
│   │   ├── tracker/      # Kanban board page
│   │   └── page.tsx      # Main dashboard
│   ├── components/
│   │   ├── layout/       # Sidebar, JobList, JobDetail
│   │   └── modals/       # CoverLetter, Resume, Import
│   ├── lib/
│   │   ├── ai-router.ts  # Multi-provider AI routing
│   │   ├── gemini.ts     # AI client functions
│   │   ├── db.ts         # Database abstraction
│   │   └── job-sources/  # Job API integrations
│   ├── store/            # Zustand state
│   └── types/            # TypeScript definitions
├── supabase/             # Database migrations
├── public/               # Static assets
└── data/                 # SQLite database (gitignored)
```

---

## 🚨 Important Notes

### Data Privacy
- All data is stored in YOUR Supabase instance or local SQLite
- No data is shared except for AI API calls (OpenRouter/Gemini)
- API calls only send necessary text content (job descriptions, resumes)

### Legal Compliance
- This app does NOT automatically scrape any website
- Bookmarklet is user-initiated and for personal use only
- Respects robots.txt and site terms of service
- You are responsible for complying with job sites' terms when using the bookmarklet

### Sensitive Data
- Never commit `.env.local` or `.env` files
- SQLite databases (`.db`, `.sqlite`) are gitignored
- Logs and error files are gitignored

---

## 🐛 Troubleshooting

### AI Provider Issues
Check the AI status at `/api/debug/ai-status`:
```json
{
  "activeProvider": "openrouter",
  "models": {
    "google/gemini-flash-1.5": "healthy",
    "anthropic/claude-3-haiku": "healthy"
  }
}
```

### Build Errors
Check `build_error.log` (gitignored) for detailed error traces.

### Database Issues
- **SQLite**: Ensure `data/` directory exists
- **Supabase**: Verify URL and Key in `.env.local`

---

## 🤝 Contributing

This is a personal project, but feel free to:
- Fork and customize for your needs
- Submit issues for bugs
- Suggest features via GitHub Issues

---

## 📜 License

MIT License - See [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

Built with inspiration from:
- Linear's smooth drag-and-drop UX
- Notion's clean design aesthetic
- The struggles of every entry-level software engineer job hunt

---

**Built with ❤️ for job seekers pursuing their dream software engineering roles.**

*Your wish for the perfect job starts here.* 🧞‍♂️
