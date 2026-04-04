'use client';

import React from 'react';

interface SpeechBubbleProps {
  text: string;
  stepIndex: number;
  totalSteps: number;
  maxWidth: number;
  side: 'left' | 'right'; // which side of Aladdin the bubble appears on
  onNext: () => void;
  onSkip: () => void;
  visible: boolean;
}

export function SpeechBubble({
  text,
  stepIndex,
  totalSteps,
  maxWidth,
  side,
  onNext,
  onSkip,
  visible,
}: SpeechBubbleProps) {
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div
      style={{
        maxWidth,
        background: '#ffffff',
        borderRadius: 14,
        padding: '16px 20px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(8px)',
        transition: 'opacity 220ms ease, transform 220ms ease',
        pointerEvents: visible ? 'auto' : 'none',
        userSelect: 'none',
        position: 'relative',
      }}
    >
      {/* Triangle pointer toward Aladdin */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          [side === 'right' ? 'left' : 'right']: -10,
          width: 0,
          height: 0,
          borderTop: '8px solid transparent',
          borderBottom: '8px solid transparent',
          [side === 'right' ? 'borderRight' : 'borderLeft']: '10px solid #ffffff',
        }}
      />

      {/* Step counter */}
      <p style={{
        margin: '0 0 8px',
        fontSize: 11,
        fontWeight: 600,
        color: '#9ca3af',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        {stepIndex + 1} / {totalSteps}
      </p>

      {/* Tour text */}
      <p style={{
        margin: '0 0 16px',
        fontSize: 14,
        lineHeight: 1.6,
        color: '#111827',
      }}>
        {text}
      </p>

      {/* Next / Finish button */}
      <button
        onClick={onNext}
        style={{
          width: '100%',
          padding: '10px 0',
          borderRadius: 8,
          border: 'none',
          background: isLast ? '#16a34a' : '#2563eb',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = isLast ? '#15803d' : '#1d4ed8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = isLast ? '#16a34a' : '#2563eb';
        }}
      >
        {isLast ? "Finish — Let's Go! 🎉" : 'Next →'}
      </button>
    </div>
  );
}
