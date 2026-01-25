// Public Job List component with server-side pagination
// Shows ALL jobs without user filtering

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Job } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface PublicJobListProps {
    onJobClick?: (job: Job) => void;
}

interface PaginationResponse {
    jobs: Job[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
type PageSize = typeof PAGE_SIZE_OPTIONS[number];

export function PublicJobList({ onJobClick }: PublicJobListProps) {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Pagination state
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState<PageSize>(50);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`/api/jobs?page=${page}&limit=${pageSize}`);
            if (!res.ok) throw new Error('Failed to fetch jobs');

            const data: PaginationResponse = await res.json();
            setJobs(data.jobs);
            setTotal(data.total);
            setTotalPages(data.totalPages);
        } catch (err: any) {
            setError(err.message || 'Failed to load jobs');
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => {
        fetchJobs();
    }, [fetchJobs]);

    // Navigation handlers
    const goToFirst = () => setPage(1);
    const goToPrev = () => setPage(p => Math.max(1, p - 1));
    const goToNext = () => setPage(p => Math.min(totalPages, p + 1));
    const goToLast = () => setPage(totalPages);

    const handlePageSizeChange = (newSize: PageSize) => {
        setPageSize(newSize);
        setPage(1); // Reset to first page when changing page size
    };

    const formatPostedDate = (postedAt: string | null): string => {
        if (!postedAt) return 'Unknown';
        try {
            const date = new Date(postedAt);
            return formatDistanceToNow(date, { addSuffix: true });
        } catch {
            return 'Unknown';
        }
    };

    const getScoreColor = (score: number) => {
        if (score >= 90) return '#10b981';
        if (score >= 75) return '#34d399';
        if (score >= 50) return '#fbbf24';
        if (score >= 30) return '#f87171';
        return '#ef4444';
    };

    const startItem = (page - 1) * pageSize + 1;
    const endItem = Math.min(page * pageSize, total);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header with pagination info */}
            <div style={{
                padding: '16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--background)',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                        All Jobs
                        <span style={{
                            marginLeft: '8px',
                            fontSize: '14px',
                            color: 'var(--text-secondary)',
                            fontWeight: 400
                        }}>
                            ({total.toLocaleString()} total)
                        </span>
                    </h2>

                    {/* Page size selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Show:</span>
                        <select
                            value={pageSize}
                            onChange={(e) => handlePageSizeChange(Number(e.target.value) as PageSize)}
                            style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                cursor: 'pointer',
                            }}
                        >
                            {PAGE_SIZE_OPTIONS.map(size => (
                                <option key={size} value={size}>{size}</option>
                            ))}
                        </select>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>per page</span>
                    </div>
                </div>

                {/* Pagination controls */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        Showing {startItem.toLocaleString()} - {endItem.toLocaleString()} of {total.toLocaleString()}
                    </span>

                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={goToFirst}
                            disabled={page === 1 || loading}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: page === 1 ? 'var(--surface)' : 'var(--background)',
                                color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                cursor: page === 1 ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                fontWeight: 500,
                            }}
                        >
                            First
                        </button>
                        <button
                            onClick={goToPrev}
                            disabled={page === 1 || loading}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: page === 1 ? 'var(--surface)' : 'var(--background)',
                                color: page === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                cursor: page === 1 ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                fontWeight: 500,
                            }}
                        >
                            ← Prev
                        </button>

                        <span style={{
                            padding: '6px 16px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                        }}>
                            Page {page} of {totalPages}
                        </span>

                        <button
                            onClick={goToNext}
                            disabled={page === totalPages || loading}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: page === totalPages ? 'var(--surface)' : 'var(--background)',
                                color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                fontWeight: 500,
                            }}
                        >
                            Next →
                        </button>
                        <button
                            onClick={goToLast}
                            disabled={page === totalPages || loading}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '4px',
                                border: '1px solid var(--border)',
                                background: page === totalPages ? 'var(--surface)' : 'var(--background)',
                                color: page === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                cursor: page === totalPages ? 'not-allowed' : 'pointer',
                                fontSize: '13px',
                                fontWeight: 500,
                            }}
                        >
                            Last
                        </button>
                    </div>
                </div>
            </div>

            {/* Job list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {loading ? (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        color: 'var(--text-secondary)'
                    }}>
                        Loading jobs...
                    </div>
                ) : error ? (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        color: '#ef4444'
                    }}>
                        {error}
                    </div>
                ) : jobs.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: '200px',
                        color: 'var(--text-secondary)'
                    }}>
                        No jobs found
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {jobs.map((job) => (
                            <div
                                key={job.id}
                                onClick={() => onJobClick?.(job)}
                                style={{
                                    padding: '16px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border)',
                                    background: 'var(--surface)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <h3 style={{
                                        margin: 0,
                                        fontSize: '15px',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)',
                                        flex: 1,
                                        marginRight: '12px',
                                    }}>
                                        {job.title}
                                    </h3>
                                    {job.match_score > 0 && (
                                        <div style={{
                                            padding: '2px 8px',
                                            borderRadius: '12px',
                                            background: getScoreColor(job.match_score),
                                            color: '#fff',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                        }}>
                                            {job.match_score}%
                                        </div>
                                    )}
                                </div>
                                <div style={{
                                    fontSize: '14px',
                                    color: 'var(--text-secondary)',
                                    marginBottom: '4px',
                                }}>
                                    {job.company || 'Unknown Company'}
                                </div>
                                <div style={{
                                    display: 'flex',
                                    gap: '12px',
                                    fontSize: '12px',
                                    color: 'var(--text-tertiary)',
                                }}>
                                    <span>{job.location || 'Location unknown'}</span>
                                    <span>•</span>
                                    <span>{formatPostedDate(job.posted_at || job.fetched_at)}</span>
                                    {job.isImported && (
                                        <>
                                            <span>•</span>
                                            <span style={{
                                                color: 'var(--accent)',
                                                fontWeight: 500
                                            }}>
                                                Imported
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
