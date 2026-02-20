// Job Detail component - Right column showing full job details

'use client';

import { useState, useEffect, useCallback } from 'react';
import { JobEditModal } from '@/components/modals/JobEditModal';
import { useStore, useStoreActions } from '@/store/useStore';
import type { Job } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ImageWithRetry } from '@/components/common/ImageWithRetry';

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
    isAuthenticated?: boolean;
    currentUserId?: string | null;
    onJobUpdate?: (updatedJob: Job) => void;
}

// User Reputation Vote Control Component
interface VoteControlProps {
    targetUser: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        imageUrl: string | null;
        votes: number;
    } | null;
    currentUserId: string | null;
    onVoteSuccess?: () => void;
}

function ReputationCard({ targetUser, currentUserId, onVoteSuccess }: VoteControlProps) {
    const [votes, setVotes] = useState(targetUser?.votes || 0);
    const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
    const [loading, setLoading] = useState(false);

    // Sync votes with prop (initial load)
    useEffect(() => {
        setVotes(targetUser?.votes || 0);
    }, [targetUser?.votes]);

    // Polling for real-time updates (Short Polling: 3s)
    useEffect(() => {
        if (!targetUser?.id) return;

        let isMounted = true;
        const fetchVotes = async () => {
            try {
                const url = new URL('/api/vote-job', window.location.origin);
                url.searchParams.set('userId', targetUser.id);

                const res = await fetch(url.toString());
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setVotes(data.votes);
                        if (currentUserId && data.userVote !== undefined) {
                            setUserVote(data.userVote);
                        }
                    }
                }
            } catch (error) {
                console.error('Vote polling error:', error);
            }
        };

        fetchVotes();
        const intervalId = setInterval(fetchVotes, 3000);
        return () => { isMounted = false; clearInterval(intervalId); };
    }, [targetUser?.id, currentUserId]);

    const handleVote = async (type: 'up' | 'down') => {
        if (!currentUserId || !targetUser || loading) return;
        if (currentUserId === targetUser.id) return;

        setLoading(true);
        const oldVote = userVote;
        const oldVotes = votes;

        let delta = 0;
        let newUserVote: 'up' | 'down' | null = type;

        if (userVote === type) {
            delta = type === 'up' ? -1 : 1;
            newUserVote = null;
        } else {
            if (type === 'up') {
                delta = userVote === 'down' ? 2 : 1;
            } else {
                delta = userVote === 'up' ? -2 : -1;
            }
        }

        setVotes(prev => prev + delta);
        setUserVote(newUserVote);

        try {
            const res = await fetch('/api/vote-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: targetUser.id, voteType: type })
            });

            if (!res.ok) {
                setVotes(oldVotes);
                setUserVote(oldVote);
                const err = await res.json();
                if (err.error === 'Cannot vote for yourself') {
                    // Silent fail or handled by UI state
                }
            } else {
                const data = await res.json();
                setVotes(data.votes);
                if (onVoteSuccess) onVoteSuccess();
            }
        } catch (err) {
            setVotes(oldVotes);
            setUserVote(oldVote);
        } finally {
            setLoading(false);
        }
    };

    if (!targetUser) return null;

    const userName = [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ') || 'User';
    const canVote = currentUserId && currentUserId !== targetUser.id;

    return (
        <div style={{
            background: 'linear-gradient(145deg, var(--surface), var(--background-secondary))',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--border)',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Decorative background element */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '4px',
                background: 'linear-gradient(90deg, var(--accent), var(--success))',
                opacity: 0.8
            }} />

            <div style={{
                width: '100%',
                textAlign: 'center',
                marginBottom: '20px',
                fontSize: '12px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--text-secondary)'
            }}>
                Posted by
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                <ImageWithRetry
                    src={targetUser.imageUrl || null}
                    alt={userName}
                    className="job-detail-avatar"
                    style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid var(--surface)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {userName}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        Community Member
                    </span>
                </div>
            </div>

            {/* Voting Section styled as "Giving Thanks" */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'var(--background)',
                padding: '8px 24px',
                borderRadius: '30px',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.05)',
                gap: '32px',
                opacity: canVote ? 1 : 0.5,
                filter: canVote ? 'none' : 'grayscale(100%) blur(0.5px)',
                pointerEvents: canVote ? 'auto' : 'none',
                transition: 'all 0.3s ease'
            }}>
                <button
                    onClick={(e) => { e.stopPropagation(); handleVote('up'); }}
                    disabled={!canVote || loading}
                    title={!currentUserId ? "Sign in to thank" : (currentUserId === targetUser.id ? "You cannot thank yourself" : `Give thanks to ${userName}`)}
                    style={{
                        color: userVote === 'up' ? 'var(--accent)' : 'var(--text-tertiary)',
                        background: userVote === 'up' ? 'rgba(var(--accent-rgb), 0.1)' : 'transparent',
                        borderRadius: '50%',
                        width: '40px',
                        height: '40px',
                        border: 'none',
                        cursor: canVote ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                        transform: userVote === 'up' ? 'scale(1.1)' : 'scale(1)'
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill={userVote === 'up' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                        {votes}
                    </span>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: '2px' }}>
                        Reputation
                    </span>
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); handleVote('down'); }}
                    disabled={!canVote || loading}
                    title={!currentUserId ? "Sign in to vote" : (currentUserId === targetUser.id ? "You cannot vote for yourself" : `Downvote ${userName}`)}
                    style={{
                        color: userVote === 'down' ? 'var(--error)' : 'var(--text-tertiary)',
                        background: 'transparent',
                        border: 'none',
                        cursor: canVote ? 'pointer' : 'default',
                        padding: '8px',
                        lineHeight: 0,
                        opacity: canVote ? 1 : 0.5,
                        transition: 'transform 0.1s',
                        transform: userVote === 'down' ? 'scale(1.1)' : 'scale(1)'
                    }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill={userVote === 'down' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"></path></svg>
                </button>
            </div>

            <div style={{ marginTop: '16px', fontSize: '11px', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                {userVote === 'up' ? "You thanked the poster!" : "Found this job helpful? Give thanks!"}
            </div>
        </div>
    );
}

// Notion-like text parser and renderer
function JobDescriptionRenderer({ text }: { text: string }) {
    if (!text) return null;

    // Helper to auto-link emails and bold money
    const enhanceText = (content: string): React.ReactNode => {
        // First, handle money highlighting
        const highlightMoney = (text: string): React.ReactNode[] => {
            // Regex for money: starts with $ followed by digit, continues with specific chars
            // allowed: digits, commas, dots, hyphens, " - " (space hyphen space), B, M, /hr, /hour, /wk, /week
            const moneyRegex = /(\$\d(?:[\d,.\-BM]|(?: - )|(?:\/(?:hr|hour|wk|week)))*)/g;

            return text.split(moneyRegex).map((part, i) => {
                if (part.match(/^\$\d/)) {
                    return <strong key={`money-${i}`} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{part}</strong>;
                }
                return part;
            });
        };

        // Then, handle email linking
        const parts = content.split(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g);

        return parts.map((part, i) => {
            // Check if it's an email
            if (part.match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+$/)) {
                return (
                    <a
                        key={`email-${i}`}
                        href={`mailto:${part}`}
                        style={{ color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {part}
                    </a>
                );
            }

            // If not email, apply money highlighting
            // Since highlightMoney returns an array, we need to handle that
            return <span key={`text-${i}`}>{highlightMoney(part)}</span>;
        });
    };

    // Split into lines
    const lines = text.split(/\r?\n/);
    const blocks: React.ReactNode[] = [];

    let currentTextBuffer: string[] = [];
    let currentListBuffer: string[] = [];

    const flushText = () => {
        if (currentTextBuffer.length > 0) {
            blocks.push(
                <p
                    key={`text-${blocks.length}`}
                    style={{
                        marginBottom: '12px',
                        lineHeight: '1.6',
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        whiteSpace: 'pre-wrap'
                    }}
                >
                    {enhanceText(currentTextBuffer.join('\n'))}
                </p>
            );
            currentTextBuffer = [];
        }
    };

    const flushList = () => {
        if (currentListBuffer.length > 0) {
            blocks.push(
                <ul
                    key={`list-${blocks.length}`}
                    style={{
                        marginTop: '4px',
                        marginBottom: '12px',
                        paddingLeft: '20px',
                        listStyleType: 'disc',
                        color: 'var(--text-secondary)'
                    }}
                >
                    {currentListBuffer.map((item, i) => (
                        <li
                            key={i}
                            style={{
                                marginBottom: '4px',
                                lineHeight: '1.6',
                                fontSize: '14px',
                                paddingLeft: '4px',
                            }}
                        >
                            <span style={{ color: 'var(--text-primary)' }}>{enhanceText(item)}</span>
                        </li>
                    ))}
                </ul>
            );
            currentListBuffer = [];
        }
    };

    lines.forEach((line) => {
        const trimmed = line.trim();

        // Empty lines trigger a flush (block separator)
        if (!trimmed) {
            flushText();
            flushList();
            return;
        }

        // Check for bullets
        const bulletMatch = trimmed.match(/^[-*•]\s+(.*)/);

        if (bulletMatch) {
            flushText();
            currentListBuffer.push(bulletMatch[1]);
            return; // Done with this line
        }

        // Header detection heuristics:
        // 1. Ends with colon (e.g., "Requirements:")
        // 2. All caps and short (e.g., "QUALIFICATIONS")
        // 3. Short line (1-5 words) - usually a section title in this context

        const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
        const isShortLine = wordCount >= 1 && wordCount <= 5;

        // Length check prevents long sentences from being treated as headers
        // We also check that it contains at least some letters to avoid bolding "123" or separator lines
        const isHeader = trimmed.length < 100 && /[a-zA-Z]/.test(trimmed) && (
            trimmed.endsWith(':') ||
            (trimmed.toUpperCase() === trimmed && trimmed.length > 3) ||
            isShortLine
        );

        if (isHeader) {
            flushText();
            flushList();
            blocks.push(
                <h4
                    key={`h-${blocks.length}`}
                    style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        marginTop: '24px',
                        marginBottom: '8px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.4
                    }}
                >
                    {enhanceText(trimmed)}
                </h4>
            );
            return;
        }

        // Standard text line
        flushList();
        currentTextBuffer.push(line);
    });

    // Final flush
    flushText();
    flushList();

    return <div className="job-description-content">{blocks}</div>;
}

export function JobDetail({
    job,
    onApply,
    onDelete,
    onGenerateCoverLetter,
    onGenerateTailoredResume,
    applicationStatus,
    isMobileVisible,
    onBack,
    isAuthenticated = false,
    currentUserId,
    onJobUpdate,
}: JobDetailProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingResume, setIsGeneratingResume] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const { toggleJobStatus } = useStoreActions();

    // The DB row spreads posted_by_user_id (snake_case); postedByUserId (camelCase) is only set in some mappers.
    const jobPosterId = job?.posted_by_user_id || job?.postedByUserId || job?.postedBy?.id || null;

    // Temporary debug log – remove after validation
    if (process.env.NODE_ENV === 'development' && job) {
        console.log('Edit check:', {
            currentUserId,
            'job.posted_by_user_id': job.posted_by_user_id,
            'job.postedByUserId': job.postedByUserId,
            'job.postedBy?.id': job.postedBy?.id,
            resolved: jobPosterId,
            match: currentUserId === jobPosterId,
        });
    }

    const canEdit = Boolean(
        currentUserId && jobPosterId && String(currentUserId) === String(jobPosterId)
    );

    const handleEditSave = useCallback(async (fields: { title: string; company: string; location: string; description: string }) => {
        if (!job) return;
        const previousJob = { ...job };

        // Optimistic update
        const optimisticJob = {
            ...job,
            title: fields.title,
            company: fields.company,
            location: fields.location,
            location_display: fields.location,
            job_description_plain: fields.description,
            normalized_text: fields.description,
            edited_by_user: true,
        };
        onJobUpdate?.(optimisticJob);
        setIsEditModalOpen(false);

        try {
            const res = await fetch(`/api/job/${job.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            });

            if (!res.ok) {
                const data = await res.json();
                // Revert optimistic update
                onJobUpdate?.(previousJob);
                throw new Error(data.error || 'Failed to save changes');
            }

            const data = await res.json();
            if (data.job) {
                onJobUpdate?.(data.job);
            }
        } catch (err) {
            // Revert optimistic update on network error
            onJobUpdate?.(previousJob);
            setIsEditModalOpen(true);
            throw err;
        }
    }, [job, onJobUpdate]);

    // ... (helper functions stay same)

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
        // ... (empty state stays same)
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

    // Helper for disabled visual style
    const disabledStyle = !isAuthenticated ? { opacity: 0.6, cursor: 'not-allowed' } : {};
    // Actually we want cursor to be pointer to allow click for modal, but look disabled
    const gatedStyle = !isAuthenticated ? { opacity: 0.6, position: 'relative' as const } : {};
    const gatedIcon = !isAuthenticated && (
        <span style={{ position: 'absolute', top: -5, right: -5, fontSize: 10 }}>🔒</span>
    );

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

            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {/* Header Info (Static) */}
                <div
                    style={{
                        padding: '20px 20px 8px 20px',
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
                            </div>
                            {job.company && (
                                <p style={{ fontSize: '16px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                    {job.company}
                                </p>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {/* Poster Card (Profile + Reputation) */}
                            {/* Poster Card (Profile + Reputation) removed from here */}

                            {/* Match Score */}
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'var(--surface)',
                                    borderRadius: 'var(--radius-lg)',
                                    minWidth: '70px',
                                }}
                            >
                                <span
                                    style={{
                                        fontSize: '24px',
                                        fontWeight: 700,
                                        color: getScoreColor(job.match_score),
                                    }}
                                >
                                    {job.match_score}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>
                                    Match
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Meta info */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
                        {/* Poster Info */}


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
                </div>

                {/* Action Buttons (Sticky) */}
                <div
                    style={{
                        padding: '12px 20px 20px 20px',
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--background-secondary)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                    }}
                >
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

                        {isAuthenticated && (
                            <button
                                onClick={() => toggleJobStatus(job.id, job.status === 'saved' ? 'fresh' : 'saved')}
                                className="btn btn-secondary"
                                style={{
                                    color: job.status === 'saved' ? 'var(--accent)' : undefined,
                                    borderColor: job.status === 'saved' ? 'var(--accent)' : undefined,
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill={job.status === 'saved' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
                                </svg>
                                {job.status === 'saved' ? 'Saved' : 'Save'}
                            </button>
                        )}

                        <button
                            onClick={handleGenerateCoverLetter}
                            disabled={isGenerating} // Don't disable for auth check, we want the click
                            className="btn btn-secondary"
                            style={gatedStyle}
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
                                    {gatedIcon}
                                </>
                            )}
                        </button>

                        <button
                            onClick={handleGenerateTailoredResume}
                            disabled={isGeneratingResume}
                            className="btn btn-secondary"
                            style={gatedStyle}
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
                                    {gatedIcon}
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
                                ...gatedStyle
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

                        {canEdit && (
                            <button
                                onClick={() => setIsEditModalOpen(true)}
                                className="btn btn-outline"
                                style={{
                                    borderColor: 'var(--border)',
                                }}
                                title="Edit Job Details"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                                Edit
                            </button>
                        )}

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
                <div style={{ flex: 1, padding: '20px' }}>

                    {(job.matched_skills?.length || job.missing_skills?.length) && (
                        <div style={{ marginBottom: '24px' }}>
                            <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Job Description
                                </h3>
                                <JobDescriptionRenderer text={job.job_description_plain || job.raw_text_summary || ''} />
                            </div>
                        )
                    }

                    {/* Poster Reputation Card */}
                    {job.postedBy && (
                        <div style={{ marginTop: '40px', marginBottom: '20px', width: '100%' }}>
                            <ReputationCard
                                targetUser={job.postedBy}
                                currentUserId={isAuthenticated ? 'user' : null}
                            />
                        </div>
                    )}

                    {/* Source link */}
                    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            Source: <a href={job.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{new URL(job.source_url).hostname}</a>
                        </p>
                    </div>
                </div >
            </div >

            {/* Edit Job Modal */}
            {isEditModalOpen && job && (
                <JobEditModal
                    job={job}
                    onClose={() => setIsEditModalOpen(false)}
                    onSave={handleEditSave}
                />
            )}
        </div >
    );
}
