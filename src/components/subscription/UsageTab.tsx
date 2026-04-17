'use client';

import { useState } from 'react';
import { Lock, Zap } from 'lucide-react';
import { useSubscription, isUnlimited, SubscriptionState } from '@/hooks/useSubscription';
import { PricingModal } from './PricingModal';

interface UsageBarProps {
  label: string;
  used: number;
  limit: number;
  isLite: boolean;
}

function UsageBar({ label, used, limit, isLite }: UsageBarProps) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited || limit === 0 ? 0 : Math.min((used / limit) * 100, 100);
  const displayRight = isLite
    ? '0 / 0'
    : unlimited
    ? '∞ / Unlimited'
    : `${used} / ${limit}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{label}</span>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{displayRight}</span>
      </div>
      <div style={{ height: '6px', borderRadius: '99px', background: 'var(--border)', position: 'relative', overflow: 'visible' }}>
        {isLite ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Lock size={10} color="var(--text-secondary)" />
          </div>
        ) : (
          <div style={{
            height: '100%', borderRadius: '99px',
            background: 'var(--accent)',
            width: unlimited ? '100%' : `${pct}%`,
            opacity: unlimited ? 0.3 : 1,
            transition: 'width 0.3s ease',
          }} />
        )}
      </div>
    </div>
  );
}

const PLAN_LABELS: Record<string, string> = {
  LITE: 'Aladdin Lite',
  COPILOT: 'Aladdin Co-Pilot',
  CAPTAIN: 'Aladdin Captain',
};

export function UsageTab() {
  const sub = useSubscription();
  const [modalOpen, setModalOpen] = useState(false);
  const isLite = sub.planType === 'LITE';

  if (sub.isLoading) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current plan</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
            {PLAN_LABELS[sub.planType] ?? sub.planType}
          </div>
          {sub.currentPeriodEnd && !isLite && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Resets on {new Date(sub.currentPeriodEnd).toLocaleDateString()}
            </div>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '8px 14px', borderRadius: '8px', border: 'none',
            background: 'var(--accent)', color: 'white', cursor: 'pointer',
            fontSize: '13px', fontWeight: 600,
          }}
        >
          <Zap size={14} />
          {isLite ? 'Upgrade' : 'Manage'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <UsageBar
          label="AI Resume Tailorings"
          used={sub.usage.resumesGenerated}
          limit={sub.limits.resumesGenerated}
          isLite={isLite}
        />
        <UsageBar
          label="Cover Letters"
          used={sub.usage.coverLettersGenerated}
          limit={sub.limits.coverLettersGenerated}
          isLite={isLite}
        />
        <UsageBar
          label="Email Reveals"
          used={sub.usage.emailsRetrieved}
          limit={sub.limits.emailsRetrieved}
          isLite={isLite}
        />
        <UsageBar
          label="LinkedIn Profiles"
          used={sub.usage.linkedinRetrieved}
          limit={sub.limits.linkedinRetrieved}
          isLite={isLite}
        />
      </div>

      {isLite && (
        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
          Upgrade to Co-Pilot to unlock AI-powered features.
        </p>
      )}

      {modalOpen && (
        <PricingModal isOpen={modalOpen} onClose={() => setModalOpen(false)} sub={sub} />
      )}
    </div>
  );
}
