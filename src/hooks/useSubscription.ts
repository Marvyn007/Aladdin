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

export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>(DEFAULT_STATE);

  useEffect(() => {
    fetch('/api/user/subscription')
      .then((r) => r.json())
      .then((data) => setState({ ...data, isLoading: false }))
      .catch(() => setState((s) => ({ ...s, isLoading: false })));
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
