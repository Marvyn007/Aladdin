'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileUp,
  Loader2,
  Sparkles,
  Upload,
  ShieldCheck,
  TimerReset,
} from 'lucide-react';
import {
  ONBOARDING_QUESTIONS,
  ONBOARDING_STEP_META,
  getOnboardingQuestionsByStep,
  type OnboardingQuestion,
} from '@/lib/onboarding';
import type { OnboardingSnapshot } from '@/lib/onboarding-db';

type AnswerMap = Record<string, unknown>;

const STEP_ORDER: Array<1 | 2> = [1, 2];

function isMultiValue(value: unknown): value is string[] {
  return Array.isArray(value);
}

function summaryValue(question: OnboardingQuestion, value: unknown): string {
  if (value == null) return 'Not set';

  if (question.type === 'multi_select' && Array.isArray(value)) {
    if (!value.length) return 'Not set';
    return value
      .map((selected) => question.options?.find((option) => option.value === selected)?.label ?? String(selected))
      .join(', ');
  }

  if (question.type === 'single_select' && typeof value === 'string') {
    return question.options?.find((option) => option.value === value)?.label ?? value;
  }

  if (question.type === 'file' && value && typeof value === 'object') {
    const fileValue = value as Record<string, unknown>;
    return String(fileValue.filename || fileValue.resumeId || 'Uploaded');
  }

  if (question.type === 'text' && typeof value === 'string') {
    return value;
  }

  return String(value);
}

function isAnswered(question: OnboardingQuestion, value: unknown): boolean {
  if (question.type === 'multi_select') {
    return Array.isArray(value) && value.length > 0;
  }

  if (question.type === 'single_select') {
    return typeof value === 'string' && value.trim().length > 0;
  }

  if (question.type === 'file') {
    return !!value && typeof value === 'object' && Object.keys(value as Record<string, unknown>).length > 0;
  }

  if (question.type === 'text') {
    return typeof value === 'string' && value.trim().length > 0;
  }

  return false;
}

function StepPill({
  step,
  active,
  complete,
  title,
}: {
  step: number;
  active: boolean;
  complete: boolean;
  title: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-full border px-4 py-2"
      style={{
        borderColor: active ? 'rgba(var(--accent-rgb), 0.35)' : 'var(--border)',
        background: active ? 'var(--accent-muted)' : 'rgba(255,255,255,0.45)',
        boxShadow: active ? '0 0 0 1px rgba(var(--accent-rgb), 0.08)' : 'none',
      }}
    >
      <div
        className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
        style={{
          background: complete ? 'var(--success)' : active ? 'var(--accent)' : 'var(--background-tertiary)',
          color: complete || active ? 'white' : 'var(--text-secondary)',
        }}
      >
        {complete ? <Check size={14} /> : step}
      </div>
      <div className="leading-tight">
        <div className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</div>
      </div>
    </div>
  );
}

