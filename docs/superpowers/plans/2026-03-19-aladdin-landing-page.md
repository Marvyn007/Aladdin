# Aladdin Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **FRONTEND CODE SKILL:** Before writing any component code, invoke the `/frontend-design` skill to guide aesthetic decisions.
>
> **TDD SKILL:** Before implementing any feature with logic, invoke `/superpowers:test-driven-development`.

**Goal:** Build a standalone Next.js marketing landing page for Aladdin — a community-powered job board + AI application suite — at `C:/Users/iamma/onedrive/desktop/aladdin-landing/`.

**Architecture:** A fresh Next.js App Router project with Tailwind v4 and CSS variables for brand tokens. Eleven components compose a 13-section landing page (Nav, Hero, LogoMarquee, ProblemSection, StatsBar, HowItWorks, 3× FeatureSection, MapCallout, Testimonials, CTASection, Footer). Tests use Vitest + @testing-library/react for logic-bearing components and Playwright for E2E navigation behavior.

**Tech Stack:** Next.js (App Router), Tailwind CSS v4, Lucide React, next/font/google (Playfair Display + DM Sans + JetBrains Mono), next/image, Vitest + @testing-library/react, Playwright

---

## File Map

| File | Responsibility |
|------|---------------|
| `app/layout.tsx` | Root layout: font injection via next/font, metadata, globals.css import, body classes |
| `app/page.tsx` | Composes all 11 section components in order |
| `app/globals.css` | CSS variables (`--color-*`), Tailwind v4 `@theme` block, `@keyframes marquee`, grain helper class, base resets |
| `components/Navbar.tsx` | `'use client'` — fixed nav, scroll-triggered glass effect, mobile hamburger drawer |
| `components/Hero.tsx` | Dark hero: gradient mesh, grain, pill badge, headline, two CTAs, screenshot with glow, bottom fade |
| `components/LogoMarquee.tsx` | CSS-only infinite logo scroll with fade masks |
| `components/ProblemSection.tsx` | 3-col pain-point cards on cream background |
| `components/StatsBar.tsx` | `'use client'` — dark strip with IntersectionObserver count-up animation |
| `components/HowItWorks.tsx` | 3 numbered steps with connector line and Lucide icons |
| `components/FeatureSection.tsx` | Reusable text+image section accepting `flip`, `label`, `headline`, `body`, `bullets`, `imageSrc`, `imageAlt` props |
| `components/MapCallout.tsx` | Full-bleed dark section with blurred map background image |
| `components/Testimonials.tsx` | 3-column testimonial cards |
| `components/CTASection.tsx` | Final dark CTA block (same dark treatment as Hero) |
| `components/Footer.tsx` | 4-column footer, social icons, copyright |
| `hooks/useScrollReveal.ts` | `'use client'` — shared Intersection Observer hook for fade-in-up scroll animations |
| `lib/countUp.ts` | Pure count-up animation helper (requestAnimationFrame), no DOM dependency — unit testable |

---

## Task 1: Scaffold the Project

**Files:**
- Create: `C:/Users/iamma/onedrive/desktop/aladdin-landing/` (entire project)
- No test file — scaffolding only

- [ ] **Step 1: Scaffold Next.js app**

```bash
cd "C:/Users/iamma/onedrive/desktop"
npx create-next-app@latest aladdin-landing --typescript --app --no-tailwind --no-src-dir --no-import-alias
cd aladdin-landing
```

Say **No** to the "Would you like to use Tailwind CSS?" prompt if interactive — we install manually below.

- [ ] **Step 2: Install dependencies**

```bash
npm install tailwindcss @tailwindcss/postcss lucide-react
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test
```

- [ ] **Step 3: Configure Tailwind v4**

Create `postcss.config.mjs`:
```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
export default config;
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

Create `vitest.setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Configure Playwright**

```bash
npx playwright install --with-deps chromium
```

Create `playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

Create `e2e/` directory: `mkdir e2e`

- [ ] **Step 6: Add scripts to package.json**

Add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:e2e": "playwright test"
```

- [ ] **Step 7: Copy and rename assets from main app**

```bash
# From the main Aladdin app's public/ folder
# Copy gallery images (rename to remove spaces)
mkdir -p public/gallery public/logos

cp "../aladdin/public/gallery 1.jpg" public/gallery/gallery-1.jpg
cp "../aladdin/public/gallery 2.png" public/gallery/gallery-2.png
cp "../aladdin/public/gallery 3.png" public/gallery/gallery-3.png
cp "../aladdin/public/gallery 4.png" public/gallery/gallery-4.png
cp "../aladdin/public/gallery 5.png" public/gallery/gallery-5.png
cp "../aladdin/public/gallery 6.png" public/gallery/gallery-6.png
cp "../aladdin/public/gallery 7.png" public/gallery/gallery-7.png
cp "../aladdin/public/gallery 8.png" public/gallery/gallery-8.png

# Copy logos
cp "../aladdin/public/logos/microsoft.png" public/logos/
cp "../aladdin/public/logos/meta.png" public/logos/
cp "../aladdin/public/logos/deepmind.jpg" public/logos/
cp "../aladdin/public/logos/huggingface.png" public/logos/
cp "../aladdin/public/logos/visa.png" public/logos/
cp "../aladdin/public/logos/amd.png" public/logos/
cp "../aladdin/public/logos/exxonmobil.png" public/logos/
cp "../aladdin/public/logos/berkshire.png" public/logos/

# Copy brand
cp "../aladdin/public/aladdin-logo.png" public/
```

Note: adjust relative paths if your directory structure differs. Both projects are siblings under `Desktop/`.

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```
Expected: Server starts on http://localhost:3000 with the default Next.js page.

- [ ] **Step 9: Commit scaffold**

```bash
git init  # (if not already initialized by create-next-app)
git add -A
git commit -m "chore: scaffold aladdin-landing Next.js project with Tailwind v4, Vitest, Playwright"
```

---

## Task 2: Global Styles and Layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

> **Invoke `/frontend-design` before writing any styles.**

- [ ] **Step 1: Replace globals.css**

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-bg: #faf8f4;
  --color-bg-dark: #1a1814;
  --color-bg-dark-2: #2a2520;
  --color-surface: #ffffff;
  --color-text-primary: #37352f;
  --color-text-secondary: #5a5754;
  --color-text-muted: #8a8884;
  --color-text-on-dark: #f5f2ed;
  --color-accent: #2383e2;
  --color-accent-hover: #0b6bcb;
  --color-accent-gold: #d4a853;
  --color-border: rgba(55, 53, 47, 0.10);
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  scroll-behavior: smooth;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  -webkit-font-smoothing: antialiased;
}

/* Grain helper — apply to dark section ::after */
.grain::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
  opacity: 0.04;
}

/* CSS-only marquee animation */
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}

/* Scroll reveal — initial state (JS adds .revealed class) */
.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.revealed {
  opacity: 1;
  transform: translateY(0);
}
.reveal-delay-1 { transition-delay: 100ms; }
.reveal-delay-2 { transition-delay: 200ms; }

/* Content wrapper */
.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 24px;
}

/* Section padding */
.section {
  padding: 120px 0;
}
@media (max-width: 768px) {
  .section { padding: 72px 0; }
}

/* Label style */
.label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--color-accent);
}

/* Buttons */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--color-accent);
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  transition: background 0.2s ease, transform 0.2s ease;
  cursor: pointer;
  border: none;
}
.btn-primary:hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  color: var(--color-text-on-dark);
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid rgba(255, 255, 255, 0.25);
  transition: border-color 0.2s ease, background 0.2s ease;
  cursor: pointer;
}
.btn-ghost:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.4);
}

/* Card */
.card {
  background: var(--color-surface);
  border-radius: 20px;
  box-shadow: 0 4px 24px rgba(55, 53, 47, 0.08), 0 1px 4px rgba(55, 53, 47, 0.06);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 40px rgba(55, 53, 47, 0.12);
}
```

