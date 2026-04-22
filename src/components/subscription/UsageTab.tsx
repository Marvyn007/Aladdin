'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Lock, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSubscription, isUnlimited } from '@/hooks/useSubscription';
import { LimitReachedModal } from './LimitReachedModal';
import { SquishyCard } from '@/components/ui/squishy-card-component';

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
  COPILOT: 'Aladdin Copilot',
  CAPTAIN: 'Aladdin Captain',
};

interface CancelSubscriptionModalProps {
  open: boolean;
  planLabel: string;
  periodEndLabel: string | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

function CancelSubscriptionModal({
  open,
  planLabel,
  periodEndLabel,
  loading,
  error,
  onClose,
  onConfirm,
}: CancelSubscriptionModalProps) {
  if (!open) return null;

  const accessText = periodEndLabel
    ? `You will keep ${planLabel} until ${periodEndLabel}.`
    : `You will keep ${planLabel} until the end of this billing period.`;
  const reassuranceText = `But don't worry, ${accessText} At least we can do that much for you.`;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(17, 24, 39, 0.58)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <SquishyCard
          badge="We are sad to see you go"
          title={<>Cancel<br />renewal?</>}
          imageSrc="/sad-puppy.png"
          description={reassuranceText}
          subtext="You will not be charged for the next billing period."
          errorText={error}
          primaryLabel="Keep my plan"
          secondaryLabel={loading ? 'Canceling...' : 'Cancel renewal'}
          loading={loading}
          onPrimary={onClose}
          onSecondary={onConfirm}
        />
      </div>
    </div>,
    document.body
  );
}

export function UsageTab() {
  const sub = useSubscription();
  const router = useRouter();
  const [captainModalOpen, setCaptainModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const isLite = sub.planType === 'LITE';
  const isCopilot = sub.planType === 'COPILOT';
  const isCaptain = sub.planType === 'CAPTAIN';
  const periodEndLabel = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
    : null;
  const planLabel = PLAN_LABELS[sub.planType] ?? sub.planType;

  async function handleCancelSubscription() {
    setCancelLoading(true);
    setCancelError(null);
    try {
      const res = await fetch('/api/stripe/cancel-subscription', { method: 'POST' });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setCancelError(data.error ?? 'Could not cancel subscription.');
        return;
      }
      setCancelModalOpen(false);
      window.dispatchEvent(new CustomEvent('aladdin:subscription-refresh'));
    } catch {
      setCancelError('Could not cancel subscription.');
    } finally {
      setCancelLoading(false);
    }
  }

  if (sub.isLoading) {
    return (
      <div style={{ padding: '24px', color: 'var(--text-secondary)', fontSize: '14px' }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Current plan</div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text)' }}>
            {planLabel}
          </div>
          {periodEndLabel && !isLite && !sub.cancelAtPeriodEnd && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Resets on {periodEndLabel}
            </div>
          )}
          {periodEndLabel && !isLite && sub.cancelAtPeriodEnd && (
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Access until {periodEndLabel}
            </div>
          )}
        </div>

        {isLite && (
          <button
            onClick={() => router.push('/upgrade')}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: 'var(--accent)', color: 'white', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            Upgrade
          </button>
        )}

        {isCopilot && (
          <button
            onClick={() => setCaptainModalOpen(true)}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: 'var(--accent)', color: 'white', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            Upgrade to Captain
          </button>
        )}

        {isCaptain && (
          <button
            onClick={() => router.push('/upgrade')}
            style={{
              padding: '8px 14px', borderRadius: '8px', border: 'none',
              background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600,
            }}
          >
            Change plan
          </button>
        )}
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
          Upgrade to Copilot to unlock AI-powered features.
        </p>
      )}

      {!isLite && (
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {sub.cancelAtPeriodEnd ? (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
              Your subscription is canceled and will not renew. You keep {planLabel}
              {periodEndLabel ? ` until ${periodEndLabel}` : ' until the end of this billing period'}.
            </p>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCancelError(null);
                setCancelModalOpen(true);
              }}
              disabled={cancelLoading}
              style={{
                alignSelf: 'flex-start',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: cancelLoading ? 'default' : 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                opacity: cancelLoading ? 0.7 : 1,
              }}
            >
              <XCircle size={15} aria-hidden />
              {cancelLoading ? 'Canceling...' : 'Cancel subscription'}
            </button>
          )}
          {cancelError && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--danger, #dc2626)' }}>
              {cancelError}
            </p>
          )}
        </div>
      )}

      <LimitReachedModal
        open={captainModalOpen}
        onClose={() => setCaptainModalOpen(false)}
        feature="resumesGenerated"
        resetDate={sub.currentPeriodEnd}
        mode="upgrade"
      />

      <CancelSubscriptionModal
        open={cancelModalOpen}
        planLabel={planLabel}
        periodEndLabel={periodEndLabel}
        loading={cancelLoading}
        error={cancelError}
        onClose={() => {
          if (!cancelLoading) setCancelModalOpen(false);
        }}
        onConfirm={handleCancelSubscription}
      />
    </div>
  );
}
