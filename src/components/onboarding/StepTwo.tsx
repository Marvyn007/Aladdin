import { QuestionMultiSelect } from '@/components/onboarding/QuestionMultiSelect';
import { QuestionSingleSelect } from '@/components/onboarding/QuestionSingleSelect';
import { QuestionFileUpload } from '@/components/onboarding/QuestionFileUpload';
import { QuestionText } from '@/components/onboarding/QuestionText';
import type { OnboardingQuestion } from '@/lib/onboarding';

interface FileUploadValue {
  resumeId: string;
  filename: string;
}

interface StepTwoProps {
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

export function StepTwo({ questions, answers, setAnswers }: StepTwoProps) {
  return (
    <div>
      {questions.map((question) => (
        <div key={question.key} style={sectionStyle}>
          <div style={titleRowStyle}>
            {question.required && (
              <span style={{ color: 'var(--color-destructive)', fontSize: 13, lineHeight: 1 }} aria-hidden>
                *
              </span>
            )}
            <div style={titleStyle}>{question.title}</div>
          </div>
          <div style={descStyle}>{question.description}</div>
          {question.type === 'single_select' && (
            <QuestionSingleSelect
              question={question}
              value={typeof answers[question.key] === 'string' ? (answers[question.key] as string) : null}
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
          {question.type === 'file' && (
            <QuestionFileUpload
              question={question}
              value={
                answers[question.key] != null && typeof answers[question.key] === 'object'
                  ? (answers[question.key] as FileUploadValue)
                  : null
              }
              onChange={(val) => setAnswers((prev) => ({ ...prev, [question.key]: val }))}
              showInfoTooltip={question.key === 'linkedin_pdf'}
            />
          )}
          {question.type === 'text' && (
            <QuestionText
              question={question}
              value={typeof answers[question.key] === 'string' ? (answers[question.key] as string) : ''}
              onChange={(val) => setAnswers((prev) => ({ ...prev, [question.key]: val }))}
            />
          )}
        </div>
      ))}
    </div>
  );
}
