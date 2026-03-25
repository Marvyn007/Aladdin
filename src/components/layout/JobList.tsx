// Job List component - Middle column showing job cards

'use client';

import { useMemo } from 'react';
import { useStore, useStoreActions } from '@/store/useStore';
import type { Job, JobStatus } from '@/types';
import { Pagination } from './Pagination';
import { useAuth } from '@clerk/nextjs';
import { SearchEmptyState } from '@/components/common/SearchEmptyState';
import { JobLoadingState } from '@/components/common/JobLoadingState';
import { CompanyLogo } from '@/components/shared/CompanyLogo';
import { trackJobInteraction } from '@/lib/actions';
import { useFilters, checkJobMatchFields, type MatchField } from '@/contexts/FilterContext';
import { extractJobCardTags, type JobCardTag } from '@/lib/job-card-tags';

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

function getTagColors(tag: JobCardTag) {
    const bySlug: Record<string, { background: string; border: string; text: string }> = {
        internship: { background: 'rgba(79, 70, 229, 0.08)', border: 'rgba(79, 70, 229, 0.18)', text: '#4338ca' },
        'co-op': { background: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.18)', text: '#6d28d9' },
        apprenticeship: { background: 'rgba(234, 88, 12, 0.08)', border: 'rgba(234, 88, 12, 0.18)', text: '#c2410c' },
        fellowship: { background: 'rgba(147, 51, 234, 0.08)', border: 'rgba(147, 51, 234, 0.18)', text: '#7e22ce' },
        'full-time': { background: 'rgba(37, 99, 235, 0.08)', border: 'rgba(37, 99, 235, 0.18)', text: '#1d4ed8' },
        'part-time': { background: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.18)', text: '#b45309' },
        contract: { background: 'rgba(220, 38, 38, 0.08)', border: 'rgba(220, 38, 38, 0.18)', text: '#b91c1c' },
        temporary: { background: 'rgba(225, 29, 72, 0.08)', border: 'rgba(225, 29, 72, 0.18)', text: '#be123c' },
        'new-grad': { background: 'rgba(8, 145, 178, 0.08)', border: 'rgba(8, 145, 178, 0.18)', text: '#0e7490' },
        'entry-level': { background: 'rgba(15, 118, 110, 0.08)', border: 'rgba(15, 118, 110, 0.18)', text: '#0f766e' },
        junior: { background: 'rgba(15, 118, 110, 0.08)', border: 'rgba(15, 118, 110, 0.18)', text: '#0f766e' },
        'mid-level': { background: 'rgba(37, 99, 235, 0.08)', border: 'rgba(37, 99, 235, 0.18)', text: '#1d4ed8' },
        senior: { background: 'rgba(219, 39, 119, 0.08)', border: 'rgba(219, 39, 119, 0.18)', text: '#be185d' },
        staff: { background: 'rgba(192, 38, 211, 0.08)', border: 'rgba(192, 38, 211, 0.18)', text: '#a21caf' },
        principal: { background: 'rgba(126, 34, 206, 0.08)', border: 'rgba(126, 34, 206, 0.18)', text: '#7e22ce' },
        lead: { background: 'rgba(225, 29, 72, 0.08)', border: 'rgba(225, 29, 72, 0.18)', text: '#be123c' },
        compensation: { background: 'rgba(22, 163, 74, 0.08)', border: 'rgba(22, 163, 74, 0.18)', text: '#15803d' },
        location: { background: 'rgba(3, 105, 161, 0.08)', border: 'rgba(3, 105, 161, 0.18)', text: '#0369a1' },
        remote: { background: 'rgba(13, 148, 136, 0.08)', border: 'rgba(13, 148, 136, 0.18)', text: '#0f766e' },
        hybrid: { background: 'rgba(14, 116, 144, 0.08)', border: 'rgba(14, 116, 144, 0.18)', text: '#0e7490' },
        'in-person': { background: 'rgba(194, 65, 12, 0.08)', border: 'rgba(194, 65, 12, 0.18)', text: '#9a3412' },
    };

    const byKind: Record<JobCardTag['kind'], { background: string; border: string; text: string }> = {
        season: { background: 'rgba(250, 204, 21, 0.14)', border: 'rgba(250, 204, 21, 0.28)', text: '#a16207' },
        program: { background: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.24)', text: '#4f46e5' },
        schedule: { background: 'rgba(37, 99, 235, 0.12)', border: 'rgba(37, 99, 235, 0.24)', text: '#2563eb' },
        experience: { background: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.24)', text: '#db2777' },
        compensation: { background: 'rgba(34, 197, 94, 0.12)', border: 'rgba(34, 197, 94, 0.24)', text: '#15803d' },
        location: { background: 'rgba(14, 165, 233, 0.12)', border: 'rgba(14, 165, 233, 0.24)', text: '#0369a1' },
        workplace: { background: 'rgba(20, 184, 166, 0.12)', border: 'rgba(20, 184, 166, 0.24)', text: '#0f766e' },
    };

    return bySlug[tag.slug] || byKind[tag.kind];
}

