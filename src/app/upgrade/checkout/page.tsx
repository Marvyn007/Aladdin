import { Suspense } from 'react';
import type { Metadata } from 'next';
import { UpgradeCheckoutClient } from '@/components/upgrade/UpgradeCheckoutClient';

export const metadata: Metadata = {
  title: 'Checkout | Aladdin',
  description: 'Complete your Aladdin subscription',
};

function CheckoutFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        background: '#f4f5f7',
        color: '#64748b',
        fontSize: 14,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid #e2e8f0',
          borderTopColor: '#0d9488',
          borderRadius: '50%',
          animation: 'spin 0.85s linear infinite',
        }}
      />
      <span>Loading checkout…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function UpgradeCheckoutPage() {
  return (
    <Suspense fallback={<CheckoutFallback />}>
      <UpgradeCheckoutClient />
    </Suspense>
  );
}
