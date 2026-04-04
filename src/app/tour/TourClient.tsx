'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TourOverlay } from '@/components/tour/TourOverlay';
import { Dashboard } from '@/components/Dashboard';

/**
 * Client entry point for the tour page.
 * - Redirects mobile users (< 1024px) to onboarding immediately,
 *   marking toured=true so they never return here.
 * - Desktop/laptop users see the real Dashboard beneath the TourOverlay.
 */
export function TourClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleMobile = async () => {
      if (window.innerWidth < 1024) {
        await fetch('/api/tour/complete', { method: 'PATCH' }).catch(() => {});
        router.push('/onboarding');
        return;
      }
      setReady(true);
    };
    handleMobile();
  }, [router]);

  const handleComplete = async () => {
    await fetch('/api/tour/complete', { method: 'PATCH' }).catch(() => {});
  };

  if (!ready) return null;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* Real dashboard in background — pointer-events disabled so user can't interact */}
      <div style={{ pointerEvents: 'none', width: '100%', height: '100%' }}>
        <Dashboard />
      </div>

      {/* Tour overlay on top */}
      <TourOverlay onComplete={handleComplete} />
    </div>
  );
}
