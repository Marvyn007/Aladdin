'use client';

import { useState, useEffect } from 'react';
import { UNLIMITED } from '@/lib/subscription/tier-config';

export interface SubscriptionState {
  planType: 'LITE' | 'COPILOT' | 'CAPTAIN';
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  usage: {
    resumesGenerated: number;
    coverLettersGenerated: number;
    emailsRetrieved: number;
    linkedinRetrieved: number;
  };
  limits: {
    resumesGenerated: number;
    coverLettersGenerated: number;
    emailsRetrieved: number;
    linkedinRetrieved: number;
  };
  isLoading: boolean;
}

const DEFAULT_STATE: SubscriptionState = {
  planType: 'LITE',
  status: 'active',
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
  usage: { resumesGenerated: 0, coverLettersGenerated: 0, emailsRetrieved: 0, linkedinRetrieved: 0 },
  limits: { resumesGenerated: 0, coverLettersGenerated: 0, emailsRetrieved: 0, linkedinRetrieved: 0 },
  isLoading: true,
};

async function fetchSubscription(): Promise<Partial<SubscriptionState>> {
  const r = await fetch('/api/user/subscription');
  if (!r.ok) throw new Error(`subscription API ${r.status}`);
  const data = await r.json() as Partial<SubscriptionState> & { error?: string };
  if (data.error || !data.planType) throw new Error(data.error ?? 'missing planType');
  return data;
}

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;
    let retries = 0;

    async function load() {
      setState((s) => ({ ...s, isLoading: true }));
      while (retries < 3) {
        try {
          const data = await fetchSubscription();
          if (!cancelled) setState({ ...DEFAULT_STATE, ...data, isLoading: false });
          return;
        } catch (err) {
          retries++;
          if (retries < 3) {
            await new Promise((res) => setTimeout(res, 800 * retries));
          }
        }
      }
      if (!cancelled) setState((s) => ({ ...s, isLoading: false }));
    }

    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const onRefresh = () => {
      fetchSubscription()
        .then((data) => setState((prev) => ({ ...prev, ...data, isLoading: false })))
        .catch(() => setState((s) => ({ ...s, isLoading: false })));
    };
    window.addEventListener('aladdin:subscription-refresh', onRefresh);
    return () => window.removeEventListener('aladdin:subscription-refresh', onRefresh);
  }, []);

  return state;
}

export function isFeatureLocked(
  feature: keyof SubscriptionState['usage'],
  state: SubscriptionState
): boolean {
  return state.usage[feature] >= state.limits[feature];
}

export function isUnlimited(limit: number): boolean {
  return limit === UNLIMITED;
}
