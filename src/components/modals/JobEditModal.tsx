'use client';

import { useState, useEffect, useRef } from 'react';
import type { Job } from '@/types';

interface JobEditModalProps {
    job: Job;
    onClose: () => void;
    onSave: (fields: { title: string; company: string; location: string; description: string }) => Promise<void>;
}

const MIN_DESCRIPTION_LENGTH = 50;

export function JobEditModal({ job, onClose, onSave }: JobEditModalProps) {
    const [title, setTitle] = useState(job.title);
    const [company, setCompany] = useState(job.company || '');
    const [location, setLocation] = useState(job.location || '');
    const [description, setDescription] = useState(
        job.job_description_plain || job.normalized_text || job.raw_text_summary || ''
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);

    // Focus trap + Esc close
    useEffect(() => {
        titleInputRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            // Focus trap
            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                    'input, textarea, button, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!title.trim()) errs.title = 'Title is required';
        if (!company.trim()) errs.company = 'Company is required';
        if (!description.trim()) errs.description = 'Description is required';
        else if (description.trim().length < MIN_DESCRIPTION_LENGTH)
            errs.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setIsSaving(true);
        setSaveError(null);
        try {
            await onSave({
                title: title.trim(),
                company: company.trim(),
                location: location.trim(),
                description: description.trim(),
            });
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
            setIsSaving(false);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md, 8px)',
        border: '1px solid var(--border)',
        background: 'var(--background)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '6px',
    };

    const errorStyle: React.CSSProperties = {
        fontSize: '12px',
        color: '#ef4444',
        marginTop: '4px',
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
            role="dialog"
            aria-modal="true"
            aria-label="Edit job"
        >
            <div
                ref={modalRef}
                style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    width: '90%',
                    maxWidth: '560px',
                    maxHeight: '90vh',
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
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Edit Job</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: 'var(--text-secondary)',
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

                {/* Form */}
                <div
                    style={{
                        padding: '24px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                    }}
                >
                    {/* Title */}
                    <div>
                        <label htmlFor="edit-job-title" style={labelStyle}>Job Title *</label>
                        <input
                            ref={titleInputRef}
                            id="edit-job-title"
                            type="text"
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: '' })); }}
                            style={{ ...inputStyle, borderColor: errors.title ? '#ef4444' : undefined }}
                            placeholder="e.g. Software Engineer"
                        />
                        {errors.title && <p style={errorStyle}>{errors.title}</p>}
                    </div>

                    {/* Company */}
                    <div>
                        <label htmlFor="edit-job-company" style={labelStyle}>Company Name *</label>
                        <input
                            id="edit-job-company"
                            type="text"
                            value={company}
                            onChange={(e) => { setCompany(e.target.value); setErrors(prev => ({ ...prev, company: '' })); }}
                            style={{ ...inputStyle, borderColor: errors.company ? '#ef4444' : undefined }}
                            placeholder="e.g. Google"
                        />
                        {errors.company && <p style={errorStyle}>{errors.company}</p>}
                    </div>

                    {/* Location */}
                    <div>
                        <label htmlFor="edit-job-location" style={labelStyle}>Location</label>
                        <input
                            id="edit-job-location"
                            type="text"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            style={inputStyle}
                            placeholder="e.g. San Francisco, CA (Remote)"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="edit-job-description" style={labelStyle}>
                            Description * <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
                                (min {MIN_DESCRIPTION_LENGTH} chars)
                            </span>
                        </label>
                        <textarea
                            id="edit-job-description"
                            value={description}
                            onChange={(e) => { setDescription(e.target.value); setErrors(prev => ({ ...prev, description: '' })); }}
                            style={{
                                ...inputStyle,
                                minHeight: '160px',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                lineHeight: '1.5',
                                borderColor: errors.description ? '#ef4444' : undefined,
                            }}
                            placeholder="Full job description..."
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            {errors.description ? (
                                <p style={errorStyle}>{errors.description}</p>
                            ) : <span />}
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                {description.trim().length} chars
                            </span>
                        </div>
                    </div>

                    {/* Save Error */}
                    {saveError && (
                        <div
                            style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-md, 8px)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                fontSize: '13px',
                            }}
                        >
                            {saveError}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--background)',
                    }}
                >
                    {/* View Original - bottom left */}
                    <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '13px',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            fontWeight: 500,
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        View Original
                    </a>

                    {/* Cancel + Save - bottom right */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: 'none',
                                background: isSaving ? 'var(--text-tertiary)' : 'var(--accent)',
                                color: 'white',
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            {isSaving ? (
                                <>
                                    <span style={{
                                        width: '14px',
                                        height: '14px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        display: 'inline-block',
                                        animation: 'spin 0.6s linear infinite',
                                    }} />
                                    Saving...
                                </>
                            ) : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Spinner animation */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