- [ ] **Step 2: Update layout.tsx with fonts and metadata**

```tsx
// app/layout.tsx
import type { Metadata } from 'next'
import { Playfair_Display, DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-playfair',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Aladdin — The Job Board Built by Developers',
  description: 'A community-powered job board with AI tools to tailor your resume, generate cover letters, and track every application — all in one place.',
  keywords: ['job board', 'software engineering', 'AI resume', 'cover letter generator', 'developer jobs'],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${playfair.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
            style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
```

Also add to `globals.css` (after `@theme` block):
```css
/* Font CSS variables (populated by next/font) */
h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-playfair), Georgia, serif;
}
.font-mono-accent {
  font-family: var(--font-mono), monospace;
}
```

- [ ] **Step 3: Update next.config.ts to allow image optimization**

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    unoptimized: false,
  },
}

export default nextConfig
```

- [ ] **Step 4: Create a basic page.tsx to verify fonts load**

```tsx
// app/page.tsx (temporary — will be replaced in Task 14)
export default function Home() {
  return (
    <main>
      <h1 style={{ fontFamily: 'var(--font-playfair)', fontSize: '48px', padding: '40px' }}>
        Aladdin — font check
      </h1>
    </main>
  )
}
```

- [ ] **Step 5: Verify in browser**

```bash
npm run dev
```
Open http://localhost:3000. Should see "Aladdin — font check" in Playfair Display serif font.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add global styles, CSS variables, font setup, layout"
```

---

## Task 3: `useScrollReveal` Hook + `countUp` Library

**Files:**
- Create: `hooks/useScrollReveal.ts`
- Create: `lib/countUp.ts`
- Create: `lib/__tests__/countUp.test.ts`

> **Invoke `/superpowers:test-driven-development` before writing implementation.**

- [ ] **Step 1: Write failing test for countUp**

```ts
// lib/__tests__/countUp.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { animateCountUp } from '../countUp'

describe('animateCountUp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('calls onUpdate with increasing values ending at target', () => {
    const onUpdate = vi.fn()
    const onComplete = vi.fn()

    animateCountUp({ target: 100, duration: 1000, onUpdate, onComplete })

    // Simulate rAF ticks
    vi.advanceTimersByTime(1000)

    expect(onUpdate).toHaveBeenCalled()
    const lastCall = onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
    expect(lastCall).toBe(100)
    expect(onComplete).toHaveBeenCalled()
  })

  it('calls onUpdate with 0 immediately on start', () => {
    const onUpdate = vi.fn()
    animateCountUp({ target: 50, duration: 500, onUpdate })
    expect(onUpdate).toHaveBeenCalledWith(0)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```
Expected: FAIL — `animateCountUp` not found.

- [ ] **Step 3: Implement countUp**

```ts
// lib/countUp.ts
interface CountUpOptions {
  target: number
  duration: number
  onUpdate: (value: number) => void
  onComplete?: () => void
}

export function animateCountUp({ target, duration, onUpdate, onComplete }: CountUpOptions): void {
  const start = performance.now()
  onUpdate(0)

  function tick(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / duration, 1)
    // ease-out quad
    const eased = 1 - (1 - progress) * (1 - progress)
    const current = Math.round(eased * target)
    onUpdate(current)

    if (progress < 1) {
      requestAnimationFrame(tick)
    } else {
      onComplete?.()
    }
  }

  requestAnimationFrame(tick)
}
```

- [ ] **Step 4: Run test — verify it passes**

```bash
npm test
```
Expected: PASS — 2 tests passing.

- [ ] **Step 5: Create useScrollReveal hook**

```ts
// hooks/useScrollReveal.ts
'use client'
import { useEffect, useRef } from 'react'

export function useScrollReveal() {
  const ref = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )

    // Observe the element itself and all .reveal children
    const targets = el.querySelectorAll('.reveal')
    targets.forEach((t) => observer.observe(t))
    if (el.classList.contains('reveal')) observer.observe(el)

    return () => observer.disconnect()
  }, [])

  return ref
}
```

- [ ] **Step 6: Commit**

```bash
git add hooks/ lib/
git commit -m "feat: add useScrollReveal hook and countUp animation library with tests"
```

---

## Task 4: Navbar

**Files:**
- Create: `components/Navbar.tsx`
- Create: `components/__tests__/Navbar.test.tsx`

> **Invoke `/frontend-design` before writing the component.**
> **Invoke `/superpowers:test-driven-development` before writing logic.**

- [ ] **Step 1: Write failing tests**

```tsx
// components/__tests__/Navbar.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Navbar from '../Navbar'

// next/image mock
vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}))

describe('Navbar', () => {
  it('renders the logo', () => {
    render(<Navbar />)
    expect(screen.getByAltText('Aladdin')).toBeInTheDocument()
  })

  it('renders all nav links', () => {
    render(<Navbar />)
    expect(screen.getByText('Features')).toBeInTheDocument()
    expect(screen.getByText('How It Works')).toBeInTheDocument()
    expect(screen.getByText('Interview Prep')).toBeInTheDocument()
    expect(screen.getByText('Jobs Map')).toBeInTheDocument()
  })

  it('renders Sign In and Get Started Free CTAs', () => {
    render(<Navbar />)
    expect(screen.getByText('Sign In')).toBeInTheDocument()
    expect(screen.getByText('Get Started Free')).toBeInTheDocument()
  })

  it('toggles mobile menu open and closed', () => {
    render(<Navbar />)
    // Drawer is hidden initially
    const drawer = screen.getByTestId('mobile-drawer')
    expect(drawer).toHaveStyle({ maxHeight: '0px' })

    // Click hamburger
    fireEvent.click(screen.getByTestId('hamburger-btn'))
    expect(drawer).toHaveStyle({ maxHeight: '500px' })

    // Click again to close
    fireEvent.click(screen.getByTestId('hamburger-btn'))
    expect(drawer).toHaveStyle({ maxHeight: '0px' })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```
Expected: FAIL — `Navbar` module not found.

- [ ] **Step 3: Implement Navbar**

