'use client';

import React, { useState } from 'react';

interface ImportJobSelectionModalProps {
    onClose: () => void;
    onSelect: (flow: 'manual' | 'automatic') => void;
}

export function ImportJobSelectionModal({ onClose, onSelect }: ImportJobSelectionModalProps) {
    const [selectedFlow, setSelectedFlow] = useState<'manual' | 'automatic'>('manual');

    const handleNext = () => {
        onSelect(selectedFlow);
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg, 12px)',
                    width: '100%',
                    maxWidth: '520px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-xl)',
                    border: '1px solid var(--border)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--background)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img
                            src="/icons/import-job.png"
                            alt="Import"
                            style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                        />
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Import Job</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            padding: '4px',
                            borderRadius: '50%',
                        }}
                        aria-label="Close"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                        How would you like to add this job to your tracker?
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {/* Option 1: Manual */}
                        <button
                            onClick={() => setSelectedFlow('manual')}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '16px',
                                padding: '16px',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '2px solid',
                                borderColor: selectedFlow === 'manual' ? 'var(--accent)' : 'var(--border)',
                                background: selectedFlow === 'manual' ? 'var(--accent-muted, rgba(59, 130, 246, 0.05))' : 'var(--background)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                background: selectedFlow === 'manual' ? 'var(--accent)' : 'var(--surface-hover, #f3f4f6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                color: selectedFlow === 'manual' ? 'white' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                </svg>
                            </div>
                            <div>
                                <h3 style={{
                                    fontSize: '15px',
                                    fontWeight: 600,
                                    color: 'var(--text-primary)',
                                    marginBottom: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px'
                                }}>
                                    Manual Import
                                    <span style={{
                                        fontSize: '11px',
                                        background: 'var(--success-muted, rgba(34, 197, 94, 0.15))',
                                        color: 'var(--success, #16a34a)',
                                        padding: '2px 8px',
                                        borderRadius: '999px',
                                        fontWeight: 500,
                                    }}>Recommended</span>
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                    Manually enter the job title, company, location, and description. Most accurate method for reliable AI cover letters.
                                </p>
                            </div>
                        </button>

                        {/* Option 2: Automatic */}
                        <button
                            onClick={() => setSelectedFlow('automatic')}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '16px',
                                padding: '16px',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '2px solid',
                                borderColor: selectedFlow === 'automatic' ? 'var(--accent)' : 'var(--border)',
                                background: selectedFlow === 'automatic' ? 'var(--accent-muted, rgba(59, 130, 246, 0.05))' : 'var(--background)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                background: selectedFlow === 'automatic' ? 'var(--accent)' : 'var(--surface-hover, #f3f4f6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                color: selectedFlow === 'automatic' ? 'white' : 'var(--text-secondary)',
                                transition: 'all 0.2s',
                            }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="17 8 12 3 7 8" />
                                    <line x1="12" y1="3" x2="12" y2="15" />
                                </svg>
                            </div>
                            <div>
                                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                                    Automatic Import
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                                    Paste a URL to automatically scrape job details. Faster, but requires review as formatting errors occasionally occur.
                                </p>
                            </div>
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '12px',
                        background: 'var(--background)',
                    }}
                >
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 'var(--radius-md, 8px)',
                            border: '1px solid var(--border)',
                            background: 'transparent',
                            color: 'var(--text-secondary)',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 500,
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleNext}
                        style={{
                            padding: '10px 20px',
                            borderRadius: 'var(--radius-md, 8px)',
                            border: 'none',
                            background: 'var(--accent)',
                            color: 'white',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        Next
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
}
