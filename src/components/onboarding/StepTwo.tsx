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

const cardStyle: React.CSSProperties = {
  borderRadius: 16,
  border: '1px solid var(--ot-card-border)',
  background: 'var(--ot-card-bg)',
  backdropFilter: 'blur(8px)',
  padding: '24px 28px',
  marginBottom: 18,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--ot-text)',
  marginBottom: 6,
};

const descStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--ot-text-muted)',
  marginBottom: 18,
  lineHeight: 1.5,
};

export function StepTwo({ questions, answers, setAnswers }: StepTwoProps) {
  return (
    <div>
      {questions.map((question) => (
        <div key={question.key} style={cardStyle}>
          <div style={titleStyle}>{question.title}</div>
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
