/**
 * AccountSettingsModal - Full-featured account settings modal
 * 4 Tabs: Profile, My Documents, Appearance, Security
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useUser, useClerk } from '@clerk/nextjs';
import { useStore, useStoreActions } from '@/store/useStore';
import { THEMES } from '@/lib/themes';
import { ActivityGraph } from '@/components/profile/ActivityGraph';

type TabType = 'profile' | 'documents' | 'appearance' | 'security' | 'touch-grass';

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AccountSettingsModal({ isOpen, onClose }: AccountSettingsModalProps) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const { theme, toggleTheme, themeId } = useStore();
    const { saveThemeSettings, setThemeId } = useStoreActions();
    const [activeTab, setActiveTab] = useState<TabType>('profile');
    const [isUpdating, setIsUpdating] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Mobile responsive state
    const [isMobile, setIsMobile] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Check for mobile/tablet viewport
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 700);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Profile form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [customUsername, setCustomUsername] = useState('');
    const [usernameError, setUsernameError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Initialize form with user data
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
        }
    }, [user]);

    // Fetch custom username from our API
    useEffect(() => {
        if (isOpen && user) {
            fetch('/api/user/profile')
                .then(res => res.json())
                .then(data => {
                    setCustomUsername(data.username || '');
                })
                .catch(err => console.error('Failed to fetch username:', err));
        }
    }, [isOpen, user]);

    // Clear messages on input change
    useEffect(() => {
        setUsernameError(null);
        setSuccessMessage(null);
    }, [customUsername]);

    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    // Close when clicking outside
    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    };

    if (!isOpen || !isLoaded || !user || !mounted) return null;

    const handleUpdateProfile = async () => {
        if (!user) return;
        setIsUpdating(true);
        setUsernameError(null);
        setSuccessMessage(null);

        try {
            // Update Clerk profile (firstName, lastName)
            await user.update({
                firstName,
                lastName,
            });

            // Update custom username via our API
            if (customUsername !== undefined) {
                const res = await fetch('/api/user/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: customUsername })
                });

                const data = await res.json();

                if (!res.ok) {
                    setUsernameError(data.error || 'Failed to update username');
                    return;
                }

                setSuccessMessage('Profile updated successfully!');
                setTimeout(() => setSuccessMessage(null), 3000);
            }
        } catch (error) {
            console.error('Failed to update profile:', error);
            setUsernameError('Failed to update profile. Please try again.');
        } finally {
            setIsUpdating(false);
        }
    };

    const handleGenerateUsername = async () => {
        setIsUpdating(true);
        try {
            const res = await fetch('/api/user/init', { method: 'POST' });
            const data = await res.json();
            if (data.username) {
                setCustomUsername(data.username);
            }
        } catch (error) {
            console.error('Failed to generate username:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        setIsUpdating(true);
        try {
            await user.setProfileImage({ file });
        } catch (error) {
            console.error('Failed to upload photo:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'profile', label: 'Profile', icon: <ProfileIcon /> },
        { id: 'touch-grass', label: 'Touch the grass', icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.5-3.3.3-1.09.88-2.16 1.7-3.2.3 2.5.8 4 1.3 5.2z"></path></svg> },
        { id: 'documents', label: 'My Documents', icon: <DocumentsIcon /> },
        { id: 'appearance', label: 'Appearance', icon: <AppearanceIcon /> },
        { id: 'security', label: 'Security', icon: <SecurityIcon /> },
    ];

    return createPortal(
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '20px',
            }}
        >
            <div
                ref={modalRef}
                style={{
                    background: 'var(--background)',
                    borderRadius: isMobile ? '0' : '16px',
                    width: isMobile ? '100%' : '100%',
                    maxWidth: isMobile ? '100%' : '700px',
                    height: isMobile ? '100%' : 'min(600px, 90vh)',
                    maxHeight: isMobile ? '100%' : '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: isMobile ? 'none' : '1px solid var(--border)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: isMobile ? '16px' : '20px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                }}>
                    {/* Left side: Hamburger (mobile) + Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {isMobile && (
                            <button
                                onClick={() => setIsDrawerOpen(true)}
                                style={{
                                    width: '36px',
                                    height: '36px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'var(--background-secondary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                }}
                                aria-label="Open navigation"
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                        )}
                        <h2 style={{
                            fontSize: isMobile ? '16px' : '18px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            margin: 0,
                        }}>
                            Account Settings
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--background-secondary)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.15s ease',
                            flexShrink: 0,
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Mobile Drawer Overlay */}
                {isMobile && isDrawerOpen && (
                    <div
                        onClick={() => setIsDrawerOpen(false)}
                        style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(0, 0, 0, 0.4)',
                            zIndex: 50,
                        }}
                    />
                )}

                {/* Mobile Drawer */}
                {isMobile && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bottom: 0,
                            width: '260px',
                            background: 'var(--background)',
                            borderRight: '1px solid var(--border)',
                            transform: isDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
                            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                            zIndex: 60,
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: isDrawerOpen ? '4px 0 20px rgba(0,0,0,0.15)' : 'none',
                        }}
                    >
                        {/* Drawer Header */}
                        <div style={{
                            padding: '16px',
                            borderBottom: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Navigation</span>
                            <button
                                onClick={() => setIsDrawerOpen(false)}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'transparent',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'var(--text-secondary)',
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        {/* Drawer Nav Items */}
                        <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        setActiveTab(tab.id);
                                        setIsDrawerOpen(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '12px 14px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: activeTab === tab.id ? 'var(--accent-muted)' : 'transparent',
                                        color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 500,
                                        transition: 'all 0.15s ease',
                                        textAlign: 'left',
                                        width: '100%',
                                    }}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Drawer Sign Out */}
                        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
                            <button
                                onClick={() => signOut()}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 14px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: 'transparent',
                                    color: 'var(--text-danger, #ef4444)',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    width: '100%',
                                    textAlign: 'left',
                                }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                Sign out
                            </button>
                        </div>
                    </div>
                )
                }

                {/* Tabs & Content */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
                    {/* Tab Navigation - Desktop Only */}
                    {!isMobile && (
                        <div style={{
                            width: '200px',
                            borderRight: '1px solid var(--border)',
                            padding: '16px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            background: 'var(--background-secondary)',
                            flexShrink: 0,
                        }}>
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: activeTab === tab.id ? 'var(--accent-muted)' : 'transparent',
                                        color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        transition: 'all 0.15s ease',
                                        textAlign: 'left',
                                    }}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}

                            {/* Sign Out at bottom */}
                            <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                                <button
                                    onClick={() => signOut()}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        padding: '10px 12px',
                                        border: 'none',
                                        borderRadius: '8px',
                                        background: 'transparent',
                                        color: 'var(--text-danger, #ef4444)',
                                        cursor: 'pointer',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        width: '100%',
                                        textAlign: 'left',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                                        <polyline points="16 17 21 12 16 7" />
                                        <line x1="21" y1="12" x2="9" y2="12" />
                                    </svg>
                                    Sign out
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Tab Content */}
                    <div style={{
                        flex: 1,
                        padding: isMobile ? '16px' : '24px',
                        overflowY: 'auto',
                        overflowX: 'hidden',
                    }}>
                        {activeTab === 'profile' && (
                            <ProfileTab
                                user={user}
                                firstName={firstName}
                                lastName={lastName}
                                username={customUsername}
                                setFirstName={setFirstName}
                                setLastName={setLastName}
                                setUsername={setCustomUsername}
                                handlePhotoUpload={handlePhotoUpload}
                                handleUpdateProfile={handleUpdateProfile}
                                handleGenerateUsername={handleGenerateUsername}
                                isUpdating={isUpdating}
                                usernameError={usernameError}
                                successMessage={successMessage}
                                isMobile={isMobile}
                            />
                        )}
                        {activeTab === 'touch-grass' && <TouchGrassTab />}
                        {activeTab === 'documents' && <DocumentsTab isMobile={isMobile} />}
                        {activeTab === 'appearance' && (
                            <AppearanceTab
                                theme={theme}
                                toggleTheme={toggleTheme}
                                currentThemeId={themeId}
                                onSetTheme={setThemeId}
                                onSave={saveThemeSettings}
                                isMobile={isMobile}
                            />
                        )}
                        {activeTab === 'security' && <SecurityTab user={user} isMobile={isMobile} />}
                    </div>
                </div >
            </div >
        </div >
        , document.body);
}

