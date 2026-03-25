'use client';

import { Checkbox } from '@/components/ui/checkbox';
import type { OnboardingQuestion } from '@/lib/onboarding';

interface QuestionMultiSelectProps {
  question: OnboardingQuestion;
  value: string[];
  onChange: (val: string[]) => void;
}

export function QuestionMultiSelect({ question, value, onChange }: QuestionMultiSelectProps) {
  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div className="space-y-3">
      {question.options?.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-3"
        >
          <Checkbox
            checked={value.includes(option.value)}
            onCheckedChange={() => handleToggle(option.value)}
          />
          <div>
            <span className="text-sm font-medium leading-none">{option.label}</span>
            {option.description && (
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            )}
          </div>
        </label>
      ))}
      {question.helperText && (
        <p className="text-xs text-muted-foreground">{question.helperText}</p>
      )}
    </div>
  );
}
