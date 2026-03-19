# Aladdin Landing Page — Design Spec

**Date:** 2026-03-19
**Status:** Approved

---

## Overview

A standalone Next.js 14 marketing website for Aladdin — a community-powered job board and AI application suite for software engineers. Deployed separately from the main app (which lives at `app.aladdin.com`). The landing page lives at the root domain (`aladdin.com`).

**Core value proposition:**
*Devs share real jobs. AI helps you apply. The community helps you prep.*

**Target audience:** Software engineers looking for jobs — particularly those frustrated by fragmented job hunting across multiple tools.

---

## Confirmed Assets

### Gallery Images (from main app `/public/`, copied to `aladdin-landing/public/gallery/`)
Note: filenames contain spaces — URL-encode as `%20` in `src` props, or rename on copy.
- `gallery 1.jpg` → hero screenshot (main job board UI)
- `gallery 2.png` → job list / community board view (Feature 1)
- `gallery 3.png` → job detail / search results (Feature 1 alternative)
- `gallery 4.png` → cover letter or resume editor (Feature 2)
- `gallery 5.png` → tailored resume view (Feature 2 alternative)
- `gallery 6.png` → Kanban board (Feature 3)
- `gallery 7.png` → interview experiences tab (Feature 3 alternative)
- `gallery 8.png` → jobs map (Map Callout background)

**Implementation note:** Rename files on copy to remove spaces (e.g., `gallery-1.jpg`, `gallery-2.png`, etc.) so Next.js `<Image>` works without URL encoding.

### Logo Images (from main app `/public/logos/`, copied to `aladdin-landing/public/logos/`)
- `microsoft.png`
- `meta.png`
- `deepmind.jpg`
- `huggingface.png`
- `visa.png`
- `amd.png`
- `exxonmobil.png`
- `berkshire.png`

### Brand Assets
- `aladdin-logo.png` — confirmed present in main app `/public/aladdin-logo.png`

---

## Aesthetic

### Direction: Warm Editorial (Premium Tier)

**Color tokens** (define as CSS variables in `globals.css`):
```css
--color-bg: #faf8f4;          /* cream base */
--color-bg-dark: #1a1814;     /* hero/CTA dark */
--color-bg-dark-2: #2a2520;   /* stats bar */
--color-surface: #ffffff;      /* card surfaces */
--color-text-primary: #37352f;
--color-text-secondary: #5a5754;
--color-text-muted: #8a8884;
--color-text-on-dark: #f5f2ed;
--color-accent: #2383e2;
--color-accent-hover: #0b6bcb;
--color-accent-gold: #d4a853;
--color-border: rgba(55, 53, 47, 0.10);
```

**Typography:**
- Display/headlines: `Playfair Display` — weights 400, 700, 900 (Google Fonts via `next/font/google`)
- Body/UI text: `DM Sans` — weights 400, 500, 700 (Google Fonts via `next/font/google`)
- Monospace accents (stats, badges): `JetBrains Mono` — weight 400 only (Google Fonts via `next/font/google`)

**Type scale:**
- Hero headline: `Playfair Display`, 72px desktop / 40px mobile, weight 900, line-height 1.1
- Section headline: `Playfair Display`, 48px desktop / 32px mobile, weight 700
- Feature headline: `Playfair Display`, 36px desktop / 28px mobile, weight 700
- Body large: `DM Sans`, 20px, weight 400
- Body: `DM Sans`, 16px, weight 400
- Label: `DM Sans`, 12px, weight 700, letter-spacing 2px, uppercase
- Stats: `JetBrains Mono`, 48px desktop / 32px mobile, weight 400

**Spacing & shape:**
- Border radius: 8px (buttons), 12px (cards), 20px (large cards / feature panels)
- Card shadow: `0 4px 24px rgba(55, 53, 47, 0.08), 0 1px 4px rgba(55, 53, 47, 0.06)`
- Section padding: `120px 0` desktop / `72px 0` mobile
- Max content width: `1200px`, centered with `margin: 0 auto; padding: 0 24px`

**Visual effects:**

*Grain texture (dark sections only):*
```css
/* Apply to dark section ::after pseudo-element */
background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
opacity: 0.04;
position: absolute; inset: 0; pointer-events: none;
```

