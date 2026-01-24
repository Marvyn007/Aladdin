// Sidebar component - Clean, minimal navigation

'use client';

import { useState, useRef } from 'react';
import { useStore } from '@/store/useStore';

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
    const { sidebarOpen, toggleSidebar, theme, toggleTheme, setActiveModal } = useStore();

    // Handle nav item click - close sidebar on mobile
    const handleNavClick = (action: () => void) => {
        action();
        if (onCloseMobile) {
            onCloseMobile();
        }
    };

    return (
        <>
            {/* Mobile overlay backdrop */}
            <div
                className={`sidebar-overlay ${isMobileOpen ? 'visible' : ''}`}
                onClick={onCloseMobile}
            />

            <aside
                className={`sidebar ${!sidebarOpen ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}
            >
                {/* Logo/Brand */}
                <div
                    style={{
                        padding: '24px 12px',
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
                            width: sidebarOpen ? '135px' : '40px',
                            height: sidebarOpen ? '135px' : '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src="/aladdin-logo.png"
                            alt="Aladdin Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    {sidebarOpen && (
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '14px', fontFamily: 'var(--font-inter)' }}>
                            The Job Finder
                        </span>
                    )}
                </div>

                {/* Navigation */}
                <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto' }}>
                    {/* Find Jobs */}
                    <NavItem
                        icon={<SearchIcon />}
                        label="Find Jobs"
                        onClick={() => handleNavClick(onFindNow)}
                        loading={isLoading}
                        active={false}
                        collapsed={!sidebarOpen}
                    />

                    {/* Import Job */}
                    <NavItem
                        icon={<img src="/icons/import-job.png" alt="Import" style={{ width: 22, height: 22, objectFit: 'contain' }} />}
                        label="Import Job"
                        onClick={() => handleNavClick(onImportJob)}
                        collapsed={!sidebarOpen}
                    />

                    {/* Score Jobs (New) */}
                    <NavItem
                        icon={<img src="/icons/score.png" alt="Score" style={{ width: 36, height: 36, objectFit: 'contain' }} />}
                        label="Score Jobs"
                        onClick={() => handleNavClick(onScoreJobs)}
                        loading={isScoring}
                        collapsed={!sidebarOpen}
                        style={{ minHeight: '48px' }}
                    />

                    {/* Filter (was Run Cleanup) */}
                    <NavItem
                        icon={<img src="/icons/broom.png" alt="Filter" style={{ width: 36, height: 36, objectFit: 'contain' }} />}
                        label="Filter"
                        onClick={() => handleNavClick(onFilter)}
                        loading={isFiltering}
                        collapsed={!sidebarOpen}
                        style={{ minHeight: '48px' }}
                    />

                    <div style={{ height: '1px', background: 'var(--text-muted)', margin: '10px 8px', opacity: 0.5 }} />

                    {/* My Resumes */}
                    <NavItem
                        icon={<ResumeIcon />}
                        label="My Resumes"
                        onClick={() => handleNavClick(() => setActiveModal('resume-selector'))}
                        collapsed={!sidebarOpen}
                    />

                    {/* Upload LinkedIn */}
                    <NavItem
                        icon={<LinkedInIcon />}
                        label="Upload LinkedIn Profile"
                        onClick={() => handleNavClick(() => setActiveModal('linkedin-selector'))}
                        collapsed={!sidebarOpen}
                    />

                    <div style={{ height: '1px', background: 'var(--text-muted)', margin: '10px 8px', opacity: 0.5 }} />

                    {/* Theme Toggle */}
                    <NavItem
                        icon={theme === 'light' ? <MoonIcon /> : <SunIcon />}
                        label={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                        onClick={() => handleNavClick(toggleTheme)}
                        collapsed={!sidebarOpen}
                    />
                </nav>

                {/* Footer - User Info */}
                <div
                    style={{
                        padding: '12px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        flexShrink: 0,
                    }}
                >
                    <div
                        style={{
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
                        }}
                    >
                        U
                    </div>
                    {sidebarOpen && (
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
                                User
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                Single-user mode
                            </div>
                        </div>
                    )}
                </div>
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
}: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active?: boolean;
    loading?: boolean;
    collapsed?: boolean;
    style?: React.CSSProperties;
}) {
    return (
        <button
            onClick={onClick}
            disabled={loading}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: collapsed ? '8px' : '8px 10px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                background: active ? 'var(--accent-muted)' : 'transparent',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                color: active ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: 500,
                transition: 'all 0.15s ease',
                width: '100%',
                textAlign: 'left',
                ...style,
            }}
            onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.background = 'transparent';
            }}
        >
            <div style={{ width: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
                {loading ? <LoadingSpinner /> : icon}
            </div>
            {!collapsed && label}
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
