'use client';

import { Check } from 'lucide-react';
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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {question.options?.map((option) => {
          const selected = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => handleToggle(option.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                border: `1.5px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.1)'}`,
                background: selected ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                color: selected ? '#a5b4fc' : 'rgba(255,255,255,0.65)',
                transition: 'all 0.15s ease',
                outline: 'none',
              }}
            >
              {selected && <Check style={{ width: 12, height: 12, flexShrink: 0 }} />}
              {option.label}
            </button>
          );
        })}
      </div>
      {question.helperText && (
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)' }}>{question.helperText}</p>
      )}
    </div>
  );
}