*Hero gradient mesh:*
```css
background:
  radial-gradient(ellipse 80% 50% at 20% 40%, rgba(35, 131, 226, 0.15) 0%, transparent 60%),
  radial-gradient(ellipse 60% 40% at 80% 60%, rgba(212, 168, 83, 0.08) 0%, transparent 60%),
  #1a1814;
```

*Glow blobs behind product screenshots:*
```css
/* Positioned absolutely behind the <Image> wrapper */
background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(35, 131, 226, 0.25) 0%, transparent 70%);
filter: blur(40px);
```

*Hero-to-cream transition:* The `<Hero>` component ends with a `div` styled as:
```css
position: absolute; bottom: 0; left: 0; right: 0; height: 120px;
background: linear-gradient(to bottom, transparent, #faf8f4);
```
This sits inside the dark hero section and visually fades into the next cream section.

**Animations:**
- Scroll reveal: `opacity: 0; transform: translateY(24px)` → `opacity: 1; transform: translateY(0)` via Intersection Observer, `transition: 0.6s ease`. Applied to section headlines, feature blocks, and cards with staggered `transition-delay` (0ms, 100ms, 200ms per item).
- Card hover: `transform: translateY(-4px); box-shadow: 0 12px 40px rgba(55,53,47,0.12)`
- CTA primary button hover: `background: var(--color-accent-hover); transform: translateY(-1px)`
- Logo marquee: CSS-only infinite scroll animation (no JS library)

---

## Page Structure

### 1. Navigation
**Component:** `Navbar.tsx`
- `position: fixed; top: 0; left: 0; right: 0; z-index: 100` — stays visible at top of viewport at all times
- Background: `transparent` initially; on scroll adds `background: rgba(250,248,244,0.85); backdrop-filter: blur(12px); border-bottom: 1px solid var(--color-border)`
- Scroll detection: JS `window.addEventListener('scroll', ...)` adds `.scrolled` class at `scrollY > 40`
- **Left:** `<Image src="/aladdin-logo.png" width={120} height={32} alt="Aladdin" />`
- **Center (desktop):** nav links — `Features`, `How It Works`, `Interview Prep`, `Jobs Map` — all `href="#"` anchors linking to section IDs (`#features`, `#how-it-works`, `#interview-prep`, `#map`)
- **Right:** `Sign In` ghost link → `href="https://app.aladdin.com/sign-in"` | `Get Started Free` button → `href="https://app.aladdin.com/signup"`
- **Mobile:** hamburger icon (Lucide `Menu`). Clicking opens a full-width dropdown drawer (slides down from top). Use `max-height: 0` → `max-height: 500px` (NOT `auto` — CSS cannot interpolate to `auto`) with `overflow: hidden; transition: max-height 0.3s ease`. Drawer shows all nav links stacked + both CTAs. Close on link click or outside tap. Toggle via React `useState` bool.

### 2. Hero Section
**Component:** `Hero.tsx`
- Background: gradient mesh + grain texture (see Aesthetic)
- `min-height: 100vh`, `display: flex; align-items: center`
- Content max-width 700px centered left on desktop, centered on mobile
- **Pill badge:** `✦ Community-powered · AI-enhanced` — small rounded pill, `border: 1px solid rgba(255,255,255,0.15)`, white text 12px `DM Sans`
- **Headline:** "The smartest way to find and land your next dev job." — `Playfair Display` 72px, color `#f5f2ed`
- **Subtext:** "Aladdin is a community-built job board with AI tools to tailor your resume, generate cover letters, and track every application — all in one place." — `DM Sans` 20px, color `rgba(245,242,237,0.7)`
- **CTAs:**
  - Primary: `Get Started Free →` → `href="https://app.aladdin.com/signup"`, blue fill button
  - Secondary: `See How It Works` → smooth scroll to `#how-it-works`, ghost button with white border
- **Social proof line:** "Trusted by developers at Microsoft, Meta, DeepMind and more" — 14px, muted white
- **Hero visual:** Right side of hero (desktop) / below copy (mobile). A `div` with `border-radius: 16px; overflow: hidden; box-shadow: 0 40px 80px rgba(0,0,0,0.4)` wrapping `<Image src="/gallery/gallery-1.jpg" width={700} height={420} alt="Aladdin job board" priority />`. Glow blob positioned absolutely behind it.
- **Bottom fade:** gradient fade from `#1a1814` to `#faf8f4` (see Aesthetic)

