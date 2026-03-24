// Job List component - Middle column showing job cards

'use client';

import { useMemo } from 'react';
import { useStore, useStoreActions } from '@/store/useStore';
import type { Job, JobStatus } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { Pagination } from './Pagination';
import { useAuth } from '@clerk/nextjs';
import { SearchEmptyState } from '@/components/common/SearchEmptyState';
import { JobLoadingState } from '@/components/common/JobLoadingState';
import { ImageWithRetry } from '@/components/common/ImageWithRetry';
import { CompanyLogo } from '@/components/shared/CompanyLogo';
import { trackJobInteraction } from '@/lib/actions';
import { useFilters, checkJobMatchFields, type MatchField } from '@/contexts/FilterContext';

const FIELD_LABELS: Record<MatchField, string> = {
    title: 'Title Match',
    company: 'Company Match',
    location: 'Location Match',
    skills: 'Skills Match',
    description: 'Description Match'
};

const THIRTY_DAYS_MS = 1000 * 60 * 60 * 24 * 30;

function getJobPostedTimestamp(job: Job): number | null {
    const candidate = job.original_posted_date ?? job.posted_at ?? job.fetched_at;
    if (!candidate) return null;
    const parsed = Date.parse(candidate);
    return Number.isNaN(parsed) ? null : parsed;
}

function matchesStatusFilter(job: Job, filter: JobStatus): boolean {
    if (filter === 'saved') {
        return job.status === 'saved';
    }

    const postedAt = getJobPostedTimestamp(job);
    if (postedAt === null) return false;

    const ageMs = Date.now() - postedAt;
    if (filter === 'fresh') {
        return ageMs <= THIRTY_DAYS_MS;
    }

    return ageMs > THIRTY_DAYS_MS;
}

function MatchBadge({ matchedFields }: { matchedFields: MatchField[] }) {
    const primaryField = matchedFields[0];
    const label = FIELD_LABELS[primaryField];
    const allMatches = matchedFields.map(f => FIELD_LABELS[f]).join(', ');

    return (
        <div
            title={allMatches}
            style={{
                background: 'var(--accent-muted)',
                color: 'var(--accent)',
                fontSize: '10px',
                fontWeight: 600,
                padding: '4px 8px',
                borderRadius: '999px',
                border: '1px solid rgba(var(--accent-rgb), 0.22)',
                cursor: 'help',
                letterSpacing: '0.2px',
                textTransform: 'uppercase' as const,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
            }}
        >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <polyline points="20 6 9 17 4 12" />
            </svg>
            {label}
        </div>
    );
}

interface JobListProps {
    onJobClick: (job: Job) => void;
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
    const paginationLimit = pagination.limit || 50;
    const selectedJob = useStore(state => state.selectedJob);
    const isLoadingJobs = useStore(state => state.isLoadingJobs);

    const { activeFilters, removeFilter, clearFilters } = useFilters();

    const filteredJobs = useMemo(() => {
        if (activeFilters.length === 0) return jobs;

        return jobs.filter(job => {
            const result = checkJobMatchFields(job, activeFilters);
            return result.matches;
        });
    }, [jobs, activeFilters]);

    const jobMatchResults = useMemo(() => {
        if (activeFilters.length === 0) return new Map<string, MatchField[]>();
        const results = new Map<string, MatchField[]>();
        jobs.forEach(job => {
            const result = checkJobMatchFields(job, activeFilters);
            if (result.matches) {
                results.set(job.id, result.matchedFields);
            }
        });
        return results;
    }, [jobs, activeFilters]);

    const statusFilteredJobs = useMemo(() => {
        const baseJobs = searchMode ? searchResults : filteredJobs;
        return baseJobs.filter(job => matchesStatusFilter(job, jobStatus));
    }, [searchMode, searchResults, filteredJobs, jobStatus]);

    const statusAwareCount = statusFilteredJobs.length;
    const statusTotalPages = Math.ceil(statusAwareCount / paginationLimit);

    // Determine which jobs to display
    let displayedJobs = statusFilteredJobs;

    // Apply client-side pagination and sorting for search results
    if (searchMode) {
        const sorted = [...statusFilteredJobs].sort((a, b) => {
            const dir = sorting.dir === 'asc' ? 1 : -1;
            if (sorting.by === 'imported') {
                return (Number(a.source === 'imported') - Number(b.source === 'imported')) * dir;
            }
            const dateA = new Date(a.original_posted_date || a.posted_at || 0).getTime();
            const dateB = new Date(b.original_posted_date || b.posted_at || 0).getTime();
            return (dateA - dateB) * dir;
        });

        const start = (pagination.page - 1) * paginationLimit;
        const end = start + paginationLimit;
        displayedJobs = sorted.slice(start, end);
    }

    const { setPagination, setJobStatus, toggleJobStatus } = useStoreActions();
    const getStatusTabStyle = (status: JobStatus) => {
        const isActive = jobStatus === status;
        return {
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: isActive ? 600 : 500,
            borderRadius: 'var(--radius-lg)',
            background: isActive ? 'var(--accent)' : 'transparent',
            color: isActive ? '#ffffff' : 'var(--accent)',
            border: 'none',
            boxShadow: isActive ? '0 8px 18px rgba(var(--accent-rgb), 0.25)' : '0 0 0 1px var(--accent-muted)',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
        };
    };

