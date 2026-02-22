// Job List component - Middle column showing job cards

'use client';

import { useState } from 'react';
import { useStore, useStoreActions } from '@/store/useStore';
import type { Job } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Pagination } from './Pagination';
import { useAuth } from '@clerk/nextjs';
import { SearchBar } from '@/components/common/SearchBar';
import { SearchEmptyState } from '@/components/common/SearchEmptyState';
import { JobLoadingState } from '@/components/common/JobLoadingState';
import { ImageWithRetry } from '@/components/common/ImageWithRetry';
import { trackJobInteraction } from '@/lib/actions';

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
    if (!postedAt) return 'Added: N/A';

    try {
        const date = new Date(postedAt);
        const chicagoTime = toZonedTime(date, 'America/Chicago');
        return `Added ${formatDistanceToNow(chicagoTime, { addSuffix: true })}`;
    } catch {
        return 'Added: N/A';
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

// Get dynamic color based on company name
export function getCompanyColor(companyName: string | null): string {
    if (!companyName) return 'var(--text-tertiary)';
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export function getCompanyInitial(companyName: string | null): string {
    if (!companyName) return '?';
    return companyName.charAt(0).toUpperCase();
}

export function JobList({ onJobClick }: JobListProps) {
    const isSignedIn = useAuth().isSignedIn;
    const jobs = useStore(state => state.jobs);
    const searchMode = useStore(state => state.searchMode);
    const searchResults = useStore(state => state.searchResults);

    const sorting = useStore(state => state.sorting);
    const jobStatus = useStore(state => state.jobStatus);
    const pagination = useStore(state => state.pagination);
    const selectedJob = useStore(state => state.selectedJob);
    const isLoadingJobs = useStore(state => state.isLoadingJobs);

    // Determine which jobs to display
    let displayedJobs = searchMode ? searchResults : jobs;

    // Apply Client-Side Pagination & Sorting for Search Results
    if (searchMode) {
        // Sort
        displayedJobs = [...displayedJobs].sort((a, b) => {
            const dir = sorting.dir === 'asc' ? 1 : -1;
            if (sorting.by === 'score') {
                return ((a.match_score || 0) - (b.match_score || 0)) * dir;
            } else if (sorting.by === 'imported') {
                return (Number(!!a.isImported) - Number(!!b.isImported)) * dir;
            } else {
                // Time
                const dateA = new Date(a.original_posted_date || a.posted_at || 0).getTime();
                const dateB = new Date(b.original_posted_date || b.posted_at || 0).getTime();
                return (dateA - dateB) * dir;
            }
        });

        // Paginate
        const start = (pagination.page - 1) * pagination.limit;
        const end = start + pagination.limit;
        displayedJobs = displayedJobs.slice(start, end);
    }

    const { setPagination, setSorting, setJobStatus, toggleJobStatus } = useStoreActions();
    const [isSortOpen, setIsSortOpen] = useState(false);

    const handleSortChange = (by: 'time' | 'imported' | 'score' | 'relevance') => {
        setSorting({ by, dir: 'desc' }); // Default desc
        setPagination({ page: 1 }); // Reset to page 1
        setIsSortOpen(false);
    };


    const getScoreColor = (score: number) => {
        if (score >= 90) return '#10b981'; // Green-500
        if (score >= 75) return '#34d399'; // Green-400
        if (score >= 50) return '#fbbf24'; // Amber-400
        if (score >= 30) return '#f87171'; // Red-400
        return '#ef4444'; // Red-500
    };

    return (
        <div className="job-list-container">
            <div
                style={{
                    padding: '16px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--background)',
                    zIndex: 10,
                }}
            >
                {/* Title Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {isSignedIn ? (
                            <div style={{ display: 'flex', gap: '4px', background: 'var(--surface)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <button
                                    onClick={() => setJobStatus('fresh')}
                                    style={{
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        background: jobStatus === 'fresh' ? 'var(--accent)' : 'transparent',
                                        color: jobStatus === 'fresh' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Fresh
                                </button>
                                <button
                                    onClick={() => setJobStatus('saved')}
                                    style={{
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        background: jobStatus === 'saved' ? 'var(--accent)' : 'transparent',
                                        color: jobStatus === 'saved' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Saved
                                </button>
                                <button
                                    onClick={() => setJobStatus('archived')}
                                    style={{
                                        padding: '4px 8px',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        borderRadius: '6px',
                                        background: jobStatus === 'archived' ? 'var(--accent)' : 'transparent',
                                        color: jobStatus === 'archived' ? '#fff' : 'var(--text-secondary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Archived
                                </button>
                            </div>
                        ) : (
                            <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                                All Jobs
                            </h2>
                        )}
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
                            {pagination.total}
                        </span>
                    </div>
                </div>

                {/* Search Bar Row */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '12px' }}>
                    <SearchBar />
                </div>

                {/* Pagination & Sort Row - below search bar, aligned left with flex-start */}
                <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {/* Sort Dropdown */}
                    <div style={{ position: 'relative' }}>
                        <button
                            onClick={() => setIsSortOpen(!isSortOpen)}
                            onBlur={() => setTimeout(() => setIsSortOpen(false), 200)}
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
                            <span>Sort by: {sorting.by === 'time' ? 'Time' : sorting.by === 'score' ? 'Score' : sorting.by === 'relevance' ? 'Relevance' : 'Imported'}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: isSortOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                <polyline points="6 9 12 15 18 9" />
                            </svg>
                        </button>

                        {isSortOpen && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
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
                                    onClick={() => handleSortChange('time')}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        background: sorting.by === 'time' ? 'var(--accent-light)' : 'transparent',
                                        color: sorting.by === 'time' ? 'var(--accent)' : 'var(--text-primary)',
                                        border: 'none',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Time (Newest)
                                </button>
                                <button
                                    onClick={() => handleSortChange('relevance')}
                                    disabled={!isSignedIn}
                                    title={!isSignedIn ? "Sign in for personalized ranking" : ""}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        background: sorting.by === 'relevance' ? 'var(--accent-light)' : 'transparent',
                                        color: !isSignedIn ? 'var(--text-tertiary)' : (sorting.by === 'relevance' ? 'var(--accent)' : 'var(--text-primary)'),
                                        border: 'none',
                                        cursor: isSignedIn ? 'pointer' : 'not-allowed',
                                        opacity: isSignedIn ? 1 : 0.6
                                    }}
                                >
                                    Relevance (Recommended)
                                </button>
                                <button
                                    onClick={() => handleSortChange('score')}
                                    disabled={!isSignedIn}
                                    title={!isSignedIn ? "Sign in to sort by match score" : ""}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        background: sorting.by === 'score' ? 'var(--accent-light)' : 'transparent',
                                        color: !isSignedIn ? 'var(--text-tertiary)' : (sorting.by === 'score' ? 'var(--accent)' : 'var(--text-primary)'),
                                        border: 'none',
                                        cursor: isSignedIn ? 'pointer' : 'not-allowed',
                                        opacity: isSignedIn ? 1 : 0.6
                                    }}
                                >
                                    Score (High to Low)
                                </button>
                                <button
                                    onClick={() => handleSortChange('imported')}
                                    style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '8px 12px',
                                        fontSize: '13px',
                                        background: sorting.by === 'imported' ? 'var(--accent-light)' : 'transparent',
                                        color: sorting.by === 'imported' ? 'var(--accent)' : 'var(--text-primary)',
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
            </div>

            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden', // Prevent horizontal scroll
                    padding: '12px', // Compact padding
                }}
            >
                {isLoadingJobs ? (
                    <JobLoadingState />
                ) : displayedJobs.length === 0 ? (

                    searchMode ? (
                        <SearchEmptyState />
                    ) : (
                        // Empty state for regular list
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
                            <p style={{ fontSize: '12px' }}>Click &ldquo;Find Now&rdquo; to refresh jobs</p>
                        </div>
                    )
                ) : (
                    // Job cards
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '16px' }}>
                        {displayedJobs.map((job) => (
                            <div
                                key={job.id}
                                onClick={() => {
                                    onJobClick(job);
                                    trackJobInteraction(job.id, 'view', { source: 'job_list', sort: sorting.by });
                                }}
                                className={`card card-interactive ${selectedJob?.id === job.id ? 'selected' : ''}`}
                                style={{
                                    padding: '12px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                }}
                            >
                                {/* Header with score */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                    <h3
                                        style={{
                                            fontSize: '13px',
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

                                    {/* Action Buttons (Save) & Profile Image */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                                        {job.postedBy && (
                                            <div
                                                title={`Posted by ${job.postedBy.firstName} ${job.postedBy.lastName}`}
                                                style={{ display: 'block', lineHeight: 0 }}
                                            >
                                                <ImageWithRetry
                                                    src={job.postedBy.imageUrl || null}
                                                    alt="Poster"
                                                    style={{
                                                        width: '28px',
                                                        height: '28px',
                                                        minWidth: '28px',
                                                        minHeight: '28px',
                                                        maxWidth: '28px',
                                                        maxHeight: '28px',
                                                        borderRadius: '50%',
                                                        objectFit: 'cover',
                                                        border: '1px solid var(--border)',
                                                        display: 'block'
                                                    }}
                                                />
                                            </div>
                                        )}

                                        {isSignedIn && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleJobStatus(job.id, job.status === 'saved' ? 'fresh' : 'saved');
                                                }}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    color: job.status === 'saved' ? 'var(--accent)' : 'var(--text-tertiary)',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                                title={job.status === 'saved' ? "Unsave" : "Save Job"}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill={job.status === 'saved' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    {/* Profile Image removed from here */}
                                    {job.match_score > 0 && (
                                        <div
                                            style={{
                                                background: getScoreColor(job.match_score),
                                                color: '#fff',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                padding: '1px 6px',
                                                borderRadius: '12px',
                                                minWidth: '28px',
                                                textAlign: 'center',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                            }}
                                        >
                                            {job.match_score}
                                        </div>
                                    )}
                                </div>

                                {/* Company & Logo */}
                                {(job.company || job.company_logo_url) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                        {job.company_logo_url ? (
                                            <img
                                                src={job.company_logo_url}
                                                alt={`${job.company} logo`}
                                                style={{ width: '16px', height: '16px', borderRadius: '4px', objectFit: 'cover' }}
                                                onError={(e) => {
                                                    // Replace with building icon on error immediately
                                                    e.currentTarget.style.display = 'none';
                                                    if (e.currentTarget.nextElementSibling) {
                                                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'block';
                                                    }
                                                }}
                                            />
                                        ) : null}
                                        {/* Fallback initial icon, hidden by default if trying to load an image */}
                                        <div
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '4px',
                                                flexShrink: 0,
                                                display: job.company_logo_url ? 'none' : 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: getCompanyColor(job.company),
                                                color: '#fff',
                                                fontSize: '10px',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            {getCompanyInitial(job.company)}
                                        </div>
                                        {job.company && <span>{job.company}</span>}
                                    </div>
                                )}

                                {/* Location & Posted */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '8px' }}>
                                    {(job.location_display || job.location) && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            {job.location_display || job.location}
                                        </span>
                                    )}
                                    <span
                                        suppressHydrationWarning
                                        style={{
                                            color: isRecentlyPosted(job.original_posted_date || job.posted_at) ? 'var(--success)' : 'var(--error)'
                                        }}
                                        title={job.original_posted_raw ? `Original: ${job.original_posted_raw}` : undefined}
                                    >
                                        {job.original_posted_raw && !job.original_posted_date
                                            ? `Added ${job.original_posted_raw}`
                                            : formatPostedDate(job.original_posted_date || job.posted_at)}
                                    </span>
                                </div>

                                {/* Why explanation */}
                                {job.why && (
                                    <p
                                        style={{
                                            fontSize: '11px',
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

                        <Pagination
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            totalItems={pagination.total}
                            limit={pagination.limit}
                            onPageChange={(page) => setPagination({ page })}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
