'use client';

import { useRouter } from 'next/navigation';
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';

export function ResumeGenerationWidget() {
  const router = useRouter();
  const { status, jobId, progress, openProgressModal, dismissCompletion, cancelGeneration } = useResumeGeneration();

  if (status === 'idle') return null;

  const isGenerating = status === 'generating';
  const isComplete = status === 'complete';
  const isError = status === 'error';

  const STAGE_LABELS: Record<number, string> = {
    0: 'Loading resume',
    1: 'Parsing resume',
    2: 'Reading LinkedIn',
    3: 'Building profile',
    4: 'Analyzing job',
    5: 'Tailoring resume',
    6: 'Finalizing…',
  };

  const generatingLabel = STAGE_LABELS[progress.currentStageIndex] ?? 'Tailoring resume';

  const handleClick = () => {
    if (isComplete && jobId) {
      router.push(`/resume-editor/${jobId}`);
      dismissCompletion();
    } else if (isGenerating) {
      openProgressModal();
    } else if (isError) {
      cancelGeneration();
    }
  };

  const dotColor = '#ffffff';
  const bgColor = isComplete ? '#22c55e' : isError ? '#ef4444' : '#f97316';
  const borderColor = isComplete ? '#16a34a' : isError ? '#dc2626' : '#ea580c';
  const textColor = '#ffffff';
  const label = isComplete ? 'Resume ready' : isError ? 'Generation failed' : generatingLabel;

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        bottom: 88,
        right: 24,
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderRadius: 12,
        background: bgColor,
        border: `1px solid ${borderColor}`,
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        cursor: isGenerating || isComplete || isError ? 'pointer' : 'default',
        userSelect: 'none',
        transition: 'box-shadow 0.2s ease',
        width: 200,
      }}
      onMouseEnter={(e) => { if (isGenerating || isComplete || isError) e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.18)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)'; }}
    >
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: dotColor,
          }}
        />
        {isGenerating && (
          <div
            style={{
              position: 'absolute',
              top: -3,
              left: -3,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: dotColor,
              opacity: 0.35,
              animation: 'rg-pulse 1.5s ease-in-out infinite',
            }}
          />
        )}
      </div>

      <span style={{ fontSize: 13, fontWeight: 600, color: textColor, whiteSpace: 'nowrap' }}>
        {label}
      </span>

      <style>{`
        @keyframes rg-pulse {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
