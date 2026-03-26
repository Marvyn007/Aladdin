'use client';

import type { OnboardingQuestion } from '@/lib/onboarding';

interface QuestionTextProps {
  question: OnboardingQuestion;
  value: string;
  onChange: (val: string) => void;
}

export function QuestionText({ question, value, onChange }: QuestionTextProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <textarea
        rows={4}
        value={value}
        placeholder={question.placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          borderRadius: 10,
          border: '1.5px solid var(--ot-card-border)',
          background: 'var(--ot-pill-bg)',
          padding: '12px 14px',
          fontSize: 15,
          color: 'var(--ot-text)',
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          lineHeight: 1.6,
          transition: 'border-color 0.15s ease',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ot-primary)'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ot-card-border)'; }}
      />
      {question.helperText && (
        <p style={{ fontSize: 13, color: 'var(--ot-text-muted)' }}>{question.helperText}</p>
      )}
    </div>
  );
}
