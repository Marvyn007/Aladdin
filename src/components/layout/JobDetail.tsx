// Job Detail component - Right column showing full job details

'use client';

import { useState, useEffect, useCallback } from 'react';
import { JobEditModal } from '@/components/modals/JobEditModal';
import { useStoreActions } from '@/store/useStore';
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';
import type { Job } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { ImageWithRetry } from '@/components/common/ImageWithRetry';
import Link from 'next/link';
import DOMPurify from 'isomorphic-dompurify';
import he from 'he';
import { CompanyLogo } from '@/components/shared/CompanyLogo';

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
        const intervalId = setInterval(fetchVotes, 3600000); // Poll once per hour (3,600,000 ms)
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
        } catch {
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
                Added by
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
function JobDescriptionRenderer({ text, html }: { text: string; html?: string | null }) {
    if (html) {
        const decodedHtml = he.decode(html);
        const cleanHtml = DOMPurify.sanitize(decodedHtml, {
            ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span'],
            ALLOWED_ATTR: ['href', 'target', 'rel']
        });
        return (
            <>
                <style dangerouslySetInnerHTML={{ __html: `
                    .job-description-html {
                        color: var(--job-desc-color);
                        line-height: 1.65;
                        font-size: 14px;
                        font-family: var(--font-inter), "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                        word-wrap: break-word;
                        max-width: 100%;
                    }
                    .job-description-html h1, .job-description-html h2, .job-description-html h3, .job-description-html h4, .job-description-html h5, .job-description-html h6 {
                        color: var(--text-primary);
                        font-weight: 600;
                        margin-top: 1.75em;
                        margin-bottom: 0.6em;
                        line-height: 1.35;
                        letter-spacing: -0.01em;
                    }
                    .job-description-html h1 { font-size: 1.45em; }
                    .job-description-html h2 { font-size: 1.3em; }
                    .job-description-html h3 { font-size: 1.12em; }
                    .job-description-html p {
                        margin-bottom: 1em;
                        line-height: 1.65;
                    }
                    .job-description-html ul, .job-description-html ol {
                        padding-left: 1.2em;
                        margin-bottom: 1.05em;
                        margin-top: 0.5em;
                    }
                    .job-description-html li {
                        margin-bottom: 0.45em;
                        line-height: 1.6;
                    }
                    .job-description-html ul { list-style-type: disc; }
                    .job-description-html ol { list-style-type: decimal; }
                    .job-description-html a {
                        color: var(--accent);
                        text-decoration: none;
                        font-weight: 500;
                    }
                    .job-description-html a:hover {
                        text-decoration: underline;
                    }
                    .job-description-html strong, .job-description-html b {
                        color: var(--text-primary);
                        font-weight: 600;
                    }
                    .job-description-html blockquote {
                        border-left: 3px solid var(--border);
                        padding-left: 1em;
                        margin-left: 0;
                        color: var(--text-tertiary);
                        font-style: italic;
                    }
                    .job-description-html code {
                        background: var(--background-secondary);
                        padding: 2px 6px;
                        border-radius: 4px;
                        font-family: "SFMono-Regular", Consolas, Monaco, monospace;
                        font-size: 0.9em;
                    }
                ` }} />
                <div 
                    className="job-description-html" 
                    dangerouslySetInnerHTML={{ __html: cleanHtml }}
                />
            </>
        );
    }

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
                        marginBottom: '16px',
                        lineHeight: '1.7',
                        fontSize: '15px',
                        color: 'var(--job-desc-color)',
                        whiteSpace: 'pre-wrap',
                        fontFamily: 'var(--font-inter), "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
                        marginTop: '8px',
                        marginBottom: '16px',
                        paddingLeft: '24px',
                        listStyleType: 'disc',
                        color: 'var(--job-desc-color)'
                    }}
                >
                    {currentListBuffer.map((item, i) => (
                        <li
                            key={i}
                            style={{
                                marginBottom: '8px',
                                lineHeight: '1.65',
                                fontSize: '15px',
                                paddingLeft: '4px',
                                fontFamily: 'var(--font-inter), "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
        const bulletMatch = trimmed.match(/^[-*\u2022]\s+(.*)/);

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
                        fontSize: '16px',
                        fontWeight: 600,
                        marginTop: '28px',
                        marginBottom: '12px',
                        color: 'var(--text-primary)',
                        lineHeight: 1.4,
                        fontFamily: 'var(--font-inter), "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
    const [hasTailoredResume, setHasTailoredResume] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const { toggleJobStatus } = useStoreActions();
    const { status: resumeStatus } = useResumeGeneration();

    // The DB row spreads posted_by_user_id (snake_case); postedByUserId (camelCase) is only set in some mappers.
    const jobPosterId = job?.posted_by_user_id || job?.postedByUserId || job?.postedBy?.id || null;

    useEffect(() => {
        if (!job?.id) {
            setHasTailoredResume(false);
            return;
        }
        let mounted = true;
        fetch(`/api/tailored-resume?jobId=${job.id}`)
            .then(res => res.json())
            .then(data => {
                if (mounted && data.resume) {
                    setHasTailoredResume(true);
                }
            })
            .catch(err => console.error("Error checking for tailored resume:", err));
        return () => { mounted = false; };
    }, [job?.id]);

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

    // Auth-gated actions should still be clickable so we can trigger the auth flow.
    const gatedStyle = !isAuthenticated ? { opacity: 0.6, position: 'relative' as const } : {};
    const gatedIcon = !isAuthenticated && (
        <span style={{ position: 'absolute', top: -7, right: -7, fontSize: 9, lineHeight: 1, fontWeight: 700 }}>LOCK</span>
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

            <div className="job-detail-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                {/* Header Info (Static) */}
                <div
                    style={{
                        padding: '24px 24px 10px',
                        background: 'var(--background)',
                    }}
                >
                    {/* Title and Score */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div style={{ flex: 1, marginRight: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <h2 style={{ fontSize: '28px', fontWeight: 700, margin: 0, lineHeight: 1.18, letterSpacing: '-0.02em' }}>
                                    {job.title}
                                </h2>
                            </div>
                            {(job.company || job.company_logo_url) && (
                                <Link
                                    href={`/interview-experiences/${encodeURIComponent(job.company || '')}`}
                                    className="company-link-header"
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        marginBottom: '6px',
                                        textDecoration: 'none',
                                        cursor: 'pointer',
                                        width: 'fit-content',
                                        transition: 'opacity 0.2s'
                                    }}
                                >
                                    <CompanyLogo companyName={job.company || ''} logoUrl={job.company_logo_url} size={20} />
                                    {job.company && (
                                        <p style={{ fontSize: '16px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
                                            {job.company}
                                        </p>
                                    )}
                                </Link>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            {/* Poster Card (Profile + Reputation) */}
                            {/* Poster Card (Profile + Reputation) removed from here */}

                        </div>
                    </div>

                    {/* Meta info */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '4px' }}>
                        {/* Poster Info */}


                        {(job.location_display || job.location) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                    <circle cx="12" cy="10" r="3" />
                                </svg>
                                <span>{job.location_display || job.location}</span>
                            </div>
                        )}
                        <div
                            style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'help', fontSize: '13px' }}
                            title={job.original_posted_raw ? `Original: ${job.original_posted_raw} (${job.original_posted_source || 'unknown'})` : undefined}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: isRecentlyPosted(job.original_posted_date || job.posted_at) ? 'var(--success)' : 'var(--error)' }}>
                                <circle cx="12" cy="12" r="10" />
                                <polyline points="12 6 12 12 16 14" />
                            </svg>
                            <span style={{ color: isRecentlyPosted(job.original_posted_date || job.posted_at) ? 'var(--success)' : 'var(--error)' }}>
                                Added: {job.original_posted_raw && !job.original_posted_date
                                    ? job.original_posted_raw
                                    : formatPostedDate(job.original_posted_date || job.posted_at)}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action Buttons (Sticky) */}
                <div
                    className="job-detail-action-bar"
                    style={{
                        padding: '10px 24px 14px',
                        borderBottom: '1px solid var(--border)',
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        background: 'var(--background)',
                    }}
                >
                    {/* Action buttons */}
                    <div className="action-buttons" style={{ gap: '10px' }}>
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
                                {job.status === 'saved' ? 'Saved Job' : 'Save Job'}
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

                        {hasTailoredResume ? (
                            <Link
                                href={`/resume-editor/${job.id}`}
                                className="btn"
                                style={{
                                    ...gatedStyle,
                                    backgroundColor: 'var(--success)',
                                    color: 'white',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                                View Tailored Resume
                                {gatedIcon}
                            </Link>
                        ) : (
                            <button
                                onClick={handleGenerateTailoredResume}
                                disabled={isGeneratingResume || resumeStatus === 'generating'}
                                title={resumeStatus === 'generating' ? 'Resume generation in progress' : undefined}
                                className="btn btn-secondary"
                                style={{
                                    ...gatedStyle,
                                    opacity: resumeStatus === 'generating' ? 0.5 : undefined,
                                    cursor: resumeStatus === 'generating' ? 'not-allowed' : undefined,
                                }}
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
                        )}

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
                                    Add to Tracker
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
                <div style={{ flex: 1, padding: '24px' }}>


                    {/* Why explanation */}
                    {
                    }

                    {/* Job description */}
                    {
                        (job.job_description_plain || job.raw_text_summary) && (
                            <div style={{ marginTop: '8px' }}>
                                <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                    Job Description
                                </h3>
                                <div style={{ 
                                    fontFamily: 'var(--font-inter), "Inter", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                                    fontSize: '14px',
                                    lineHeight: '1.65',
                                    color: 'var(--text-secondary)',
                                }}>
                                    <JobDescriptionRenderer
                                        text={job.job_description_plain || job.raw_text_summary || ''}
                                        html={job.raw_description_html || (job as Job & { rawDescriptionHtml?: string }).rawDescriptionHtml}
                                    />
                                </div>
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

