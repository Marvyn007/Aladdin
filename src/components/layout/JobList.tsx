// Job List component - Middle column showing job cards

'use client';

import { useState } from 'react';
import { useStore } from '@/store/useStore';
import type { Job } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

interface JobListProps {
    onJobClick: (job: Job) => void;
}

// Get score color class based on score value
function getScoreClass(score: number): string {
    if (score >= 75) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
}

// Format posted date
function formatPostedDate(postedAt: string | null): string {
    if (!postedAt) return 'Posted: N/A';

    try {
        const date = new Date(postedAt);
        const chicagoTime = toZonedTime(date, 'America/Chicago');
        return `Posted ${formatDistanceToNow(chicagoTime, { addSuffix: true })}`;
    } catch {
        return 'Posted: N/A';
    }
}

// Check if job was posted less than 24 hours ago
function isRecentlyPosted(postedAt: string | null): boolean {
    if (!postedAt) return false;
    try {
        const date = new Date(postedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
        return hoursDiff < 24;
    } catch {
        return false;
    }
}

export function JobList({ onJobClick }: JobListProps) {
    const { jobs, selectedJob, isLoadingJobs, filters, lastUpdated } = useStore();

    // Filter jobs based on filters
    const filteredJobs = jobs.filter((job) => {
        // Location filter
        if (filters.location) {
            const location = job.location?.toLowerCase() || '';
            if (!location.includes(filters.location.toLowerCase())) {
                return false;
            }
        }

        // Remote only filter
        if (filters.remoteOnly) {
            const location = job.location?.toLowerCase() || '';
            if (!location.includes('remote')) {
                return false;
            }
        }

        return true;
    });

    // Sorting Logic
    type SortMode = 'time' | 'score' | 'imported';
    const [sortMode, setSortMode] = useState<SortMode>('time');
    const [isSortOpen, setIsSortOpen] = useState(false);

    const getJobTime = (job: Job) => {
        // Prioritize original_posted_date -> posted_at -> fetched_at
        const dateStr = job.original_posted_date || job.posted_at || job.fetched_at;
        return dateStr ? new Date(dateStr).getTime() : 0;
    };

    const sortedJobs = [...filteredJobs].sort((a, b) => {
        if (sortMode === 'imported') {
            // Imported jobs first, then by time
            const aImported = a.isImported ? 1 : 0;
            const bImported = b.isImported ? 1 : 0;
            if (aImported !== bImported) return bImported - aImported;
            return getJobTime(b) - getJobTime(a);
        }

        if (sortMode === 'score') {
            const diff = b.match_score - a.match_score;
            // Break ties with time
            if (diff !== 0) return diff;
        }

        // Time sort (default and tie-breaker)
        return getJobTime(b) - getJobTime(a);
    });

    const getScoreColor = (score: number) => {
        if (score >= 90) return '#10b981'; // Green-500
        if (score >= 75) return '#34d399'; // Green-400
        if (score >= 50) return '#fbbf24'; // Amber-400
        if (score >= 30) return '#f87171'; // Red-400
        return '#ef4444'; // Red-500
    };

    return (
        <div
            style={{
                width: '380px',
                minWidth: '380px',
                height: '100vh',
                background: 'var(--background)',
                borderRight: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            <div
                style={{
                    padding: '16px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--background)',
                    zIndex: 10,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            Fresh Jobs
                        </h2>
                        <span
                            style={{
                                fontSize: '12px',
                                background: 'var(--surface)',
                                color: 'var(--text-secondary)',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                            }}
                        >
                            {filteredJobs.length}
                        </span>
                    </div>

                    {/* Sort Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsSortOpen(!isSortOpen)}
                            onBlur={() => setTimeout(() => setIsSortOpen(false), 200)} // Delay to allow click
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                color: 'var(--text-secondary)',
                                fontSize: '12px',
                                fontWeight: 500,
                                cursor: 'pointer',
                            }}
                        >
                            <span>Sort by: {sortMode === 'time' ? 'Time' : sortMode === 'score' ? 'Score' : 'Imported'}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isSortOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        {isSortOpen && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    boxShadow: 'var(--shadow-lg)',
                                    zIndex: 20,
                                    width: '160px',
                                    overflow: 'hidden',
                                }}
                            >
                                <button
                                    onClick={() => { setSortMode('time'); setIsSortOpen(false); }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        background: sortMode === 'time' ? 'var(--accent-light)' : 'transparent',
                                        color: sortMode === 'time' ? 'var(--accent)' : 'var(--text-primary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Time (Newest)
                                </button>
                                <button
                                    onClick={() => { setSortMode('score'); setIsSortOpen(false); }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        background: sortMode === 'score' ? 'var(--accent-light)' : 'transparent',
                                        color: sortMode === 'score' ? 'var(--accent)' : 'var(--text-primary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Score (High to Low)
                                </button>
                                <button
                                    onClick={() => { setSortMode('imported'); setIsSortOpen(false); }}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        background: sortMode === 'imported' ? 'var(--accent-light)' : 'transparent',
                                        color: sortMode === 'imported' ? 'var(--accent)' : 'var(--text-primary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Imported First
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
                        Updated: {lastUpdated ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true }) : 'Never'}
                    </p>
                </div>
            </div>

            {/* Job List */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '12px',
                }}
            >
                {isLoadingJobs ? (
                    // Loading skeleton
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div
                                key={i}
                                className="card loading-pulse"
                                style={{ height: '120px', background: 'var(--surface)' }}
                            />
                        ))}
                    </div>
                ) : sortedJobs.length === 0 ? (
                    // Empty state
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '300px',
                            textAlign: 'center',
                            color: 'var(--text-tertiary)',
                        }}
                    >
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: '16px', opacity: 0.5 }}>
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <p style={{ fontSize: '14px', marginBottom: '8px' }}>No jobs found</p>
                        <p style={{ fontSize: '12px' }}>Click &ldquo;Find Now&rdquo; to search for jobs</p>
                    </div>
                ) : (
                    // Job cards
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {sortedJobs.map((job) => (
                            <div
                                key={job.id}
                                onClick={() => onJobClick(job)}
                                className="card card-interactive"
                                style={{
                                    padding: '16px',
                                    cursor: 'pointer',
                                    borderColor: selectedJob?.id === job.id ? 'var(--accent)' : undefined,
                                    boxShadow: selectedJob?.id === job.id ? 'var(--shadow-glow)' : undefined,
                                    position: 'relative',
                                }}
                            >
                                {/* Header with score */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                                    <h3
                                        style={{
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            lineHeight: 1.4,
                                            flex: 1,
                                            marginRight: '12px',
                                        }}
                                        className="truncate-2"
                                    >
                                        {job.title}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {job.isImported && (
                                            <div
                                                style={{
                                                    background: 'var(--accent)',
                                                    color: '#fff',
                                                    fontSize: '10px',
                                                    fontWeight: 700,
                                                    padding: '3px 6px',
                                                    borderRadius: '4px',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.5px',
                                                }}
                                            >
                                                Imported
                                            </div>
                                        )}
                                        {job.match_score > 0 && (
                                            <div
                                                style={{
                                                    background: getScoreColor(job.match_score),
                                                    color: '#fff',
                                                    fontSize: '12px',
                                                    fontWeight: 700,
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    minWidth: '32px',
                                                    textAlign: 'center',
                                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                {job.match_score}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Company */}
                                {job.company && (
                                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                        {job.company}
                                    </div>
                                )}

                                {/* Location & Posted */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '10px' }}>
                                    {(job.location_display || job.location) && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            {job.location_display || job.location}
                                        </span>
                                    )}
                                    <span
                                        style={{
                                            color: isRecentlyPosted(job.original_posted_date || job.posted_at) ? 'var(--success)' : 'var(--error)'
                                        }}
                                        title={job.original_posted_raw ? `Original: ${job.original_posted_raw}` : undefined}
                                    >
                                        {job.original_posted_raw && !job.original_posted_date
                                            ? `Posted ${job.original_posted_raw}`
                                            : formatPostedDate(job.original_posted_date || job.posted_at)}
                                    </span>
                                </div>

                                {/* Why explanation */}
                                {job.why && (
                                    <p
                                        style={{
                                            fontSize: '12px',
                                            color: 'var(--text-secondary)',
                                            fontStyle: 'italic',
                                            lineHeight: 1.5,
                                        }}
                                        className="truncate-2"
                                    >
                                        {job.why}
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
