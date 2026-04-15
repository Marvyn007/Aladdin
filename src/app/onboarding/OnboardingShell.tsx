'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sun, Moon, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'aladdin-onboarding-theme';

export function OnboardingShell({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light') setIsDark(false);
      else if (stored === 'dark') setIsDark(true);
    } catch {}
    setMounted(true);
  }, []);

  const toggle = () => {
    setIsDark((prev) => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light'); } catch {}
      return next;
    });
  };

  const themeClass = `onboarding-theme${isDark ? ' dark' : ''}`;

  return (
    <div
      className={themeClass}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--ot-bg)',
        color: 'var(--ot-text)',
        fontFamily: "'Open Sans', sans-serif",
        transition: 'background-color 0.35s ease, color 0.35s ease',
      }}
    >
      <div className="onboarding-split">
        {/* ── Left Panel: Image + Branding ── */}
        <motion.div
          className="onboarding-image-panel"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8 }}
        >
          <img
            src="/Onboarding stock.png"
            alt="Career journey"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Gradient overlay for text legibility */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: isDark
                ? 'linear-gradient(to top, rgba(0,12,35,0.88) 0%, rgba(29,161,242,0.12) 55%, rgba(0,8,25,0.30) 100%)'
                : 'linear-gradient(to top, rgba(230,244,255,0.94) 0%, rgba(29,161,242,0.06) 55%, rgba(255,255,255,0.15) 100%)',
              transition: 'background 0.5s ease',
            }}
          />

          {/* Branding content pinned to bottom */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              padding: '0 44px 52px',
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6, ease: 'easeOut' }}
            >
              {/* Logo */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 12,
                    background: 'var(--ot-primary-gradient)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 20px var(--ot-primary-glow)',
                    flexShrink: 0,
                  }}
                >
                  <Sparkles style={{ width: 20, height: 20, color: '#fff' }} />
                </div>
                <span
                  style={{
                    fontFamily: "'Cinzel', serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: isDark ? '#ffffff' : 'var(--ot-text)',
                    letterSpacing: '0.06em',
                    textShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : 'none',
                  }}
                >
                  Aladdin
                </span>
              </div>

              {/* Tagline */}
              <h2
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: isDark ? '#ffffff' : 'var(--ot-text)',
                  lineHeight: 1.3,
                  letterSpacing: '-0.02em',
                  maxWidth: 380,
                  textShadow: isDark ? '0 2px 12px rgba(0,0,0,0.35)' : 'none',
                }}
              >
                Your AI-powered job search starts here
              </h2>
              <p
                style={{
                  fontSize: 15,
                  color: isDark ? 'rgba(255,255,255,0.78)' : 'var(--ot-text-muted)',
                  marginTop: 10,
                  lineHeight: 1.7,
                  maxWidth: 340,
                  textShadow: isDark ? '0 1px 4px rgba(0,0,0,0.2)' : 'none',
                }}
              >
                Tell us about yourself so we can surface the right opportunities for you.
              </p>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Right Panel: Scrollable Content ── */}
        <div
          className="onboarding-content-panel"
          style={{
            backgroundColor: 'var(--ot-bg)',
            backgroundImage: 'var(--ot-glow)',
          }}
        >
          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              position: 'absolute',
              top: 18,
              right: 20,
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: '1.5px solid var(--ot-toggle-border)',
              background: 'var(--ot-toggle-bg)',
              color: 'var(--ot-toggle-color)',
              cursor: 'pointer',
              outline: 'none',
              opacity: mounted ? 1 : 0,
              transition: 'opacity 0.25s ease, background 0.25s ease, border-color 0.25s ease, color 0.25s ease',
            }}
          >
            {isDark
              ? <Sun style={{ width: 16, height: 16 }} />
              : <Moon style={{ width: 16, height: 16 }} />
            }
          </button>

          {children}
        </div>
      </div>
    </div>
  );
}