### 3. Company Logo Marquee
**Component:** `LogoMarquee.tsx`
- Cream background
- Label above (centered): "Jobs from top companies, shared by real developers" — 14px `DM Sans`, muted
- Marquee strip: two identical sets of logos side by side for seamless loop. CSS `@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`, `animation: marquee 30s linear infinite`
- Each logo: `<Image width={120} height={32} style={{ width: 'auto', height: '32px', objectFit: 'contain' }} alt="..." />`. Use numeric `width` and `height` props (required by `next/image`); the CSS `style` overrides constrain the rendered size correctly. Do NOT use `width={auto}` — that is invalid JSX and will throw a build error.
- Fade mask: `::before` and `::after` pseudo-elements with left/right gradient masks (`linear-gradient(to right, #faf8f4, transparent)` and reverse)
- Logo order: `microsoft.png`, `meta.png`, `deepmind.jpg`, `huggingface.png`, `visa.png`, `amd.png`, `exxonmobil.png`, `berkshire.png`
- Logo images: grayscale via CSS `filter: grayscale(1) opacity(0.5)`, hover → `filter: grayscale(0) opacity(1)`, `transition: filter 0.3s`

### 4. Problem / Empathy Section
**Component:** `ProblemSection.tsx`
- Cream background, `id="features"`
- Centered heading: "Job hunting is exhausting. It doesn't have to be." — `Playfair Display` 48px
- Sub-headline: "Devs waste hours across 10 different tools. Aladdin brings everything into one place." — `DM Sans` 20px muted
- 3-column card grid (stacks to 1 col on mobile):
  1. Icon: `📂` | Pain: "Scattered across 10 job sites" | Solution: "One community board with all jobs in one place"
  2. Icon: `✍️` | Pain: "Cover letters from scratch, every time" | Solution: "AI generates a tailored cover letter in one click"
  3. Icon: `🎤` | Pain: "No idea what the interview will look like" | Solution: "Real interview experiences from the community"
- Cards: white surface, 20px radius, warm shadow, hover lift animation

### 5. Stats Bar
**Component:** `StatsBar.tsx`
- Background: `#2a2520`, full width, `padding: 64px 0`
- 4 stats in a row (2×2 grid on mobile), each with animated count-up on scroll into view:
  1. `5,000+` | "Jobs in the database"
  2. `1-click` | "AI cover letter + resume"
  3. `7 stages` | "Kanban pipeline (Applied → Offer)"
  4. `100+` | "Community interview experiences"
- Stat number: `JetBrains Mono` 48px, color `#f5f2ed`
- Label: `DM Sans` 14px, color `rgba(245,242,237,0.6)`
- Dividers: `1px solid rgba(255,255,255,0.08)` between items (hidden on mobile)
- Count-up animation: triggered by Intersection Observer; use a simple JS counter from 0 to target over 1.5s with `requestAnimationFrame`; non-numeric stats (`1-click`, `7 stages`, `100+`) animate a fade-in only

### 6. How It Works
**Component:** `HowItWorks.tsx`, `id="how-it-works"`
- Cream background, centered content
- Section label: `HOW IT WORKS` — 12px `DM Sans` uppercase, blue, letter-spacing 2px
- Headline: "From discovery to offer, in three steps." — `Playfair Display` 48px
- 3 steps in a horizontal row (stacks vertically on mobile), connected by a dashed line:
  1. Number `01` (gold accent) | Icon: Lucide `Search` | **Discover Jobs** | "Browse or search community-imported jobs by title, skills, company, or location. Or explore all jobs on the interactive map."
  2. Number `02` | Icon: Lucide `Sparkles` | **Apply with AI** | "Generate a tailored cover letter and resume in one click. Edit both in the built-in editor and download as PDF."
  3. Number `03` | Icon: Lucide `LayoutDashboard` | **Track & Prepare** | "Mark jobs as Applied to move them into your Kanban board. Read community interview experiences so you walk in prepared."
- Connector: horizontal `border-top: 2px dashed rgba(55,53,47,0.15)` line between step numbers (desktop only, hidden on mobile)
- Step number: `JetBrains Mono` 14px, gold color (`#d4a853`)