```tsx
// components/Navbar.tsx
'use client'
import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Interview Prep', href: '#interview-prep' },
  { label: 'Jobs Map', href: '#map' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      background: scrolled ? 'rgba(250,248,244,0.85)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid var(--color-border)' : 'none',
      transition: 'background 0.3s ease, border-bottom 0.3s ease',
    }}>
      <div className="container" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 64,
      }}>
        {/* Logo */}
        <Image src="/aladdin-logo.png" width={120} height={32} alt="Aladdin" style={{ objectFit: 'contain' }} />

        {/* Center nav links (desktop) */}
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}
             className="hidden md:flex">
          {navLinks.map((link) => (
            <a key={link.label} href={link.href} style={{
              color: scrolled ? 'var(--color-text-secondary)' : 'rgba(245,242,237,0.75)',
              textDecoration: 'none', fontSize: 15, fontWeight: 500,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = scrolled ? 'var(--color-text-primary)' : '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = scrolled ? 'var(--color-text-secondary)' : 'rgba(245,242,237,0.75)')}>
              {link.label}
            </a>
          ))}
        </div>

        {/* Right CTAs (desktop) */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} className="hidden md:flex">
          <a href="https://app.aladdin.com/sign-in" style={{
            color: scrolled ? 'var(--color-text-secondary)' : 'rgba(245,242,237,0.75)',
            textDecoration: 'none', fontSize: 15, fontWeight: 500,
          }}>Sign In</a>
          <a href="https://app.aladdin.com/signup" className="btn-primary" style={{ padding: '8px 18px', fontSize: 14 }}>
            Get Started Free
          </a>
        </div>

        {/* Hamburger (mobile) */}
        <button
          data-testid="hamburger-btn"
          onClick={() => setMenuOpen((o) => !o)}
          className="md:hidden"
          style={{ background: 'none', border: 'none', cursor: 'pointer',
                   color: scrolled ? 'var(--color-text-primary)' : '#fff' }}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile drawer */}
      <div
        data-testid="mobile-drawer"
        style={{
          maxHeight: menuOpen ? '500px' : '0px',
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
          background: 'rgba(250,248,244,0.97)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="container" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {navLinks.map((link) => (
            <a key={link.label} href={link.href}
               onClick={() => setMenuOpen(false)}
               style={{ color: 'var(--color-text-primary)', textDecoration: 'none', fontSize: 16, fontWeight: 500 }}>
              {link.label}
            </a>
          ))}
          <hr style={{ borderColor: 'var(--color-border)', margin: '4px 0' }} />
          <a href="https://app.aladdin.com/sign-in"
             style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: 15 }}>Sign In</a>
          <a href="https://app.aladdin.com/signup" className="btn-primary" style={{ textAlign: 'center' }}>
            Get Started Free
          </a>
        </div>
      </div>
    </nav>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```
Expected: PASS — 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add components/Navbar.tsx components/__tests__/Navbar.test.tsx
git commit -m "feat: add Navbar component with scroll glass effect and mobile drawer"
```

---

## Task 5: Hero Section

**Files:**
- Create: `components/Hero.tsx`
- Create: `components/__tests__/Hero.test.tsx`

> **Invoke `/frontend-design` before writing the component.**

- [ ] **Step 1: Write failing test**

```tsx
// components/__tests__/Hero.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Hero from '../Hero'

vi.mock('next/image', () => ({
  default: (props: { alt: string; priority?: boolean }) => <img alt={props.alt} />,
}))

