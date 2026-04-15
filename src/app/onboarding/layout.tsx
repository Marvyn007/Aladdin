import './theme.css';
import { OnboardingShell } from './OnboardingShell';

import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getOnboardingSnapshot } from '@/lib/onboarding-db';

export const metadata: Metadata = {
  title: 'Onboarding | Aladdin',
};

const ONBOARDING_ENTRY_COOKIE = 'aladdin_onboarding_entry';

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/');
  }

  const snapshot = await getOnboardingSnapshot(userId);
  if (snapshot.allRequiredAnswered) {
    redirect('/');
  }

  const entry = (await cookies()).get(ONBOARDING_ENTRY_COOKIE)?.value;
  if (entry !== '1') {
    redirect('/');
  }

  return (
    <OnboardingShell>
      {children}
    </OnboardingShell>
  );
}
