// Sidebar component - Clean, minimal navigation

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore, useStoreActions } from '@/store/useStore';
import { Map as MapIcon } from 'lucide-react';
import { UserAccountSection } from './UserAccountSection';
import { useAuth } from '@clerk/nextjs';
import { AuthModal } from '@/components/modals/AuthModal';


// Hook to detect compact logo mode (use "A" icon instead of full logo)
function useCompactMode() {
    const [isCompact, setIsCompact] = useState(false);

    useEffect(() => {
        const checkWidth = () => {
            // Use compact "A" logo when viewport is <= 1200px but > 900px
            // At <= 900px, sidebar collapses to icons anyway
            setIsCompact(window.innerWidth <= 1200 && window.innerWidth > 900);
        };

        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    return isCompact;
}

// Hook to detect if sidebar should auto-collapse
function useAutoCollapse() {
    const [shouldCollapse, setShouldCollapse] = useState(false);

    useEffect(() => {
        const checkWidth = () => {
            // Disable auto-collapse. Mobile/Tablet will use Slide-Out Drawer (Expanded Content).
            // Width/Visibility is handled by CSS.
            setShouldCollapse(false);
        };

        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    return shouldCollapse;
}

interface SidebarProps {
    onFindNow: () => void;

    // New actions
    onScoreJobs: () => void;
    onImportJob: () => void;
    onFilter: () => void;

    // Loading states
    isLoading: boolean;
    isScoring: boolean;
    isFiltering: boolean;

    // Mobile responsive props
    isMobileOpen?: boolean;
    onCloseMobile?: () => void;
}

export function Sidebar({
    onFindNow,
    onScoreJobs,
    onImportJob,
    onFilter,
    isLoading,
    isScoring,
    isFiltering,
    isMobileOpen,
    onCloseMobile
}: SidebarProps) {
    const { sidebarOpen, toggleSidebar, setActiveModal, viewMode, setViewMode, resumes, defaultResume } = useStore();
    const { isSignedIn, isLoaded, userId } = useAuth();
    const router = useRouter();
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authMessage, setAuthMessage] = useState<string>('');
    const [resumeEditorWarning, setResumeEditorWarning] = useState<'no-resume' | 'no-default' | null>(null);
    const isCompactMode = useCompactMode();
    const shouldAutoCollapse = useAutoCollapse();

    // Effective collapsed state: user choice OR auto-collapse at 900px
    const isEffectivelyCollapsed = !sidebarOpen || shouldAutoCollapse;

    // Handle nav item click - close sidebar on mobile
    const handleNavClick = (action: () => void, requiresAuth: boolean = false, message?: string) => {
        if (requiresAuth && !isSignedIn) {
            setAuthMessage(message || "Sign in to access this feature.");
            setAuthModalOpen(true);
            return;
        }

        action();
        if (onCloseMobile) {
            onCloseMobile();
        }
    };

    const handleOpenResumeEditor = () => {
        if (!isSignedIn || !userId) {
            setAuthMessage('Sign in to use the Resume Editor.');
            setAuthModalOpen(true);
            return;
        }
        if (!defaultResume) {
            setResumeEditorWarning(resumes.length === 0 ? 'no-resume' : 'no-default');
            return;
        }
        if (onCloseMobile) onCloseMobile();
        router.push(`/resume-editor/base/${userId}`);
    };

    return (
        <>
            <AuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
            />

            {/* Yellow Warning Modal — no default resume */}
            {resumeEditorWarning && (
                <>
                    <div
                        style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.3)' }}
                        onClick={() => setResumeEditorWarning(null)}
                    />
                    <div style={{
                        position: 'fixed',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        zIndex: 9001,
                        background: '#fffbeb',
                        border: '1px solid #fcd34d',
                        borderRadius: 14,
                        padding: '24px 28px',
                        maxWidth: 380,
                        width: 'calc(100vw - 48px)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                                    <line x1="12" y1="9" x2="12" y2="13" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" />
                                </svg>
                                <span style={{ fontSize: 14, fontWeight: 700, color: '#92400e' }}>One quick thing</span>
                            </div>
                            <button
                                onClick={() => setResumeEditorWarning(null)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', lineHeight: 1 }}
                                aria-label="Dismiss"
                            >
                                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                        <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6, margin: '0 0 16px' }}>
                            {resumeEditorWarning === 'no-resume'
                                ? "You haven't uploaded a resume yet. Head to My Resumes to upload one first."
                                : "No default resume selected. Go to My Resumes and mark one as your default."}
                        </p>
                        <button
                            onClick={() => { setResumeEditorWarning(null); setActiveModal('resume-selector'); }}
                            style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#d97706', color: '#fff', border: 'none', cursor: 'pointer' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#b45309'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = '#d97706'; }}
                        >
                            Go to My Resumes
                        </button>
                    </div>
                </>
            )}

            {/* Mobile overlay backdrop */}
            <div
                className={`sidebar-overlay ${isMobileOpen ? 'visible' : ''}`}
                onClick={onCloseMobile}
            />

            <aside
                className={`sidebar ${isEffectivelyCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
            >
                {/* Logo/Brand */}
                <div
                    style={{
                        padding: (isCompactMode || isEffectivelyCollapsed) ? '16px 12px' : '24px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                        cursor: 'pointer',
                        textAlign: 'center',
                    }}
                    onClick={toggleSidebar}
                >
                    <div
                        style={{
                            width: isEffectivelyCollapsed ? '40px' : (isCompactMode ? '48px' : '135px'),
                            height: isEffectivelyCollapsed ? '40px' : (isCompactMode ? '48px' : '135px'),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.25s ease',
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={(isCompactMode || isEffectivelyCollapsed) ? '/aladdin-icon.png' : '/favicon.png'}
                            alt="Aladdin Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    {!isEffectivelyCollapsed && !isCompactMode && (
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '14px', fontFamily: 'var(--font-inter)' }}>
                            The Job Finder
                        </span>
                    )}
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
                    {/* Search/Filter */}
                    <NavItem
                        icon={<SearchIcon />}
                        label="Search"
                        onClick={() => handleNavClick(onFilter)}
                        loading={isFiltering}
                        collapsed={isEffectivelyCollapsed}
                        style={{ minHeight: '48px' }}
                    />

                    {/* Import Job (Protected) */}
                    <NavItem
                        icon={<img src="/icons/import-job.png" alt="Import" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
                        label="Import Job"
                        onClick={() => handleNavClick(() => useStore.getState().setActiveModal('import-job-selection'), true, "Sign in to import jobs.")}
                        collapsed={isEffectivelyCollapsed}
                        disabled={!isSignedIn}
                    />

                    {/* Resume Editor (Protected) */}
                    <NavItem
                        icon={<EditIcon />}
                        label="Resume Editor"
                        onClick={handleOpenResumeEditor}
                        collapsed={isEffectivelyCollapsed}
                        disabled={!isSignedIn}
                    />

                    <div style={{ height: '1px', background: 'var(--text-muted)', margin: '10px 8px', opacity: 0.5 }} />

                    {/* My Resumes (Protected) */}
                    <NavItem
                        icon={<ResumeIcon />}
                        label="My Resumes"
                        onClick={() => handleNavClick(() => setActiveModal('resume-selector'), true, "Sign in to manage resumes.")}
                        collapsed={isEffectivelyCollapsed}
                        disabled={!isSignedIn}
                    />

                    {/* Upload LinkedIn (Protected) */}
                    <NavItem
                        icon={<LinkedInIcon />}
                        label="Upload LinkedIn Profile"
                        onClick={() => handleNavClick(() => setActiveModal('linkedin-selector'), true, "Sign in to upload LinkedIn profile.")}
                        collapsed={isEffectivelyCollapsed}
                        disabled={!isSignedIn}
                    />
                </nav>

                {/* Footer - User Account */}
                <UserAccountSection collapsed={isEffectivelyCollapsed} />
            </aside>
        </>
    );
}

// Navigation Item Component
function NavItem({
    icon,
    label,
    onClick,
    active,
    loading,
    collapsed,
    style,
    disabled = false,
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
    loading?: boolean;
    collapsed?: boolean;
    style?: React.CSSProperties;
    disabled?: boolean;
}) {
    return (
        <button
            onClick={onClick}
            // Don't use disabled HTML attribute so we can catch clicks for modal
            // disabled={loading} 
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '8px' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'var(--accent-muted)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'wait' : 'pointer',
                color: disabled ? 'var(--text-tertiary)' : (active ? 'var(--accent)' : 'var(--text-secondary)'),
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.15s ease',
                width: '100%',
                textAlign: 'left',
                opacity: disabled ? 0.7 : 1,
                ...style,
            }}
            onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent';
            }}
            // Only show hover effect if not strictly disabled logic (visual feedback)
            onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.03)';
            }}
        >
            <div style={{ width: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, filter: disabled ? 'grayscale(100%) opacity(0.7)' : 'none' }}>
                {loading ? <LoadingSpinner /> : icon}
            </div>
            {!collapsed && label}
            {disabled && !collapsed && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 'auto', opacity: 0.5 }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            )}
        </button>
    );
}

// Icons
const SearchIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const StarIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
);

const BroomIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2a10 10 0 1 0 10 10" />
        <path d="M12 12l9 9" />
        <path d="M8 16l4 4" />
    </svg>
);

const UploadIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
);

const LinkedInIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
);

const MoonIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

const SunIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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



const ResumeIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
);

const EditIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const LoadingSpinner = () => (
    <span
        style={{
            width: '22px',
            height: '22px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block',
            animation: 'spin 1s linear infinite',
        }}
    />
);


