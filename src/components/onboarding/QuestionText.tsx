'use client';

import type { OnboardingQuestion } from '@/lib/onboarding';

interface QuestionTextProps {
  question: OnboardingQuestion;
  value: string;
  onChange: (val: string) => void;
}

export function QuestionText({ question, value, onChange }: QuestionTextProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea
        rows={4}
        value={value}
        placeholder={question.placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          borderRadius: 8,
          border: '1px solid var(--ot-card-border)',
          background: 'var(--ot-row-bg)',
          padding: '9px 11px',
          fontSize: 12,
          color: 'var(--ot-text)',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.5,
          transition: 'border-color 0.15s ease',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ot-primary)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ot-card-border)'; }}
      />
      {question.helperText && (
        <p style={{ fontSize: 11, color: 'var(--ot-text-muted)' }}>{question.helperText}</p>
      )}
    </div>
  );
}
