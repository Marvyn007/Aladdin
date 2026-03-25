import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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

export function StepTwo({ questions, answers, setAnswers }: StepTwoProps) {
  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <Card key={question.key}>
          <CardHeader>
            <CardTitle>{question.title}</CardTitle>
            <CardDescription>{question.description}</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
