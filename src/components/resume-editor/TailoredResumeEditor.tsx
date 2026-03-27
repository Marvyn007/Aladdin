'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ParsingProgress } from './ParsingProgress';
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';

export function TailoredResumeEditor() {
  const router = useRouter();
  const {
    status,
    jobTitle,
    company,
    jobUrl,
    initialJobDescription,
    progress,
    error,
    isModalOpen,
    jobId,
    startGeneration,
    sendToBackground,
  } = useResumeGeneration();

  const [jobDescription, setJobDescription] = useState('');

  // Re-initialize textarea when modal opens with a new job
  useEffect(() => {
    if (isModalOpen) {
      setJobDescription(initialJobDescription ?? '');
    }
  }, [isModalOpen, initialJobDescription]);

  // Redirect when generation completes while modal is open
  useEffect(() => {
    if (status === 'complete' && isModalOpen && jobId) {
      router.push(`/resume-editor/${jobId}`);
    }
  }, [status, isModalOpen, jobId, router]);

  if (!isModalOpen) return null;

  const isGenerating = status === 'generating';
  const hasGenerated = status === 'complete';

  const handleGenerate = () => {
    if (!jobDescription.trim()) return;
    startGeneration(jobDescription);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: '20px'
    }}>
      <div style={{
        background: '#ffffff', borderRadius: '12px',
        width: '90%', maxWidth: '600px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(12,24,40,0.35)',
        overflow: 'hidden', border: '1px solid #e6e9ee'
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e6e9ee' }}>
          <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Tailored Resume Editor</h2>
              <p style={{ marginTop: '4px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                {jobTitle} {company && `at ${company}`}
              </p>
            </div>
            <button
              onClick={sendToBackground}
              style={{
                padding: '8px',
                marginTop: '-4px',
                marginRight: '-4px',
                color: '#94a3b8',
                background: 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseOut={(e) => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
          {error && (
            <div style={{
              padding: '12px 16px', background: '#fef2f2',
              color: '#dc2626', borderRadius: '8px',
              marginBottom: '20px', fontSize: '14px',
              border: '1px solid #fecaca'
            }}>
              {error}
            </div>
          )}

          {!isGenerating && !hasGenerated ? (
            <div className="flex flex-col gap-2">
              <label style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                Job Description <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <textarea
                style={{
                  width: '100%',
                  background: '#fff',
                  border: '1px solid #e6e9ee',
                  borderRadius: '8px',
                  padding: '12px 14px',
                  fontSize: '14px',
                  resize: 'vertical',
                  color: '#334155',
                  lineHeight: 1.6,
                  outline: 'none',
                  minHeight: '200px',
                  transition: 'all 0.2s ease'
                }}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the target job description here..."
              />
            </div>
          ) : (
            <div style={{ padding: '20px 0' }}>
              <ParsingProgress
                stages={progress.stages}
                currentStageIndex={progress.currentStageIndex}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #e6e9ee', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isGenerating ? (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button
                onClick={sendToBackground}
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#92400e',
                  background: '#fff7ed',
                  border: '1px solid #fed7aa',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Run in background
              </button>
            </div>
          ) : (
            <>
              <div style={{ flex: 1 }}>
                {jobUrl && (
                  <a
                    href={jobUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: '13px', fontWeight: 600, color: '#3b82f6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
                    </svg>
                    View Original Job
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={sendToBackground}
                  style={{ padding: '8px 16px', fontSize: '13px', fontWeight: 500, color: '#64748b', background: 'transparent', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={status !== 'idle' || !jobDescription.trim()}
                  style={{
                    padding: '9px 20px',
                    fontSize: '14px',
                    fontWeight: 600,
                    color: (status !== 'idle' || !jobDescription.trim()) ? '#94a3b8' : '#fff',
                    background: (status !== 'idle' || !jobDescription.trim()) ? '#f1f5f9' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: (status !== 'idle' || !jobDescription.trim()) ? 'not-allowed' : 'pointer',
                    boxShadow: (status !== 'idle' || !jobDescription.trim()) ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Generate Resume
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