### 7. Feature 1 — Community Job Board
**Component:** `FeatureSection.tsx` with `flip={false}` (text left, image right)
- Cream background, `id="features-community"`
- Section label: `DISCOVER`
- Headline: "Real jobs, shared by real developers."
- Body: "Every job on Aladdin was imported by a community member. Importers earn reputation points and can correct job details if something's inaccurate. Search across title, company, location, skills, or anything in the description — and save jobs to revisit later."
- Bullet points (checkmark icon, blue):
  - Community reputation system for importers
  - Keyword search across all job fields
  - Save jobs for later
  - All jobs plotted on interactive map
- Image: `<Image src="/gallery/gallery-2.png" width={640} height={400} alt="Aladdin job board" />` with glow blob behind

### 8. Feature 2 — AI Application Tools
**Component:** `FeatureSection.tsx` with `flip={true}` (image left, text right)
- Cream background, `id="features-ai"`
- Section label: `APPLY SMARTER`
- Headline: "Your resume and cover letter, tailored to every job."
- Body: "Upload your resume and optionally your LinkedIn profile. With one click, Aladdin generates a cover letter and tailored resume for the specific job. Edit both in the live two-panel editor, then download as PDF — ready to send."
- Bullet points:
  - AI cover letter in one click
  - Tailored resume per job
  - Live two-panel resume editor
  - PDF export
- Image: `<Image src="/gallery/gallery-4.png" width={640} height={400} alt="AI resume editor" />` with glow blob

### 9. Feature 3 — Application Tracker + Interview Prep
**Component:** `FeatureSection.tsx` with `flip={false}` (text left, image right)
- Cream background, `id="interview-prep"`
- Section label: `TRACK & PREPARE`
- Headline: "Track every application. Walk into every interview prepared."
- Body: "Hit 'Applied?' and the job moves into your personal Kanban board — tracking your progress through 7 stages: Applied, Got OA, Interview R1, R2, R3, R4, and Got Offer. Browse community interview experiences by company to know exactly what to expect."
- Bullet points:
  - 7-column drag-and-drop Kanban board
  - Stages: Applied → Got OA → Interview R1–R4 → Got Offer
  - Interview experiences by company
  - Community salary and review aggregates
- Image: `<Image src="/gallery/gallery-6.png" width={640} height={400} alt="Kanban tracker" />` with glow blob

### 10. Jobs Map Callout
**Component:** `MapCallout.tsx`, `id="map"`
- Full-bleed dark section, `min-height: 500px`, centered content
- Background: `<Image src="/gallery/gallery-8.png" fill style={{ objectFit: 'cover', filter: 'blur(4px) brightness(0.35)' }} alt="" />` (decorative, `aria-hidden`)
- Dark overlay: `position: absolute; inset: 0; background: rgba(26,24,20,0.7)`
- Grain texture overlay (same as hero)
- Content (relative z-index above overlays):
  - Headline: "See where the opportunities are." — `Playfair Display` 48px, white
  - Subtext: "Every job in the Aladdin database is plotted on an interactive map. Spot clusters, explore by region, and discover roles near you." — `DM Sans` 18px, `rgba(245,242,237,0.7)`
  - CTA: `Explore the Map →` button → `href="https://app.aladdin.com/map"`, primary blue button
- Note: `blur` is applied via CSS `filter` on the `<Image>` element, NOT `backdrop-filter`. The image is positioned `absolute fill` inside a `relative` container div.

### 11. Testimonials
**Component:** `Testimonials.tsx`
- Cream background, 3-column grid (stacks on mobile)
- Section label: `WHAT DEVELOPERS SAY`
- Headline: "Helping developers land their next role." — `Playfair Display` 40px
- 3 placeholder cards (replace with real quotes before launch):

  **Card 1:**
  - Avatar initials: `JL`, blue circle
  - Name: Jordan Lee
  - Title: Software Engineer · Class of 2025
  - Quote: "I was spending hours rewriting my cover letter for every job. Aladdin's AI just gets it — one click and it's tailored, professional, and actually sounds like me."

  **Card 2:**
  - Avatar initials: `AR`, gold circle
  - Name: Anika Rodrigues
  - Title: CS Graduate · New Grad Hire at Meta
  - Quote: "The interview experiences section was honestly the best part. I knew exactly what Meta's process looked like before I even walked in. Game changer."

  **Card 3:**
  - Avatar initials: `MS`, teal circle
  - Name: Marcus S.
  - Title: Junior Developer
  - Quote: "I love that jobs come from real devs, not scrapers. The reputation system means the listings are actually accurate. And the Kanban board keeps me from losing track of anything."