// Profile Tab Component
function ProfileTab({
    user,
    firstName,
    lastName,
    username,
    setFirstName,
    setLastName,
    setUsername,
    handlePhotoUpload,
    handleUpdateProfile,
    handleGenerateUsername,
    isUpdating,
    usernameError,
    successMessage,
    isMobile,
}: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    user: any;
    firstName: string;
    lastName: string;
    username: string;
    setFirstName: (v: string) => void;
    setLastName: (v: string) => void;
    setUsername: (v: string) => void;
    handlePhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleUpdateProfile: () => void;
    handleGenerateUsername: () => void;
    isUpdating: boolean;
    usernameError: string | null;
    successMessage: string | null;
    isMobile?: boolean;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [savedUsername, setSavedUsername] = useState(username);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSavingUsername, setIsSavingUsername] = useState(false);
    const [localUsernameError, setLocalUsernameError] = useState<string | null>(null);
    const [usernameSaved, setUsernameSaved] = useState(true);
    const [reputation, setReputation] = useState<number>(0);
    const [loadingReputation, setLoadingReputation] = useState(true);

    // Track if username has unsaved changes
    const hasUnsavedUsername = username !== savedUsername;

    // Fetch user's reputation from database
    const refreshReputation = () => {
        if (!user?.id) return;
        setLoadingReputation(true);
        fetch(`/api/vote-job?userId=${user.id}`)
            .then(res => res.json())
            .then(data => {
                if (typeof data.votes === 'number') {
                    setReputation(data.votes);
                }
            })
            .catch(err => console.error('Failed to fetch reputation:', err))
            .finally(() => setLoadingReputation(false));
    };

    useEffect(() => {
        refreshReputation();
    }, [user?.id]);

    // Update savedUsername when it changes externally
    useEffect(() => {
        setSavedUsername(username);
        setUsernameSaved(true);
    }, []); // Only on mount

    // Client-side validation
    const validateLocally = (value: string): string | null => {
        if (!value || value.trim().length === 0) return null; // Empty is valid
        const trimmed = value.trim();
        if (trimmed.length < 10) return 'Username must be at least 10 characters.';
        if (trimmed.length > 30) return 'Username must be 30 characters or less.';
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            return 'Username can only contain letters, numbers, hyphens, and underscores (no spaces).';
        }
        if (/^[-_]/.test(trimmed) || /[-_]$/.test(trimmed)) {
            return 'Username cannot start or end with a hyphen or underscore.';
        }
        // Check reserved words
        const lower = trimmed.toLowerCase();
        const reserved = ['user', 'admin', 'root', 'system', 'guest', 'anonymous', 'null', 'undefined', 'test', 'demo', 'default', 'unknown', 'moderator', 'staff', 'support', 'official', 'verified', 'legacy', 'deleted', 'banned'];
        if (reserved.some(word => lower === word || lower.includes(word))) {
            return 'This username contains a reserved word.';
        }
        return null;
    };

    const handleUsernameChange = (value: string) => {
        setUsername(value);
        setUsernameSaved(false);
        const error = validateLocally(value);
        setLocalUsernameError(error);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        setLocalUsernameError(null);
        try {
            const res = await fetch('/api/user/username/generate', { method: 'POST' });
            const data = await res.json();
            if (data.success && data.username) {
                setUsername(data.username);
                setUsernameSaved(false);
                setLocalUsernameError(null);
            }
        } catch (error) {
            console.error('Failed to generate username:', error);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSaveUsername = async () => {
        if (localUsernameError) return;

        setIsSavingUsername(true);
        setLocalUsernameError(null);

        try {
            const res = await fetch('/api/user/username', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim() || null })
            });

            const data = await res.json();

            if (!res.ok) {
                setLocalUsernameError(data.error || 'Failed to save username');
                return;
            }

            setSavedUsername(data.username || '');
            setUsernameSaved(true);
            // Optionally show success toast (using successMessage state would require lifting this)
        } catch (error) {
            console.error('Failed to save username:', error);
            setLocalUsernameError('Failed to save username. Please try again.');
        } finally {
            setIsSavingUsername(false);
        }
    };

    const displayError = localUsernameError || usernameError;
    const canSaveUsername = !localUsernameError && hasUnsavedUsername && !isSavingUsername;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Profile Information
            </h3>

            {/* Reputation Section */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between', // Changed to space-between to accommodate button
                padding: '16px',
                background: 'var(--background-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: reputation >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: `2px solid ${reputation >= 0 ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    }}>
                        <span style={{
                            fontSize: '20px',
                            fontWeight: 700,
                            color: reputation >= 0 ? '#22c55e' : '#ef4444',
                        }}>
                            {loadingReputation ? '...' : (reputation >= 0 ? `+${reputation}` : reputation)}
                        </span>
                    </div>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                            Your Reputation
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                            Based on votes from jobs you&apos;ve posted
                        </p>
                    </div>
                </div>

                <button
                    onClick={refreshReputation}
                    disabled={loadingReputation}
                    style={{
                        padding: '8px',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        cursor: loadingReputation ? 'default' : 'pointer',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: loadingReputation ? 0.7 : 1,
                        transition: 'all 0.2s ease'
                    }}
                    title="Refresh Reputation"
                >
                    <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                            animation: loadingReputation ? 'spin 1s linear infinite' : 'none'
                        }}
                    >
                        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                        <path d="M3 21v-5h5" />
                    </svg>
                </button>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.3)',
                    color: '#22c55e',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {successMessage}
                </div>
            )}

            {/* Photo Upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={user.imageUrl}
                        alt="Profile"
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '3px solid var(--border)',
                        }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            position: 'absolute',
                            bottom: 0,
                            right: 0,
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: 'var(--accent)',
                            border: '2px solid var(--background)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                        </svg>
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        style={{ display: 'none' }}
                    />
                </div>
                <div>
                    <p style={{ fontSize: '14px', color: 'var(--text-primary)', margin: 0 }}>Profile Photo</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                        Click the camera icon to upload
                    </p>
                </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        First Name
                    </label>
                    <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--background-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none',
                        }}
                    />
                </div>
                <div>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        Last Name
                    </label>
                    <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--background-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none',
                        }}
                    />
                </div>
            </div>

            {/* Username Field with Generate and Save Buttons */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                        Username
                    </label>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <input
                        type="text"
                        value={username}
                        onChange={(e) => handleUsernameChange(e.target.value)}
                        placeholder="Leave empty to use your name"
                        style={{
                            flex: 1,
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${displayError ? '#ef4444' : 'var(--border)'}`,
                            background: 'var(--background-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none',
                        }}
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        aria-label="Generate a new quirky username"
                        style={{
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--accent)',
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: 500,
                            cursor: isGenerating ? 'not-allowed' : 'pointer',
                            opacity: isGenerating ? 0.7 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M23 4v6h-6" />
                            <path d="M1 20v-6h6" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        {isGenerating ? 'Generating...' : 'Generate'}
                    </button>
                </div>



                {/* Error Message */}
                {displayError && (
                    <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        {displayError}
                    </p>
                )}



                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '6px' }}>
                    Must be at least 10 characters. Letters, numbers, hyphens, and underscores only.
                </p>
            </div>

            <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Email
                </label>
                <input
                    type="email"
                    value={user.primaryEmailAddress?.emailAddress || ''}
                    disabled
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border)',
                        background: 'var(--background-tertiary)',
                        color: 'var(--text-tertiary)',
                        fontSize: '14px',
                        outline: 'none',
                    }}
                />
                <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                    Email cannot be changed here
                </p>
            </div>

            <button
                onClick={handleUpdateProfile}
                disabled={isUpdating}
                style={{
                    padding: '12px 24px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent)',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: isUpdating ? 'not-allowed' : 'pointer',
                    opacity: isUpdating ? 0.7 : 1,
                    alignSelf: 'flex-start',
                    transition: 'all 0.15s ease',
                }}
            >
                {isUpdating ? 'Saving...' : 'Save Changes'}
            </button>
        </div>
    );
}

// Documents Tab Component
function DocumentsTab({ isMobile }: { isMobile?: boolean }) {
    const [resumes, setResumes] = useState<{ id: string; filename: string; createdAt: string }[]>([]);
    const [linkedins, setLinkedins] = useState<{ id: string; filename: string; createdAt: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchDocs();
    }, []);

    async function fetchDocs() {
        setLoading(true);
        try {
            const [resumesRes, linkedinRes] = await Promise.all([
                fetch('/api/upload-resume'),
                fetch('/api/upload-linkedin')
            ]);

            const resumesData = await resumesRes.json();
            const linkedinData = await linkedinRes.json();

            setResumes(resumesData.resumes || []);
            setLinkedins(linkedinData.profiles || []);
        } catch (error) {
            console.error('Failed to fetch documents:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleDeleteResume = async (id: string) => {
        if (!confirm('Are you sure you want to delete this resume?')) return;
        try {
            const res = await fetch(`/api/upload-resume?id=${id}`, { method: 'DELETE' });
            if (res.ok) fetchDocs();
        } catch (e) {
            console.error(e);
        }
    };

    // For now assuming LinkedIn delete endpoint follows pattern or is missing.
    // If missing, we skip delete for LinkedIn or try standard pattern.
    // Actually upload-linkedin doesn't seem to have DELETE implemented in the file I read.
    // I will check if I need to implement it.
    // Current requirement focuses on Resumes.

    const handlePreviewResume = (id: string) => {
        window.open(`/api/resumes/${id}/preview`, '_blank');
    };

    const handleDownloadResume = (id: string) => {
        window.open(`/api/resumes/${id}/download`, '_blank');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                My Documents
            </h3>

            {/* Resumes Section */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
                        📄 Resumes
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {resumes.length} saved
                    </span>
                </div>
                <div style={{
                    background: 'var(--background-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    padding: loading ? '24px' : resumes.length ? '8px' : '24px',
                }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', margin: 0 }}>Loading...</p>
                    ) : resumes.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', margin: 0, fontSize: '13px' }}>
                            No saved resumes yet. Generate and save resumes from the main app.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {resumes.map((resume) => (
                                <div
                                    key={resume.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        background: 'var(--background)',
                                    }}
                                >
                                    <div>
                                        <span style={{ fontSize: '13px', color: 'var(--text-primary)', display: 'block' }}>{resume.filename}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{new Date(resume.createdAt || (resume as any).upload_at).toLocaleDateString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button
                                            onClick={() => handlePreviewResume(resume.id)}
                                            style={{
                                                border: 'none', background: 'var(--surface)', cursor: 'pointer', color: 'var(--text-secondary)',
                                                width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title="Preview"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDownloadResume(resume.id)}
                                            style={{
                                                border: 'none', background: 'var(--surface)', cursor: 'pointer', color: 'var(--accent)',
                                                width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title="Download"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                <polyline points="7 10 12 15 17 10" />
                                                <line x1="12" y1="15" x2="12" y2="3" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteResume(resume.id)}
                                            style={{
                                                border: 'none', background: 'var(--surface)', cursor: 'pointer', color: 'var(--error)',
                                                width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                            }}
                                            title="Delete"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* LinkedIn Section */}
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <h4 style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>
                        💼 LinkedIn Profiles
                    </h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                        {linkedins.length} saved
                    </span>
                </div>
                <div style={{
                    background: 'var(--background-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border)',
                    padding: loading ? '24px' : linkedins.length ? '8px' : '24px',
                }}>
                    {loading ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', margin: 0 }}>Loading...</p>
                    ) : linkedins.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-tertiary)', margin: 0, fontSize: '13px' }}>
                            No LinkedIn profiles uploaded yet.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {linkedins.map((linkedin) => (
                                <div
                                    key={linkedin.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        background: 'var(--background)',
                                    }}
                                >
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{linkedin.filename}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{linkedin.createdAt}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// Appearance Tab Component
// Appearance Tab Component
interface AppearanceTabProps {
    theme: 'light' | 'dark'; // Corrected type
    toggleTheme: () => void;
    currentThemeId: string;
    onSetTheme: (id: string) => void;
    onSave: (mode: 'light' | 'dark', themeId: string) => Promise<void>;
    isMobile?: boolean;
}

function AppearanceTab({ theme, toggleTheme, currentThemeId, onSetTheme, onSave, isMobile }: AppearanceTabProps) {
    const isDark = theme === 'dark';
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    // Auto-save when theme mode is toggled
    const handleToggleTheme = async () => {
        console.log('[DEBUG] handleToggleTheme clicked. Current:', theme);
        const newMode = theme === 'light' ? 'dark' : 'light';
        toggleTheme(); // Update local state immediately
        setIsSaving(true);
        setMessage(null);
        try {
            console.log('[DEBUG] Calling onSave with:', { newMode, currentThemeId });
            await onSave(newMode, currentThemeId);
            setMessage('Saved!');
            setTimeout(() => setMessage(null), 2000);
        } catch (error) {
            console.error('[DEBUG] handleToggleTheme save failed', error);
            setMessage('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    // Auto-save when color palette is changed
    const handleSetTheme = async (id: string) => {
        console.log('[DEBUG] handleSetTheme clicked:', id);
        if (id === currentThemeId) return; // No change
        onSetTheme(id); // Update local state immediately
        setIsSaving(true);
        setMessage(null);
        try {
            console.log('[DEBUG] Calling onSave with:', { theme, id });
            await onSave(theme, id);
            setMessage('Saved!');
            setTimeout(() => setMessage(null), 2000);
        } catch (error) {
            console.error('[DEBUG] handleSetTheme save failed', error);
            setMessage('Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Appearance
            </h3>

            {/* Theme Toggle */}
            <div style={{
                background: 'var(--background-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '20px',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
                            Dark Mode
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: '4px 0 0' }}>
                            {isDark ? 'Dark theme is active' : 'Light theme is active'}
                        </p>
                    </div>

                    <button
                        onClick={handleToggleTheme}
                        disabled={isSaving}
                        style={{
                            position: 'relative',
                            width: '72px',
                            height: '36px',
                            borderRadius: '18px',
                            border: 'none',
                            background: isDark
                                ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
                                : 'linear-gradient(135deg, #87ceeb 0%, #98d8e8 50%, #b5e7f9 100%)',
                            cursor: 'pointer',
                            padding: 0,
                            overflow: 'hidden',
                            transition: 'all 0.4s ease',
                            boxShadow: isDark
                                ? 'inset 0 2px 4px rgba(0,0,0,0.3)'
                                : 'inset 0 2px 4px rgba(0,0,0,0.1)',
                        }}
                    >
                        {/* Sun/Moon Circle Logic remains same */}
                        <div style={{
                            position: 'absolute',
                            top: '4px',
                            left: isDark ? '40px' : '4px',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: isDark
                                ? 'linear-gradient(135deg, #f5f5dc 0%, #fffacd 100%)'
                                : 'linear-gradient(135deg, #ffd700 0%, #ffb347 100%)',
                            boxShadow: isDark
                                ? '0 0 10px rgba(255, 250, 205, 0.5)'
                                : '0 0 15px rgba(255, 215, 0, 0.6)',
                            transition: 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)',
                        }} />
                    </button>
                </div>
            </div>

            {/* Theme Presets */}
            <div>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                    Theme
                </p>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: '12px',
                }}>
                    {THEMES.map((t) => {
                        const palette = isDark ? t.colors.dark : t.colors.light;
                        const isSelected = currentThemeId === t.id;

                        return (
                            <button
                                key={t.id}
                                onClick={() => handleSetTheme(t.id)}
                                disabled={isSaving}
                                style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'flex-start',
                                    gap: '8px',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    background: isSelected ? 'var(--accent-muted)' : 'var(--background-secondary)',
                                    border: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    textAlign: 'left',
                                    position: 'relative',
                                }}
                            >
                                {/* Color Swatches */}
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: palette.background,
                                        border: '1px solid rgba(0,0,0,0.1)',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                    }} />
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: palette.accent,
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                    }} />
                                </div>

                                <div>
                                    <span style={{
                                        display: 'block',
                                        fontSize: '13px',
                                        fontWeight: 600,
                                        color: isSelected ? 'var(--accent)' : 'var(--text-primary)'
                                    }}>
                                        {t.name}
                                    </span>
                                    <span style={{
                                        display: 'block',
                                        fontSize: '11px',
                                        color: 'var(--text-tertiary)',
                                        opacity: 0.8
                                    }}>
                                        {t.description.split(' ')[0]} {/* Simple short desc */}
                                    </span>
                                </div>

                                {isSelected && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '10px',
                                        right: '10px',
                                        color: 'var(--accent)',
                                    }}>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
                {currentThemeId !== 'aladdin' && (
                    <button
                        onClick={() => handleSetTheme('aladdin')}
                        disabled={isSaving}
                        style={{
                            marginTop: '16px',
                            fontSize: '12px',
                            color: 'var(--text-tertiary)',
                            background: 'transparent',
                            border: 'none',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                        }}
                    >
                        Reset to Default
                    </button>
                )}
            </div>

            {/* Auto-Save Status Indicator */}
            <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
                {isSaving && (
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                            <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                        </svg>
                        Saving...
                    </span>
                )}
                {message && !isSaving && (
                    <span style={{ fontSize: '13px', color: message.includes('Saved') ? 'var(--accent)' : 'var(--error)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {message.includes('Saved') && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        )}
                        {message}
                    </span>
                )}
            </div>
        </div >
    );
}

// Security Tab Component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecurityTab({ user, isMobile }: { user: any; isMobile?: boolean }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Security
            </h3>

            {/* Connected Accounts */}
            <div style={{
                background: 'var(--background-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '20px',
            }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                    Connected Accounts
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {user.externalAccounts?.map((account: { provider: string; id: string }) => (
                        <div
                            key={account.id}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px',
                                borderRadius: '8px',
                                background: 'var(--background)',
                            }}
                        >
                            {account.provider === 'google' && <GoogleIcon />}
                            {account.provider === 'github' && <GithubIcon />}
                            <span style={{ fontSize: '13px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                {account.provider}
                            </span>
                            <span style={{
                                marginLeft: 'auto',
                                fontSize: '11px',
                                color: 'var(--accent)',
                                background: 'var(--accent-muted)',
                                padding: '2px 8px',
                                borderRadius: '4px',
                            }}>
                                Connected
                            </span>
                        </div>
                    ))}
                    {(!user.externalAccounts || user.externalAccounts.length === 0) && (
                        <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '12px' }}>
                            No external accounts connected
                        </p>
                    )}
                </div>
            </div>

            {/* Account ID */}
            <div style={{
                background: 'var(--background-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '20px',
            }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                    Account ID
                </p>
                <code style={{
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    background: 'var(--background-tertiary)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    display: 'block',
                    wordBreak: 'break-all',
                }}>
                    {user.id}
                </code>
            </div>

            {/* Last Sign In */}
            <div style={{
                background: 'var(--background-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '20px',
            }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px' }}>
                    Last Sign In
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: 0 }}>
                    {user.lastSignInAt ? new Date(user.lastSignInAt).toLocaleString() : 'Unknown'}
                </p>
            </div>
        </div>
    );
}

// Icons
function ProfileIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </svg>
    );
}

function DocumentsIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
    );
}

function AppearanceIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
    );
}

function SecurityIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

function GithubIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
    );
}

function TouchGrassTab() {
    const [activityData, setActivityData] = useState<{ activity: Record<string, number>, streak: number } | null>(null);

    useEffect(() => {
        const fetchActivity = async () => {
            try {
                const res = await fetch('/api/user/activity');
                if (res.ok) {
                    const data = await res.json();
                    setActivityData(data);
                }
            } catch (e) {
                console.error("Failed to fetch activity", e);
            }
        };
        fetchActivity();
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {activityData ? (
                <ActivityGraph activity={activityData.activity} streak={activityData.streak} />
            ) : (
                <div style={{ height: '300px', background: 'var(--surface)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                    Loading your grass...
                </div>
            )}
        </div>
    );
}
