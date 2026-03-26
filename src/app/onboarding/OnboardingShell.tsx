'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

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
    /* position: fixed escapes `html, body { overflow: hidden }` from globals.css */
    <div
      className={themeClass}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--ot-bg)',
        backgroundImage: 'var(--ot-glow)',
        color: 'var(--ot-text)',
        fontFamily: "'Open Sans', sans-serif",
        transition: 'background-color 0.35s ease, background-image 0.5s ease, color 0.35s ease',
      }}
    >

      {/* Fixed theme toggle — top-right */}
      <button
        type="button"
        onClick={toggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        style={{
          position: 'fixed',
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

      {/* Scrollable content column — independent of body overflow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          zIndex: 1,
        }}
      >
        {children}
      </div>
    </div>
  );
}