function QuestionShell({
  question,
  value,
  saving,
  saved,
  lastUpdated,
  onToggleMulti,
  onSelectSingle,
  onFileUpload,
  onTextChange,
}: {
  question: OnboardingQuestion;
  value: unknown;
  saving: boolean;
  saved: boolean;
  lastUpdated?: string;
  onToggleMulti: (questionKey: string, optionValue: string) => void;
  onSelectSingle: (questionKey: string, optionValue: string) => void;
  onFileUpload: (file: File) => void;
  onTextChange: (text: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="border-b pb-6 last:border-b-0 last:pb-0" style={{ borderColor: 'rgba(55,53,47,0.08)' }}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
            <span>{question.step === 1 ? 'About you' : 'Additional preferences'}</span>
            <span>•</span>
            <span>Question {question.order}</span>
          </div>
          <h3 className="text-[22px] font-semibold leading-tight sm:text-[24px]" style={{ color: 'var(--text-primary)' }}>
            {question.title}
          </h3>
          <p className="mt-2 max-w-2xl text-[14px] leading-6" style={{ color: 'var(--text-secondary)' }}>
            {question.description}
          </p>
          {question.helperText && (
            <p className="mt-2 text-[12px] leading-5" style={{ color: 'var(--text-tertiary)' }}>
              {question.helperText}
            </p>
          )}
          <p
            className="mt-3 rounded-[18px] border px-3 py-2 text-[12px] leading-5"
            style={{
              borderColor: 'rgba(var(--accent-rgb), 0.14)',
              background: 'rgba(var(--accent-rgb), 0.05)',
              color: 'var(--text-secondary)',
            }}
          >
            <strong style={{ color: 'var(--text-primary)' }}>Why this matters:</strong> {question.rationale}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1 text-[12px] font-medium">
          <div className="flex items-center gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1" style={{ background: 'var(--success-muted)', color: 'var(--success)' }}>
                <Check size={12} />
                Saved
              </span>
            )}
            {saving && (
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1" style={{ background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                <Loader2 size={12} className="animate-spin" />
                Saving
              </span>
            )}
            {!saving && !saved && (
              <span className="inline-flex items-center gap-1 rounded-full px-3 py-1" style={{ background: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>
                <TimerReset size={12} />
                Pending
              </span>
            )}
          </div>
          {lastUpdated && (
            <span style={{ color: 'var(--text-tertiary)' }}>
              Updated {new Date(lastUpdated).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {question.type === 'multi_select' && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {question.options?.map((option) => {
            const selected = isMultiValue(value) && value.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onToggleMulti(question.key, option.value)}
                className="flex items-center justify-between gap-3 rounded-full border px-4 py-3 text-left text-[14px] transition-all duration-200"
                style={{
                  borderColor: selected ? 'rgba(var(--accent-rgb), 0.5)' : 'var(--border)',
                  background: selected ? 'var(--accent-muted)' : 'rgba(255,255,255,0.72)',
                  color: 'var(--text-primary)',
                  boxShadow: selected ? '0 0 0 1px rgba(var(--accent-rgb), 0.12)' : 'none',
                  transform: selected ? 'translateY(-1px)' : 'translateY(0px)',
                }}
              >
                <span className="leading-tight">{option.label}</span>
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full border"
                  style={{
                    borderColor: selected ? 'var(--accent)' : 'var(--border)',
                    background: selected ? 'var(--accent)' : 'transparent',
                    color: selected ? 'white' : 'transparent',
                  }}
                >
                  <Check size={12} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'single_select' && (
        <div className="flex flex-wrap gap-2">
          {question.options?.map((option) => {
            const selected = typeof value === 'string' && value === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onSelectSingle(question.key, option.value)}
                className="rounded-full border px-4 py-3 text-[14px] transition-all duration-200"
                style={{
                  borderColor: selected ? 'rgba(var(--accent-rgb), 0.5)' : 'var(--border)',
                  background: selected ? 'var(--accent-muted)' : 'rgba(255,255,255,0.72)',
                  color: 'var(--text-primary)',
                  boxShadow: selected ? '0 0 0 1px rgba(var(--accent-rgb), 0.12)' : 'none',
                }}
              >
                {selected && <Check size={14} className="mr-2 inline" />}
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      {question.type === 'file' && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-full border px-5 py-3 text-[14px] font-semibold transition-all duration-200"
            style={{
              borderColor: 'var(--border)',
              background: 'rgba(255,255,255,0.72)',
              color: 'var(--text-primary)',
            }}
          >
            <Upload size={16} />
            Upload PDF
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                onFileUpload(file);
              }
              event.currentTarget.value = '';
            }}
          />

          {isAnswered(question, value) && (
            <div
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[13px]"
              style={{
                borderColor: 'rgba(var(--accent-rgb), 0.25)',
                background: 'rgba(var(--accent-rgb), 0.08)',
                color: 'var(--text-primary)',
              }}
            >
              <FileUp size={14} />
              {summaryValue(question, value)}
            </div>
          )}
        </div>
      )}

      {question.type === 'text' && (
        <textarea
          rows={4}
          value={typeof value === 'string' ? value : ''}
          placeholder={question.placeholder}
          onChange={(event) => onTextChange(event.target.value)}
          className="w-full rounded-[24px] border px-4 py-4 text-[14px] outline-none transition-all duration-200"
          style={{
            borderColor: 'var(--border)',
            background: 'rgba(255,255,255,0.72)',
            color: 'var(--text-primary)',
            resize: 'vertical',
            minHeight: '124px',
          }}
        />
      )}
    </section>
  );
}

export function OnboardingWizard({ initialSnapshot }: { initialSnapshot: OnboardingSnapshot }) {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState<1 | 2>(initialSnapshot.state.currentStep === 2 ? 2 : 1);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [state, setState] = useState(initialSnapshot.state);
  const [progress, setProgress] = useState(initialSnapshot.progress);
  const [requiredAnswered, setRequiredAnswered] = useState(initialSnapshot.requiredAnswered);
  const [requiredTotal, setRequiredTotal] = useState(initialSnapshot.requiredTotal);
  const [savingKeys, setSavingKeys] = useState<Record<string, boolean>>({});
  const [lastUpdated, setLastUpdated] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resumeLabel, setResumeLabel] = useState<string | null>(null);
  const textSaveTimers = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

  const currentStepQuestions = useMemo(() => getOnboardingQuestionsByStep(activeStep), [activeStep]);
  const completedSteps = useMemo(() => {
    return STEP_ORDER.reduce((acc, step) => {
      const questions = getOnboardingQuestionsByStep(step);
      const complete = questions.every((question) => isAnswered(question, answers[question.key]));
      acc[step] = complete;
      return acc;
    }, {} as Record<1 | 2, boolean>);
  }, [answers]);

  const summaryQuestions = useMemo(
    () => ONBOARDING_QUESTIONS.filter((question) => question.required).slice(0, 5),
    []
  );

  const syncSnapshot = useCallback((snapshot: OnboardingSnapshot) => {
    setState(snapshot.state);
    setProgress(snapshot.progress);
    setRequiredAnswered(snapshot.requiredAnswered);
    setRequiredTotal(snapshot.requiredTotal);
    setAnswers(
      Object.fromEntries(
        Object.entries(snapshot.answersByKey).map(([key, answer]) => [key, answer.value])
      )
    );

    if (snapshot.state.currentStep === 2) {
      setActiveStep(2);
    }
  }, []);

  useEffect(() => {
    syncSnapshot(initialSnapshot);
    setLoaded(true);
  }, [initialSnapshot, syncSnapshot]);

  useEffect(() => {
    const timestamps: Record<string, string> = {};
    for (const question of ONBOARDING_QUESTIONS) {
      const answer = initialSnapshot.answersByKey[question.key];
      if (answer?.updatedAt) {
        timestamps[question.key] = answer.updatedAt;
      }
    }
    setLastUpdated(timestamps);
  }, [loaded, initialSnapshot]);

  const persistAnswer = useCallback(
    async (questionKey: string, value: unknown) => {
      setSavingKeys((current) => ({ ...current, [questionKey]: true }));
      setError(null);

      try {
        const response = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answer: { questionKey, value },
            currentStep: activeStep,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to save answer');
        }

        syncSnapshot(data);
      } catch (saveError) {
        console.error('[Onboarding] Failed to persist answer:', saveError);
        setError(saveError instanceof Error ? saveError.message : 'Failed to save answer');
      } finally {
        setSavingKeys((current) => {
          const next = { ...current };
          delete next[questionKey];
          return next;
        });
      }
    },
    [activeStep, syncSnapshot]
  );

  const persistStep = useCallback(
    async (nextStep: 1 | 2) => {
      setSavingKeys((current) => ({ ...current, __step: true }));
      setError(null);

      try {
        const response = await fetch('/api/onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            currentStep: nextStep,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to save step');
        }

        syncSnapshot(data);
        setActiveStep(nextStep);
      } catch (stepError) {
        console.error('[Onboarding] Failed to save step:', stepError);
        setError(stepError instanceof Error ? stepError.message : 'Failed to save step');
      } finally {
        setSavingKeys((current) => {
          const next = { ...current };
          delete next.__step;
          return next;
        });
      }
    },
    [syncSnapshot]
  );

  const updateAnswer = useCallback(
    (questionKey: string, value: unknown) => {
      setAnswers((current) => ({ ...current, [questionKey]: value }));
      void persistAnswer(questionKey, value);
    },
    [persistAnswer]
  );

  const scheduleTextSave = useCallback(
    (questionKey: string, value: string) => {
      if (textSaveTimers.current[questionKey]) {
        clearTimeout(textSaveTimers.current[questionKey] as ReturnType<typeof setTimeout>);
      }

      textSaveTimers.current[questionKey] = setTimeout(() => {
        updateAnswer(questionKey, value);
      }, 500);
    },
    [updateAnswer]
  );

  const toggleMulti = useCallback(
    (questionKey: string, optionValue: string) => {
      const current = answers[questionKey];
      const currentValues = Array.isArray(current) ? current : [];
      const nextValues = currentValues.includes(optionValue)
        ? currentValues.filter((entry) => entry !== optionValue)
        : [...currentValues, optionValue];
      updateAnswer(questionKey, nextValues);
    },
    [answers, updateAnswer]
  );

  const selectSingle = useCallback(
    (questionKey: string, optionValue: string) => {
      updateAnswer(questionKey, optionValue);
    },
    [updateAnswer]
  );

  const uploadResume = useCallback(async (file: File) => {
    setSavingKeys((current) => ({ ...current, resume_upload: true }));
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('setAsDefault', 'true');

      const uploadResponse = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData,
      });

      const uploadData = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error || 'Failed to upload resume');
      }

      const resumeValue = {
        resumeId: uploadData.resume?.id,
        filename: uploadData.resume?.filename || file.name,
      };

      setResumeLabel(uploadData.resume?.filename || file.name);
      setAnswers((current) => ({ ...current, resume_upload: resumeValue }));
      await persistAnswer('resume_upload', resumeValue);
    } catch (uploadError) {
      console.error('[Onboarding] Resume upload failed:', uploadError);
      setError(uploadError instanceof Error ? uploadError.message : 'Failed to upload resume');
    } finally {
      setSavingKeys((current) => {
        const next = { ...current };
        delete next.resume_upload;
        return next;
      });
    }
  }, [persistAnswer]);

  const missingRequiredQuestions = useMemo(
    () =>
      currentStepQuestions.filter((question) => question.required && !isAnswered(question, answers[question.key])),
    [answers, currentStepQuestions]
  );

  const canContinue = missingRequiredQuestions.length === 0;

  const handleBack = () => {
    setActiveStep((current) => (current === 2 ? 1 : 1));
  };

  const handleNext = async () => {
    if (!canContinue) return;
    if (activeStep === 1) {
      await persistStep(2);
      return;
    }

    await finishOnboarding();
  };

  const finishOnboarding = useCallback(async () => {
    setSavingKeys((current) => ({ ...current, __complete: true }));
    setError(null);

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complete: true,
          currentStep: activeStep,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to finish onboarding');
      }

      syncSnapshot(data);
      router.push('/');
    } catch (completeError) {
      console.error('[Onboarding] Failed to finish onboarding:', completeError);
      setError(completeError instanceof Error ? completeError.message : 'Failed to finish onboarding');
    } finally {
      setSavingKeys((current) => {
        const next = { ...current };
        delete next.__complete;
        return next;
      });
    }
  }, [activeStep, router, syncSnapshot]);

  if (!loaded) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border px-4 py-3" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.72)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>Loading your profile...</span>
        </div>
      </div>
    );
  }

  const isComplete = state.status === 'complete' || progress >= 100;

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 15% 20%, rgba(35,131,226,0.12), transparent 28%),
            radial-gradient(circle at 80% 10%, rgba(15,123,108,0.10), transparent 26%),
            radial-gradient(circle at 80% 82%, rgba(35,131,226,0.08), transparent 28%),
            linear-gradient(180deg, rgba(250,248,245,1) 0%, rgba(245,243,239,1) 100%)
          `,
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-4 rounded-[28px] border px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgba(55,53,47,0.08)', background: 'rgba(255,255,255,0.5)' }}>
          <div className="flex items-center gap-3">
            <img src="/aladdin-logo.png" alt="Aladdin" className="h-10 w-10 object-contain" />
            <div>
              <div className="text-[12px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--text-tertiary)' }}>
                Aladdin onboarding
              </div>
              <h1 className="text-[20px] font-semibold sm:text-[24px]" style={{ color: 'var(--text-primary)' }}>
                Build the profile that powers your job matches
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-full border px-4 py-2 text-[12px] font-medium" style={{ borderColor: 'rgba(var(--accent-rgb), 0.2)', background: 'var(--accent-muted)', color: 'var(--accent)' }}>
              <Sparkles size={12} className="mr-1 inline" />
              Answers save automatically
            </div>
            <div className="rounded-full border px-4 py-2 text-[12px] font-semibold" style={{ borderColor: 'rgba(var(--success), 0.2)', background: 'var(--success-muted)', color: 'var(--success)' }}>
              {state.status === 'complete' ? 'Profile complete' : `${progress}% complete`}
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside
            className="order-2 h-fit rounded-[32px] border p-5 lg:order-1 lg:sticky lg:top-6"
            style={{
              borderColor: 'rgba(55,53,47,0.08)',
              background: 'rgba(255,255,255,0.62)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.04)',
            }}
          >
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full border text-lg font-semibold"
                  style={{
                    borderColor: 'rgba(var(--accent-rgb), 0.22)',
                    background: 'conic-gradient(from 0deg, var(--accent) 0deg, var(--accent) ' + progress * 3.6 + 'deg, rgba(var(--accent-rgb), 0.10) ' + progress * 3.6 + 'deg, rgba(var(--accent-rgb), 0.10) 360deg)',
                    color: 'white',
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: 'var(--background)' }}>
                    <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{progress}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                    Progress
                  </p>
                  <p className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {requiredAnswered}/{requiredTotal} core answers saved
                  </p>
                  <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    {isComplete ? 'You can still edit any answer below.' : 'A few choices left, then you are done.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-[24px] border p-4" style={{ borderColor: 'rgba(55,53,47,0.08)', background: 'rgba(250,248,245,0.92)' }}>
                <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                  <ShieldCheck size={14} />
                  What this powers
                </div>
                <ul className="space-y-2 text-[13px] leading-6" style={{ color: 'var(--text-secondary)' }}>
                  <li>• Better matching from day one</li>
                  <li>• Cleaner search filters and alerts</li>
                  <li>• Faster personalization for resume and coaching</li>
                </ul>
              </div>

              <div className="rounded-[24px] border p-4" style={{ borderColor: 'rgba(55,53,47,0.08)', background: 'rgba(250,248,245,0.92)' }}>
                <div className="mb-3 text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                  Your summary
                </div>
                <div className="flex flex-wrap gap-2">
                  {summaryQuestions.map((question) => {
                    const value = answers[question.key];
                    return (
                      <span
                        key={question.key}
                        className="inline-flex max-w-full items-center rounded-full border px-3 py-2 text-[12px]"
                        style={{
                          borderColor: isAnswered(question, value) ? 'rgba(var(--accent-rgb), 0.18)' : 'var(--border)',
                          background: isAnswered(question, value) ? 'var(--accent-muted)' : 'rgba(255,255,255,0.8)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <span className="truncate">
                          {isAnswered(question, value) ? summaryValue(question, value) : question.title}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border p-4" style={{ borderColor: 'rgba(55,53,47,0.08)', background: 'rgba(250,248,245,0.92)' }}>
                <div className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                  <Check size={14} />
                  High-signal extras
                </div>
                <div className="space-y-3 text-[13px] leading-6" style={{ color: 'var(--text-secondary)' }}>
                  <div>Resume upload helps us infer skills and seniority faster.</div>
                  <div>Free-text notes capture salary floor, notice period, and weird constraints.</div>
                  <div>Visa and region answers prevent dead-end recommendations.</div>
                </div>
              </div>
            </div>
          </aside>

          <main className="order-1 min-w-0 rounded-[32px] border p-5 sm:p-6 lg:order-2" style={{ borderColor: 'rgba(55,53,47,0.08)', background: 'rgba(255,255,255,0.72)', boxShadow: '0 22px 55px rgba(0,0,0,0.05)' }}>
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--text-tertiary)' }}>
                  <span>{ONBOARDING_STEP_META[activeStep].title}</span>
                  <span>•</span>
                  <span>{activeStep} of 2</span>
                </div>
                <h2 className="text-[28px] font-semibold sm:text-[34px]" style={{ color: 'var(--text-primary)' }}>
                  {ONBOARDING_STEP_META[activeStep].subtitle}
                </h2>
              </div>

              <div className="flex flex-wrap gap-3">
                <StepPill step={1} active={activeStep === 1} complete={completedSteps[1]} title="Step 1" />
                <StepPill step={2} active={activeStep === 2} complete={completedSteps[2]} title="Step 2" />
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-[20px] border px-4 py-3 text-[14px]" style={{ borderColor: 'rgba(224,62,62,0.25)', background: 'var(--error-muted)', color: 'var(--error)' }}>
                {error}
              </div>
            )}

            <div key={activeStep} className="space-y-8" style={{ animation: 'onboarding-fade-in 220ms ease-out' }}>
              {currentStepQuestions.map((question) => (
                <QuestionShell
                  key={question.key}
                  question={question}
                  value={answers[question.key]}
                  saving={!!savingKeys[question.key]}
                  saved={isAnswered(question, answers[question.key])}
                  lastUpdated={lastUpdated[question.key]}
                  onToggleMulti={toggleMulti}
                  onSelectSingle={selectSingle}
                  onFileUpload={uploadResume}
                  onTextChange={(text) => {
                    if (question.key === 'extra_notes') {
                      scheduleTextSave(question.key, text);
                    }
                  }}
                />
              ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgba(55,53,47,0.08)' }}>
              <button
                type="button"
                onClick={handleBack}
                disabled={activeStep === 1}
                className="inline-flex items-center justify-center gap-2 rounded-full border px-5 py-3 text-[14px] font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderColor: 'var(--border)',
                  background: 'rgba(255,255,255,0.72)',
                  color: 'var(--text-primary)',
                }}
              >
                <ArrowLeft size={16} />
                Back
              </button>

              <div className="flex flex-col gap-2 sm:items-end">
                {!canContinue && (
                  <div className="text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
                    Finish the required fields on this step to continue.
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!canContinue || !!savingKeys.__complete}
                  className="inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{
                    background: 'linear-gradient(135deg, var(--text-primary) 0%, #111 100%)',
                    boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
                  }}
                >
                  {savingKeys.__complete ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving
                    </>
                  ) : activeStep === 1 ? (
                    <>
                      Continue
                      <ArrowRight size={16} />
                    </>
                  ) : (
                    <>
                      Finish onboarding
                      <Check size={16} />
                    </>
                  )}
                </button>
              </div>
            </div>
          </main>
        </div>

        <div className="pb-4 text-center text-[12px]" style={{ color: 'var(--text-tertiary)' }}>
          {resumeLabel ? `Resume saved: ${resumeLabel}` : 'Resume is optional, but it helps us personalize faster.'}
        </div>
      </div>

      <style jsx>{`
        @keyframes onboarding-fade-in {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
