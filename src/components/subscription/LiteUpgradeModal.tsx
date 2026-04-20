'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

interface LiteUpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

async function startCheckout(priceId: string, setLoading: (v: string | null) => void) {
  if (!priceId) { console.error('[LiteUpgradeModal] priceId is empty'); return; }
  setLoading(priceId);
  try {
    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json() as { url?: string; error?: string };
    if (data.url) {
      window.location.href = data.url;
    } else {
      console.error('[LiteUpgradeModal] No URL returned:', data);
    }
  } catch (err) {
    console.error('[LiteUpgradeModal] Checkout error:', err);
  } finally {
    setLoading(null);
  }
}

const COPILOT_FEATURES = [
  'Everything in Lite',
  '15x AI-Tailored Resumes per month',
  '30x High-Conversion Cover Letters',
  '60x LinkedIn Profile Insights',
  'Unlock Referral Network Access',
  'Advanced "Apply Pilot" Auto-fill',
];

const CAPTAIN_FEATURES = [
  'Everything in Co-Pilot',
  '60x Premium Tailored Resumes',
  '150x Verified Email Retrievals (Direct Access)',
  'Unlimited AI Cover Letters',
  'Unlimited LinkedIn Lead Scraping',
  'Priority "First-to-Apply" Alerts',
];

function GreenCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
      <polyline points="2,7 5,10 11,3" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LiteUpgradeModal({ open, onClose }: LiteUpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const copilotPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_COPILOT ?? '';
  const captainPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_CAPTAIN ?? '';

  if (!open) return null;

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* White wrapper */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 24,
          padding: 28,
          width: 720,
          maxWidth: '95vw',
          boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4b5563' }}>
            You are on Free Plan
          </p>
          <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 700, color: '#000000', lineHeight: 1.2 }}>
            This feature requires a paid plan
          </p>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: '#374151' }}>
            Choose a plan to unlock full access
          </p>
        </div>

        {/* Plan cards row */}
        <div style={{ display: 'flex', gap: 12 }}>

          {/* Copilot card */}
          <div style={{ flex: 1, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden', background: '#1d4ed8' }}>
            {/* Decorative circle */}
            <div style={{ position: 'absolute', top: -30, right: -40, width: 190, height: 190, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', zIndex: 0 }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <span style={{
                display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.22)', color: '#ffffff', marginBottom: 12,
              }}>
                Best Value
              </span>
              <p style={{ margin: '0 0 2px', fontSize: 30, fontWeight: 800, color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>Copilot</p>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#ffffff' }}>$6.99 / mo</p>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#ffffff', lineHeight: 1.5 }}>
                Your job hunt on autopilot. Move 10x faster.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
                {COPILOT_FEATURES.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 12, color: '#ffffff', lineHeight: 1.4 }}>
                    <GreenCheck />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(copilotPriceId, setLoading)}
                disabled={!!loading}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12,
                  background: 'transparent', border: '2px solid #ffffff',
                  color: '#ffffff', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading === copilotPriceId ? 'Redirecting...' : 'Upgrade to Co-Pilot'}
              </button>
            </div>
          </div>

          {/* Captain card */}
          <div style={{ flex: 1, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden', background: '#6d28d9' }}>
            <div style={{ position: 'absolute', top: -30, right: -40, width: 190, height: 190, borderRadius: '50%', background: 'rgba(0,0,0,0.25)', zIndex: 0 }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <span style={{
                display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999,
                background: 'rgba(255,255,255,0.22)', color: '#ffffff', marginBottom: 12,
              }}>
                Full Command
              </span>
              <p style={{ margin: '0 0 2px', fontSize: 30, fontWeight: 800, color: '#ffffff', lineHeight: 1.1, letterSpacing: '-0.02em' }}>Captain</p>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#ffffff' }}>$16.99 / mo</p>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: '#ffffff', lineHeight: 1.5 }}>
                Dominate the hidden job market. Total command.
              </p>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
                {CAPTAIN_FEATURES.map(f => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, fontSize: 12, color: '#ffffff', lineHeight: 1.4 }}>
                    <GreenCheck />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(captainPriceId, setLoading)}
                disabled={!!loading}
                style={{
                  width: '100%', padding: '12px 0', borderRadius: 12,
                  background: '#ffffff', border: 'none',
                  color: '#000000', fontSize: 12, fontWeight: 700,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading === captainPriceId ? 'Redirecting...' : 'Take Full Command'}
              </button>
            </div>
          </div>
        </div>

        {/* Dismiss */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 14, fontWeight: 400, color: '#6b7280',
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
