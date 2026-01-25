/**
 * AccountSettingsModal - Full-featured account settings modal
 * 4 Tabs: Profile, My Documents, Appearance, Security
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { useStore } from '@/store/useStore';

type TabType = 'profile' | 'documents' | 'appearance' | 'security';

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AccountSettingsModal({ isOpen, onClose }: AccountSettingsModalProps) {
    const { user, isLoaded } = useUser();
    const { signOut } = useClerk();
    const { theme, toggleTheme } = useStore();
    const [activeTab, setActiveTab] = useState<TabType>('profile');
    const [isUpdating, setIsUpdating] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);

    // Profile form state
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [username, setUsername] = useState('');

    // Initialize form with user data
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || '');
            setLastName(user.lastName || '');
            setUsername(user.username || '');
        }
    }, [user]);

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

    if (!isOpen || !isLoaded || !user) return null;

    const handleUpdateProfile = async () => {
        if (!user) return;
        setIsUpdating(true);
        try {
            await user.update({
                firstName,
                lastName,
                username: username || undefined,
            });
        } catch (error) {
            console.error('Failed to update profile:', error);
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
        { id: 'documents', label: 'My Documents', icon: <DocumentsIcon /> },
        { id: 'appearance', label: 'Appearance', icon: <AppearanceIcon /> },
        { id: 'security', label: 'Security', icon: <SecurityIcon /> },
    ];

    return (
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
                    borderRadius: '16px',
                    width: '100%',
                    maxWidth: '700px',
                    height: '600px',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    border: '1px solid var(--border)',
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <h2 style={{
                        fontSize: '18px',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        margin: 0,
                    }}>
                        Account Settings
                    </h2>
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
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Tabs & Content */}
                <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                    {/* Tab Navigation */}
                    <div style={{
                        width: '200px',
                        borderRight: '1px solid var(--border)',
                        padding: '16px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        background: 'var(--background-secondary)',
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

                    {/* Tab Content */}
                    <div style={{
                        flex: 1,
                        padding: '24px',
                        overflowY: 'auto',
                    }}>
                        {activeTab === 'profile' && (
                            <ProfileTab
                                user={user}
                                firstName={firstName}
                                lastName={lastName}
                                username={username}
                                setFirstName={setFirstName}
                                setLastName={setLastName}
                                setUsername={setUsername}
                                handlePhotoUpload={handlePhotoUpload}
                                handleUpdateProfile={handleUpdateProfile}
                                isUpdating={isUpdating}
                            />
                        )}
                        {activeTab === 'documents' && <DocumentsTab />}
                        {activeTab === 'appearance' && (
                            <AppearanceTab theme={theme} toggleTheme={toggleTheme} />
                        )}
                        {activeTab === 'security' && <SecurityTab user={user} />}
                    </div>
                </div>
            </div>
        </div>
    );
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
    isUpdating,
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
    isUpdating: boolean;
}) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                Profile Information
            </h3>

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

            <div>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Username
                </label>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
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
function DocumentsTab() {
    const [resumes, setResumes] = useState<{ id: string; filename: string; createdAt: string }[]>([]);
    const [linkedins, setLinkedins] = useState<{ id: string; filename: string; createdAt: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Fetch documents
        async function fetchDocs() {
            try {
                // TODO: Implement API calls to fetch user's documents
                // For now, using empty arrays
                setResumes([]);
                setLinkedins([]);
            } catch (error) {
                console.error('Failed to fetch documents:', error);
            } finally {
                setLoading(false);
            }
        }
        fetchDocs();
    }, []);

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
                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{resume.filename}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{resume.createdAt}</span>
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
function AppearanceTab({ theme, toggleTheme }: { theme: string; toggleTheme: () => void }) {
    const isDark = theme === 'dark';

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

                    {/* Creative Toggle Switch */}
                    <button
                        onClick={toggleTheme}
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
                        {/* Stars (visible in dark mode) */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: isDark ? 1 : 0,
                            transition: 'opacity 0.4s ease',
                        }}>
                            <div style={{ position: 'absolute', top: '8px', left: '10px', width: '2px', height: '2px', background: 'white', borderRadius: '50%' }} />
                            <div style={{ position: 'absolute', top: '14px', left: '18px', width: '1px', height: '1px', background: 'white', borderRadius: '50%' }} />
                            <div style={{ position: 'absolute', top: '22px', left: '8px', width: '1px', height: '1px', background: 'white', borderRadius: '50%' }} />
                            <div style={{ position: 'absolute', top: '10px', left: '28px', width: '1px', height: '1px', background: 'white', borderRadius: '50%' }} />
                        </div>

                        {/* Clouds (visible in light mode) */}
                        <div style={{
                            position: 'absolute',
                            inset: 0,
                            opacity: isDark ? 0 : 1,
                            transition: 'opacity 0.4s ease',
                        }}>
                            <div style={{
                                position: 'absolute',
                                top: '20px',
                                left: '6px',
                                width: '12px',
                                height: '6px',
                                background: 'rgba(255,255,255,0.8)',
                                borderRadius: '6px',
                            }} />
                            <div style={{
                                position: 'absolute',
                                top: '14px',
                                left: '16px',
                                width: '10px',
                                height: '5px',
                                background: 'rgba(255,255,255,0.6)',
                                borderRadius: '5px',
                            }} />
                        </div>

                        {/* Sun/Moon Circle */}
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
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            {/* Moon craters (visible in dark mode) */}
                            {isDark && (
                                <>
                                    <div style={{
                                        position: 'absolute',
                                        top: '6px',
                                        right: '8px',
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        background: 'rgba(0,0,0,0.1)',
                                    }} />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '8px',
                                        left: '6px',
                                        width: '4px',
                                        height: '4px',
                                        borderRadius: '50%',
                                        background: 'rgba(0,0,0,0.1)',
                                    }} />
                                </>
                            )}
                        </div>
                    </button>
                </div>
            </div>

            {/* Theme Preview */}
            <div style={{
                background: 'var(--background-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border)',
                padding: '20px',
            }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                    Theme Preview
                </p>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: '8px',
                }}>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--background)', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>Primary</div>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--background-secondary)', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>Secondary</div>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--accent)', textAlign: 'center', fontSize: '11px', color: 'white' }}>Accent</div>
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--border)', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)' }}>Border</div>
                </div>
            </div>
        </div>
    );
}

// Security Tab Component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SecurityTab({ user }: { user: any }) {
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
