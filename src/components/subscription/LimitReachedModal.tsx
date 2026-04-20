'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { UsageFeature } from '@/lib/subscription/tier-config';

interface LimitReachedModalProps {
  open: boolean;
  onClose: () => void;
  feature: UsageFeature;
  resetDate: string | null;
}

const FEATURE_LABELS: Record<UsageFeature, string> = {
  resumesGenerated: 'Monthly Resume Tailoring\nLimit Reached',
  coverLettersGenerated: 'Monthly Cover Letter\nLimit Reached',
  emailsRetrieved: 'Monthly Email Reveal\nLimit Reached',
  linkedinRetrieved: 'Monthly LinkedIn View\nLimit Reached',
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

export function LimitReachedModal({ open, onClose, feature, resetDate }: LimitReachedModalProps) {
  const [loading, setLoading] = useState(false);
  const captainPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_CAPTAIN ?? '';
  const formattedDate = formatResetDate(resetDate);
  const titleLines = FEATURE_LABELS[feature].split('\n');

  if (!open) return null;

  const handleUpgrade = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: captainPriceId }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      {/* Teal card — no white wrapper */}
      <div
        className="w-[380px] max-w-[95vw] rounded-2xl p-7 relative overflow-hidden shadow-2xl"
        style={{ background: '#0e7490' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Decorative circle */}
        <div
          className="absolute rounded-full"
          style={{ top: -30, right: -40, width: 190, height: 190, background: 'rgba(0,0,0,0.25)', zIndex: 0 }}
        />
        <div className="relative z-10">
          <span
            className="inline-block text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
            style={{ background: 'rgba(255,255,255,0.22)' }}
          >
            Copilot Plan
          </span>

          <p className="text-white text-3xl font-extrabold leading-tight tracking-tight mb-3">
            {titleLines[0]}
            {titleLines[1] && <><br />{titleLines[1]}</>}
          </p>

          <p className="text-white text-sm mb-5">
            Resets {formattedDate}. Upgrade to Captain for nearly 5x the usage at just over 2x the price.
          </p>

          {/* Comparison table */}
          <div className="mb-5">
            {COMPARE_ROWS.map((row, i) => (
              <div
                key={row.label}
                className="flex justify-between items-center py-1.5 text-xs text-white"
                style={{ borderBottom: i < COMPARE_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.2)' : 'none' }}
              >
                <span>{row.label}</span>
                <span className="font-bold">
                  {row.copilot} &rarr; {row.captain}
                </span>
              </div>
            ))}
          </div>

          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-white text-black text-xs font-bold uppercase tracking-widest disabled:opacity-60"
          >
            {loading ? 'Redirecting...' : 'Take Full Command'}
          </button>
        </div>
      </div>

      {/* Dismiss — outside the card */}
      <button
        onClick={onClose}
        className="text-white text-xs font-normal uppercase tracking-widest bg-transparent border-none cursor-pointer w-[380px] max-w-[95vw] text-center"
      >
        Wait until {formattedDate}
      </button>
    </div>
  );

  return createPortal(modal, document.body);
}
