// Job Detail component - Right column showing full job details

'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Job } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface JobDetailProps {
    job: Job | null;
    onApply: (jobId: string) => void;
    onDelete?: (jobId: string) => void;
    onGenerateCoverLetter: (jobId: string) => void;
    onGenerateTailoredResume: (jobId: string) => void;
    applicationStatus: 'none' | 'applied' | 'loading';
    // Mobile responsive props
    isMobileVisible?: boolean;
    onBack?: () => void;
}

export function JobDetail({ job, onApply, onDelete, onGenerateCoverLetter, onGenerateTailoredResume, applicationStatus, isMobileVisible, onBack }: JobDetailProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingResume, setIsGeneratingResume] = useState(false);

    const formatPostedDate = (postedAt: string | null): string => {
        if (!postedAt) return 'N/A';
        try {
            const date = new Date(postedAt);
            const chicagoTime = toZonedTime(date, 'America/Chicago');
            return formatDistanceToNow(chicagoTime, { addSuffix: true });
        } catch {
            return 'N/A';
        }
    };

    const isRecentlyPosted = (postedAt: string | null): boolean => {
        if (!postedAt) return false;
        try {
            const date = new Date(postedAt);
            const now = new Date();
            const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
            return hoursDiff < 24;
        } catch {
            return false;
        }
    };

    const getScoreColor = (score: number): string => {
        if (score >= 75) return 'var(--success)';
        if (score >= 50) return 'var(--warning)';
        return 'var(--text-tertiary)';
    };

    const handleGenerateCoverLetter = async () => {
        if (!job) return;
        setIsGenerating(true);
        try {
            await onGenerateCoverLetter(job.id);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateTailoredResume = async () => {
        if (!job) return;
        setIsGeneratingResume(true);
        try {
            await onGenerateTailoredResume(job.id);
        } finally {
            setIsGeneratingResume(false);
        }
    };

    if (!job) {
        return (
            <div
                className={`job-detail-container ${isMobileVisible ? 'mobile-visible' : ''}`}
                style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-tertiary)',
                }}
            >
                <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    style={{ marginBottom: '20px', opacity: 0.4 }}
                >
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                </svg>
                <p style={{ fontSize: '15px', marginBottom: '8px' }}>Select a job to view details</p>
                <p style={{ fontSize: '13px', opacity: 0.7 }}>Click on a job card from the list</p>
            </div>
        );
    }

    return (
        <div
            className={`job-detail-container ${isMobileVisible ? 'mobile-visible' : ''}`}
        >
            {/* Mobile Back Button */}
            {onBack && (
                <button className="mobile-back-btn" onClick={onBack}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    Back to Jobs
                </button>
            )}

            {/* Header */}
            <div
                style={{
                    padding: '24px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--background-secondary)',
                }}
            >
                {/* Title and Score */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                    <div style={{ flex: 1, marginRight: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, lineHeight: 1.4 }}>
                                {job.title}
                            </h2>
                            {job.isImported && (
                                <span style={{
                                    fontSize: '11px',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    padding: '3px 8px',
                                    borderRadius: '12px',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px',
                                    flexShrink: 0,
                                }}>
                                    Imported
                                </span>
                            )}
                        </div>
                        {job.company && (
                            <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                {job.company}
                            </p>
                        )}
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            padding: '16px 20px',
                            background: 'var(--surface)',
                            borderRadius: 'var(--radius-lg)',
                            minWidth: '80px',
                        }}
                    >
                        <span
                            style={{
                                fontSize: '28px',
                                fontWeight: 700,
                                color: getScoreColor(job.match_score),
                            }}
                        >
                            {job.match_score}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                            Match
                        </span>
                    </div>
                </div>

                {/* Meta info */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
                    {(job.location_display || job.location) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            <span>{job.location_display || job.location}</span>
                        </div>
                    )}
                    <div
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'help' }}
                        title={job.original_posted_raw ? `Original: ${job.original_posted_raw} (${job.original_posted_source || 'unknown'})` : undefined}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: isRecentlyPosted(job.original_posted_date || job.posted_at) ? 'var(--success)' : 'var(--error)' }}>
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span style={{ color: isRecentlyPosted(job.original_posted_date || job.posted_at) ? 'var(--success)' : 'var(--error)' }}>
                            Posted: {job.original_posted_raw && !job.original_posted_date
                                ? job.original_posted_raw
                                : formatPostedDate(job.original_posted_date || job.posted_at)}
                        </span>
                    </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        View Original
                    </a>

                    <button
                        onClick={handleGenerateCoverLetter}
                        disabled={isGenerating}
                        className="btn btn-secondary"
                    >
                        {isGenerating ? (
                            <>
                                <span className="loading-spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                Generating...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <line x1="16" y1="13" x2="8" y2="13" />
                                    <line x1="16" y1="17" x2="8" y2="17" />
                                </svg>
                                Generate Cover Letter
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleGenerateTailoredResume}
                        disabled={isGeneratingResume}
                        className="btn btn-secondary"
                    >
                        {isGeneratingResume ? (
                            <>
                                <span className="loading-spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                Loading...
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                                    <polyline points="14 2 14 8 20 8" />
                                    <path d="M16 13H8M16 17H8M10 9H8" />
                                </svg>
                                Tailor Resume
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => onApply(job.id)}
                        disabled={applicationStatus === 'loading' || applicationStatus === 'applied'}
                        className={`btn ${applicationStatus === 'applied' ? 'btn-ghost' : 'btn-secondary'}`}
                        style={{
                            background: applicationStatus === 'applied' ? 'var(--success-muted)' : undefined,
                            color: applicationStatus === 'applied' ? 'var(--success)' : undefined,
                            borderColor: applicationStatus === 'applied' ? 'var(--success)' : undefined,
                        }}
                    >
                        {applicationStatus === 'loading' ? (
                            <>
                                <span className="loading-spin" style={{ width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                Adding...
                            </>
                        ) : applicationStatus === 'applied' ? (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Applied
                            </>
                        ) : (
                            <>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                Applied?
                            </>
                        )}
                    </button>

                    {onDelete && (
                        <button
                            onClick={() => {
                                if (job) onDelete(job.id);
                            }}
                            className="btn btn-outline"
                            style={{
                                color: 'var(--error)',
                                borderColor: 'var(--border)',
                            }}
                            title="Delete Job Permanently"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    )}
                </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

                {(job.matched_skills?.length || job.missing_skills?.length) && (
                    <div style={{ marginBottom: '24px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Skills Analysis
                        </h3>

                        {job.matched_skills && job.matched_skills.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                    Matched Skills
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {job.matched_skills.map((skill, i) => (
                                        <span key={i} className="badge badge-success">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {job.missing_skills && job.missing_skills.length > 0 && (
                            <div>
                                <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                    Missing Skills
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {job.missing_skills.map((skill, i) => (
                                        <span key={i} className="badge badge-warning">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )
                }

                {/* Why explanation */}
                {
                    job.why && (
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Match Explanation
                            </h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic' }}>
                                &ldquo;{job.why}&rdquo;
                            </p>
                        </div>
                    )
                }

                {/* Job description */}
                {
                    (job.job_description_plain || job.raw_text_summary) && (
                        <div>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                Job Description
                            </h3>
                            <div
                                style={{
                                    fontSize: '14px',
                                    color: 'var(--text-primary)',
                                    lineHeight: 1.7,
                                    whiteSpace: 'pre-wrap',
                                }}
                            >
                                {job.job_description_plain || job.raw_text_summary}
                            </div>
                        </div>
                    )
                }

                {/* Source link */}
                <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        Source: <a href={job.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{new URL(job.source_url).hostname}</a>
                    </p>
                </div>
            </div >
        </div >
    );
}
