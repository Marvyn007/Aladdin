'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';

interface ImportJobModalProps {
    onClose: () => void;
}

export function ImportJobModal({ onClose }: ImportJobModalProps) {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { addImportedJob } = useStore();

    const handleImport = async () => {
        if (!url) {
            setError('Please enter a valid URL');
            return;
        }

        // Basic URL validation
        try {
            new URL(url);
        } catch {
            setError('Please enter a valid URL (e.g., https://example.com/job)');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch('/api/import-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });

            const data = await res.json();

            if (data.success) {
                addImportedJob(data.job);
                onClose();
            } else {
                setError(data.error || 'Failed to import job');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to connect to server');
        } finally {
            setIsLoading(false);
        }
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
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    width: '90%',
                    maxWidth: '500px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img
                            src="/icons/import-job.png"
                            alt="Import"
                            style={{ width: '24px', height: '24px', objectFit: 'contain' }}
                        />
                        <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Import Job</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            padding: '4px',
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px' }}>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Paste a job URL below to automatically extract details, score it against your resume, and add it to your job list.
                    </p>

                    <div style={{ marginBottom: '16px' }}>
                        <label
                            style={{
                                display: 'block',
                                fontSize: '13px',
                                fontWeight: 500,
                                marginBottom: '8px',
                                color: 'var(--text-primary)'
                            }}
                        >
                            Job URL
                        </label>
                        <input
                            type="text"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://linkedin.com/jobs/..."
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border)',
                                background: 'var(--background-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '14px',
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isLoading) handleImport();
                            }}
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '10px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            borderRadius: '6px',
                            color: 'var(--error)',
                            fontSize: '13px',
                            marginBottom: '16px'
                        }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button
                            onClick={onClose}
                            style={{
                                padding: '10px 16px',
                                borderRadius: '6px',
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
                            onClick={handleImport}
                            disabled={isLoading}
                            className="btn btn-primary"
                            style={{
                                padding: '10px 20px',
                                minWidth: '120px',
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px',
                            }}
                        >
                            {isLoading ? (
                                <>
                                    <span className="spinner-small" />
                                    Importing...
                                </>
                            ) : (
                                <>
                                    <span>Import Job</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14" />
                                        <path d="M12 5l7 7-7 7" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
