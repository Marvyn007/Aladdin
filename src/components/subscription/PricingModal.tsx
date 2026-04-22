'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Zap, Star, Rocket } from 'lucide-react';
import { SubscriptionState } from '@/hooks/useSubscription';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  sub: SubscriptionState;
}

const PLANS = [
  {
    id: 'LITE' as const,
    name: 'Aladdin Lite',
    price: 'Free',
    icon: <Star size={20} />,
    features: ['Job board & map', 'Application tracker', 'Interview prep', 'Static resume editor'],
  },
  {
    id: 'COPILOT' as const,
    name: 'Aladdin Co-pilot',
    price: '$6.99/mo',
    icon: <Zap size={20} />,
    features: ['Everything in Lite', '15 AI resume tailorings', '30 cover letters', '60 LinkedIn profiles', '30 email reveals'],
    plan: 'copilot' as const,
    highlight: true,
  },
  {
    id: 'CAPTAIN' as const,
    name: 'Aladdin Captain',
    price: '$16.99/mo',
    icon: <Rocket size={20} />,
    features: ['Everything in Co-pilot', '60 AI resume tailorings', '∞ cover letters*', '150 email reveals', '∞ LinkedIn profiles*'],
    plan: 'captain' as const,
  },
];

export function PricingModal({ isOpen, onClose, sub }: PricingModalProps) {
  const [loading, setLoading] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpgrade = async (plan: 'copilot' | 'captain') => {
    setLoading(plan);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan,
          successPath: '/upgrade?checkout=success&session_id={CHECKOUT_SESSION_ID}',
          cancelPath: '/upgrade',
        }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading('portal');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  };

  const isPaid = sub.planType !== 'LITE';

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000, padding: '20px',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--background)', borderRadius: '16px',
          width: '100%', maxWidth: '680px', padding: '32px',
          position: 'relative', maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          <X size={20} />
        </button>

        <h2 style={{ margin: '0 0 8px', fontSize: '22px', fontWeight: 700 }}>Upgrade your plan</h2>
        <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Unlock AI-powered features to accelerate your job search.
        </p>

        {sub.cancelAtPeriodEnd && sub.currentPeriodEnd && (
          <div style={{
            background: 'var(--warning-muted, #fef9c3)', border: '1px solid var(--warning, #eab308)',
            borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '14px',
          }}>
            Your plan ends on {new Date(sub.currentPeriodEnd).toLocaleDateString()}.{' '}
            <button
              onClick={handleManage}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontWeight: 600, padding: 0 }}
            >
              Reactivate
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              style={{
                border: (plan as { highlight?: boolean }).highlight ? '2px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: '12px', padding: '20px',
                background: sub.planType === plan.id ? 'var(--accent-muted)' : 'transparent',
                display: 'flex', flexDirection: 'column', gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
                {plan.icon}
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{plan.name}</span>
              </div>
              <div style={{ fontSize: '22px', fontWeight: 700 }}>{plan.price}</div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Check size={12} style={{ marginTop: '2px', flexShrink: 0, color: 'var(--accent)' }} />
                    {f}
                  </li>
                ))}
              </ul>

              {sub.planType === plan.id ? (
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 'auto' }}>
                  Current plan
                </div>
              ) : 'plan' in plan ? (
                <button
                  onClick={() => handleUpgrade((plan as { plan: 'copilot' | 'captain' }).plan)}
                  disabled={loading !== null}
                  style={{
                    marginTop: 'auto', padding: '10px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                    background: (plan as { highlight?: boolean }).highlight ? 'var(--accent)' : 'var(--surface)',
                    color: (plan as { highlight?: boolean }).highlight ? 'white' : 'var(--text)',
                    fontWeight: 600, fontSize: '13px',
                    opacity: loading !== null ? 0.6 : 1,
                  }}
                >
                  {loading === (plan as { plan: 'copilot' | 'captain' }).plan ? 'Redirecting…' : 'Upgrade'}
                </button>
              ) : null}
            </div>
          ))}
        </div>

        {isPaid && (
          <div style={{ marginTop: '20px', textAlign: 'center' }}>
            <button
              onClick={handleManage}
              disabled={loading !== null}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'underline',
              }}
            >
              {loading === 'portal' ? 'Redirecting…' : 'Manage subscription'}
            </button>
          </div>
        )}

        <p style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          * Unlimited subject to fair use policy (500/mo).
        </p>
      </div>
    </div>,
    document.body
  );
}
