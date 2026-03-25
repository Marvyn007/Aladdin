'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

/* ─── Types ──────────────────────────────────────────────────────────────── */
export interface TocSection {
  id: string;
  label: string;
}

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  summaryItems: string[];
  tocSections: TocSection[];
  children: React.ReactNode;
}

/* ─── Constants ──────────────────────────────────────────────────────────── */
const ACCENT   = 'oklch(55% 0.22 265)';
const ACCENT_L = 'oklch(65% 0.22 265)';
const TEXT_HI  = 'oklch(15% 0.02 260)';
const TEXT_LO  = 'oklch(45% 0.04 260)';
const TEXT_MID = 'oklch(55% 0.03 260)';
const BORDER   = 'oklch(90% 0.02 260)';
const LATO     = "var(--font-lato), 'Lato', system-ui, sans-serif";
const MONO     = "var(--font-jetbrains), 'JetBrains Mono', monospace";

/* ─── LegalPage ──────────────────────────────────────────────────────────── */
export function LegalPage({
  title,
  lastUpdated,
  summaryItems,
  tocSections,
  children,
}: LegalPageProps) {
  const [activeId, setActiveId] = useState<string>(tocSections[0]?.id ?? '');
  const [scrolled, setScrolled]  = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  /* Scroll state for header */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* IntersectionObserver for TOC active section */
  useEffect(() => {
    const headings = tocSections
      .map(({ id }) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          const topmost = visible.sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0];
          setActiveId(topmost.target.id);
        }
      },
      { rootMargin: '-10% 0px -70% 0px', threshold: 0 },
    );
    headings.forEach((h) => observerRef.current?.observe(h));
    return () => observerRef.current?.disconnect();
  }, [tocSections]);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: 'smooth' });
  };

  return (
    <div style={{ fontFamily: LATO }}>

      {/* ── Fixed Header ─────────────────────────────────────────────────── */}
      <header style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        height: 68,
        background: scrolled ? 'rgba(7,9,15,0.97)' : '#07090F',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: '1px solid rgba(107,88,219,0.16)',
        transition: 'background 0.3s ease, backdrop-filter 0.3s ease',
        overflow: 'hidden',
      }}>
        {/* Animated glow line on scroll */}
        <div style={{
          position: 'absolute',
          bottom: -1,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(107,88,219,0.55), transparent)',
          opacity: scrolled ? 1 : 0,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
        }} />

        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 24px',
          height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <Image
              src="/aladdin-logo.png" alt="Aladdin" width={26} height={26}
              style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.88 }}
              priority
            />
            <span style={{ fontFamily: LATO, fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>
              Aladdin
            </span>
          </Link>

          {/* Back link */}
          <Link href="/" style={{
            fontFamily: LATO, fontSize: 13.5, color: 'rgba(255,255,255,0.42)',
            textDecoration: 'none', letterSpacing: '-0.01em', transition: 'color 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.42)')}
          >
            ← Back to App
          </Link>
        </div>
      </header>

      {/* ── Dark Hero / Title area ────────────────────────────────────────── */}
      <div style={{ background: '#07090F', paddingTop: 68 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '64px 24px 52px' }}>
          {/* LEGAL badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: 'rgba(107,88,219,0.12)',
            border: '1px solid rgba(107,88,219,0.28)',
            borderRadius: 100,
            padding: '5px 14px',
            marginBottom: 22,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: ACCENT_L,
              boxShadow: `0 0 6px ${ACCENT_L}`,
              display: 'inline-block',
            }} />
            <span style={{ fontFamily: LATO, fontSize: 11, fontWeight: 700, letterSpacing: '1.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>
              Legal
            </span>
          </div>

          {/* Page title */}
          <h1 style={{
            fontFamily: LATO,
            fontSize: 'clamp(34px, 5vw, 54px)',
            fontWeight: 900,
            color: '#fff',
            lineHeight: 1.06,
            letterSpacing: '-0.035em',
            marginBottom: 16,
          }}>
            {title}
          </h1>

          {/* Date */}
          <p style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.04em' }}>
            {lastUpdated}
          </p>
        </div>

        {/* Separator with center glow */}
        <div style={{ borderBottom: '1px solid rgba(107,88,219,0.16)', position: 'relative' }}>
          <div style={{
            position: 'absolute',
            bottom: -1,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '32%',
            height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(107,88,219,0.5), transparent)',
            pointerEvents: 'none',
          }} />
        </div>
      </div>

      {/* ── Two-column content ────────────────────────────────────────────── */}
      <div style={{ background: '#fafaf8' }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '52px 24px 120px',
          display: 'flex', gap: 64, alignItems: 'flex-start',
        }}>

          {/* TOC Sidebar */}
          <aside style={{
            width: 248, flexShrink: 0,
            position: 'sticky', top: 88,
            maxHeight: 'calc(100vh - 120px)',
            overflowY: 'auto', paddingBottom: 24,
          }}>
            <p style={{
              fontFamily: LATO, fontSize: 10, fontWeight: 700,
              letterSpacing: '2.5px', textTransform: 'uppercase',
              color: TEXT_MID, marginBottom: 14,
            }}>
              On this page
            </p>
            <nav>
              {tocSections.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => scrollTo(id)}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    borderLeft: `2px solid ${activeId === id ? ACCENT : BORDER}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    padding: '6px 0 6px 14px',
                    fontFamily: LATO,
                    fontSize: 13,
                    fontWeight: activeId === id ? 600 : 400,
                    color: activeId === id ? ACCENT : TEXT_LO,
                    lineHeight: 1.45,
                    letterSpacing: '-0.005em',
                    transition: 'color 0.18s, border-color 0.18s',
                  }}
                >
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <main style={{ flex: 1, minWidth: 0, maxWidth: 680 }}>

            {/* Summary box */}
            <div style={{
              background: '#fffdf5',
              border: '1px solid rgba(212,168,83,0.25)',
              borderLeft: '3px solid #d4a853',
              borderRadius: '0 12px 12px 0',
              padding: '24px 28px',
              marginBottom: 52,
              boxShadow: '0 2px 16px oklch(15% 0.02 260 / 0.04)',
            }}>
              <p style={{
                fontFamily: LATO, fontSize: 10, fontWeight: 700,
                letterSpacing: '2px', textTransform: 'uppercase',
                color: '#a07a30', marginBottom: 14,
              }}>
                The short version
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summaryItems.map((item, i) => (
                  <li key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    fontFamily: LATO, fontSize: 14.5, color: TEXT_LO, lineHeight: 1.65,
                  }}>
                    <span style={{ color: '#d4a853', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal sections */}
            {children}
          </main>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer style={{
        background: '#07090F',
        borderTop: '1px solid rgba(107,88,219,0.16)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top glow line */}
        <div style={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          width: '36%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(107,88,219,0.55), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Watermark */}
        <div style={{
          position: 'absolute', bottom: -24, left: '50%', transform: 'translateX(-50%)',
          fontSize: 'clamp(80px, 13vw, 176px)', fontWeight: 900, letterSpacing: '-0.05em',
          color: 'rgba(255,255,255,0.016)', userSelect: 'none', pointerEvents: 'none',
          whiteSpace: 'nowrap', fontFamily: LATO, lineHeight: 1,
        }}>
          ALADDIN
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 28px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <Image
                src="/aladdin-logo.png" alt="Aladdin" width={22} height={22}
                style={{ objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.55 }}
              />
              <span style={{ fontFamily: LATO, fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.48)', letterSpacing: '-0.02em' }}>
                Aladdin
              </span>
            </Link>

            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {[
                { label: 'Privacy Policy', href: '/privacy' },
                { label: 'Terms of Service', href: '/terms' },
                { label: 'Back to App', href: '/' },
              ].map(({ label, href }) => (
                <Link
                  key={label} href={href}
                  style={{ fontFamily: LATO, fontSize: 13.5, color: 'rgba(255,255,255,0.36)', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.8)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.36)')}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.055)', paddingTop: 20 }}>
            <p style={{ fontFamily: LATO, fontSize: 13, color: 'rgba(255,255,255,0.18)' }}>
              © 2026 Aladdin. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* ── Responsive overrides ─────────────────────────────────────────── */}
      <style>{`
        @media (max-width: 860px) {
          .legal-content-wrapper { flex-direction: column !important; }
          .legal-toc { width: 100% !important; position: static !important; max-height: none !important; border-bottom: 1px solid oklch(90% 0.02 260); padding-bottom: 24px !important; margin-bottom: 32px; }
        }
      `}</style>
    </div>
  );
}

/* ─── LegalSection ───────────────────────────────────────────────────────── */
export function LegalSection({
  id,
  number,
  heading,
  children,
}: {
  id: string;
  number: string;
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} style={{ marginBottom: 52, scrollMarginTop: 96 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span style={{
          fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
          fontSize: 10, fontWeight: 400, letterSpacing: '0.08em',
          color: 'oklch(55% 0.22 265)', flexShrink: 0,
        }}>
          {number}
        </span>
        <h2 style={{
          fontFamily: "var(--font-lato), 'Lato', system-ui, sans-serif",
          fontSize: 20, fontWeight: 700,
          color: 'oklch(15% 0.02 260)',
          lineHeight: 1.2, letterSpacing: '-0.02em',
        }}>
          {heading}
        </h2>
      </div>
      <div style={{ height: 1, background: 'oklch(90% 0.02 260)', marginBottom: 20 }} />
      <div>{children}</div>
    </section>
  );
}

/* ─── Text helpers ───────────────────────────────────────────────────────── */
export function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: "var(--font-lato), 'Lato', system-ui, sans-serif",
      fontSize: 15, color: 'oklch(42% 0.04 260)',
      lineHeight: 1.82, marginBottom: 14, letterSpacing: '-0.005em',
    }}>
      {children}
    </p>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
      {children}
    </ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      fontFamily: "var(--font-lato), 'Lato', system-ui, sans-serif",
      fontSize: 15, color: 'oklch(42% 0.04 260)', lineHeight: 1.75,
    }}>
      <span style={{ color: 'oklch(55% 0.22 265)', flexShrink: 0, marginTop: '2px', fontWeight: 700 }}>—</span>
      <span>{children}</span>
    </li>
  );
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{
      fontFamily: "var(--font-lato), 'Lato', system-ui, sans-serif",
      fontSize: 11, fontWeight: 700, letterSpacing: '1.6px',
      textTransform: 'uppercase', color: 'oklch(35% 0.04 260)',
      marginTop: 24, marginBottom: 10,
    }}>
      {children}
    </h3>
  );
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'oklch(55% 0.22 265 / 0.07)',
      border: '1px dashed oklch(55% 0.22 265 / 0.35)',
      borderRadius: 4, padding: '0 6px',
      fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
      fontSize: 13, color: 'oklch(45% 0.18 265)',
    }}>
      {children}
    </span>
  );
}