    return (
        <div className="job-list-container">
            <div
                style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    background: 'var(--background)',
                    zIndex: 10,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: activeFilters.length > 0 ? '12px' : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {isSignedIn ? (
                            <div
                                style={{
                                    display: 'flex',
                                    gap: '6px',
                                    padding: '4px',
                                    borderRadius: 'var(--radius-lg)',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
                                }}
                            >
                                <button onClick={() => setJobStatus('fresh')} style={getStatusTabStyle('fresh')}>
                                    Fresh
                                </button>
                                <button onClick={() => setJobStatus('saved')} style={getStatusTabStyle('saved')}>
                                    Saved
                                </button>
                                <button onClick={() => setJobStatus('archived')} style={getStatusTabStyle('archived')}>
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
                                background: 'var(--background-secondary)',
                                color: 'var(--text-tertiary)',
                                padding: '3px 9px',
                                borderRadius: '999px',
                                border: '1px solid var(--border)',
                            }}
                        >
                            {statusAwareCount}
                        </span>
                    </div>
                </div>

                {activeFilters.length > 0 && (
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            flexWrap: 'wrap',
                            padding: '10px',
                            background: 'var(--background-secondary)',
                            borderRadius: '10px',
                            border: '1px solid var(--border)'
                        }}
                    >
                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                            Search:
                        </span>
                        {activeFilters.map(filter => (
                            <span
                                key={filter}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    fontSize: '11px',
                                    background: 'var(--surface)',
                                    color: 'var(--text-secondary)',
                                    border: '1px solid var(--border)',
                                    padding: '3px 9px',
                                    borderRadius: '999px',
                                    fontWeight: 500
                                }}
                            >
                                {filter}
                                <button
                                    onClick={() => removeFilter(filter)}
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'inherit',
                                        marginLeft: '4px',
                                        cursor: 'pointer',
                                        padding: 0,
                                        display: 'flex',
                                        fontSize: '12px',
                                        fontWeight: 700,
                                        lineHeight: 1,
                                    }}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        <button
                            onClick={clearFilters}
                            style={{
                                fontSize: '11px',
                                color: 'var(--error)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 600,
                                marginLeft: 'auto'
                            }}
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </div>

            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '12px',
                }}
            >
                {isLoadingJobs ? (
                    <JobLoadingState />
                ) : displayedJobs.length === 0 ? (
                    searchMode ? (
                        <SearchEmptyState />
                    ) : (
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '16px' }}>
                        {displayedJobs.map((job) => (
                            <div
                                key={job.id}
                                onClick={() => {
                                    onJobClick(job);
                                    trackJobInteraction(job.id, 'view', { source: 'job_list', sort: sorting.by });
                                }}
                                className={`card card-interactive job-listing-card ${selectedJob?.id === job.id ? 'selected' : ''}`}
                                style={{
                                    padding: '14px 14px 12px',
                                    cursor: 'pointer',
                                    position: 'relative',
                                    background: 'var(--surface)',
                                    border: selectedJob?.id === job.id ? '1px solid rgba(var(--accent-rgb), 0.35)' : '1px solid var(--border)',
                                    borderRadius: '12px',
                                    transition: 'all 0.18s ease',
                                    boxShadow: selectedJob?.id === job.id ? '0 0 0 2px rgba(var(--accent-rgb), 0.15)' : 'none',
                                }}
                            >
                                {activeFilters.length > 0 && jobMatchResults.get(job.id) && (
                                    <div style={{ marginBottom: '8px' }}>
                                        <MatchBadge matchedFields={jobMatchResults.get(job.id)!} />
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '9px' }}>
                                    <h3
                                        style={{
                                            fontSize: '15px',
                                            fontWeight: 600,
                                            color: 'var(--text-primary)',
                                            lineHeight: 1.35,
                                            flex: 1,
                                            marginRight: '10px',
                                        }}
                                        className="truncate-2"
                                    >
                                        {job.title}
                                    </h3>

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
                                                    borderRadius: '999px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'color var(--transition-fast)',
                                                }}
                                                title={job.status === 'saved' ? 'Unsave' : 'Save Job'}
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill={job.status === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {(job.company || job.company_logo_url) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 500 }}>
                                        <CompanyLogo companyName={job.company || ''} logoUrl={job.company_logo_url} size={18} />
                                        {job.company && <span>{job.company}</span>}
                                    </div>
                                )}

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                                    {(job.location_display || job.location) && (
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                                <circle cx="12" cy="10" r="3" />
                                            </svg>
                                            <span style={{ color: 'var(--text-secondary)' }}>{job.location_display || job.location}</span>
                                        </span>
                                    )}
                                    <span
                                        suppressHydrationWarning
                                        style={{
                                            color: isRecentlyPosted(job.original_posted_date || job.posted_at) ? 'var(--success)' : 'var(--text-tertiary)',
                                            fontWeight: isRecentlyPosted(job.original_posted_date || job.posted_at) ? 500 : 400,
                                        }}
                                        title={job.original_posted_raw ? `Original: ${job.original_posted_raw}` : undefined}
                                    >
                                        {job.original_posted_raw && !job.original_posted_date
                                            ? `Added ${job.original_posted_raw}`
                                            : formatPostedDate(job.original_posted_date || job.posted_at)}
                                    </span>
                                </div>
                            </div>
                        ))}

                        <Pagination
                            currentPage={pagination.page}
                            totalPages={statusTotalPages}
                            totalItems={statusAwareCount}
                            limit={pagination.limit}
                            onPageChange={(page) => setPagination({ page })}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

