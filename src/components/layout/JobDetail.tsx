// Job Detail component - Right column showing full job details

'use client';

import { useState, useEffect } from 'react';
import { useStore, useStoreActions } from '@/store/useStore';
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
    isAuthenticated?: boolean;
}

// User Reputation Vote Control Component
interface VoteControlProps {
    targetUser: {
        id: string;
        firstName: string | null;
        lastName: string | null;
        votes: number;
    } | null;
    currentUserId: string | null;
    onVoteSuccess?: () => void;
}

function VoteControl({ targetUser, currentUserId, onVoteSuccess }: VoteControlProps) {
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
                        setVotes(data.votes); // Always update total count
                        if (currentUserId && data.userVote !== undefined) {
                            setUserVote(data.userVote); // Update own vote status if logged in
                        }
                    }
                }
            } catch (error) {
                console.error('Vote polling error:', error);
            }
        };

        // Initial fetch
        fetchVotes();

        // Poll every 3 seconds
        const intervalId = setInterval(fetchVotes, 3000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [targetUser?.id, currentUserId]);

    const handleVote = async (type: 'up' | 'down') => {
        if (!currentUserId || !targetUser || loading) return;

        // Prevent self-voting
        if (currentUserId === targetUser.id) return;

        // If user already voted this way, do nothing (strict single vote per type)
        // Actually, if clicking same vote, we might want to toggle it off?
        // User request says "exactly once". Usually means toggle support or strict one-time.
        // Let's assume strict set for now, or toggle if backend supports deletion.
        // Current backend supports flipping. If same, it returns current.
        // Let's keep UI simple: clicking same does nothing as per typical "one vote" interpretation unless toggle requested.

        if (userVote === type) return;

        setLoading(true);
        const oldVote = userVote;
        const oldVotes = votes;

        // Optimistic Calc
        // No vote -> Up (+1)
        // Down -> Up (+2)
        // No vote -> Down (-1)
        // Up -> Down (-2)

        let delta = 0;
        if (type === 'up') {
            delta = oldVote === 'down' ? 2 : 1;
        } else {
            delta = oldVote === 'up' ? -2 : -1;
        }

        // Optimistic update
        setVotes(prev => prev + delta);
        setUserVote(type);

        try {
            const res = await fetch('/api/vote-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: targetUser.id, voteType: type })
            });

            if (!res.ok) {
                // Revert on failure
                setVotes(oldVotes);
                setUserVote(oldVote);
                const err = await res.json();
                if (err.error === 'Cannot vote for yourself') {
                    alert("You cannot vote for yourself.");
                }
            } else {
                const data = await res.json();
                // Sync with server truth just in case
                setVotes(data.votes);
                if (onVoteSuccess) onVoteSuccess();
            }
        } catch (err) {
            // Revert on error
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', background: 'var(--surface)', padding: '6px 10px', borderRadius: '12px', minWidth: '50px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: '2px' }}>
                Reputation
            </span>
            <button
                onClick={(e) => { e.stopPropagation(); handleVote('up'); }}
                disabled={!canVote || loading}
                title={!currentUserId ? "Sign in to vote" : (currentUserId === targetUser.id ? "You cannot vote for yourself" : `Upvote ${userName}`)}
                style={{
                    color: userVote === 'up' ? 'var(--success)' : 'var(--text-tertiary)',
                    background: 'none',
                    border: 'none',
                    cursor: canVote && userVote !== 'up' ? 'pointer' : 'default',
                    padding: '2px',
                    lineHeight: 0,
                    opacity: canVote ? 1 : 0.5,
                    transition: 'transform 0.1s'
                }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={userVote === 'up' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
            </button>
            <span style={{ fontSize: '14px', fontWeight: 700, color: votes >= 0 ? 'var(--success)' : 'var(--error)', minWidth: '20px', textAlign: 'center' }}>
                {votes > 0 ? '+' : ''}{votes}
            </span>
            <button
                onClick={(e) => { e.stopPropagation(); handleVote('down'); }}
                disabled={!canVote || loading}
                title={!currentUserId ? "Sign in to vote" : (currentUserId === targetUser.id ? "You cannot vote for yourself" : `Downvote ${userName}`)}
                style={{
                    color: userVote === 'down' ? 'var(--error)' : 'var(--text-tertiary)',
                    background: 'none',
                    border: 'none',
                    cursor: canVote && userVote !== 'down' ? 'pointer' : 'default',
                    padding: '2px',
                    lineHeight: 0,
                    opacity: canVote ? 1 : 0.5,
                    transition: 'transform 0.1s'
                }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={userVote === 'down' ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
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
    isAuthenticated = false
}: JobDetailProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isGeneratingResume, setIsGeneratingResume] = useState(false);
    const { toggleJobStatus } = useStoreActions();

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
                            {job.postedBy && (
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '6px 12px 6px 6px',
                                    background: 'var(--surface)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border)',
                                }}>
                                    {/* Avatar & Name */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <img
                                            src={job.postedBy.imageUrl || '/placeholder-user.jpg'}
                                            alt={`${job.postedBy.firstName || 'User'}`}
                                            style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                                border: '1px solid var(--border)',
                                            }}
                                            onError={(e) => {
                                                e.currentTarget.src = '/placeholder-user.jpg';
                                            }}
                                        />
                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
                                                {job.postedBy.firstName} {job.postedBy.lastName}
                                            </span>
                                            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: 1 }}>
                                                Poster
                                            </span>
                                        </div>
                                    </div>

                                    {/* Vertical Separator */}
                                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>

                                    {/* Vote Control */}
                                    <VoteControl
                                        targetUser={job.postedBy}
                                        currentUserId={isAuthenticated ? 'user' : null}
                                    />
                                </div>
                            )}

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

                    {/* Source link */}
                    <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            Source: <a href={job.source_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>{new URL(job.source_url).hostname}</a>
                        </p>
                    </div>
                </div >
            </div>
        </div >
    );
}
