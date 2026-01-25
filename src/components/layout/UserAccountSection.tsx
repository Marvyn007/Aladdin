/**
 * UserAccountSection - Clerk-integrated user account UI for sidebar
 * Shows authenticated user avatar, name, and dropdown menu with settings modal
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { AccountSettingsModal } from './AccountSettingsModal';

export function UserAccountSection({ collapsed }: { collapsed?: boolean }) {
    const { user, isLoaded, isSignedIn } = useUser();
    const { signOut } = useClerk();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    // Not signed in - this shouldn't happen with middleware, but handle gracefully
    if (!isSignedIn || !user) {
        return null;
    }

    const displayName = user.firstName || user.username || 'User';
    const displayEmail = user.primaryEmailAddress?.emailAddress || '';
    const avatarUrl = user.imageUrl;
    const initials = (user.firstName?.[0] || user.username?.[0] || 'U').toUpperCase();

    return (
        <>
            <div ref={dropdownRef} style={{ position: 'relative' }}>
                {/* User Info Button */}
                <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    style={{
                        width: '100%',
                        padding: '12px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: dropdownOpen ? 'var(--background-secondary)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-secondary)'}
                    onMouseLeave={(e) => {
                        if (!dropdownOpen) e.currentTarget.style.background = 'transparent';
                    }}
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

                    {/* Dropdown Arrow */}
                    {!collapsed && (
                        <svg
                            width="12"
                            height="12"
                            viewBox="0 0 12 12"
                            fill="none"
                            style={{
                                transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.15s ease',
                                color: 'var(--text-tertiary)',
                            }}
                        >
                            <path
                                d="M2.5 4.5L6 8L9.5 4.5"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    )}
                </button>

                {/* Dropdown Menu - Now Opaque */}
                {dropdownOpen && (
                    <div style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '8px',
                        right: '8px',
                        marginBottom: '4px',
                        background: 'var(--background)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                        overflow: 'hidden',
                        zIndex: 100,
                    }}>
                        {/* Settings Option */}
                        <button
                            onClick={() => {
                                setDropdownOpen(false);
                                setModalOpen(true);
                            }}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'var(--background)',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-primary)',
                                fontSize: '13px',
                                transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--background)'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                            Settings
                        </button>

                        {/* Divider */}
                        <div style={{ height: '1px', background: 'var(--border)' }} />

                        {/* Sign Out Option */}
                        <button
                            onClick={() => {
                                setDropdownOpen(false);
                                signOut();
                            }}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                background: 'var(--background)',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-danger, #ef4444)',
                                fontSize: '13px',
                                transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--background-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--background)'}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Sign out
                        </button>
                    </div>
                )}
            </div>

            {/* Account Settings Modal */}
            <AccountSettingsModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
            />
        </>
    );
}
