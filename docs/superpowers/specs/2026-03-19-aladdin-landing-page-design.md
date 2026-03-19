# Aladdin Landing Page — Design Spec

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

A standalone Next.js 14 marketing website for Aladdin — a community-powered job board and AI application suite for software engineers. Deployed separately from the main app (which lives at something like `app.aladdin.com`). The landing page lives at the root domain (`aladdin.com` or equivalent).

**Core value proposition:**
*Devs share real jobs. AI helps you apply. The community helps you prep.*

**Target audience:** Software engineers at any level looking for jobs — particularly those tired of fragmented job hunting across multiple tools.

---

## Aesthetic

### Direction: Warm Editorial (Premium Tier)
- **Base palette:** Cream/warm white (`#faf8f4`) backgrounds, warm dark brown text (`#37352f`)
- **Primary accent:** Rich blue (`#2383e2`) for CTAs and highlights, with hover state `#0b6bcb`
- **Secondary accent:** Subtle warm gold/amber for premium touches (`#d4a853`)
- **Surface elevation:** White cards on cream base; subtle `box-shadow` depth
- **Dark hero variant:** The main hero section uses a deep warm dark (`#1a1814`) for contrast and drama, transitioning to cream for the rest of the page
- **Typography:**
  - Display/headlines: `Playfair Display` (Google Fonts) — elegant serif with editorial weight
  - Body/UI: `DM Sans` (Google Fonts) — modern, warm grotesque; pairs beautifully with Playfair
  - Monospace accents (stats, badges): `JetBrains Mono`
- **Borders:** `rgba(55, 53, 47, 0.10)` — warm, barely visible
- **Border radius:** 12px cards, 8px buttons, 20px large cards
- **Shadows:** Layered warm shadows (`0 4px 24px rgba(55,53,47,0.08)`)
- **Animation:** Subtle scroll-triggered fade-in-up animations (Intersection Observer); hover lift on cards; smooth CTA pulse

### Premium Details
- Subtle grain/noise texture overlay on dark sections (CSS SVG filter)
- Gradient mesh in hero background
- Floating "glow" blobs behind product screenshots
- Company logos in a slow-scrolling marquee
- Feature cards with icon + micro-animation on hover

---

## Page Structure

### 1. Navigation
- Fixed, glassmorphic navbar (`backdrop-filter: blur` on scroll)
- Left: Aladdin logo (`/public/aladdin-logo.png`)
- Center: `Features` · `How It Works` · `Interview Prep` · `Jobs Map`
- Right: `Sign In` (ghost) + `Get Started Free` (primary CTA button)
- Collapses to hamburger on mobile

### 2. Hero Section
- **Dark background** (`#1a1814`) with grain texture and gradient mesh
- Pill badge above headline: `✦ Community-powered · AI-enhanced`
- **Headline (Playfair Display, 72px):** "The smartest way to find and land your next dev job."
- **Subtext (DM Sans, 20px):** "Aladdin is a community-built job board with AI tools to tailor your resume, generate cover letters, and track every application — all in one place."
- Two CTAs: `Get Started Free →` (primary blue) + `See How It Works` (ghost)
- Social proof micro-line below CTAs: "Joined by developers from Microsoft, Meta, DeepMind and more"
- **Hero visual:** Browser mockup / framed screenshot of the main job board UI (`gallery 1.jpg` or `gallery 2.png`), with a warm glow behind it. Slightly angled/tilted for depth.

### 3. Company Logo Marquee
- Seamlessly looping horizontal scroll of company logos from `/public/logos/`
- Label above: "Jobs from top companies, shared by real developers"
- Logos: Microsoft, Meta, DeepMind, HuggingFace, Visa, AMD, ExxonMobil, Berkshire
- Soft fade masks on left and right edges

### 4. Problem / Empathy Section
- Cream background
- Large quote-style headline: "Job hunting is exhausting. It doesn't have to be."
- 3-column pain point cards (icon + text):
  - "10 different tabs open just to find jobs" → **One community board**
  - "Writing cover letters from scratch every time" → **AI writes them in 1 click**
  - "No idea what the interview will be like" → **Real experiences from real devs**

### 5. Stats Bar
- Full-width warm dark strip (`#2a2520`)
- 4 animated count-up stats (IntersectionObserver triggers count):
  - `5,000+` — Jobs in the database
  - `1-click` — Cover letter generation
  - `7 stages` — Kanban application tracking
  - `Community` — Interview experiences by company
- Stats displayed in `JetBrains Mono` for technical feel

### 6. How It Works (3 Steps)
- Cream background, centered
- Section label: `HOW IT WORKS`
- Headline: "From discovery to offer, in three steps."
- 3 large numbered steps with icon, title, and description:
  1. **Discover Jobs** — Browse or search community-imported jobs. Filter by title, skills, location, or company. See all jobs on an interactive map.
  2. **Apply with AI** — Generate a tailored resume and cover letter in one click. Edit in the built-in editor. Download as PDF.
  3. **Track & Prepare** — Mark jobs as Applied to add them to your Kanban board. Read community interview experiences to walk in prepared.
