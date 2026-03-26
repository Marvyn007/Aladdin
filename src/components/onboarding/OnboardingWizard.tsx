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
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string, durationMs = 3500) => {
    setToast(msg);
    setTimeout(() => setToast(null), durationMs);
  };

  const step1Questions = getOnboardingQuestionsByStep(1);
  const step2Questions = getOnboardingQuestionsByStep(2);

  useEffect(() => {
    const loadSnapshot = async () => {
      try {
        const res = await fetch('/api/onboarding');
        if (res.ok) {
          const snapshot = await res.json();
          // Don't redirect if already completed — user can revisit anytime
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

  const handleSkip = async () => {
    setSaving(true);
    try {
      // Save whatever answers exist so far without marking complete
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentStep,
          answers: Object.entries(answers).map(([questionKey, value]) => ({ questionKey, value })),
        }),
      });
    } catch {
      // Non-blocking — navigate regardless
    } finally {
      setSaving(false);
    }
    router.push('/');
  };

  const handleComplete = async () => {
    // Check which sections are incomplete — warn the user at the bottom (non-blocking)
    const hasPrefs = step1Questions.some((q) => answers[q.key] != null && answers[q.key] !== '');
    const hasResume = (() => {
      const v = answers['resume_upload'];
      return v != null && typeof v === 'object';
    })();
    const hasLinkedin = (() => {
      const v = answers['linkedin_pdf'];
      return v === 'skipped' || (v != null && typeof v === 'object');
    })();

    const missing: string[] = [];
    if (!hasPrefs) missing.push('job preferences');
    if (!hasResume) missing.push('resume');
    if (!hasLinkedin) missing.push('LinkedIn profile');

    if (missing.length > 0) {
      showToast(`Heads up: you haven't completed your ${missing.join(', ')}. You can finish later from Account Settings.`);
    }

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
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 style={{ width: 32, height: 32, color: 'var(--ot-primary)', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const progressPct = currentStep === 1 ? 50 : 100;

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '52px 10% 96px',
      }}
    >
      <div style={{ width: '100%' }}>

        {/* ── Branding ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: 'var(--ot-primary-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 12px var(--ot-primary-glow)',
              flexShrink: 0,
            }}
          >
            <Sparkles style={{ width: 17, height: 17, color: 'var(--ot-primary-fg)' }} />
          </div>
          <span
            style={{
              fontFamily: "'Cinzel', serif",
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--ot-primary)',
              letterSpacing: '0.06em',
            }}
          >
            Aladdin
          </span>
        </div>

        {/* ── Step header ── */}
        <div style={{ marginBottom: 28 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              color: 'var(--ot-text)',
              marginBottom: 8,
              letterSpacing: '-0.02em',
              lineHeight: 1.25,
            }}
          >
            {currentStep === 1 ? 'Personalize your job search' : 'Your resume & notes'}
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ot-text-muted)', lineHeight: 1.6 }}>
            {currentStep === 1
              ? "Tell us what you're looking for so we can surface the right opportunities."
              : 'Optionally upload your resume so we can tailor your recommendations.'}
          </p>
        </div>

        {/* ── Step indicator + progress bar ── */}
        <div style={{ marginBottom: 36 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {STEP_LABELS.map((label, i) => {
                const stepNum = i + 1;
                const done = currentStep > stepNum;
                const active = currentStep === stepNum;
                return (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: '50%',
                        background: done
                          ? 'var(--ot-primary)'
                          : active
                          ? 'var(--ot-primary-alpha)'
                          : 'var(--ot-step-inactive-bg)',
                        border: `2px solid ${done || active ? 'var(--ot-primary)' : 'var(--ot-step-inactive-border)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 10,
                        fontWeight: 700,
                        color: done
                          ? 'var(--ot-primary-fg)'
                          : active
                          ? 'var(--ot-primary)'
                          : 'var(--ot-step-inactive-color)',
                        transition: 'all 0.25s ease',
                      }}
                    >
                      {done ? '✓' : stepNum}
                    </div>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: active ? 600 : 400,
                        color: active
                          ? 'var(--ot-text)'
                          : done
                          ? 'var(--ot-step-done-color)'
                          : 'var(--ot-step-inactive-color)',
                        transition: 'color 0.25s ease',
                      }}
                    >
                      {label}
                    </span>
                    {i < STEP_LABELS.length - 1 && (
                      <div
                        style={{
                          width: 28,
                          height: 1,
                          background: 'var(--ot-track-bg)',
                          marginLeft: 2,
                          marginRight: 2,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: 'var(--ot-text-muted)' }}>{progressPct}%</span>
          </div>

          {/* Progress track */}
          <div
            style={{
              height: 4,
              borderRadius: 9999,
              background: 'var(--ot-track-bg)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                borderRadius: 9999,
                background: 'var(--ot-primary-gradient)',
                transition: 'width 0.45s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </div>
        </div>

        {/* ── Step content ── */}
        <div style={{ marginBottom: 36 }}>
          {currentStep === 1 && (
            <StepOne questions={step1Questions} answers={answers} setAnswers={setAnswers} />
          )}
          {currentStep === 2 && (
            <StepTwo questions={step2Questions} answers={answers} setAnswers={setAnswers} />
          )}
        </div>

        {/* ── Navigation buttons ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {currentStep === 2 ? (
            <button
              type="button"
              onClick={handleBack}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 500,
                border: '1.5px solid var(--ot-ghost-border)',
                background: 'var(--ot-ghost-bg)',
                color: 'var(--ot-ghost-color)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <ArrowLeft style={{ width: 15, height: 15 }} />
              Back
            </button>
          ) : (
            <div />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Skip — always visible */}
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              style={{
                background: 'none',
                border: 'none',
                padding: '10px 4px',
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--ot-text-muted)',
                cursor: saving ? 'not-allowed' : 'pointer',
                outline: 'none',
                opacity: saving ? 0.5 : 1,
                textDecoration: 'underline',
                textDecorationColor: 'transparent',
                transition: 'color 0.15s ease, text-decoration-color 0.15s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--ot-text)'; e.currentTarget.style.textDecorationColor = 'var(--ot-text)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--ot-text-muted)'; e.currentTarget.style.textDecorationColor = 'transparent'; }}
            >
              Skip for now
            </button>

            {currentStep === 1 ? (
              <button
                type="button"
                onClick={handleNext}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 24px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  background: saving ? 'var(--ot-primary-alpha)' : 'var(--ot-primary-gradient)',
                  color: saving ? 'var(--ot-primary)' : 'var(--ot-primary-fg)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  boxShadow: saving ? 'none' : '0 4px 18px var(--ot-primary-glow)',
                }}
              >
                {saving && <Loader2 style={{ width: 15, height: 15 }} />}
                Continue
                {!saving && <ArrowRight style={{ width: 15, height: 15 }} />}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '11px 24px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  border: 'none',
                  background: saving ? 'var(--ot-primary-alpha)' : 'var(--ot-primary-gradient)',
                  color: saving ? 'var(--ot-primary)' : 'var(--ot-primary-fg)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  boxShadow: saving ? 'none' : '0 4px 18px var(--ot-primary-glow)',
                }}
              >
                {saving && <Loader2 style={{ width: 15, height: 15 }} />}
                Finish setup
                {!saving && <Sparkles style={{ width: 14, height: 14 }} />}
              </button>
            )}
          </div>
        </div>

      </div>

      {/* ── Bottom toast (non-blocking warning) ── */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            maxWidth: 480,
            width: 'calc(100% - 48px)',
            padding: '12px 18px',
            borderRadius: 10,
            background: 'var(--ot-card-bg, rgba(30,30,40,0.96))',
            border: '1px solid var(--ot-card-border, rgba(255,255,255,0.12))',
            boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            color: 'var(--ot-text, #e0e0e0)',
            fontSize: 13,
            lineHeight: 1.5,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            animation: 'ot-toast-in 0.28s cubic-bezier(0.22,1,0.36,1) forwards',
          }}
        >
          {/* Warning icon */}
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ot-primary, #a78bfa)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
