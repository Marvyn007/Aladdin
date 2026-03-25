'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  ONBOARDING_STEP_META,
  getOnboardingQuestionsByStep,
} from '@/lib/onboarding';
import { StepOne } from '@/components/onboarding/StepOne';
import { StepTwo } from '@/components/onboarding/StepTwo';

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const step1Questions = getOnboardingQuestionsByStep(1);
  const step2Questions = getOnboardingQuestionsByStep(2);

  // Load existing snapshot on mount
  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const res = await fetch('/api/onboarding');
        if (res.ok) {
          const snapshot = await res.json();
          if (snapshot.completed) {
            router.push('/');
            return;
          }
          // Populate answers from snapshot
          const loadedAnswers: Record<string, unknown> = {};
          for (const [key, record] of Object.entries(snapshot.answersByKey ?? {})) {
            loadedAnswers[key] = (record as { value: unknown }).value;
          }
          setAnswers(loadedAnswers);
          if (snapshot.state?.currentStep === 2) {
            setCurrentStep(2);
          }
        }
      } catch (err) {
        console.error('[OnboardingWizard] Failed to load snapshot:', err);
      } finally {
        setLoading(false);
      }
    };

    void loadSnapshot();
  }, [router]);

  const handleNext = async () => {
    setSaving(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStep: 1,
          answers: Object.entries(answers).map(([questionKey, value]) => ({ questionKey, value })),
        }),
      });
      setCurrentStep(2);
    } catch (err) {
      console.error('[OnboardingWizard] Failed to save step 1:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStep: 2,
          complete: true,
          answers: Object.entries(answers).map(([questionKey, value]) => ({ questionKey, value })),
        }),
      });
      router.push('/');
    } catch (err) {
      console.error('[OnboardingWizard] Failed to complete onboarding:', err);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Progress value={currentStep === 1 ? 50 : 100} className="mb-6" />

      <p className="text-sm text-muted-foreground">
        Step {currentStep} of 2 &mdash; {ONBOARDING_STEP_META[currentStep].title}
      </p>

      {currentStep === 1 && (
        <StepOne
          questions={step1Questions}
          answers={answers}
          setAnswers={setAnswers}
        />
      )}

      {currentStep === 2 && (
        <StepTwo
          questions={step2Questions}
          answers={answers}
          setAnswers={setAnswers}
        />
      )}

      <div className="flex items-center justify-between pt-4">
        {currentStep === 2 ? (
          <Button variant="outline" onClick={() => setCurrentStep(1)}>
            Back
          </Button>
        ) : (
          <div />
        )}

        {currentStep === 1 ? (
          <Button onClick={handleNext} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Next
          </Button>
        ) : (
          <Button onClick={handleComplete} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Complete
          </Button>
        )}
      </div>
    </div>
  );
}
