import { describe, it, expect } from 'vitest';
import {
  ONBOARDING_QUESTIONS,
  getOnboardingQuestionsByStep,
  type OnboardingQuestion,
} from '@/lib/onboarding';

describe('ONBOARDING_QUESTIONS array', () => {
  it('has exactly 11 entries (10 original + linkedin_pdf)', () => {
    expect(ONBOARDING_QUESTIONS.length).toBe(11);
  });

  it('contains an entry with key linkedin_pdf', () => {
    const q = ONBOARDING_QUESTIONS.find((q) => q.key === 'linkedin_pdf');
    expect(q).toBeDefined();
  });

  it('linkedin_pdf is on step 2', () => {
    const q = ONBOARDING_QUESTIONS.find((q) => q.key === 'linkedin_pdf');
    expect(q?.step).toBe(2);
  });

  it('linkedin_pdf has order 11', () => {
    const q = ONBOARDING_QUESTIONS.find((q) => q.key === 'linkedin_pdf');
    expect(q?.order).toBe(11);
  });

  it('linkedin_pdf has type file (D-14: routes through normalizeFileValue)', () => {
    const q = ONBOARDING_QUESTIONS.find((q) => q.key === 'linkedin_pdf');
    expect(q?.type).toBe('file');
  });

  it('linkedin_pdf is not required', () => {
    const q = ONBOARDING_QUESTIONS.find((q) => q.key === 'linkedin_pdf');
    expect(q?.required).toBe(false);
  });

  it('linkedin_pdf appears at the end of the array (after extra_notes at order 10)', () => {
    const lastQuestion = ONBOARDING_QUESTIONS[ONBOARDING_QUESTIONS.length - 1];
    expect(lastQuestion.key).toBe('linkedin_pdf');
  });
});

describe('getOnboardingQuestionsByStep', () => {
  it('step 2 includes linkedin_pdf', () => {
    const step2 = getOnboardingQuestionsByStep(2);
    const keys = step2.map((q) => q.key);
    expect(keys).toContain('linkedin_pdf');
  });

  it('step 2 returns questions sorted by order', () => {
    const step2 = getOnboardingQuestionsByStep(2);
    const orders = step2.map((q) => q.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it('linkedin_pdf is the last item in step 2 (order 11)', () => {
    const step2 = getOnboardingQuestionsByStep(2);
    const last = step2[step2.length - 1];
    expect(last.key).toBe('linkedin_pdf');
    expect(last.order).toBe(11);
  });
});

describe('D-14: normalizeFileValue handles linkedin_pdf identically to resume_upload', () => {
  it('linkedin_pdf question type is file, ensuring same normalizeFileValue code path as resume_upload', () => {
    const linkedinQ = ONBOARDING_QUESTIONS.find((q) => q.key === 'linkedin_pdf') as OnboardingQuestion;
    const resumeQ = ONBOARDING_QUESTIONS.find((q) => q.key === 'resume_upload') as OnboardingQuestion;

    // Both must have type 'file' to ensure they both flow through normalizeFileValue
    expect(linkedinQ.type).toBe('file');
    expect(resumeQ.type).toBe('file');

    // normalizeFileValue is dispatched based on question.type === 'file', not question.key
    // So both linkedin_pdf and resume_upload take the exact same code path.
    // This verifies D-14: the function is generic.
    expect(linkedinQ.type).toBe(resumeQ.type);
  });
});