- Card design: white surface, 20px radius, warm shadow. Quote in 16px `DM Sans`. Name in `DM Sans` 700.

### 12. Final CTA Section
**Component:** `CTASection.tsx`
- Background: `#1a1814` with grain texture + gradient mesh (same recipe as hero)
- Centered content, `padding: 160px 0`
- Headline: "Your next job is already on Aladdin." — `Playfair Display` 64px, color `#f5f2ed`
- Subtext: "Join the community. Import jobs. Apply smarter. Land the role." — `DM Sans` 22px, `rgba(245,242,237,0.65)`
- Two buttons side by side:
  - `Get Started Free →` → `href="https://app.aladdin.com/signup"` — large primary blue, `padding: 16px 36px`, `font-size: 18px`
  - `Sign In` → `href="https://app.aladdin.com/sign-in"` — ghost with white border
- Below buttons: "No credit card required · Free to use" — 14px `DM Sans`, `rgba(245,242,237,0.4)`

### 13. Footer
**Component:** `Footer.tsx`
- Background: `#141210` (slightly darker than hero dark)
- `padding: 64px 0 32px`
- 4-column grid (collapses to 2-col on tablet, 1-col on mobile):

  **Col 1 — Brand:**
  - `<Image src="/aladdin-logo.png" ... />` (white/light version if available, else standard)
  - Tagline: "Built by developers, for developers."
  - Social icons (Lucide icons or SVG): GitHub → `href="https://github.com"` (placeholder), Twitter/X → `href="#"` (placeholder)

  **Col 2 — Product:**
  - Heading: `PRODUCT`
  - Links: Features, How It Works, Jobs Map, Interview Prep

  **Col 3 — Community:**
  - Heading: `COMMUNITY`
  - Links: Import a Job, Submit Interview Experience, Browse Jobs

  **Col 4 — Legal:**
  - Heading: `LEGAL`
  - Links: Privacy Policy (`href="#"`), Terms of Service (`href="#"`)

- Bottom bar: `border-top: 1px solid rgba(255,255,255,0.08)`, `margin-top: 48px`, `padding-top: 24px`
  - Left: `© 2026 Aladdin. All rights reserved.`
  - Right: "Made with ♥ for developers"
- All footer text: `rgba(245,242,237,0.5)`, 14px `DM Sans`; headings `rgba(245,242,237,0.25)` uppercase 11px

---

## Technical Spec

### Project Setup
- **Framework:** Next.js (App Router, latest stable — use `npx create-next-app@latest`). App Router patterns used throughout are compatible with Next.js 14+.
- **Styling:** Tailwind CSS v4 + CSS variables (defined in `globals.css`) for brand tokens. Tailwind v4 has no `tailwind.config.ts` — configuration is done via `@theme` block inside `globals.css`. Tailwind used for spacing/layout utilities; custom CSS for brand-specific styles.
  - Install: `npm install tailwindcss @tailwindcss/postcss` and add `@import "tailwindcss"` to `globals.css`
  - Custom tokens go in `@theme { }` block in `globals.css`
- **Fonts:** Google Fonts via `next/font/google` — `Playfair_Display` + `DM_Sans` + `JetBrains_Mono`
- **Images:** `next/image` throughout. All `<Image>` components require numeric `width`+`height` props (layout-known) or `fill` (decorative backgrounds with a `position: relative` parent). Include `sizes` prop on all large images.
  - Hero image example: `<Image src="/gallery/gallery-1.jpg" width={700} height={420} sizes="(max-width: 768px) 100vw, 700px" priority alt="Aladdin job board" />`
