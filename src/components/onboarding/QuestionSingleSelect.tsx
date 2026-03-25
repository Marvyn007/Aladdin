'use client';

import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { OnboardingQuestion } from '@/lib/onboarding';

interface QuestionSingleSelectProps {
  question: OnboardingQuestion;
  value: string | null;
  onChange: (val: string) => void;
}

export function QuestionSingleSelect({ question, value, onChange }: QuestionSingleSelectProps) {
  return (
    <RadioGroup value={value ?? ''} onValueChange={onChange}>
      {question.options?.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-3"
        >
          <RadioGroupItem value={option.value} />
          <div>
            <span className="text-sm font-medium leading-none">{option.label}</span>
            {option.description && (
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            )}
          </div>
        </label>
      ))}
    </RadioGroup>
  );
}
