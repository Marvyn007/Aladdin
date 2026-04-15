'use client';

import type { OnboardingQuestion } from '@/lib/onboarding';
import { getOptionGridContainerStyle } from '@/components/onboarding/optionGridLayout';

interface QuestionSingleSelectProps {
  question: OnboardingQuestion;
  value: string | null;
  onChange: (val: string | null) => void;
}

export function QuestionSingleSelect({ question, value, onChange }: QuestionSingleSelectProps) {
  const options = question.options ?? [];
  const hasDescription = options.some((o) => Boolean(o.description));
  const labels = options.map((o) => o.label);
  const gridStyle = getOptionGridContainerStyle(labels, {
    forceSingleColumn: hasDescription,
  });

  const rowBase = (withDescription: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: withDescription ? 'flex-start' : 'center',
    gap: 8,
    padding: '8px 12px',
    minHeight: 48,
    borderRadius: 8,
    background: 'var(--ot-row-bg)',
    border: '1px solid transparent',
    cursor: 'pointer',
    margin: 0,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'left',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={gridStyle}>
        {options.map((option) => {
          const selected = value === option.value;
          const withDescription = Boolean(option.description);
          return (
            <label
              key={option.value}
              style={{
                ...rowBase(withDescription),
                borderColor: selected ? 'var(--ot-row-selected-border)' : 'transparent',
                background: selected ? 'var(--ot-row-selected-bg)' : 'var(--ot-row-bg)',
              }}
            >
              <input
                type="checkbox"
                checked={selected}
                onChange={() => {
                  if (selected) onChange(null);
                  else onChange(option.value);
                }}
                style={{
                  width: 16,
                  height: 16,
                  margin: withDescription ? '2px 0 0' : 0,
                  flexShrink: 0,
                  accentColor: 'var(--ot-primary)',
                  cursor: 'pointer',
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 13,
                    fontWeight: 400,
                    color: 'var(--ot-text)',
                    lineHeight: 1.35,
                  }}
                >
                  {option.label}
                </span>
                {option.description && (
                  <span
                    style={{
                      display: 'block',
                      fontSize: 11,
                      color: 'var(--ot-text-muted)',
                      marginTop: 2,
                      lineHeight: 1.4,
                      opacity: 0.9,
                    }}
                  >
                    {option.description}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
