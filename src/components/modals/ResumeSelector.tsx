// Resume Selector Modal - Manage and select resumes

'use client';

import { useState, useEffect, useRef } from 'react';
import type { Resume } from '@/types';

interface ResumeSelectorProps {
    onClose: () => void;
}

export function ResumeSelector({ onClose }: ResumeSelectorProps) {
    const [resumes, setResumes] = useState<Resume[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewTitle, setPreviewTitle] = useState<string>('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        loadResumes();
    }, []);

    const loadResumes = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/upload-resume');
            const data = await res.json();
            setResumes(data.resumes || []);
        } catch (error) {
            console.error('Error loading resumes:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('setAsDefault', 'false');

        try {
            const res = await fetch('/api/upload-resume', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data.success) {
                loadResumes();
            } else {
                alert(data.error || 'Failed to upload resume');
            }
        } catch {
            alert('Failed to upload resume');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleSetDefault = async (resumeId: string) => {
        try {
            const res = await fetch('/api/upload-resume', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resumeId, action: 'setDefault' }),
            });
            if (res.ok) {
                loadResumes();
            }
        } catch (error) {
            console.error('Error setting default resume:', error);
        }
    };

    const handleDelete = async (resumeId: string) => {
        if (!confirm('Are you sure you want to delete this resume?')) return;

        try {
            const res = await fetch(`/api/upload-resume?id=${resumeId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                loadResumes();
            }
        } catch (error) {
            console.error('Error deleting resume:', error);
        }
    };

    const handlePreview = (resume: Resume) => {
        setPreviewUrl(`/api/resumes/${resume.id}/preview`);
        setPreviewTitle(resume.filename);
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
                    maxHeight: '80vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
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
                    }}
                >
                    <h2 style={{ fontSize: '18px', fontWeight: 600 }}>My Resumes</h2>
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
                <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                            Loading resumes...
                        </div>
                    ) : resumes.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '12px', opacity: 0.5 }}>
                                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                            </svg>
                            <p>No resumes uploaded yet</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {resumes.map((resume) => (
                                <div
                                    key={resume.id}
                                    style={{
                                        padding: '12px 16px',
                                        background: resume.is_default ? 'var(--accent-muted)' : 'var(--background)',
                                        border: `1px solid ${resume.is_default ? 'var(--accent)' : 'var(--border)'}`,
                                        borderRadius: 'var(--radius-md)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                    }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
                                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                        <polyline points="14 2 14 8 20 8" />
                                    </svg>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: '14px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {resume.filename}
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                            {resume.is_default && (
                                                <span style={{ color: 'var(--accent)', marginRight: '8px' }}>✓ Default</span>
                                            )}
                                            {new Date(resume.upload_at).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '4px' }}>
                                        {!resume.is_default && (
                                            <button
                                                onClick={() => handleSetDefault(resume.id)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: 'var(--accent)',
                                                    padding: '6px',
                                                    fontSize: '12px',
                                                }}
                                                title="Set as default"
                                            >
                                                Set Default
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handlePreview(resume);
                                            }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--text-secondary)',
                                                padding: '6px',
                                            }}
                                            title="Preview"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(resume.id)}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                color: 'var(--error)',
                                                padding: '6px',
                                            }}
                                            title="Delete"
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--border)',
                    }}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handleUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                    >
                        {isUploading ? 'Uploading...' : 'Upload New Resume'}
                    </button>
                </div>
            </div>

            {/* Preview Modal */}
            {previewUrl && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0, 0, 0, 0.75)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1100,
                    }}
                    onClick={() => setPreviewUrl(null)}
                >
                    <div
                        style={{
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-lg)',
                            width: '90%',
                            maxWidth: '800px',
                            height: '85vh',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            style={{
                                padding: '16px 20px',
                                borderBottom: '1px solid var(--border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--background)',
                            }}
                        >
                            <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{previewTitle}</h3>
                            <button
                                onClick={() => setPreviewUrl(null)}
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
                        <iframe
                            src={previewUrl}
                            style={{ width: '100%', flex: 1, border: 'none', background: '#f5f5f5' }}
                            title="Resume Preview"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
