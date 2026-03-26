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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
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
                gap: 8,
                padding: '10px 18px',
                borderRadius: 9999,
                fontSize: 15,
                fontWeight: 500,
                cursor: 'pointer',
                border: `1.5px solid ${selected ? 'var(--ot-pill-selected-border)' : 'var(--ot-pill-border)'}`,
                background: selected ? 'var(--ot-pill-selected-bg)' : 'var(--ot-pill-bg)',
                color: selected ? 'var(--ot-pill-selected-color)' : 'var(--ot-pill-color)',
                transition: 'all 0.15s ease',
                outline: 'none',
              }}
            >
              {selected && <Check style={{ width: 13, height: 13, flexShrink: 0 }} />}
              {option.label}
            </button>
          );
        })}
      </div>
      {question.helperText && (
        <p style={{ fontSize: 13, color: 'var(--ot-text-muted)' }}>{question.helperText}</p>
      )}
    </div>
  );
}
