/**
 * UserAccountSection - Clerk-integrated user account UI for sidebar
 * Shows authenticated user avatar, name, and dropdown menu with settings modal
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { AccountSettingsModal } from './AccountSettingsModal';

export function UserAccountSection({ collapsed }: { collapsed?: boolean }) {
    const { user, isLoaded, isSignedIn } = useUser();
    const [modalOpen, setModalOpen] = useState(false);
    const [customUsername, setCustomUsername] = useState<string | null>(null);
    const [usernameLoaded, setUsernameLoaded] = useState(false);

    // Fetch or initialize custom username
    const fetchUsername = useCallback(async () => {
        if (!isSignedIn || !user) return;

        try {
            // First try to get existing profile
            const profileRes = await fetch('/api/user/profile');
            const profile = await profileRes.json();

            // If user exists in DB (even with null username), use it
            if (profile.exists) {
                setCustomUsername(profile.username);
            } else {
                // Only initialize/auto-generate for NEW users who don't exist in DB yet
                const initRes = await fetch('/api/user/init', { method: 'POST' });
                const initData = await initRes.json();
                if (initData.username) {
                    setCustomUsername(initData.username);
                }
            }
        } catch (error) {
            console.error('Failed to fetch username:', error);
        } finally {
            setUsernameLoaded(true);
        }
    }, [isSignedIn, user]);

    useEffect(() => {
        if (isSignedIn && user && !usernameLoaded) {
            fetchUsername();
        }
    }, [isSignedIn, user, usernameLoaded, fetchUsername]);

    // Refresh username when modal closes (in case it was updated)
    const handleModalClose = () => {
        setModalOpen(false);
        // Refetch username in case it was changed
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
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'var(--background-tertiary)',
                    animation: 'pulse 1.5s infinite',
                }} />
                {!collapsed && (
                    <div style={{ flex: 1 }}>
                        <div style={{
                            width: '80px',
                            height: '12px',
                            background: 'var(--background-tertiary)',
                            borderRadius: '4px',
                            marginBottom: '4px',
                        }} />
                        <div style={{
                            width: '100px',
                            height: '10px',
                            background: 'var(--background-tertiary)',
                            borderRadius: '4px',
                        }} />
                    </div>
                )}
            </div>
        );
    }

    // Not signed in - Show sign in prompt
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
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                padding: '8px',
                                background: 'var(--accent)',
                                color: 'white',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontSize: '13px',
                                fontWeight: 500,
                            }}
                        >
                            Sign In
                        </a>
                    </div>
                ) : (
                    <a
                        href="/sign-in"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '36px',
                            height: '36px',
                            background: 'var(--accent)',
                            color: 'white',
                            borderRadius: '50%',
                            textDecoration: 'none',
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

    // Display priority: customUsername > firstName + lastName > firstName > email prefix
    // NEVER show 'User' as a placeholder
    const displayEmail = user.primaryEmailAddress?.emailAddress || '';
    const clerkName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || null;
    const emailPrefix = displayEmail ? displayEmail.split('@')[0] : null;

    const displayName = customUsername
        || clerkName
        || emailPrefix
        || 'Anonymous'; // Last resort, but should never hit due to auto-generation
    const avatarUrl = user.imageUrl;
    const initials = (customUsername?.[0] || user.firstName?.[0] || emailPrefix?.[0] || 'A').toUpperCase();

    return (
        <>
            {/* User Info Button */}
            <button
                onClick={() => setModalOpen(true)}
                style={{
                    width: '100%',
                    padding: '12px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-secondary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                title="Account Settings"
            >
                {/* Avatar */}
                {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            flexShrink: 0,
                        }}
                    />
                ) : (
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        background: 'var(--accent-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        fontSize: '13px',
                        flexShrink: 0,
                    }}>
                        {initials}
                    </div>
                )}

                {/* Name & Email */}
                {!collapsed && (
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                        <div style={{
                            fontSize: '13px',
                            fontWeight: 500,
                            color: 'var(--text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {displayName}
                        </div>
                        <div style={{
                            fontSize: '11px',
                            color: 'var(--text-tertiary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                        }}>
                            {displayEmail}
                        </div>
                    </div>
                )}
            </button>


            {/* Account Settings Modal */}
            <AccountSettingsModal
                isOpen={modalOpen}
                onClose={handleModalClose}
            />
        </>
    );
}
