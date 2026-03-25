import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { QuestionMultiSelect } from '@/components/onboarding/QuestionMultiSelect';
import { QuestionSingleSelect } from '@/components/onboarding/QuestionSingleSelect';
import type { OnboardingQuestion } from '@/lib/onboarding';

interface StepOneProps {
  questions: OnboardingQuestion[];
  answers: Record<string, unknown>;
  setAnswers: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
}

export function StepOne({ questions, answers, setAnswers }: StepOneProps) {
  return (
    <div className="space-y-6">
      {questions.map((question) => (
        <Card key={question.key}>
          <CardHeader>
            <CardTitle>{question.title}</CardTitle>
            <CardDescription>{question.description}</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
