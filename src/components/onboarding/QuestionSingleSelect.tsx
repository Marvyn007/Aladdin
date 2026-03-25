'use client';

import type { OnboardingQuestion } from '@/lib/onboarding';

interface QuestionSingleSelectProps {
  question: OnboardingQuestion;
  value: string | null;
  onChange: (val: string) => void;
}

export function QuestionSingleSelect({ question, value, onChange }: QuestionSingleSelectProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              border: `1.5px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.08)'}`,
              background: selected ? 'rgba(99,102,241,0.14)' : 'rgba(255,255,255,0.03)',
              textAlign: 'left',
              transition: 'all 0.15s ease',
              outline: 'none',
              width: '100%',
            }}
          >
            {/* Radio circle */}
            <div
              style={{
                width: 17,
                height: 17,
                borderRadius: '50%',
                border: `2px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.25)'}`,
                background: selected ? '#6366f1' : 'transparent',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected && (
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
              )}
            </div>
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.72)',
                }}
              >
                {option.label}
              </div>
              {option.description && (
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
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
