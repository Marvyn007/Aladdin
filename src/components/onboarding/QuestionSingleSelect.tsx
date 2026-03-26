'use client';

import type { OnboardingQuestion } from '@/lib/onboarding';

interface QuestionSingleSelectProps {
  question: OnboardingQuestion;
  value: string | null;
  onChange: (val: string) => void;
}

export function QuestionSingleSelect({ question, value, onChange }: QuestionSingleSelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {question.options?.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '14px 18px',
              borderRadius: 12,
              cursor: 'pointer',
              border: `1.5px solid ${selected ? 'var(--ot-row-selected-border)' : 'var(--ot-row-border)'}`,
              background: selected ? 'var(--ot-row-selected-bg)' : 'var(--ot-row-bg)',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              outline: 'none',
              width: '100%',
            }}
          >
            {/* Radio circle */}
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                border: `2px solid ${selected ? 'var(--ot-radio-selected)' : 'var(--ot-radio-border)'}`,
                background: selected ? 'var(--ot-radio-selected)' : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {selected && (
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ot-primary-fg)' }} />
              )}
            </div>
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 500,
                  color: selected ? 'var(--ot-text)' : 'var(--ot-text-muted)',
                  transition: 'color 0.15s ease',
                }}
              >
                {option.label}
              </div>
              {option.description && (
                <div style={{ fontSize: 13, color: 'var(--ot-text-muted)', marginTop: 3, opacity: 0.75 }}>
                  {option.description}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
