/**
 * UserAccountSection - Clerk-integrated user account UI for sidebar
 * Shows authenticated user avatar, name, and popover menu with settings/upgrade options
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Settings, Zap, ChevronUp } from 'lucide-react';
import { AccountSettingsModal } from './AccountSettingsModal';
import { useSubscription } from '@/hooks/useSubscription';

const PLAN_LABELS: Record<string, string> = {
  LITE: 'Lite',
  COPILOT: 'Co-Pilot',
  CAPTAIN: 'Captain',
};

export function UserAccountSection({ collapsed }: { collapsed?: boolean }) {
    const router = useRouter();
    const { user, isLoaded, isSignedIn } = useUser();
    const sub = useSubscription();
    const [modalOpen, setModalOpen] = useState(false);
    const [popoverOpen, setPopoverOpen] = useState(false);
    const [customUsername, setCustomUsername] = useState<string | null>(null);
    const [usernameLoaded, setUsernameLoaded] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);

    // Close popover on outside click
    useEffect(() => {
        if (!popoverOpen) return;
        function handleClick(e: MouseEvent) {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                buttonRef.current && !buttonRef.current.contains(e.target as Node)
            ) {
                setPopoverOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [popoverOpen]);

    // Fetch or initialize custom username
    const fetchUsername = useCallback(async () => {
        if (!isSignedIn || !user) return;
        try {
            const profileRes = await fetch('/api/user/profile');
            const profile = await profileRes.json();
            if (profile.exists) {
                setCustomUsername(profile.username);
            } else {
                const initRes = await fetch('/api/user/init', { method: 'POST' });
                const initData = await initRes.json();
                if (initData.username) setCustomUsername(initData.username);
            }
        } catch (error) {
            console.error('Failed to fetch username:', error);
        } finally {
            setUsernameLoaded(true);
        }
    }, [isSignedIn, user]);

    useEffect(() => {
        if (isSignedIn && user && !usernameLoaded) fetchUsername();
    }, [isSignedIn, user, usernameLoaded, fetchUsername]);

    const handleModalClose = () => {
        setModalOpen(false);
        setUsernameLoaded(false);
    };

    // Loading state
    if (!isLoaded) {
        return (
            <div style={{
                padding: '12px',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
            }}>
                <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--background-tertiary)',
                    animation: 'pulse 1.5s infinite',
                }} />
                {!collapsed && (
                    <div style={{ flex: 1 }}>
                        <div style={{ width: '80px', height: '12px', background: 'var(--background-tertiary)', borderRadius: '4px', marginBottom: '4px' }} />
                        <div style={{ width: '100px', height: '10px', background: 'var(--background-tertiary)', borderRadius: '4px' }} />
                    </div>
                )}
            </div>
        );
    }

    // Not signed in
    if (!isSignedIn || !user) {
        return (
            <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
                {!collapsed ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            Personalize your experience
                        </p>
                        <a
                            href="/sign-in"
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                width: '100%', padding: '8px',
                                background: 'var(--accent)', color: 'white',
                                borderRadius: '6px', textDecoration: 'none',
                                fontSize: '13px', fontWeight: 500,
                            }}
                        >
                            Sign In
                        </a>
                    </div>
                ) : (
                    <a
                        href="/sign-in"
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '36px', height: '36px',
                            background: 'var(--accent)', color: 'white',
                            borderRadius: '50%', textDecoration: 'none',
                        }}
                        title="Sign In"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                            <polyline points="10 17 15 12 10 7" />
                            <line x1="15" y1="12" x2="3" y2="12" />
                        </svg>
                    </a>
                )}
            </div>
        );
    }

    const displayEmail = user.primaryEmailAddress?.emailAddress || '';
    const clerkName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || null;
    const emailPrefix = displayEmail ? displayEmail.split('@')[0] : null;
    const displayName = customUsername || clerkName || emailPrefix || 'Anonymous';
    const avatarUrl = user.imageUrl;
    const initials = (customUsername?.[0] || user.firstName?.[0] || emailPrefix?.[0] || 'A').toUpperCase();
    const planLabel = PLAN_LABELS[sub.planType] ?? sub.planType;
    const isPaid = sub.planType !== 'LITE';

    return (
        <div style={{ position: 'relative' }}>
            {/* Popover */}
            {popoverOpen && (
                <div
                    ref={popoverRef}
                    style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: '8px',
                        right: '8px',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '14px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.08)',
                        overflow: 'hidden',
                        zIndex: 200,
                        animation: 'popoverIn 0.16s cubic-bezier(0.22,1,0.36,1)',
                    }}
                >
                    <style>{`
                        @keyframes popoverIn {
                            from { opacity: 0; transform: translateY(6px) scale(0.97); }
                            to   { opacity: 1; transform: translateY(0)   scale(1); }
                        }
                        .user-popover-item:hover { background: var(--background-secondary) !important; }
                    `}</style>

                    {/* User info header */}
                    <div style={{
                        padding: '14px 16px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                    }}>
                        {avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={avatarUrl}
                                alt={displayName}
                                style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            />
                        ) : (
                            <div style={{
                                width: '34px', height: '34px', borderRadius: '50%',
                                background: 'var(--accent-muted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'var(--accent)', fontWeight: 600, fontSize: '13px', flexShrink: 0,
                            }}>
                                {initials}
                            </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                            <div style={{
                                fontSize: '13px', fontWeight: 600, color: 'var(--text)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {displayName}
                            </div>
                            <div style={{
                                fontSize: '11px', color: 'var(--text-secondary)',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                                {displayEmail}
                            </div>
                        </div>
                        {/* Plan badge */}
                        <span style={{
                            marginLeft: 'auto',
                            fontSize: '10px', fontWeight: 600,
                            padding: '3px 8px', borderRadius: '99px',
                            background: isPaid ? 'var(--accent-muted)' : 'var(--background-secondary)',
                            color: isPaid ? 'var(--accent)' : 'var(--text-secondary)',
                            border: isPaid ? '1px solid var(--accent)' : '1px solid var(--border)',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                        }}>
                            {planLabel}
                        </span>
                    </div>

                    {/* Menu items */}
                    <div style={{ padding: '6px' }}>
                        <button
                            className="user-popover-item"
                            onClick={() => { setPopoverOpen(false); setModalOpen(true); }}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 12px', borderRadius: '8px',
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 500, color: 'var(--text)',
                                textAlign: 'left', transition: 'background 0.12s',
                            }}
                        >
                            <Settings size={15} strokeWidth={2} color="var(--text-secondary)" />
                            Settings
                        </button>

                        <button
                            className="user-popover-item"
                            onClick={() => { setPopoverOpen(false); router.push('/pricing'); }}
                            style={{
                                width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                                padding: '10px 12px', borderRadius: '8px',
                                background: isPaid ? 'transparent' : 'var(--accent-muted)',
                                border: 'none', cursor: 'pointer',
                                fontSize: '13px', fontWeight: 600,
                                color: isPaid ? 'var(--text)' : 'var(--accent)',
                                textAlign: 'left', transition: 'background 0.12s',
                            }}
                        >
                            <Zap size={15} strokeWidth={2} color={isPaid ? 'var(--text-secondary)' : 'var(--accent)'} />
                            {isPaid ? 'Manage plan' : 'Upgrade plan'}
                        </button>
                    </div>
                </div>
            )}

            {/* User Info Button */}
            <button
                ref={buttonRef}
                onClick={() => setPopoverOpen(v => !v)}
                style={{
                    width: '100%',
                    padding: '12px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: popoverOpen ? 'var(--background-secondary)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => { if (!popoverOpen) e.currentTarget.style.background = 'var(--background-secondary)'; }}
                onMouseLeave={(e) => { if (!popoverOpen) e.currentTarget.style.background = 'transparent'; }}
                title="Account menu"
            >
                {/* Avatar */}
                {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                    />
                ) : (
                    <div style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'var(--accent-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--accent)', fontWeight: 600, fontSize: '13px', flexShrink: 0,
                    }}>
                        {initials}
                    </div>
                )}

                {/* Name & Email */}
                {!collapsed && (
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{
                            fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {displayName}
                        </div>
                        <div style={{
                            fontSize: '11px', color: 'var(--text-tertiary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                            {displayEmail}
                        </div>
                    </div>
                )}

                {/* Chevron */}
                {!collapsed && (
                    <ChevronUp
                        size={14}
                        style={{
                            flexShrink: 0,
                            color: 'var(--text-secondary)',
                            transform: popoverOpen ? 'rotate(0deg)' : 'rotate(180deg)',
                            transition: 'transform 0.2s ease',
                        }}
                    />
                )}
            </button>

            {/* Account Settings Modal */}
            <AccountSettingsModal
                isOpen={modalOpen}
                onClose={handleModalClose}
            />
        </div>
    );
}
