'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

interface LiteUpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

async function startCheckout(priceId: string, setLoading: (v: string | null) => void) {
  setLoading(priceId);
  try {
    const res = await fetch('/api/stripe/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ priceId }),
    });
    const data = await res.json() as { url?: string };
    if (data.url) window.location.href = data.url;
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

export function LiteUpgradeModal({ open, onClose }: LiteUpgradeModalProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const copilotPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_COPILOT ?? '';
  const captainPriceId = process.env.NEXT_PUBLIC_STRIPE_PRICE_CAPTAIN ?? '';

  if (!open) return null;

  const modal = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-7 shadow-2xl w-[720px] max-w-[95vw]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-600 mb-1">
            You are on Free Plan
          </p>
          <p className="text-xl font-bold text-black mb-1">
            This feature requires a paid plan
          </p>
          <p className="text-sm font-medium text-gray-700">
            Choose a plan to unlock full access
          </p>
        </div>

        {/* Plan cards */}
        <div className="flex gap-3">
          {/* Copilot */}
          <div className="flex-1 rounded-2xl p-6 relative overflow-hidden" style={{ background: '#1d4ed8' }}>
            <div
              className="absolute rounded-full"
              style={{ top: -30, right: -40, width: 190, height: 190, background: 'rgba(0,0,0,0.25)', zIndex: 0 }}
            />
            <div className="relative z-10">
              <span
                className="inline-block text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
                style={{ background: 'rgba(255,255,255,0.22)' }}
              >
                Best Value
              </span>
              <p className="text-white text-3xl font-extrabold leading-tight tracking-tight mb-0.5">Copilot</p>
              <p className="text-white text-sm font-bold mb-1">$6.99 / mo</p>
              <p className="text-white text-xs leading-relaxed mb-4">
                Your job hunt on autopilot. Move 10x faster.
              </p>
              <ul className="space-y-1 mb-5">
                {COPILOT_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-white text-xs leading-relaxed">
                    <Check size={13} className="mt-0.5 flex-shrink-0" color="#4ade80" strokeWidth={3} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(copilotPriceId, setLoading)}
                disabled={!!loading}
                className="w-full py-3 rounded-xl text-white text-xs font-bold uppercase tracking-widest border-2 border-white disabled:opacity-60"
                style={{ background: 'transparent' }}
              >
                {loading === copilotPriceId ? 'Redirecting...' : 'Upgrade to Co-Pilot'}
              </button>
            </div>
          </div>

          {/* Captain */}
          <div className="flex-1 rounded-2xl p-6 relative overflow-hidden" style={{ background: '#6d28d9' }}>
            <div
              className="absolute rounded-full"
              style={{ top: -30, right: -40, width: 190, height: 190, background: 'rgba(0,0,0,0.25)', zIndex: 0 }}
            />
            <div className="relative z-10">
              <span
                className="inline-block text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full mb-3"
                style={{ background: 'rgba(255,255,255,0.22)' }}
              >
                Full Command
              </span>
              <p className="text-white text-3xl font-extrabold leading-tight tracking-tight mb-0.5">Captain</p>
              <p className="text-white text-sm font-bold mb-1">$16.99 / mo</p>
              <p className="text-white text-xs leading-relaxed mb-4">
                Dominate the hidden job market. Total command.
              </p>
              <ul className="space-y-1 mb-5">
                {CAPTAIN_FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2 text-white text-xs leading-relaxed">
                    <Check size={13} className="mt-0.5 flex-shrink-0" color="#4ade80" strokeWidth={3} />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => startCheckout(captainPriceId, setLoading)}
                disabled={!!loading}
                className="w-full py-3 rounded-xl text-black text-xs font-bold uppercase tracking-widest bg-white disabled:opacity-60"
              >
                {loading === captainPriceId ? 'Redirecting...' : 'Take Full Command'}
              </button>
            </div>
          </div>
        </div>

        {/* Dismiss */}
        <div className="text-center mt-4">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 font-normal bg-transparent border-none cursor-pointer"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
