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

/* ─── LegalPage ──────────────────────────────────────────────────────────── */
export function LegalPage({
  title,
  lastUpdated,
  summaryItems,
  tocSections,
  children,
}: LegalPageProps) {
  const [activeId, setActiveId] = useState<string>(tocSections[0]?.id ?? '');
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Track which section is in view for the TOC highlight
  useEffect(() => {
    const headings = tocSections.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];

    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Pick the one closest to the top
          const topmost = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
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
    const y = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header style={styles.header}>
        {/* Grain overlay */}
        <div style={styles.headerGrain} aria-hidden />
        <div style={styles.headerInner}>
          <Link href="/" style={styles.logoLink}>
            <Image
              src="/aladdin-logo.png"
              alt="Aladdin"
              width={110}
              height={28}
              style={{ objectFit: 'contain' }}
              priority
            />
          </Link>
          <Link href="/" style={styles.backLink}>
            ← Back to App
          </Link>
        </div>
      </header>

      {/* ── Page title ──────────────────────────────────────────────────── */}
      <div style={styles.titleSection}>
        <p style={styles.titleLabel}>Legal</p>
        <h1 style={styles.pageTitle}>{title}</h1>
        <p style={styles.lastUpdated}>{lastUpdated}</p>
      </div>

      {/* ── Two-column layout ───────────────────────────────────────────── */}
      <div style={styles.contentWrapper}>
        {/* Sidebar TOC */}
        <aside style={styles.sidebar}>
          <p style={styles.tocLabel}>On this page</p>
          <nav>
            {tocSections.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                style={{
                  ...styles.tocItem,
                  ...(activeId === id ? styles.tocItemActive : {}),
                }}
              >
                {activeId === id && <span style={styles.tocDot} />}
                {label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main style={styles.main}>
          {/* Plain English summary */}
          <div style={styles.summaryBox}>
            <p style={styles.summaryTitle}>The short version</p>
            <ul style={styles.summaryList}>
              {summaryItems.map((item, i) => (
                <li key={i} style={styles.summaryItem}>
                  <span style={styles.summaryCheck}>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Legal text */}
          {children}
        </main>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer style={styles.footer}>
        <div style={styles.footerInner}>
          <div style={styles.footerTop}>
            <Link href="/" style={styles.footerLogo}>
              <Image
                src="/aladdin-logo.png"
                alt="Aladdin"
                width={90}
                height={24}
                style={{ objectFit: 'contain', opacity: 0.6 }}
              />
            </Link>
            <div style={styles.footerLinks}>
              <Link href="/privacy" style={styles.footerLink}>Privacy Policy</Link>
              <Link href="/terms" style={styles.footerLink}>Terms of Service</Link>
              <Link href="/" style={styles.footerLink}>Back to App</Link>
            </div>
          </div>
          <div style={styles.footerBottom}>
            <p style={styles.footerCopy}>© 2026 Aladdin. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

/* ─── Section heading component ─────────────────────────────────────────── */
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
    <section id={id} style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionNumber}>{number}</span>
        <h2 style={styles.sectionHeading}>{heading}</h2>
      </div>
      <div style={styles.sectionRule} />
      <div style={styles.sectionBody}>{children}</div>
    </section>
  );
}

/* ─── Paragraph, list, sub-heading helpers ───────────────────────────────── */
export function P({ children }: { children: React.ReactNode }) {
  return <p style={styles.para}>{children}</p>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul style={styles.ul}>{children}</ul>;
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li style={styles.li}>
      <span style={styles.liBullet}>—</span>
      <span>{children}</span>
    </li>
  );
}

export function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 style={styles.subHeading}>{children}</h3>;
}

export function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        background: 'rgba(212,168,83,0.15)',
        border: '1px dashed rgba(212,168,83,0.6)',
        borderRadius: '4px',
        padding: '0 6px',
        fontFamily: 'var(--font-jetbrains)',
        fontSize: '13px',
        color: '#8a6a20',
      }}
    >
      {children}
    </span>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles: Record<string, React.CSSProperties> = {
  /* Header */
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#1a1814',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    height: '64px',
    overflow: 'hidden',
  },
  headerGrain: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
    opacity: 0.04,
    pointerEvents: 'none',
  },
  headerInner: {
    position: 'relative',
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoLink: { display: 'flex', alignItems: 'center', textDecoration: 'none' },
  backLink: {
    color: 'rgba(245,242,237,0.5)',
    fontSize: '14px',
    fontFamily: 'var(--font-dm-sans)',
    textDecoration: 'none',
    letterSpacing: '0.01em',
    transition: 'color 0.2s',
  },

  /* Title area */
  titleSection: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '120px 24px 56px',
    paddingLeft: 'calc(24px + 280px + 80px)',
  },
  titleLabel: {
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#d4a853',
    marginBottom: '12px',
  },
  pageTitle: {
    fontFamily: 'var(--font-playfair)',
    fontSize: '52px',
    fontWeight: 700,
    color: '#37352f',
    lineHeight: 1.1,
    marginBottom: '16px',
  },
  lastUpdated: {
    fontFamily: 'var(--font-jetbrains)',
    fontSize: '12px',
    color: '#8a8884',
    letterSpacing: '0.02em',
  },

  /* Two-column layout */
  contentWrapper: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 24px 120px',
    display: 'flex',
    gap: '80px',
    alignItems: 'flex-start',
  },

  /* Sidebar TOC */
  sidebar: {
    width: '280px',
    flexShrink: 0,
    position: 'sticky',
    top: '88px',
    maxHeight: 'calc(100vh - 120px)',
    overflowY: 'auto',
    paddingBottom: '24px',
  },
  tocLabel: {
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '2px',
    textTransform: 'uppercase',
    color: '#8a8884',
    marginBottom: '16px',
  },
  tocItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    padding: '7px 0',
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '13.5px',
    color: '#5a5754',
    lineHeight: 1.4,
    transition: 'color 0.2s',
    paddingLeft: '0',
  },
  tocItemActive: {
    color: '#2383e2',
    fontWeight: 500,
  },
  tocDot: {
    width: '5px',
    height: '5px',
    borderRadius: '50%',
    backgroundColor: '#2383e2',
    flexShrink: 0,
  },

  /* Main content */
  main: {
    flex: 1,
    minWidth: 0,
    maxWidth: '680px',
  },

  /* Summary box */
  summaryBox: {
    background: '#fffbf0',
    borderLeft: '3px solid #d4a853',
    borderRadius: '0 12px 12px 0',
    padding: '28px 32px',
    marginBottom: '56px',
    boxShadow: '0 2px 12px rgba(55,53,47,0.06)',
  },
  summaryTitle: {
    fontFamily: 'var(--font-playfair)',
    fontSize: '18px',
    fontStyle: 'italic',
    color: '#5a5754',
    marginBottom: '16px',
  },
  summaryList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '15px',
    color: '#5a5754',
    lineHeight: 1.6,
  },
  summaryCheck: {
    color: '#d4a853',
    fontWeight: 700,
    flexShrink: 0,
    marginTop: '1px',
  },

  /* Sections */
  section: {
    marginBottom: '56px',
    scrollMarginTop: '96px',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
    marginBottom: '16px',
  },
  sectionNumber: {
    fontFamily: 'var(--font-jetbrains)',
    fontSize: '11px',
    color: '#d4a853',
    letterSpacing: '0.05em',
  },
  sectionHeading: {
    fontFamily: 'var(--font-playfair)',
    fontSize: '24px',
    fontWeight: 700,
    color: '#37352f',
    lineHeight: 1.2,
  },
  sectionRule: {
    height: '1px',
    background: 'rgba(55,53,47,0.08)',
    marginBottom: '20px',
  },
  sectionBody: {},

  /* Typography */
  para: {
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '15.5px',
    color: '#5a5754',
    lineHeight: 1.85,
    marginBottom: '16px',
  },
  ul: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  li: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '15.5px',
    color: '#5a5754',
    lineHeight: 1.75,
  },
  liBullet: {
    color: '#8a8884',
    flexShrink: 0,
    marginTop: '1px',
    userSelect: 'none',
  },
  subHeading: {
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '14px',
    fontWeight: 700,
    color: '#37352f',
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    marginTop: '24px',
    marginBottom: '10px',
  },

  /* Footer */
  footer: {
    backgroundColor: '#141210',
    borderTop: '1px solid rgba(255,255,255,0.06)',
  },
  footerInner: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '40px 24px 28px',
  },
  footerTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
    gap: '16px',
  },
  footerLogo: { display: 'flex', alignItems: 'center', textDecoration: 'none' },
  footerLinks: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
  footerLink: {
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '14px',
    color: 'rgba(245,242,237,0.45)',
    textDecoration: 'none',
    transition: 'color 0.2s',
  },
  footerBottom: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    paddingTop: '24px',
  },
  footerCopy: {
    fontFamily: 'var(--font-dm-sans)',
    fontSize: '13px',
    color: 'rgba(245,242,237,0.3)',
  },
};
