import { QuestionMultiSelect } from '@/components/onboarding/QuestionMultiSelect';
import { QuestionSingleSelect } from '@/components/onboarding/QuestionSingleSelect';
import { QuestionJobFunction } from '@/components/onboarding/QuestionJobFunction';
import type { OnboardingQuestion, JobFunctionValue } from '@/lib/onboarding';
import { JOB_FUNCTION_TAXONOMY } from '@/lib/onboarding';

interface StepOneProps {
  questions: OnboardingQuestion[];
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}

const sectionStyle: React.CSSProperties = {
  marginBottom: 28,
};

const titleRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 4,
  marginBottom: 4,
};

const titleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--ot-text)',
  letterSpacing: '-0.01em',
};

const descStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--ot-text-muted)',
  marginBottom: 10,
  lineHeight: 1.45,
};

export function StepOne({ questions, answers, setAnswers }: StepOneProps) {
  return (
    <div>
      {questions.map((question) => (
        <div
          key={question.key}
          style={{
            ...sectionStyle,
            ...(question.type === 'job_function' ? { position: 'relative', zIndex: 10 } : {}),
          }}
        >
          <div style={titleRowStyle}>
            {question.required && (
              <span style={{ color: 'var(--color-destructive)', fontSize: 13, lineHeight: 1 }} aria-hidden>
                *
              </span>
            )}
            <div style={titleStyle}>{question.title}</div>
          </div>
          <div style={descStyle}>{question.description}</div>
          {question.type === 'job_function' && (
            <QuestionJobFunction
              taxonomy={JOB_FUNCTION_TAXONOMY}
              value={(answers[question.key] as JobFunctionValue) ?? { industries: [], subcategories: [], roles: [] }}
              onChange={(val) => setAnswers((prev) => ({ ...prev, [question.key]: val }))}
            />
          )}
          {question.type === 'multi_select' && (
            <QuestionMultiSelect
              question={question}
              value={Array.isArray(answers[question.key]) ? (answers[question.key] as string[]) : []}
              onChange={(val) => setAnswers((prev) => ({ ...prev, [question.key]: val }))}
            />
          )}
          {question.type === 'single_select' && (
            <QuestionSingleSelect
              question={question}
              value={typeof answers[question.key] === 'string' ? (answers[question.key] as string) : null}
              onChange={(val) => setAnswers((prev) => ({ ...prev, [question.key]: val }))}
            />
          )}
        </div>
      ))}
    </div>
  );
}
