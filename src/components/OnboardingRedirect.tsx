'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';

const ONBOARDING_SHOWN_KEY = 'onboardingShown';

/**
 * OnboardingRedirect — invisible client component that redirects first-time users
 * to /onboarding ONCE on first sign-in.
 *
 * Behavior per D-01:
 * - Uses `isNew: true` from POST /api/user/init to detect first-time users.
 *   isNew is only true on the very first init call (when user has no username yet).
 * - Persists `onboardingShown` in localStorage so redirect fires ONCE per browser,
 *   even if user dismisses onboarding without completing it.
 * - Does NOT redirect returning users who haven't completed onboarding —
 *   they can use the Sidebar "Onboarding" link (per D-02) to revisit voluntarily.
 * - Uses router.replace (not push) so /onboarding replaces history entry (per D-03).
 * - On error, fails open (user stays on dashboard).
 */
export function OnboardingRedirect() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || checked) return;

    // Check localStorage first — if onboardingShown is set, skip entirely (per D-01)
    const alreadyShown = localStorage.getItem(ONBOARDING_SHOWN_KEY);
    if (alreadyShown === 'true') {
      setChecked(true);
      return;
    }

    // Call /api/user/init to check isNew flag (per D-01)
    // This endpoint returns isNew: true ONLY on first-ever sign-in
    // (when user has no username yet). After first call, isNew is false.
    fetch('/api/user/init', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.isNew) {
          // First-time user — redirect to onboarding and persist the flag
          localStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
          router.replace('/onboarding');
        } else {
          // Returning user — mark as shown so we never check again
          localStorage.setItem(ONBOARDING_SHOWN_KEY, 'true');
        }
        setChecked(true);
      })
      .catch(() => {
        // On error, don't redirect — let user use the dashboard (fail open)
        setChecked(true);
      });
  }, [isLoaded, isSignedIn, checked, router]);

  return null; // Invisible component, only performs redirect logic
}
