'use client';

import { OnboardingUploadsScreen } from '@/components/onboarding/OnboardingUploadsScreen';
import { useState } from 'react';

export default function OnboardingUploadsPage() {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [substep, setSubstep] = useState<'resume' | 'linkedin'>('resume');

  return (
    <main>
      <OnboardingUploadsScreen
        answers={answers}
        setAnswers={setAnswers}
        substep={substep}
        setSubstep={setSubstep}
        onBackToStepOne={() => setSubstep('resume')}
        onContinueToStepThree={() => undefined}
      />
    </main>
  );
}