- **Icons:** Lucide React (`lucide-react` package) for UI icons. No separate icon library needed.
- **No animation library** — all animations via CSS + vanilla JS Intersection Observer
- **`'use client'` directive required** on the following components (they use browser APIs):
  - `Navbar.tsx` — `window.addEventListener` for scroll detection, state for mobile drawer open/close
  - `StatsBar.tsx` — `IntersectionObserver` + `requestAnimationFrame` for count-up animation
  - Any component that uses a `useScrollReveal` hook or similar Intersection Observer hook
  - Purely presentational components (Footer, LogoMarquee, FeatureSection, etc.) do NOT need `'use client'` unless they add interactivity
- **Location:** `C:/Users/iamma/onedrive/desktop/aladdin-landing/` (sibling to the main app)

### Asset Preparation (before scaffolding)
Copy and rename gallery images (remove spaces):
```
gallery 1.jpg  → gallery-1.jpg
gallery 2.png  → gallery-2.png
gallery 3.png  → gallery-3.png
gallery 4.png  → gallery-4.png
gallery 5.png  → gallery-5.png
gallery 6.png  → gallery-6.png
gallery 7.png  → gallery-7.png
gallery 8.png  → gallery-8.png
```
Copy logos as-is (no spaces in names).
Copy `aladdin-logo.png` to `public/`.

### File Structure
```
aladdin-landing/
├── app/
│   ├── layout.tsx          # Root layout, font injection, metadata, globals import
│   ├── page.tsx            # Composes all section components in order
│   └── globals.css         # CSS variables, base resets, marquee keyframe, grain helper
├── components/
│   ├── Navbar.tsx          # Fixed nav with scroll-triggered glass effect + mobile drawer
│   ├── Hero.tsx            # Dark hero with headline, CTAs, screenshot + bottom fade
│   ├── LogoMarquee.tsx     # CSS-only infinite logo scroll
│   ├── ProblemSection.tsx  # 3-col pain point cards
│   ├── StatsBar.tsx        # Dark strip with count-up stats
│   ├── HowItWorks.tsx      # 3-step numbered process with connector
│   ├── FeatureSection.tsx  # Reusable text+image section; accepts: label, headline, body, bullets, imageSrc, imageAlt, flip (boolean)
│   ├── MapCallout.tsx      # Full-bleed dark section with blurred map bg
│   ├── Testimonials.tsx    # 3-column quote cards
│   ├── CTASection.tsx      # Final dark CTA
│   └── Footer.tsx          # 4-column footer
├── public/
│   ├── aladdin-logo.png
│   ├── gallery/
│   │   ├── gallery-1.jpg
│   │   ├── gallery-2.png
│   │   └── ... (gallery-3 through gallery-8)
│   └── logos/
│       ├── microsoft.png
│       ├── meta.png
│       ├── deepmind.jpg
│       └── ... (all 8 logos)
├── next.config.ts
├── package.json
└── tsconfig.json
Note: No `tailwind.config.ts` — Tailwind v4 uses `@theme` inside `globals.css` instead.
```

### Responsive Breakpoints
- **Mobile first** (default): single column, stacked sections, hamburger nav, `font-size` scaled down
- **Tablet** (`md`, ≥768px): 2-column grids where applicable, nav links visible
- **Desktop** (`lg`, ≥1280px): full side-by-side feature sections, 3-col grids, full type scale

### Link Targets Summary
| Element | href |
|---|---|
| Nav: Get Started Free | `https://app.aladdin.com/signup` |
| Nav: Sign In | `https://app.aladdin.com/sign-in` |
| Hero: Get Started Free | `https://app.aladdin.com/signup` |
| Hero: See How It Works | `#how-it-works` (smooth scroll) |
| Map Callout: Explore the Map | `https://app.aladdin.com/map` |
| CTA: Get Started Free | `https://app.aladdin.com/signup` |
| CTA: Sign In | `https://app.aladdin.com/sign-in` |
| Footer: Social GitHub | `https://github.com` (placeholder) |
| Footer: Social Twitter | `#` (placeholder) |
| Footer: Legal links | `#` (placeholder) |

### Performance Notes
- Hero image: `priority` prop on `<Image>` (above the fold)
- Gallery images: no `priority`, lazy loaded
- Logo images: `unoptimized` for `.jpg` logos; standard optimization for `.png`
- Marquee images: set explicit `width` and `height` on each, `object-fit: contain`
