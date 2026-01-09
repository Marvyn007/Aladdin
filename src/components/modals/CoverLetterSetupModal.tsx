'use client';

import { useState, useEffect } from 'react';

interface CoverLetterSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (jobDescription: string) => void;
    jobTitle: string;
    company: string | null;
    jobUrl: string | null;
    initialDescription?: string;
}

export function CoverLetterSetupModal({
    isOpen,
    onClose,
    onGenerate,
    jobTitle,
    company,
    jobUrl,
    initialDescription = ''
}: CoverLetterSetupModalProps) {
    const [description, setDescription] = useState(initialDescription);

    useEffect(() => {
        if (isOpen) {
            setDescription(initialDescription || '');
        }
    }, [isOpen, initialDescription]);

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div
                className="modal-content"
                style={{
                    maxWidth: '600px',
                    width: '95%',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '85vh'
                }}
            >
                {/* Header */}
                <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--border)', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                        Generate Cover Letter
                    </h2>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        {jobTitle} {company && `at ${company}`}
                    </p>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                            Job Description <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(Optional)</span>
                        </label>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                            Paste the full job description here. Our AI will use this to align your cover letter with the specific requirements.
                        </p>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Paste job description here..."
                            style={{
                                width: '100%',
                                minHeight: '200px',
                                padding: '12px',
                                fontSize: '14px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                resize: 'vertical',
                                background: 'var(--background)',
                                color: 'var(--text-primary)'
                            }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {jobUrl ? (
                        <a
                            href={jobUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost"
                            style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                <polyline points="15 3 21 3 21 9" />
                                <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                            View Original Job
                        </a>
                    ) : <div></div>}

                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={onClose} className="btn btn-ghost">
                            Cancel
                        </button>
                        <button
                            onClick={() => onGenerate(description)}
                            className="btn btn-primary"
                        >
                            Generate Cover Letter
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
