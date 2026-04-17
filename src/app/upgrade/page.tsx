'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import NumberFlow from '@number-flow/react';
import { ArrowLeft, Check, Zap, Star, Rocket, Shield } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';

const PLANS = [
  {
    id: 'LITE' as const,
    name: 'Aladdin Lite',
    tagline: 'Start your job search',
    monthlyPrice: 0,
    yearlyMonthlyPrice: 0,
    yearlyTotal: 0,
    Icon: Star,
    priceId: null as string | null,
    features: [
      'Jobs Map & Listings',
      'Application Tracker & Heatmap',
      'Interview Prep & Tech Questions',
      'Static Resume Editor',
    ],
    includesLabel: 'Free forever includes:',
  },
  {
    id: 'COPILOT' as const,
    name: 'Co-Pilot',
    tagline: 'AI-assisted job hunting',
    monthlyPrice: 6.99,
    yearlyMonthlyPrice: 5.59,
    yearlyTotal: 67,
    Icon: Zap,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_COPILOT ?? null,
    popular: true,
    features: [
      'Everything in Lite',
      '15 AI Resume Tailorings / mo',
      '30 Cover Letters / mo',
      '60 LinkedIn Profile Views / mo',
      '30 Email Reveals / mo',
    ],
    includesLabel: 'Co-Pilot includes:',
  },
  {
    id: 'CAPTAIN' as const,
    name: 'Captain',
    tagline: 'Maximum output, no limits',
    monthlyPrice: 16.99,
    yearlyMonthlyPrice: 13.59,
    yearlyTotal: 163,
    Icon: Rocket,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_CAPTAIN ?? null,
    features: [
      'Everything in Co-Pilot',
      '60 AI Resume Tailorings / mo',
      'Unlimited Cover Letters*',
      'Unlimited LinkedIn Profiles*',
      '150 Email Reveals / mo',
    ],
    includesLabel: 'Captain includes:',
  },
];

