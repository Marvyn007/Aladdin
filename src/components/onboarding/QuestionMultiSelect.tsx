'use client';

import type { OnboardingQuestion } from '@/lib/onboarding';
import { getOptionGridContainerStyle } from '@/components/onboarding/optionGridLayout';

interface QuestionMultiSelectProps {
  question: OnboardingQuestion;
  value: string[];
  onChange: (val: string[]) => void;
}

const rowBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 12px',
  minHeight: 48,
  borderRadius: 8,
  background: 'var(--ot-row-bg)',
  border: '1px solid transparent',
  cursor: 'pointer',
  margin: 0,
  minWidth: 0,
  fontSize: 13,
  fontWeight: 400,
  color: 'var(--ot-text)',
  lineHeight: 1.35,
  boxSizing: 'border-box',
};

export function QuestionMultiSelect({ question, value, onChange }: QuestionMultiSelectProps) {
  const options = question.options ?? [];
  const labels = options.map((o) => o.label);
  const gridStyle = getOptionGridContainerStyle(labels);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={gridStyle}>
        {options.map((option) => {
          const selected = value.includes(option.value);
          return (
            <label
              key={option.value}
              style={{
                ...rowBase,
                borderColor: selected ? 'var(--ot-row-selected-border)' : 'transparent',
                background: selected ? 'var(--ot-row-selected-bg)' : 'var(--ot-row-bg)',
              }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => handleToggle(option.value)}
                style={{
                  width: 16,
                  height: 16,
                  margin: 0,
                  flexShrink: 0,
                  accentColor: 'var(--ot-primary)',
                  cursor: 'pointer',
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>{option.label}</span>
            </label>
          );
        })}
      </div>
      {question.helperText && (
        <p style={{ fontSize: 11, color: 'var(--ot-text-muted)', marginTop: 2 }}>{question.helperText}</p>
      )}
    </div>
  );
}