function parseCompensationLabel(label: string): { currency: string | null; amount: string } {
    const trimmed = label.trim();
    const prefixMatch = trimmed.match(/^(R\$|HK\$|CHF|AED|SAR|kr|zł|₹|€|£|¥|\$|R)\s*/i);
    if (!prefixMatch) {
        return { currency: null, amount: trimmed };
    }

    const amount = trimmed.slice(prefixMatch[0].length).trimStart();
    return {
        currency: prefixMatch[1],
        amount: amount || trimmed,
    };
}

function TagIcon({ kind }: { kind: JobCardTag['kind'] }) {
    if (kind === 'compensation') {
        return (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="6" width="18" height="12" rx="2" />
                <circle cx="12" cy="12" r="2.5" />
                <path d="M7 12h.01" />
                <path d="M17 12h.01" />
            </svg>
        );
    }

    if (kind === 'location') {
        return (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
            </svg>
        );
    }

    if (kind === 'workplace') {
        return (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="14" rx="2" />
                <path d="M8 20h8" />
                <path d="M12 18v2" />
            </svg>
        );
    }

    if (kind === 'season') {
        return (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <path d="M16 2v4" />
                <path d="M8 2v4" />
                <path d="M3 10h18" />
            </svg>
        );
    }

    if (kind === 'experience') {
        return (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m5 12 4 4L19 6" />
            </svg>
        );
    }

    return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7h18" />
            <path d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
            <rect x="3" y="7" width="18" height="13" rx="2" />
        </svg>
    );
}

function JobTagPill({ tag }: { tag: JobCardTag }) {
    const colors = getTagColors(tag);
    const compensationDisplay = tag.kind === 'compensation' ? parseCompensationLabel(tag.label) : null;
    const showCompensationCurrencyPrefix = tag.kind === 'compensation' && Boolean(compensationDisplay?.currency);

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 11px',
                borderRadius: '999px',
                fontSize: '13px',
                fontWeight: 600,
                lineHeight: 1,
                color: colors.text,
                background: colors.background,
                border: `1px solid ${colors.border}`,
                whiteSpace: 'nowrap',
            }}
        >
            {showCompensationCurrencyPrefix ? (
                <span style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1 }}>
                    {compensationDisplay?.currency}
                </span>
            ) : (
                <TagIcon kind={tag.kind} />
            )}
            {showCompensationCurrencyPrefix ? compensationDisplay?.amount : tag.label}
        </span>
    );
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
                        {displayedJobs.map((job) => {
                            const tags = extractJobCardTags(job);

                            return (
                                <div
                                    key={job.id}
                                    onClick={() => {
                                        onJobClick(job);
                                        trackJobInteraction(job.id, 'view', { source: 'job_list', sort: sorting.by });
                                    }}
                                    className={`card card-interactive job-listing-card ${selectedJob?.id === job.id ? 'selected' : ''}`}
                                    style={{
                                        padding: '16px 18px',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        background: selectedJob?.id === job.id
                                            ? 'color-mix(in srgb, var(--accent) 7%, var(--surface))'
                                            : 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '14px',
                                        transition: 'all 0.18s ease',
                                        boxShadow: selectedJob?.id === job.id
                                            ? '0 1px 0 rgba(var(--accent-rgb), 0.2)'
                                            : '0 1px 2px rgba(15, 23, 42, 0.06)',
                                    }}
                                >
                                    {activeFilters.length > 0 && jobMatchResults.get(job.id) && (
                                        <div style={{ marginBottom: '10px' }}>
                                            <MatchBadge matchedFields={jobMatchResults.get(job.id)!} />
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                        <div
                                            style={{
                                                width: '56px',
                                                height: '56px',
                                                minWidth: '56px',
                                                borderRadius: '14px',
                                                border: '1px solid rgba(15, 23, 42, 0.08)',
                                                background: '#ffffff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            <CompanyLogo
                                                companyName={job.company || 'Company'}
                                                logoUrl={job.company_logo_url}
                                                size={42}
                                            />
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div
                                                        style={{
                                                            fontSize: '15px',
                                                            fontWeight: 500,
                                                            color: 'var(--text-secondary)',
                                                            lineHeight: 1.25,
                                                            marginBottom: '4px',
                                                        }}
                                                        className="truncate-2"
                                                    >
                                                        {job.company || 'Unknown Company'}
                                                    </div>

                                                    <h3
                                                        style={{
                                                            fontSize: '17px',
                                                            fontWeight: 650,
                                                            color: 'var(--text-primary)',
                                                            lineHeight: 1.15,
                                                            letterSpacing: '-0.01em',
                                                            margin: 0,
                                                        }}
                                                        className="truncate-2"
                                                    >
                                                        {job.title}
                                                    </h3>
                                                </div>

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
                                                            marginTop: '2px',
                                                            flexShrink: 0,
                                                            opacity: 0.82,
                                                        }}
                                                        title={job.status === 'saved' ? 'Unsave' : 'Save Job'}
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill={job.status === 'saved' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                                        </svg>
                                                    </button>
                                                )}
                                            </div>

                                            {tags.length > 0 && (
                                                <div
                                                    style={{
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        gap: '8px',
                                                        marginTop: '12px',
                                                    }}
                                                >
                                                    {tags.map((tag) => (
                                                        <JobTagPill key={`${job.id}-${tag.kind}-${tag.slug}`} tag={tag} />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

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

