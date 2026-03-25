'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import {
  ONBOARDING_STEP_META,
  getOnboardingQuestionsByStep,
} from '@/lib/onboarding';
import { StepOne } from '@/components/onboarding/StepOne';
import { StepTwo } from '@/components/onboarding/StepTwo';

const STEP_LABELS = ['About You', 'Your Resume'];

export function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const step1Questions = getOnboardingQuestionsByStep(1);
  const step2Questions = getOnboardingQuestionsByStep(2);

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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error('[OnboardingWizard] Failed to save step 1:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setCurrentStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Loader2 style={{ width: 32, height: 32, color: '#6366f1', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const progressPct = currentStep === 1 ? 50 : 100;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 16px 80px' }}>
      <div style={{ width: '100%', maxWidth: 620 }}>

        {/* Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 36 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles style={{ width: 16, height: 16, color: 'white' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>Aladdin</span>
        </div>

        {/* Step header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'rgba(255,255,255,0.95)', marginBottom: 6, letterSpacing: '-0.02em' }}>
            {currentStep === 1 ? 'Personalize your job search' : 'Your resume & notes'}
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)' }}>
            {currentStep === 1
              ? "Tell us what you're looking for so we can surface the right opportunities."
              : 'Optionally upload your resume so we can tailor recommendations.'}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {STEP_LABELS.map((label, i) => {
                const stepNum = i + 1;
                const done = currentStep > stepNum;
                const active = currentStep === stepNum;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: done ? '#6366f1' : active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.07)',
                      border: `2px solid ${done || active ? '#6366f1' : 'rgba(255,255,255,0.12)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      color: done || active ? (done ? 'white' : '#a5b4fc') : 'rgba(255,255,255,0.3)',
                    }}>
                      {done ? '✓' : stepNum}
                    </div>
                    <span style={{
                      fontSize: 12,
                      fontWeight: active ? 600 : 400,
                      color: active ? 'rgba(255,255,255,0.8)' : done ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
                    }}>
                      {label}
                    </span>
                    {i < STEP_LABELS.length - 1 && (
                      <div style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.1)', marginLeft: 4, marginRight: 4 }} />
                    )}
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>{progressPct}%</span>
          </div>

          {/* Progress track */}
          <div style={{
            height: 4, borderRadius: 9999,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${progressPct}%`,
              borderRadius: 9999,
              background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Step content */}
        <div style={{ marginBottom: 32 }}>
          {currentStep === 1 && (
            <StepOne questions={step1Questions} answers={answers} setAnswers={setAnswers} />
          )}
          {currentStep === 2 && (
            <StepTwo questions={step2Questions} answers={answers} setAnswers={setAnswers} />
          )}
        </div>

        {/* Nav buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {currentStep === 2 ? (
            <button
              type="button"
              onClick={handleBack}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '10px 18px', borderRadius: 10,
                fontSize: 14, fontWeight: 500,
                border: '1.5px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.05)',
                color: 'rgba(255,255,255,0.65)',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <ArrowLeft style={{ width: 15, height: 15 }} />
              Back
            </button>
          ) : (
            <div />
          )}

          {currentStep === 1 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 22px', borderRadius: 10,
                fontSize: 14, fontWeight: 600,
                border: 'none',
                background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                outline: 'none',
                boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
              }}
            >
              {saving ? <Loader2 style={{ width: 15, height: 15 }} /> : null}
              Continue
              {!saving && <ArrowRight style={{ width: 15, height: 15 }} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={saving}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '11px 22px', borderRadius: 10,
                fontSize: 14, fontWeight: 600,
                border: 'none',
                background: saving ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: 'white',
                cursor: saving ? 'not-allowed' : 'pointer',
                outline: 'none',
                boxShadow: '0 4px 15px rgba(99,102,241,0.35)',
              }}
            >
              {saving ? <Loader2 style={{ width: 15, height: 15 }} /> : null}
              Finish setup
              {!saving && <Sparkles style={{ width: 14, height: 14 }} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