- Visual connector line between steps

### 7. Feature 1 — Community Job Board
- Text on left, screenshot on right (`gallery 2.png` or `gallery 3.png`)
- Label: `DISCOVER`
- Headline: "Real jobs, shared by real developers."
- Body: "Every job on Aladdin was imported by a community member. Importers earn reputation points and can correct job details. Search across title, company, location, skills, or anything in the description."
- Bullet highlights: Community reputation system · Keyword search across all fields · Save jobs for later · Jobs visible on interactive map

### 8. Feature 2 — AI Application Tools
- Text on right, screenshot on left (`gallery 4.png` or `gallery 5.png`)
- Label: `APPLY SMARTER`
- Headline: "Your resume and cover letter, tailored to every job."
- Body: "Upload your resume and optionally your LinkedIn profile. With one click, Aladdin generates a tailored cover letter and resume for the specific job. Edit it in the built-in editor, then download as PDF."
- Bullet highlights: AI cover letter generation · Tailored resume per job · Live two-panel resume editor · PDF export

### 9. Feature 3 — Application Tracker + Interview Prep
- Text on left, screenshot on right (`gallery 6.png` or `gallery 7.png`)
- Label: `TRACK & PREPARE`
- Headline: "Track every application. Walk into every interview prepared."
- Body: "Hit 'Applied?' and the job moves into your personal Kanban board — from Applied through Offer. Browse community interview experiences by company so you know exactly what to expect."
- Bullet highlights: 7-column Kanban board · Drag-and-drop tracking · Interview experiences by company · Salary and review aggregates

### 10. Jobs Map Feature Callout
- Full-bleed dark section with a blurred map screenshot as background (`gallery 8.png`)
- Overlay text: "See where the opportunities are."
- Subtext: "Every job in the Aladdin database is plotted on an interactive map. Spot clusters, explore by region, and find roles near you."
- CTA: `Explore the Map →`

### 11. Testimonials
- Cream background, 3-column card layout
- 3 fictional-but-realistic quotes from junior devs (placeholder until real ones collected):
  - Quote about community job sharing
  - Quote about AI cover letter saving time
  - Quote about the Kanban tracker + interview prep combo
- Cards: avatar circle (initials), name, title ("Software Engineer", "CS Graduate 2025"), quote

### 12. Final CTA Section
- Dark warm background (`#1a1814`) with grain + gradient glow
- Large Playfair headline: "Your next job is already on Aladdin."
- Subtext: "Join the community. Import jobs. Apply smarter. Land the role."
- Two buttons: `Get Started Free →` (large, primary) + `Sign In` (ghost)
- Below buttons: "No credit card required · Free to use"

### 13. Footer
- 4-column layout: Logo + tagline | Product links | Community | Legal
- Tagline: "Built by developers, for developers."
- Social links

---

## Technical Spec

### Project Setup
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + custom CSS variables for brand tokens
- **Fonts:** Google Fonts — `Playfair Display` (400, 700, 900) + `DM Sans` (400, 500, 700) + `JetBrains Mono` (400)
- **Animations:** CSS transitions + Intersection Observer for scroll reveals; count-up for stats
- **Location:** New standalone Next.js project at a sibling directory (e.g., `Desktop/aladdin-landing/`)
- **Assets:** Copy relevant assets from the main app's `/public/` folder — gallery images, logos, aladdin-logo.png

### File Structure
```
aladdin-landing/
├── app/
│   ├── layout.tsx          # Root layout, fonts, metadata
│   ├── page.tsx            # Landing page (imports all sections)
│   └── globals.css         # CSS variables, base styles
├── components/
│   ├── Navbar.tsx
│   ├── Hero.tsx
│   ├── LogoMarquee.tsx
│   ├── ProblemSection.tsx
│   ├── StatsBar.tsx
│   ├── HowItWorks.tsx
│   ├── FeatureSection.tsx  # Reusable, accepts props for flip/content
│   ├── MapCallout.tsx
│   ├── Testimonials.tsx
│   ├── CTASection.tsx
│   └── Footer.tsx
├── public/
│   ├── gallery/            # Copied from main app
│   └── logos/              # Copied from main app
├── package.json
└── tailwind.config.ts
```

### Responsive Breakpoints
- Mobile first: single column, stacked sections
- Tablet (≥768px): 2-column where applicable
- Desktop (≥1280px): Full layout with side-by-side features

### Performance
- Next.js `Image` component for all screenshots (automatic WebP + lazy loading)
- Fonts loaded via `next/font/google`
- Marquee animation via CSS only (no JS library)

---

## Content Notes
- All copy is placeholder-quality but production-intent — designed to be edited
- Gallery screenshots are used as-is from the main app's `/public/` directory
- Company logos (`/public/logos/`) are used in the marquee to show real companies whose jobs appear on the board
- Stats are approximate/aspirational — replace with real numbers before launch
- Testimonials are illustrative — replace with real user quotes before launch
