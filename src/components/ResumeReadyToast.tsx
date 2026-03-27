'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';

export function ResumeReadyToast() {
  const router = useRouter();
  const { status, jobId, isModalOpen, dismissCompletion } = useResumeGeneration();
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (status === 'complete' && !isModalOpen && !dismissed) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        // Do NOT call dismissCompletion — widget stays green
      }, 8000);
      return () => clearTimeout(timer);
    }
    if (status !== 'complete') {
      setVisible(false);
      setDismissed(false);
    }
  }, [status, isModalOpen, dismissed]);

  const handleOpen = () => {
    if (jobId) {
      router.push(`/resume-editor/${jobId}`);
      dismissCompletion();
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    // Widget stays green — user can still click it
  };

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes rg-toast-in {
          from { opacity: 0; transform: translateX(calc(100% + 24px)); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9100,
          maxWidth: 340,
          width: 'calc(100vw - 48px)',
          background: '#fff',
          border: '1px solid #bbf7d0',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.14)',
          padding: '16px 18px',
          animation: 'rg-toast-in 0.32s cubic-bezier(0.22,1,0.36,1) forwards',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e', flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>Your resume is ready!</span>
          </div>
          <button
            onClick={handleDismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', lineHeight: 1 }}
            aria-label="Dismiss"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.55, margin: 0 }}>
          Open it in the editor to review and fine-tune anything that doesn&apos;t look right. You can also click the green widget anytime to jump back.
        </p>

        {/* Action */}
        <button
          onClick={handleOpen}
          style={{
            alignSelf: 'flex-start',
            padding: '7px 16px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            background: '#22c55e',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Open in editor
        </button>
      </div>
    </>
  );
}
