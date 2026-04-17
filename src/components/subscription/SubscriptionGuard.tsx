'use client';

import { ReactNode, useState } from 'react';
import { Lock } from 'lucide-react';
import { useSubscription, isFeatureLocked } from '@/hooks/useSubscription';
import { UpgradeCTAModal } from './UpgradeCTAModal';

interface SubscriptionGuardProps {
  feature: keyof ReturnType<typeof useSubscription>['usage'];
  children: ReactNode;
  reason?: string;
}

export function SubscriptionGuard({ feature, children, reason }: SubscriptionGuardProps) {
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
        <UpgradeCTAModal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          reason={reason}
        />
      )}
    </>
  );
}
