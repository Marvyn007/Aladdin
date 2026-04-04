'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { InterviewExperienceModal } from '@/components/modals/InterviewExperienceModal';
import { CompanyLogo } from '@/components/shared/CompanyLogo';

const LOGO_DEV_TOKEN = 'pk_By0CIs75Tsy8K9CqV4sT7w';

function getLogoUrl(company: { name: string; logoUrl?: string | null; domain?: string | null }): string {
    if (company.logoUrl) return company.logoUrl;
    return '/default company icon.png';
}

const formatCompanyName = (name: string) => {
    if (!name) return "";
    return name
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

interface CompanyStats {
    name: string;
    logoUrl: string | null;
    reviewCount: number;
    avgSalaryHourly: number | null;
}

interface PaginationData {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export function InterviewExperiencesView() {
    const [companies, setCompanies] = useState<CompanyStats[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('most_reviews');
    const [isLoading, setIsLoading] = useState(true);
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchCompanies(1);
    }, [searchQuery, sortBy]);

    const fetchCompanies = async (page: number) => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...(searchQuery ? { q: searchQuery } : {}),
                sort_by: sortBy
            });
            const res = await fetch(`/api/interview-experiences?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setCompanies(data.companies);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Failed to fetch companies:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= pagination.totalPages) {
            fetchCompanies(newPage);
            // Scroll to top of content area
            const contentArea = document.querySelector('.content-area');
            if (contentArea) contentArea.scrollTop = 0;
        }
    };

    return (
        <div className="content-area" style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--background)', overflowY: 'auto' }}>

            {/* Header Area */}
            <div style={{ padding: '24px 8vw 32px 8vw', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
                <div>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '8px' }}>
                        Interview Experiences
                    </h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
                        Read structured feedback, timelines, and salaries to prepare for your next interview.
                    </p>
                </div>

                <button
                    onClick={() => setIsModalOpen(true)}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        background: 'var(--accent)',
                        color: 'var(--accent-foreground)',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '14px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'opacity 0.2s ease',
                        boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.2)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                    <Plus size={18} />
                    Add Interview Experience
                </button>
            </div>

            {/* Search & Tool Bar */}
            <div style={{
                padding: '0 8vw 32px 8vw',
                display: 'flex',
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: '24px',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <div style={{ position: 'relative', flex: 1, minWidth: '300px', maxWidth: '500px' }}>
                    <Search
                        size={18}
                        style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                    />
                    <input
                        type="text"
                        placeholder="Search companies, roles, or locations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 16px 12px 48px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '12px',
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            transition: 'border-color 0.2s'
                        }}
                        onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                    />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Sort by:</span>
                    <div style={{
                        display: 'flex',
                        background: 'var(--background-secondary)',
                        padding: '4px',
                        borderRadius: '12px',
                        border: '1px solid var(--border)'
                    }}>
                        {[
                            { id: 'most_reviews', label: 'Most Reviews' },
                            { id: 'highest_pay', label: 'Highest Pay' },
                            { id: 'a_z', label: 'A-Z' },
                            { id: 'z_a', label: 'Z-A' }
                        ].map((option) => (
                            <button
                                key={option.id}
                                onClick={() => setSortBy(option.id)}
                                style={{
                                    padding: '8px 16px',
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    borderRadius: '8px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    background: sortBy === option.id ? 'var(--surface)' : 'transparent',
                                    color: sortBy === option.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                    boxShadow: sortBy === option.id ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                                }}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Area - Grid */}
            <div style={{ flex: 1, padding: '16px 8vw 64px 8vw', display: 'flex', flexDirection: 'column' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '100px', gap: '16px' }}>
                        <div className="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin" />
                        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Loading Companies...</p>
                    </div>
                ) : companies.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '80px', flex: 1 }}>
                        <p style={{ fontSize: '16px', marginBottom: '8px' }}>No companies found.</p>
                        <p style={{ fontSize: '14px' }}>Try searching for something else or add a new experience.</p>
                    </div>
                ) : (
                    <>
                        <div style={{ 
                            display: 'grid', 
                            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                            gap: '48px 40px',
                            padding: '24px 0 64px 0',
                        }}>
                            {companies.map((company) => (
                                <Link
                                    key={company.name}
                                    href={`/interview-experiences/${encodeURIComponent(company.name)}`}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        textDecoration: 'none',
                                        cursor: 'pointer',
                                        position: 'relative',
                                        transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                                    }}
                                    onMouseOver={(e) => {
                                        const title = e.currentTarget.querySelector('.company-name') as HTMLElement;
                                        if (title) title.style.color = 'var(--text-primary)';
                                    }}
                                    onMouseOut={(e) => {
                                        const title = e.currentTarget.querySelector('.company-name') as HTMLElement;
                                        if (title) title.style.color = 'var(--text-secondary)';
                                    }}
                                >
                                    {/* Avg Salary Box (Top Left) */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '-6px',
                                        left: '20px',
                                        background: 'var(--primary)',
                                        color: 'var(--primary-foreground)',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 12px rgba(var(--accent-rgb), 0.3)',
                                        zIndex: 10,
                                        border: '2px solid var(--background)',
                                        pointerEvents: 'none',
                                        letterSpacing: '0.02em'
                                    }}>
                                        {company.avgSalaryHourly ? `$${Math.round(company.avgSalaryHourly)}/hr` : '$N/A'}
                                    </div>

                                    {/* Review Count Box (Top Right) */}
                                    <div style={{
                                        position: 'absolute',
                                        top: '-6px',
                                        right: '20px',
                                        background: 'var(--success)',
                                        color: 'var(--primary-foreground)',
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        padding: '4px 8px',
                                        borderRadius: '12px',
                                        boxShadow: '0 4px 12px var(--success-muted)',
                                        zIndex: 10,
                                        border: '2px solid var(--background)',
                                        pointerEvents: 'none',
                                        letterSpacing: '0.02em'
                                    }}>
                                        {company.reviewCount}
                                    </div>

                                    <div style={{ 
                                        width: '140px', 
                                        height: '140px', 
                                        background: 'var(--popover)',
                                        borderRadius: '36px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden',
                                        boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.03)',
                                        marginBottom: '16px',
                                        position: 'relative',
                                        zIndex: 5,
                                        border: '1px solid rgba(0,0,0,0.03)'
                                    }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img 
                                            src={getLogoUrl(company)} 
                                            alt={company.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                e.currentTarget.parentElement!.innerHTML = `<span style="font-weight: 700; color: var(--accent); font-size: 42px; letter-spacing: -0.05em;">${company.name[0].toUpperCase()}</span>`;
                                            }}
                                        />
                                    </div>
                                    
                                    <h3 className="company-name" style={{ 
                                        fontSize: '15px', 
                                        fontWeight: 600, 
                                        color: 'var(--text-secondary)', 
                                        textAlign: 'center',
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        letterSpacing: '-0.01em',
                                        width: '100%',
                                        transition: 'color 0.2s ease',
                                        marginTop: '4px'
                                    }}>
                                        {formatCompanyName(company.name)}
                                    </h3>
                                </Link>
                            ))}
                        </div>

                        {/* Advanced Pagination Controls */}
                        {pagination.totalPages > 1 && (
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                gap: '10px', 
                                marginTop: 'auto', 
                                padding: '40px 0',
                                borderTop: '1px solid var(--border)'
                            }}>
                                <button 
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '12px',
                                        background: pagination.page === 1 ? 'transparent' : 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        color: pagination.page === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                        cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        opacity: pagination.page === 1 ? 0.5 : 1
                                    }}
                                >
                                    Previous
                                </button>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {(() => {
                                        const { page, totalPages } = pagination;
                                        const pages: (number | string)[] = [];
                                        
                                        // Always include first page
                                        pages.push(1);
                                        
                                        // Calculate range around current page (±3)
                                        const startRange = Math.max(2, page - 3);
                                        const endRange = Math.min(totalPages - 1, page + 3);
                                        
                                        // Add ellipsis before range if needed
                                        if (startRange > 2) {
                                            pages.push('...');
                                        }
                                        
                                        // Add range
                                        for (let i = startRange; i <= endRange; i++) {
                                            pages.push(i);
                                        }
                                        
                                        // Add ellipsis after range if needed
                                        if (endRange < totalPages - 1) {
                                            pages.push('...');
                                        }
                                        
                                        // Always include last page
                                        if (totalPages > 1) {
                                            pages.push(totalPages);
                                        }
                                        
                                        return pages.map((p, idx) => (
                                            typeof p === 'number' ? (
                                                <button
                                                    key={`page-${p}-${idx}`}
                                                    onClick={() => handlePageChange(p)}
                                                    style={{
                                                        minWidth: '42px',
                                                        height: '42px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: page === p ? 'var(--accent)' : 'var(--surface)',
                                                        color: page === p ? 'var(--primary-foreground)' : 'var(--text-primary)',
                                                        border: page === p ? 'none' : '1px solid var(--border)',
                                                        borderRadius: '12px',
                                                        fontWeight: page === p ? 'bold' : '600',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        fontSize: '14px',
                                                        boxShadow: page === p ? '0 4px 12px rgba(var(--accent-rgb), 0.3)' : 'none'
                                                    }}
                                                >
                                                    {p}
                                                </button>
                                            ) : (
                                                <span key={`ellipsis-${idx}`} style={{ color: 'var(--text-tertiary)', padding: '0 4px', fontSize: '18px', fontWeight: 'bold' }}>
                                                    {p}
                                                </span>
                                            )
                                        ));
                                    })()}
                                </div>

                                <button 
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    style={{
                                        padding: '10px 18px',
                                        borderRadius: '12px',
                                        background: pagination.page === pagination.totalPages ? 'transparent' : 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        color: pagination.page === pagination.totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                                        cursor: pagination.page === pagination.totalPages ? 'not-allowed' : 'pointer',
                                        fontSize: '14px',
                                        fontWeight: 600,
                                        transition: 'all 0.2s',
                                        opacity: pagination.page === pagination.totalPages ? 0.5 : 1
                                    }}
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <InterviewExperienceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={() => {
                    setIsModalOpen(false);
                    fetchCompanies(1);
                }}
            />
        </div>
    );
}