describe('Hero', () => {
  it('renders the main headline', () => {
    render(<Hero />)
    expect(screen.getByText(/smartest way to find and land/i)).toBeInTheDocument()
  })

  it('renders Get Started Free CTA linking to signup', () => {
    render(<Hero />)
    const cta = screen.getAllByText(/Get Started Free/i)[0]
    expect(cta.closest('a')).toHaveAttribute('href', 'https://app.aladdin.com/signup')
  })

  it('renders the hero screenshot image', () => {
    render(<Hero />)
    expect(screen.getByAltText('Aladdin job board')).toBeInTheDocument()
  })

  it('renders the pill badge', () => {
    render(<Hero />)
    expect(screen.getByText(/Community-powered/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```

- [ ] **Step 3: Implement Hero**

```tsx
// components/Hero.tsx
import Image from 'next/image'

export default function Hero() {
  return (
    <section style={{
      position: 'relative',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      background: `
        radial-gradient(ellipse 80% 50% at 20% 40%, rgba(35,131,226,0.15) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 60%, rgba(212,168,83,0.08) 0%, transparent 60%),
        #1a1814
      `,
    }} className="grain">
      <div className="container" style={{
        display: 'flex', alignItems: 'center', gap: 64,
        paddingTop: 100, paddingBottom: 160,
        flexWrap: 'wrap',
      }}>

        {/* Left: Copy */}
        <div style={{ flex: '1 1 480px', maxWidth: 600 }}>
          {/* Pill badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 100, padding: '6px 16px', marginBottom: 28,
            color: 'rgba(245,242,237,0.8)', fontSize: 12,
            fontFamily: 'var(--font-dm-sans)',
          }}>
            ✦ Community-powered · AI-enhanced
          </div>

          <h1 style={{
            fontFamily: 'var(--font-playfair)',
            fontSize: 'clamp(40px, 6vw, 72px)',
            fontWeight: 900,
            lineHeight: 1.1,
            color: '#f5f2ed',
            marginBottom: 24,
          }}>
            The smartest way to find and land your next dev job.
          </h1>

          <p style={{
            fontSize: 20, lineHeight: 1.65,
            color: 'rgba(245,242,237,0.7)',
            marginBottom: 36,
            maxWidth: 520,
          }}>
            Aladdin is a community-built job board with AI tools to tailor your resume,
            generate cover letters, and track every application — all in one place.
          </p>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', marginBottom: 28 }}>
            <a href="https://app.aladdin.com/signup" className="btn-primary" style={{ fontSize: 17, padding: '14px 28px' }}>
              Get Started Free →
            </a>
            <a href="#how-it-works" className="btn-ghost" style={{ fontSize: 16, padding: '13px 24px' }}>
              See How It Works
            </a>
          </div>

          <p style={{ fontSize: 13, color: 'rgba(245,242,237,0.4)' }}>
            Trusted by developers at Microsoft, Meta, DeepMind and more
          </p>
        </div>

        {/* Right: Screenshot */}
        <div style={{ flex: '1 1 420px', position: 'relative' }}>
          {/* Glow blob */}
          <div style={{
            position: 'absolute', inset: -60,
            background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(35,131,226,0.25) 0%, transparent 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'relative',
            borderRadius: 16, overflow: 'hidden',
            boxShadow: '0 40px 80px rgba(0,0,0,0.4)',
          }}>
            <Image
              src="/gallery/gallery-1.jpg"
              width={700}
              height={420}
              sizes="(max-width: 768px) 100vw, 700px"
              alt="Aladdin job board"
              priority
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
        </div>
      </div>

      {/* Bottom fade to cream */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 120,
        background: 'linear-gradient(to bottom, transparent, #faf8f4)',
        pointerEvents: 'none',
      }} />
    </section>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/Hero.tsx components/__tests__/Hero.test.tsx
git commit -m "feat: add Hero section with gradient mesh, pill badge, CTA, and product screenshot"
```

---

## Task 6: LogoMarquee

**Files:**
- Create: `components/LogoMarquee.tsx`
- Create: `components/__tests__/LogoMarquee.test.tsx`

> **Invoke `/frontend-design` before writing the component.**

- [ ] **Step 1: Write failing test**

```tsx
// components/__tests__/LogoMarquee.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import LogoMarquee from '../LogoMarquee'

vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}))

describe('LogoMarquee', () => {
  it('renders the section label', () => {
    render(<LogoMarquee />)
    expect(screen.getByText(/jobs from top companies/i)).toBeInTheDocument()
  })

  it('renders all 8 company logos (duplicated for seamless loop = 16 imgs)', () => {
    render(<LogoMarquee />)
    const imgs = screen.getAllByRole('img')
    // 8 logos × 2 sets = 16
    expect(imgs.length).toBe(16)
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```

- [ ] **Step 3: Implement LogoMarquee**

```tsx
// components/LogoMarquee.tsx
import Image from 'next/image'

const logos = [
  { src: '/logos/microsoft.png', alt: 'Microsoft' },
  { src: '/logos/meta.png', alt: 'Meta' },
  { src: '/logos/deepmind.jpg', alt: 'DeepMind' },
  { src: '/logos/huggingface.png', alt: 'Hugging Face' },
  { src: '/logos/visa.png', alt: 'Visa' },
  { src: '/logos/amd.png', alt: 'AMD' },
  { src: '/logos/exxonmobil.png', alt: 'ExxonMobil' },
  { src: '/logos/berkshire.png', alt: 'Berkshire Hathaway' },
]

function LogoSet() {
  return (
    <>
      {logos.map((logo) => (
        <div key={logo.alt} style={{ flexShrink: 0, padding: '0 40px' }}>
          <Image
            src={logo.src}
            alt={logo.alt}
            width={120}
            height={32}
            unoptimized={logo.src.endsWith('.jpg')}
            style={{
              width: 'auto', height: '28px', objectFit: 'contain',
              filter: 'grayscale(1) opacity(0.5)',
              transition: 'filter 0.3s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLImageElement).style.filter = 'grayscale(0) opacity(1)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLImageElement).style.filter = 'grayscale(1) opacity(0.5)' }}
          />
        </div>
      ))}
    </>
  )
}

export default function LogoMarquee() {
  return (
    <div style={{ background: 'var(--color-bg)', padding: '48px 0' }}>
      <p style={{
        textAlign: 'center', marginBottom: 32,
        fontSize: 13, color: 'var(--color-text-muted)',
        letterSpacing: 1,
      }}>
        Jobs from top companies, shared by real developers
      </p>

      {/* Marquee container */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Fade masks */}
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 120, zIndex: 1,
          background: 'linear-gradient(to right, var(--color-bg), transparent)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 120, zIndex: 1,
          background: 'linear-gradient(to left, var(--color-bg), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Scrolling track — two identical sets for seamless loop */}
        <div style={{
          display: 'flex',
          animation: 'marquee 30s linear infinite',
          width: 'max-content',
        }}>
          <LogoSet />
          <LogoSet />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add components/LogoMarquee.tsx components/__tests__/LogoMarquee.test.tsx
git commit -m "feat: add CSS-only logo marquee with grayscale hover effect"
```

---

## Task 7: ProblemSection

**Files:**
- Create: `components/ProblemSection.tsx`
- Create: `components/__tests__/ProblemSection.test.tsx`

> **Invoke `/frontend-design` before writing the component.**

- [ ] **Step 1: Write failing test**

```tsx
// components/__tests__/ProblemSection.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProblemSection from '../ProblemSection'

describe('ProblemSection', () => {
  it('renders the headline', () => {
    render(<ProblemSection />)
    expect(screen.getByText(/Job hunting is exhausting/i)).toBeInTheDocument()
  })

  it('renders all 3 pain point cards', () => {
    render(<ProblemSection />)
    expect(screen.getByText(/Scattered across/i)).toBeInTheDocument()
    expect(screen.getByText(/Cover letters from scratch/i)).toBeInTheDocument()
    expect(screen.getByText(/No idea what the interview/i)).toBeInTheDocument()
  })

  it('renders the solutions for each pain point', () => {
    render(<ProblemSection />)
    expect(screen.getByText(/One community board/i)).toBeInTheDocument()
    expect(screen.getByText(/AI generates/i)).toBeInTheDocument()
    expect(screen.getByText(/Real interview experiences/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```

- [ ] **Step 3: Implement ProblemSection**

```tsx
// components/ProblemSection.tsx
const painPoints = [
  {
    icon: '📂',
    pain: 'Scattered across 10 job sites',
    solution: 'One community board with all jobs in one place',
  },
  {
    icon: '✍️',
    pain: 'Cover letters from scratch, every time',
    solution: 'AI generates a tailored cover letter in one click',
  },
  {
    icon: '🎤',
    pain: 'No idea what the interview will look like',
    solution: 'Real interview experiences from the community',
  },
]

export default function ProblemSection() {
  return (
    <section id="features" className="section" style={{ background: 'var(--color-bg)' }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 'clamp(32px, 4vw, 48px)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: 16,
        }}>
          Job hunting is exhausting. It doesn&apos;t have to be.
        </h2>
        <p style={{
          fontSize: 20, color: 'var(--color-text-secondary)',
          maxWidth: 560, margin: '0 auto 56px',
          lineHeight: 1.6,
        }}>
          Devs waste hours across 10 different tools. Aladdin brings everything into one place.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
        }}>
          {painPoints.map((item) => (
            <div key={item.pain} className="card" style={{ padding: 36, textAlign: 'left' }}>
              <div style={{ fontSize: 36, marginBottom: 20 }}>{item.icon}</div>
              <p style={{
                fontSize: 14, color: 'var(--color-text-muted)',
                marginBottom: 12, lineHeight: 1.5,
                textDecoration: 'line-through', textDecorationColor: 'rgba(55,53,47,0.3)',
              }}>
                {item.pain}
              </p>
              <p style={{
                fontSize: 17, fontWeight: 600,
                color: 'var(--color-text-primary)',
                lineHeight: 1.4,
              }}>
                {item.solution}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add components/ProblemSection.tsx components/__tests__/ProblemSection.test.tsx
git commit -m "feat: add ProblemSection with pain-point-to-solution cards"
```

---

## Task 8: StatsBar

**Files:**
- Create: `components/StatsBar.tsx`
- Create: `components/__tests__/StatsBar.test.tsx`

> **Invoke `/frontend-design` before writing the component.**
> **Invoke `/superpowers:test-driven-development` for the count-up logic.**

- [ ] **Step 1: Write failing tests**

```tsx
// components/__tests__/StatsBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StatsBar from '../StatsBar'

// IntersectionObserver mock
const mockObserve = vi.fn()
const mockDisconnect = vi.fn()
vi.stubGlobal('IntersectionObserver', vi.fn(() => ({
  observe: mockObserve,
  disconnect: mockDisconnect,
})))

describe('StatsBar', () => {
  it('renders all 4 stat labels', () => {
    render(<StatsBar />)
    expect(screen.getByText(/Jobs in the database/i)).toBeInTheDocument()
    expect(screen.getByText(/AI cover letter/i)).toBeInTheDocument()
    expect(screen.getByText(/Kanban pipeline/i)).toBeInTheDocument()
    expect(screen.getByText(/Community interview/i)).toBeInTheDocument()
  })

  it('renders initial stat values', () => {
    render(<StatsBar />)
    // Non-animated stats are rendered as their display value
    expect(screen.getByText('1-click')).toBeInTheDocument()
    expect(screen.getByText('7 stages')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```

- [ ] **Step 3: Implement StatsBar**

```tsx
// components/StatsBar.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { animateCountUp } from '@/lib/countUp'

const stats = [
  { value: 5000, suffix: '+', label: 'Jobs in the database', numeric: true },
  { value: null, display: '1-click', label: 'AI cover letter + resume', numeric: false },
  { value: null, display: '7 stages', label: 'Kanban pipeline (Applied → Offer)', numeric: false },
  { value: 100, suffix: '+', label: 'Community interview experiences', numeric: true },
]

export default function StatsBar() {
  const sectionRef = useRef<HTMLDivElement>(null)
  const [counts, setCounts] = useState<(number | null)[]>(stats.map(() => null))
  const [visible, setVisible] = useState(false)
  const animated = useRef(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true
          setVisible(true)
          stats.forEach((stat, i) => {
            if (stat.numeric && stat.value !== null) {
              animateCountUp({
                target: stat.value,
                duration: 1500,
                onUpdate: (v) => setCounts((prev) => {
                  const next = [...prev]
                  next[i] = v
                  return next
                }),
              })
            }
          })
        }
      },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={sectionRef} style={{
      background: 'var(--color-bg-dark-2)',
      padding: '64px 0',
    }}>
      <div className="container" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 0,
      }}>
        {stats.map((stat, i) => (
          <div key={stat.label} style={{
            textAlign: 'center', padding: '24px 20px',
            borderRight: i < stats.length - 1 ? '1px solid rgba(255,255,255,0.08)' : 'none',
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'clamp(32px, 4vw, 48px)',
              color: '#f5f2ed',
              marginBottom: 8,
              opacity: visible ? 1 : 0,
              transition: 'opacity 0.6s ease',
            }}>
              {stat.numeric
                ? (counts[i] !== null ? `${counts[i]}${stat.suffix}` : `0${stat.suffix}`)
                : stat.display}
            </div>
            <div style={{
              fontSize: 14,
              color: 'rgba(245,242,237,0.6)',
              lineHeight: 1.4,
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add components/StatsBar.tsx components/__tests__/StatsBar.test.tsx
git commit -m "feat: add StatsBar with IntersectionObserver count-up animation"
```

---

## Task 9: HowItWorks

**Files:**
- Create: `components/HowItWorks.tsx`
- Create: `components/__tests__/HowItWorks.test.tsx`

> **Invoke `/frontend-design` before writing the component.**

- [ ] **Step 1: Write failing test**

```tsx
// components/__tests__/HowItWorks.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HowItWorks from '../HowItWorks'

describe('HowItWorks', () => {
  it('renders the section headline', () => {
    render(<HowItWorks />)
    expect(screen.getByText(/From discovery to offer/i)).toBeInTheDocument()
  })

  it('renders all 3 step titles', () => {
    render(<HowItWorks />)
    expect(screen.getByText('Discover Jobs')).toBeInTheDocument()
    expect(screen.getByText('Apply with AI')).toBeInTheDocument()
    expect(screen.getByText('Track & Prepare')).toBeInTheDocument()
  })

  it('renders step numbers 01, 02, 03', () => {
    render(<HowItWorks />)
    expect(screen.getByText('01')).toBeInTheDocument()
    expect(screen.getByText('02')).toBeInTheDocument()
    expect(screen.getByText('03')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```

- [ ] **Step 3: Implement HowItWorks**

```tsx
// components/HowItWorks.tsx
import { Search, Sparkles, LayoutDashboard } from 'lucide-react'

const steps = [
  {
    num: '01',
    Icon: Search,
    title: 'Discover Jobs',
    body: 'Browse or search community-imported jobs by title, skills, company, or location. Or explore all jobs on the interactive map.',
  },
  {
    num: '02',
    Icon: Sparkles,
    title: 'Apply with AI',
    body: 'Generate a tailored cover letter and resume in one click. Edit both in the built-in editor and download as PDF.',
  },
  {
    num: '03',
    Icon: LayoutDashboard,
    title: 'Track & Prepare',
    body: "Mark jobs as Applied to move them into your Kanban board. Read community interview experiences so you walk in prepared.",
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="section" style={{ background: 'var(--color-bg)' }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <p className="label" style={{ marginBottom: 16 }}>HOW IT WORKS</p>
        <h2 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 'clamp(32px, 4vw, 48px)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: 72,
        }}>
          From discovery to offer, in three steps.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 40,
          position: 'relative',
        }}>
          {steps.map((step, i) => (
            <div key={step.num} style={{ textAlign: 'center', padding: '0 16px' }}>
              {/* Step number */}
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                color: 'var(--color-accent-gold)',
                marginBottom: 16,
                letterSpacing: 2,
              }}>
                {step.num}
              </div>

              {/* Icon circle */}
              <div style={{
                width: 56, height: 56,
                borderRadius: '50%',
                background: 'rgba(35,131,226,0.08)',
                border: '1px solid rgba(35,131,226,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px',
                color: 'var(--color-accent)',
              }}>
                <step.Icon size={24} />
              </div>

              <h3 style={{
                fontFamily: 'var(--font-playfair)',
                fontSize: 22, fontWeight: 700,
                color: 'var(--color-text-primary)',
                marginBottom: 12,
              }}>
                {step.title}
              </h3>
              <p style={{
                fontSize: 16, color: 'var(--color-text-secondary)',
                lineHeight: 1.6,
              }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add components/HowItWorks.tsx components/__tests__/HowItWorks.test.tsx
git commit -m "feat: add HowItWorks 3-step section with Lucide icons"
```

---

## Task 10: FeatureSection (Reusable)

**Files:**
- Create: `components/FeatureSection.tsx`
- Create: `components/__tests__/FeatureSection.test.tsx`

> **Invoke `/frontend-design` before writing the component.**

- [ ] **Step 1: Write failing tests**

```tsx
// components/__tests__/FeatureSection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FeatureSection from '../FeatureSection'

vi.mock('next/image', () => ({
  default: (props: { alt: string }) => <img alt={props.alt} />,
}))

const props = {
  id: 'test-feature',
  label: 'TEST LABEL',
  headline: 'This is the feature headline',
  body: 'This is the feature body copy.',
  bullets: ['Bullet one', 'Bullet two', 'Bullet three'],
  imageSrc: '/gallery/gallery-2.png',
  imageAlt: 'Feature screenshot',
  flip: false,
}

describe('FeatureSection', () => {
  it('renders the label', () => {
    render(<FeatureSection {...props} />)
    expect(screen.getByText('TEST LABEL')).toBeInTheDocument()
  })

  it('renders the headline', () => {
    render(<FeatureSection {...props} />)
    expect(screen.getByText('This is the feature headline')).toBeInTheDocument()
  })

  it('renders all bullet points', () => {
    render(<FeatureSection {...props} />)
    expect(screen.getByText('Bullet one')).toBeInTheDocument()
    expect(screen.getByText('Bullet two')).toBeInTheDocument()
    expect(screen.getByText('Bullet three')).toBeInTheDocument()
  })

  it('renders the screenshot image', () => {
    render(<FeatureSection {...props} />)
    expect(screen.getByAltText('Feature screenshot')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test — verify it fails**

```bash
npm test
```

- [ ] **Step 3: Implement FeatureSection**

```tsx
// components/FeatureSection.tsx
import Image from 'next/image'
import { CheckCircle } from 'lucide-react'

interface FeatureSectionProps {
  id: string
  label: string
  headline: string
  body: string
  bullets: string[]
  imageSrc: string
  imageAlt: string
  flip: boolean
}

export default function FeatureSection({
  id, label, headline, body, bullets, imageSrc, imageAlt, flip,
}: FeatureSectionProps) {
  return (
    <section id={id} className="section" style={{ background: 'var(--color-bg)' }}>
      <div className="container">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 80,
          flexDirection: flip ? 'row-reverse' : 'row',
          flexWrap: 'wrap',
        }}>
          {/* Text content */}
          <div style={{ flex: '1 1 360px', maxWidth: 520 }}>
            <p className="label" style={{ marginBottom: 16 }}>{label}</p>
            <h2 style={{
              fontFamily: 'var(--font-playfair)',
              fontSize: 'clamp(28px, 3.5vw, 40px)',
              fontWeight: 700,
              color: 'var(--color-text-primary)',
              marginBottom: 20,
              lineHeight: 1.2,
            }}>
              {headline}
            </h2>
            <p style={{
              fontSize: 17, color: 'var(--color-text-secondary)',
              lineHeight: 1.7, marginBottom: 28,
            }}>
              {body}
            </p>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bullets.map((bullet) => (
                <li key={bullet} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle size={18} style={{ color: 'var(--color-accent)', marginTop: 2, flexShrink: 0 }} />
                  <span style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Image with glow */}
          <div style={{ flex: '1 1 400px', position: 'relative' }}>
            {/* Glow blob */}
            <div style={{
              position: 'absolute', inset: -40,
              background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(35,131,226,0.15) 0%, transparent 70%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'relative',
              borderRadius: 20,
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(55,53,47,0.12), 0 4px 16px rgba(55,53,47,0.08)',
            }}>
              <Image
                src={imageSrc}
                alt={imageAlt}
                width={640}
                height={400}
                sizes="(max-width: 768px) 100vw, 640px"
                style={{ display: 'block', width: '100%', height: 'auto' }}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

- [ ] **Step 5: Commit**

```bash
git add components/FeatureSection.tsx components/__tests__/FeatureSection.test.tsx
git commit -m "feat: add reusable FeatureSection component with flip layout, bullets, and glow"
```

---

## Task 11: MapCallout, Testimonials, CTASection, Footer

**Files:**
- Create: `components/MapCallout.tsx`
- Create: `components/Testimonials.tsx`
- Create: `components/CTASection.tsx`
- Create: `components/Footer.tsx`
- Create: `components/__tests__/MapCallout.test.tsx`
- Create: `components/__tests__/Testimonials.test.tsx`
- Create: `components/__tests__/CTASection.test.tsx`
- Create: `components/__tests__/Footer.test.tsx`

> **Invoke `/frontend-design` before writing each component.**

- [ ] **Step 1: Write all failing tests**

```tsx
// components/__tests__/MapCallout.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MapCallout from '../MapCallout'
vi.mock('next/image', () => ({ default: (p: { alt: string }) => <img alt={p.alt} /> }))

describe('MapCallout', () => {
  it('renders headline', () => {
    render(<MapCallout />)
    expect(screen.getByText(/See where the opportunities are/i)).toBeInTheDocument()
  })
  it('renders Explore the Map CTA with correct href', () => {
    render(<MapCallout />)
    const link = screen.getByText(/Explore the Map/i).closest('a')
    expect(link).toHaveAttribute('href', 'https://app.aladdin.com/map')
  })
})
```

```tsx
// components/__tests__/Testimonials.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Testimonials from '../Testimonials'

describe('Testimonials', () => {
  it('renders section headline', () => {
    render(<Testimonials />)
    expect(screen.getByText(/Helping developers land/i)).toBeInTheDocument()
  })
  it('renders all 3 reviewer names', () => {
    render(<Testimonials />)
    expect(screen.getByText('Jordan Lee')).toBeInTheDocument()
    expect(screen.getByText('Anika Rodrigues')).toBeInTheDocument()
    expect(screen.getByText('Marcus S.')).toBeInTheDocument()
  })
})
```

```tsx
// components/__tests__/CTASection.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import CTASection from '../CTASection'

describe('CTASection', () => {
  it('renders headline', () => {
    render(<CTASection />)
    expect(screen.getByText(/Your next job is already on Aladdin/i)).toBeInTheDocument()
  })
  it('renders Get Started Free linking to signup', () => {
    render(<CTASection />)
    const link = screen.getByText(/Get Started Free/i).closest('a')
    expect(link).toHaveAttribute('href', 'https://app.aladdin.com/signup')
  })
})
```

```tsx
// components/__tests__/Footer.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import Footer from '../Footer'
vi.mock('next/image', () => ({ default: (p: { alt: string }) => <img alt={p.alt} /> }))

describe('Footer', () => {
  it('renders copyright', () => {
    render(<Footer />)
    expect(screen.getByText(/2026 Aladdin/i)).toBeInTheDocument()
  })
  it('renders PRODUCT, COMMUNITY, LEGAL column headings', () => {
    render(<Footer />)
    expect(screen.getByText('PRODUCT')).toBeInTheDocument()
    expect(screen.getByText('COMMUNITY')).toBeInTheDocument()
    expect(screen.getByText('LEGAL')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests — verify all fail**

```bash
npm test
```
Expected: 8 tests FAIL.

- [ ] **Step 3: Implement MapCallout**

```tsx
// components/MapCallout.tsx
import Image from 'next/image'

export default function MapCallout() {
  return (
    <section id="map" style={{
      position: 'relative', minHeight: 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }} className="grain">
      {/* Background image */}
      <Image
        src="/gallery/gallery-8.png"
        alt=""
        fill
        aria-hidden
        style={{ objectFit: 'cover', filter: 'blur(4px) brightness(0.35)' }}
      />
      {/* Dark overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,24,20,0.7)' }} />

      {/* Content */}
      <div className="container" style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '80px 24px' }}>
        <h2 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 'clamp(32px, 4vw, 48px)',
          fontWeight: 700,
          color: '#f5f2ed',
          marginBottom: 20,
        }}>
          See where the opportunities are.
        </h2>
        <p style={{
          fontSize: 18, color: 'rgba(245,242,237,0.7)',
          maxWidth: 520, margin: '0 auto 36px',
          lineHeight: 1.65,
        }}>
          Every job in the Aladdin database is plotted on an interactive map.
          Spot clusters, explore by region, and discover roles near you.
        </p>
        <a href="https://app.aladdin.com/map" className="btn-primary" style={{ fontSize: 16, padding: '14px 28px' }}>
          Explore the Map →
        </a>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Implement Testimonials**

```tsx
// components/Testimonials.tsx
const testimonials = [
  {
    initials: 'JL',
    color: 'var(--color-accent)',
    name: 'Jordan Lee',
    title: 'Software Engineer · Class of 2025',
    quote: "I was spending hours rewriting my cover letter for every job. Aladdin's AI just gets it — one click and it's tailored, professional, and actually sounds like me.",
  },
  {
    initials: 'AR',
    color: 'var(--color-accent-gold)',
    name: 'Anika Rodrigues',
    title: 'CS Graduate · New Grad Hire at Meta',
    quote: "The interview experiences section was honestly the best part. I knew exactly what Meta's process looked like before I even walked in. Game changer.",
  },
  {
    initials: 'MS',
    color: '#0f7b6c',
    name: 'Marcus S.',
    title: 'Junior Developer',
    quote: "I love that jobs come from real devs, not scrapers. The reputation system means the listings are actually accurate. And the Kanban board keeps me from losing track of anything.",
  },
]

export default function Testimonials() {
  return (
    <section className="section" style={{ background: 'var(--color-bg)' }}>
      <div className="container" style={{ textAlign: 'center' }}>
        <p className="label" style={{ marginBottom: 16 }}>WHAT DEVELOPERS SAY</p>
        <h2 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 'clamp(28px, 3.5vw, 40px)',
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          marginBottom: 56,
        }}>
          Helping developers land their next role.
        </h2>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 24,
          textAlign: 'left',
        }}>
          {testimonials.map((t) => (
            <div key={t.name} className="card" style={{ padding: 32 }}>
              <p style={{
                fontSize: 16, color: 'var(--color-text-secondary)',
                lineHeight: 1.7, marginBottom: 28,
                fontStyle: 'italic',
              }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: t.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {t.initials}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-text-primary)' }}>{t.name}</div>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{t.title}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Implement CTASection**

```tsx
// components/CTASection.tsx
export default function CTASection() {
  return (
    <section style={{
      position: 'relative',
      padding: '160px 0',
      overflow: 'hidden',
      background: `
        radial-gradient(ellipse 80% 50% at 20% 40%, rgba(35,131,226,0.12) 0%, transparent 60%),
        radial-gradient(ellipse 60% 40% at 80% 60%, rgba(212,168,83,0.06) 0%, transparent 60%),
        #1a1814
      `,
    }} className="grain">
      <div className="container" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <h2 style={{
          fontFamily: 'var(--font-playfair)',
          fontSize: 'clamp(36px, 5vw, 64px)',
          fontWeight: 900,
          color: '#f5f2ed',
          marginBottom: 20,
          lineHeight: 1.1,
        }}>
          Your next job is already on Aladdin.
        </h2>
        <p style={{
          fontSize: 22, color: 'rgba(245,242,237,0.65)',
          marginBottom: 44, lineHeight: 1.5,
        }}>
          Join the community. Import jobs. Apply smarter. Land the role.
        </p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 20 }}>
          <a href="https://app.aladdin.com/signup" className="btn-primary"
             style={{ fontSize: 18, padding: '16px 36px' }}>
            Get Started Free →
          </a>
          <a href="https://app.aladdin.com/sign-in" className="btn-ghost">
            Sign In
          </a>
        </div>
        <p style={{ fontSize: 14, color: 'rgba(245,242,237,0.35)' }}>
          No credit card required · Free to use
        </p>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Implement Footer**

```tsx
// components/Footer.tsx
import Image from 'next/image'
import { Github, Twitter } from 'lucide-react'

const productLinks = ['Features', 'How It Works', 'Jobs Map', 'Interview Prep']
const communityLinks = ['Import a Job', 'Submit Interview Experience', 'Browse Jobs']
const legalLinks = ['Privacy Policy', 'Terms of Service']

export default function Footer() {
  return (
    <footer style={{ background: '#141210', padding: '64px 0 32px' }}>
      <div className="container">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 48,
          marginBottom: 48,
        }}>
          {/* Col 1: Brand */}
          <div>
            <Image src="/aladdin-logo.png" width={120} height={32} alt="Aladdin"
                   style={{ objectFit: 'contain', marginBottom: 16, opacity: 0.8 }} />
            <p style={{ fontSize: 14, color: 'rgba(245,242,237,0.5)', lineHeight: 1.6, marginBottom: 20 }}>
              Built by developers, for developers.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <a href="https://github.com" aria-label="GitHub"
                 style={{ color: 'rgba(245,242,237,0.4)' }}>
                <Github size={18} />
              </a>
              <a href="#" aria-label="Twitter"
                 style={{ color: 'rgba(245,242,237,0.4)' }}>
                <Twitter size={18} />
              </a>
            </div>
          </div>

          {/* Col 2: Product */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
                         color: 'rgba(245,242,237,0.25)', marginBottom: 16 }}>PRODUCT</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {productLinks.map((l) => (
                <li key={l}><a href="#" style={{ fontSize: 14, color: 'rgba(245,242,237,0.5)',
                                                 textDecoration: 'none' }}>{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Col 3: Community */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
                         color: 'rgba(245,242,237,0.25)', marginBottom: 16 }}>COMMUNITY</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {communityLinks.map((l) => (
                <li key={l}><a href="#" style={{ fontSize: 14, color: 'rgba(245,242,237,0.5)',
                                                  textDecoration: 'none' }}>{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Col 4: Legal */}
          <div>
            <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase',
                         color: 'rgba(245,242,237,0.25)', marginBottom: 16 }}>LEGAL</h4>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {legalLinks.map((l) => (
                <li key={l}><a href="#" style={{ fontSize: 14, color: 'rgba(245,242,237,0.5)',
                                                  textDecoration: 'none' }}>{l}</a></li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.08)',
          paddingTop: 24,
          display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
        }}>
          <p style={{ fontSize: 13, color: 'rgba(245,242,237,0.3)' }}>
            © 2026 Aladdin. All rights reserved.
          </p>
          <p style={{ fontSize: 13, color: 'rgba(245,242,237,0.3)' }}>
            Made with ♥ for developers
          </p>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 7: Run all tests — verify 8 new tests pass**

```bash
npm test
```
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add components/MapCallout.tsx components/Testimonials.tsx components/CTASection.tsx components/Footer.tsx components/__tests__/
git commit -m "feat: add MapCallout, Testimonials, CTASection, and Footer components"
```

---

## Task 12: Compose page.tsx

**Files:**
- Modify: `app/page.tsx`

> **Invoke `/frontend-design` before writing the composition.**

- [ ] **Step 1: Replace page.tsx with full composition**

```tsx
// app/page.tsx
import Navbar from '@/components/Navbar'
import Hero from '@/components/Hero'
import LogoMarquee from '@/components/LogoMarquee'
import ProblemSection from '@/components/ProblemSection'
import StatsBar from '@/components/StatsBar'
import HowItWorks from '@/components/HowItWorks'
import FeatureSection from '@/components/FeatureSection'
import MapCallout from '@/components/MapCallout'
import Testimonials from '@/components/Testimonials'
import CTASection from '@/components/CTASection'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <LogoMarquee />
        <ProblemSection />
        <StatsBar />
        <HowItWorks />
        <FeatureSection
          id="features-community"
          label="DISCOVER"
          headline="Real jobs, shared by real developers."
          body="Every job on Aladdin was imported by a community member. Importers earn reputation points and can correct job details if something's inaccurate. Search across title, company, location, skills, or anything in the description — and save jobs to revisit later."
          bullets={[
            'Community reputation system for importers',
            'Keyword search across all job fields',
            'Save jobs for later',
            'All jobs plotted on interactive map',
          ]}
          imageSrc="/gallery/gallery-2.png"
          imageAlt="Aladdin community job board"
          flip={false}
        />
        <FeatureSection
          id="features-ai"
          label="APPLY SMARTER"
          headline="Your resume and cover letter, tailored to every job."
          body="Upload your resume and optionally your LinkedIn profile. With one click, Aladdin generates a cover letter and tailored resume for the specific job. Edit both in the live two-panel editor, then download as PDF — ready to send."
          bullets={[
            'AI cover letter in one click',
            'Tailored resume per job',
            'Live two-panel resume editor',
            'PDF export',
          ]}
          imageSrc="/gallery/gallery-4.png"
          imageAlt="AI resume and cover letter editor"
          flip={true}
        />
        <FeatureSection
          id="interview-prep"
          label="TRACK & PREPARE"
          headline="Track every application. Walk into every interview prepared."
          body="Hit 'Applied?' and the job moves into your personal Kanban board — tracking your progress through 7 stages: Applied, Got OA, Interview R1, R2, R3, R4, and Got Offer. Browse community interview experiences by company to know exactly what to expect."
          bullets={[
            '7-column drag-and-drop Kanban board',
            'Stages: Applied → Got OA → Interview R1–R4 → Got Offer',
            'Interview experiences by company',
            'Community salary and review aggregates',
          ]}
          imageSrc="/gallery/gallery-6.png"
          imageAlt="Kanban application tracker"
          flip={false}
        />
        <MapCallout />
        <Testimonials />
        <CTASection />
      </main>
      <Footer />
    </>
  )
}
```

- [ ] **Step 2: Start dev server and visually verify full page**

```bash
npm run dev
```

Open http://localhost:3000. Scroll through and verify:
- [ ] Hero renders with dark background and product screenshot
- [ ] Logo marquee animates
- [ ] Problem section cards appear
- [ ] Stats bar shows stats
- [ ] How It Works has 3 steps
- [ ] 3 feature sections with screenshots (check console for 404s on images)
- [ ] Map callout with blurred background
- [ ] 3 testimonial cards
- [ ] Final CTA dark section
- [ ] Footer with 4 columns

- [ ] **Step 3: Fix any image 404s**

If gallery images show 404, double-check the asset copy commands from Task 1 Step 7. Re-run as needed.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: compose full landing page with all 13 sections"
```

---

## Task 13: E2E Tests + Responsive Polish

**Files:**
- Create: `e2e/landing.spec.ts`
- Modify: `app/globals.css` (responsive fixes)

> **Invoke `/superpowers:test-driven-development` before writing E2E tests.**

- [ ] **Step 1: Write E2E tests**

```ts
// e2e/landing.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Aladdin Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('page title is correct', async ({ page }) => {
    await expect(page).toHaveTitle(/Aladdin/)
  })

  test('navbar is fixed and visible on scroll', async ({ page }) => {
    const nav = page.locator('nav')
    await expect(nav).toBeVisible()
    await page.evaluate(() => window.scrollTo(0, 500))
    await expect(nav).toBeVisible()
  })

  test('Get Started Free links go to signup', async ({ page }) => {
    const links = page.locator('a[href="https://app.aladdin.com/signup"]')
    await expect(links.first()).toBeVisible()
  })

  test('See How It Works scrolls to how-it-works section', async ({ page }) => {
    await page.click('text=See How It Works')
    await page.waitForTimeout(600)
    const section = page.locator('#how-it-works')
    await expect(section).toBeInViewport()
  })

  test('mobile menu opens and closes on hamburger click', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    const drawer = page.getByTestId('mobile-drawer')
    await expect(drawer).toHaveCSS('max-height', '0px')
    await page.getByTestId('hamburger-btn').click()
    await expect(drawer).not.toHaveCSS('max-height', '0px')
    await page.getByTestId('hamburger-btn').click()
    await expect(drawer).toHaveCSS('max-height', '0px')
  })

  test('all 13 sections render', async ({ page }) => {
    const ids = ['features', 'how-it-works', 'features-community', 'features-ai', 'interview-prep', 'map']
    for (const id of ids) {
      await expect(page.locator(`#${id}`)).toBeAttached()
    }
  })
})
```

- [ ] **Step 2: Run E2E tests**

```bash
npm run test:e2e
```
Expected: All 6 tests pass. Fix failures before continuing.

- [ ] **Step 3: Add responsive CSS and wire class names**

First, add `className="feature-flip"` to the outer flex `div` in `FeatureSection.tsx` (the one with `flexDirection: flip ? 'row-reverse' : 'row'`), and add `className="stats-grid"` to the grid `div` in `StatsBar.tsx`. Then add to `globals.css`:

```css
/* Feature section stack on mobile */
@media (max-width: 768px) {
  .feature-flip { flex-direction: column !important; }

  /* Stats bar: 2x2 grid on mobile */
  .stats-grid { grid-template-columns: 1fr 1fr !important; }
  .stats-grid > div { border-right: none !important; border-bottom: 1px solid rgba(255,255,255,0.08); }
}

/* Hide desktop nav on mobile */
@media (max-width: 767px) {
  .hidden { display: none !important; }
}
@media (min-width: 768px) {
  .md\\:flex { display: flex !important; }
  .md\\:hidden { display: none !important; }
}
```

- [ ] **Step 4: Manually test at 375px mobile width**

In browser DevTools, set device to iPhone 12. Verify:
- [ ] Hamburger menu visible, desktop links hidden
- [ ] Hero stacks vertically (copy above screenshot)
- [ ] Feature sections stack (text then image)
- [ ] Stats bar in 2×2 grid
- [ ] Cards stack to single column

- [ ] **Step 5: Run all unit tests + E2E one final time**

```bash
npm run test && npm run test:e2e
```
Expected: All tests pass.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: add E2E tests and responsive polish — landing page complete"
```

---

## Task 14: Final Verification

- [ ] Run `npm run build` — verify zero build errors

```bash
npm run build
```
Expected: Build succeeds. Fix any TypeScript errors or missing image sizes.

- [ ] Run `npm start` and verify the production build at http://localhost:3000 looks identical to dev

- [ ] Check browser console for errors (no red errors, no 404s)

- [ ] Commit

```bash
git add -A
git commit -m "chore: verify production build passes — Aladdin landing page ready"
```

---

## Done

The landing page is complete at `C:/Users/iamma/onedrive/desktop/aladdin-landing/`. To deploy: push to GitHub and connect to Vercel. Set the root directory to `aladdin-landing/` if in a monorepo, or deploy the standalone repo directly.