function PricingToggle({ yearly, onToggle }: { yearly: boolean; onToggle: () => void }) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '4px',
        borderRadius: '99px',
        border: '1px solid var(--border)',
        background: 'var(--background)',
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      {(['Monthly', 'Yearly'] as const).map((label) => {
        const isActive = (label === 'Yearly') === yearly;
        return (
          <div key={label} style={{ position: 'relative' }}>
            {isActive && (
              <motion.div
                layoutId="pricing-toggle"
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'var(--foreground)',
                  borderRadius: '99px',
                  zIndex: 0,
                }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <span
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '13px',
                fontWeight: 500,
                color: isActive ? 'white' : 'var(--text-secondary)',
                borderRadius: '99px',
                transition: 'color 0.2s',
              }}
            >
              {label}
              {label === 'Yearly' && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '99px',
                    background: isActive ? 'rgba(255,255,255,0.2)' : 'var(--accent-muted)',
                    color: isActive ? 'white' : 'var(--accent)',
                    letterSpacing: '0.02em',
                  }}
                >
                  −20%
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function PlanCard({
  plan,
  yearly,
  currentPlan,
  onUpgrade,
  onManage,
  loading,
  index,
}: {
  plan: typeof PLANS[0];
  yearly: boolean;
  currentPlan: string;
  onUpgrade: (priceId: string) => void;
  onManage: () => void;
  loading: string | null;
  index: number;
}) {
  const isCurrent = currentPlan === plan.id;
  const isLite = plan.id === 'LITE';
  const displayPrice = yearly ? plan.yearlyMonthlyPrice : plan.monthlyPrice;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '16px',
        border: plan.popular
          ? '2px solid var(--accent)'
          : '1px solid var(--border)',
        background: 'var(--background)',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: plan.popular
          ? '0 4px 24px rgba(var(--accent-rgb), 0.10)'
          : '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {plan.popular && (
        <div
          style={{
            background: 'var(--accent)',
            padding: '6px 0',
            textAlign: 'center',
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: 'white',
            textTransform: 'uppercase',
          }}
        >
          Most Popular
        </div>
      )}

      <div style={{ padding: '24px', flex: 1 }}>
        {/* Header */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <plan.Icon
              size={16}
              style={{ color: plan.popular ? 'var(--accent)' : 'var(--text-secondary)' }}
              strokeWidth={2}
            />
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: plan.popular ? 'var(--accent)' : 'var(--text-secondary)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              {plan.name}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '2px', marginBottom: '4px' }}>
            {isLite ? (
              <span style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Free
              </span>
            ) : (
              <>
                <span style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text-secondary)', alignSelf: 'flex-start', marginTop: '6px' }}>$</span>
                <NumberFlow
                  value={displayPrice}
                  format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                  style={{ fontSize: '32px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
                />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '2px' }}>/mo</span>
              </>
            )}
          </div>

          {!isLite && yearly && (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
              ${plan.yearlyTotal} billed yearly
            </p>
          )}

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
            {plan.tagline}
          </p>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'var(--border)', marginBottom: '16px' }} />

        {/* Features */}
        <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', margin: '0 0 10px' }}>
          {plan.includesLabel}
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {plan.features.map((feature) => (
            <li key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <Check
                size={13}
                strokeWidth={2.5}
                style={{
                  marginTop: '2px',
                  flexShrink: 0,
                  color: plan.popular ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              />
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 24px 24px' }}>
        {isCurrent ? (
          <div
            style={{
              padding: '11px',
              borderRadius: '10px',
              border: '1px solid var(--border)',
              background: 'var(--background-secondary)',
              textAlign: 'center',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary)',
            }}
          >
            Current plan
          </div>
        ) : currentPlan !== 'LITE' && !plan.priceId ? null : plan.priceId ? (
          <button
            onClick={() => {
              if (currentPlan !== 'LITE') {
                onManage();
              } else {
                onUpgrade(plan.priceId!);
              }
            }}
            disabled={loading !== null}
            style={{
              width: '100%',
              padding: '11px',
              borderRadius: '10px',
              border: 'none',
              cursor: loading !== null ? 'wait' : 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              color: 'white',
              background: plan.popular
                ? 'linear-gradient(180deg, var(--accent) 0%, color-mix(in oklch, var(--accent), black 15%) 100%)'
                : 'linear-gradient(180deg, var(--text-primary) 0%, color-mix(in oklch, var(--text-primary), black 20%) 100%)',
              opacity: loading !== null ? 0.7 : 1,
              transition: 'opacity 0.15s, transform 0.15s',
              boxShadow: plan.popular
                ? '0 1px 3px rgba(var(--accent-rgb), 0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
                : '0 1px 3px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          >
            {loading === plan.priceId ? 'Redirecting…' :
              currentPlan === 'LITE' ? `Get ${plan.name}` :
              isCurrent ? 'Current plan' : 'Manage plan'}
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}

export default function UpgradePage() {
  const router = useRouter();
  const sub = useSubscription();
  const [yearly, setYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const handleUpgrade = async (priceId: string) => {
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

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--background)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top nav bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          background: 'var(--background)',
          zIndex: 10,
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            padding: '6px 0',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          Back
        </button>
      </div>

      {/* Page content */}
      <div
        style={{
          flex: 1,
          maxWidth: '960px',
          width: '100%',
          margin: '0 auto',
          padding: '56px 24px 80px',
        }}
      >
        {/* Hero text */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ textAlign: 'center', marginBottom: '40px' }}
        >
          <p
            style={{
              fontSize: '12px',
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: '12px',
            }}
          >
            Pricing
          </p>
          <h1
            style={{
              fontSize: '36px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.025em',
              margin: '0 0 12px',
              lineHeight: 1.15,
            }}
          >
            Plans for every stage
            <br />of your job search
          </h1>
          <p
            style={{
              fontSize: '15px',
              color: 'var(--text-secondary)',
              maxWidth: '420px',
              margin: '0 auto 28px',
              lineHeight: 1.6,
            }}
          >
            Start free, upgrade when you need AI-powered tools to stand out.
          </p>

          <PricingToggle yearly={yearly} onToggle={() => setYearly((v) => !v)} />
        </motion.div>

        {/* Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px',
          }}
        >
          {PLANS.map((plan, index) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              yearly={yearly}
              currentPlan={sub.planType}
              onUpgrade={handleUpgrade}
              onManage={handleManage}
              loading={loading}
              index={index}
            />
          ))}
        </div>

        {/* Footer notes */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          style={{
            marginTop: '40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <Shield size={13} strokeWidth={2} />
            <span style={{ fontSize: '12px' }}>
              Cancel anytime · Billed securely via Stripe · No hidden fees
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0, textAlign: 'center' }}>
            * Unlimited subject to fair use policy (500/mo). Usage resets on your billing date.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
