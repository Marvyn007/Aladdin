'use client';

import { createPortal } from 'react-dom';

interface CaptainLimitModalProps {
  open: boolean;
  onClose: () => void;
  resetDate: string | null;
}

function formatResetDate(iso: string | null): string {
  if (!iso) return 'next month';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export function CaptainLimitModal({ open, onClose, resetDate }: CaptainLimitModalProps) {
  if (!open) return null;

  const formattedDate = formatResetDate(resetDate);

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        background: 'rgba(0,0,0,0.6)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, maxWidth: '95vw', borderRadius: 16, padding: 28,
          position: 'relative', overflow: 'hidden',
          background: '#0f172a',
          boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Captain badge */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/captain badge.png"
          alt=""
          style={{
            position: 'absolute', top: 25, right: 60,
            width: 120, height: 120,
            objectFit: 'contain',
            opacity: 1,
            zIndex: 2,
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Badge */}
          <span style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', marginBottom: 16,
          }}>
            Captain Plan
          </span>

          {/* Title */}
          <p style={{
            margin: '0 0 14px', fontSize: 28, fontWeight: 800,
            color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em',
          }}>
            You're on<br />a roll.
          </p>

          {/* Body */}
          <p style={{
            margin: '0 0 8px', fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6,
          }}>
            You've made the most of Captain this month and we love the enthusiasm.
          </p>
          <p style={{
            margin: '0 0 24px', fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6,
          }}>
            We're building a better system to keep up with users like you. For now, your limits reset on <span style={{ color: '#ffffff', fontWeight: 600 }}>{formattedDate}</span>.
          </p>

          {/* Dismiss CTA */}
          <button
            onClick={onClose}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
              color: '#ffffff', fontSize: 12, fontWeight: 600,
              letterSpacing: '0.06em', textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
