'use client';

import type { OnboardingQuestion } from '@/lib/onboarding';

interface QuestionTextProps {
  question: OnboardingQuestion;
  value: string;
  onChange: (val: string) => void;
}

export function QuestionText({ question, value, onChange }: QuestionTextProps) {
  return (
    <div className="space-y-2">
      <textarea
        rows={4}
        value={value}
        placeholder={question.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {question.helperText && (
        <p className="text-xs text-muted-foreground">{question.helperText}</p>
      )}
    </div>
  );
}
