'use client';

import { ReactNode, useState } from 'react';
import { Lock } from 'lucide-react';
import { useSubscription, isFeatureLocked, SubscriptionState } from '@/hooks/useSubscription';
import { PricingModal } from './PricingModal';

interface SubscriptionGuardProps {
  feature: keyof SubscriptionState['usage'];
  children: ReactNode;
}

export function SubscriptionGuard({ feature, children }: SubscriptionGuardProps) {
  const sub = useSubscription();
  const [modalOpen, setModalOpen] = useState(false);

  if (sub.isLoading) return <>{children}</>;

  const locked = isFeatureLocked(feature, sub);

  if (!locked) return <>{children}</>;

  return (
    <>
      <div
        style={{ position: 'relative', display: 'inline-block', cursor: 'pointer' }}
        onClick={() => setModalOpen(true)}
      >
        <div style={{ opacity: 0.5, pointerEvents: 'none', userSelect: 'none' }}>
          {children}
        </div>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lock size={16} color="var(--text-secondary)" />
        </div>
      </div>
      {modalOpen && (
        <PricingModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          sub={sub}
        />
      )}
    </>
  );
}
