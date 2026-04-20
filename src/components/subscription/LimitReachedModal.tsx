'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { UsageFeature } from '@/lib/subscription/tier-config';

interface LimitReachedModalProps {
  open: boolean;
  onClose: () => void;
  feature: UsageFeature;
  resetDate: string | null;
  /** 'limit' (default) = user hit their cap. 'upgrade' = proactive upsell, no limit messaging. */
  mode?: 'limit' | 'upgrade';
}

const FEATURE_LABELS: Record<UsageFeature, string[]> = {
  resumesGenerated: ['Monthly Resume Tailoring', 'Limit Reached'],
  coverLettersGenerated: ['Monthly Cover Letter', 'Limit Reached'],
  emailsRetrieved: ['Monthly Email Reveal', 'Limit Reached'],
  linkedinRetrieved: ['Monthly LinkedIn View', 'Limit Reached'],
};

function formatResetDate(iso: string | null): string {
  if (!iso) return 'next month';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

const COMPARE_ROWS: { label: string; copilot: string; captain: string }[] = [
  { label: 'AI Resumes', copilot: '15 per month', captain: '60 per month' },
  { label: 'Email Reveals', copilot: '30 per month', captain: '150 per month' },
  { label: 'LinkedIn Views', copilot: '60 per month', captain: 'Unlimited' },
  { label: 'Cover Letters', copilot: '30 per month', captain: 'Unlimited' },
];

export function LimitReachedModal({ open, onClose, feature, resetDate, mode = 'limit' }: LimitReachedModalProps) {
  const [loading, setLoading] = useState(false);
  const captainPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_CAPTAIN ?? '';
  const formattedDate = formatResetDate(resetDate);
  const [line1, line2] = FEATURE_LABELS[feature];
  const isUpgrade = mode === 'upgrade';

  if (!open) return null;

  const handleUpgrade = async () => {
    if (!captainPriceId) { console.error('[LimitReachedModal] captainPriceId is empty'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: captainPriceId }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('[LimitReachedModal] No URL returned:', data);
      }
    } catch (err) {
      console.error('[LimitReachedModal] Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
        background: 'rgba(0,0,0,0.55)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Teal card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 380, maxWidth: '95vw', borderRadius: 16, padding: 28,
          position: 'relative', overflow: 'hidden',
          background: '#0e7490',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Decorative circle */}
        <div style={{ position: 'absolute', top: -30, right: -40, width: 190, height: 190, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', zIndex: 0 }} />

        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Plan badge */}
          <span style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999,
            background: 'rgba(255,255,255,0.22)', color: '#ffffff', marginBottom: 12,
          }}>
            Copilot Plan
          </span>

          {/* Title */}
          <p style={{ margin: '0 0 12px', fontSize: 28, fontWeight: 800, color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {isUpgrade ? (
              <>Ready for<br />Full Command?</>
            ) : (
              <>{line1}<br />{line2}</>
            )}
          </p>

          {/* Subtitle */}
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#ffffff', lineHeight: 1.5 }}>
            {isUpgrade
              ? 'Unlock nearly 4x more usage across every feature at just over 2x the price.'
              : `Resets ${formattedDate}. Upgrade to Captain for nearly 5x the usage at just over 2x the price.`
            }
          </p>

          {/* Comparison table */}
          <div style={{ marginBottom: 20 }}>
            {COMPARE_ROWS.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 0', fontSize: 12, color: '#ffffff',
                  borderBottom: i < COMPARE_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none',
                }}
              >
                <span>{row.label}</span>
                <span style={{ fontWeight: 700 }}>{row.copilot} &rarr; {row.captain}</span>
              </div>
            ))}
          </div>

          {/* Upgrade CTA */}
          <button
            onClick={handleUpgrade}
            disabled={loading}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: '#ffffff', border: 'none',
              color: '#000000', fontSize: 12, fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Redirecting...' : 'Take Full Command'}
          </button>
        </div>
      </div>

      {/* Dismiss — outside card */}
      <button
        onClick={onClose}
        style={{
          width: 380, maxWidth: '95vw', textAlign: 'center',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 12, fontWeight: 400, color: '#ffffff',
          letterSpacing: '0.05em',
        }}
      >
        {isUpgrade ? 'Nevermind' : `Wait until ${formattedDate}`}
      </button>
    </div>
  );

  return createPortal(modal, document.body);
}
