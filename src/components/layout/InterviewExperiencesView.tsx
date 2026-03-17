'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { InterviewExperienceModal } from '@/components/modals/InterviewExperienceModal';
import { CompanyLogo } from '@/components/shared/CompanyLogo';

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
                        color: 'white',
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
            <div style={{ flex: 1, padding: '32px 8vw' }}>
                {isLoading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
                        <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
                    </div>
                ) : companies.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', marginTop: '80px' }}>
                        <p style={{ fontSize: '16px', marginBottom: '8px' }}>No companies found.</p>
                        <p style={{ fontSize: '14px' }}>Try searching for something else or add a new experience.</p>
                    </div>
                ) : (
                    <>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(4, 1fr)',
                                gap: '24px',
                                maxWidth: '1400px',
                                margin: '0 auto'
                            }}
                        >
                            {companies.map((company) => {
                                return (
                                    <div
                                        key={company.name}
                                        onClick={() => router.push(`/interview-experiences/${encodeURIComponent(company.name)}`)}
                                        style={{
                                            background: 'var(--background-secondary)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '16px',
                                            padding: '24px 16px',
                                            cursor: 'pointer',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '12px',
                                            position: 'relative',
                                            overflow: 'hidden'
                                        }}
                                        className="company-card group"
                                        onMouseEnter={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--accent)';
                                            e.currentTarget.style.boxShadow = '0 8px 24px -12px rgba(var(--accent-rgb), 0.3)';
                                        }}
                                        onMouseLeave={(e) => {
                                            e.currentTarget.style.borderColor = 'var(--border)';
                                            e.currentTarget.style.boxShadow = 'none';
                                        }}
                                    >
                                        {/* Logo Container - Large white square as in design */}
                                        <div style={{
                                            width: '80px',
                                            height: '80px',
                                            background: '#FFFFFF',
                                            borderRadius: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '12px',
                                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                                            flexShrink: 0
                                        }}>
                                            <CompanyLogo 
                                                companyName={company.name} 
                                                logoUrl={company.logoUrl} 
                                                size={56} 
                                            />
                                        </div>

                                        {/* Company Name */}
                                        <h3 style={{ 
                                            fontSize: '14px', 
                                            fontWeight: 700, 
                                            color: 'var(--text-primary)', 
                                            textAlign: 'center',
                                            margin: 0,
                                            lineHeight: 1.2
                                        }}>
                                            {company.name}
                                        </h3>

                                        {/* Stats Row - Horizontal */}
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            justifyContent: 'center', 
                                            gap: '8px', 
                                            width: '100%', 
                                            flexWrap: 'wrap',
                                            marginTop: '4px'
                                        }}>
                                            {/* Salary Pill */}
                                            <div style={{
                                                padding: '6px 14px',
                                                border: '1.5px solid var(--border)',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: 700,
                                                color: 'var(--text-primary)',
                                                whiteSpace: 'nowrap',
                                                background: 'var(--surface)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                letterSpacing: '0.3px'
                                            }}>
                                                {company.avgSalaryHourly ? `$ ${Math.round(company.avgSalaryHourly)} / hr` : 'N/A USD'}
                                            </div>

                                            {/* Reviews Pill */}
                                            <div style={{
                                                padding: '6px 14px',
                                                border: '1.5px solid var(--border)',
                                                borderRadius: '20px',
                                                fontSize: '11px',
                                                fontWeight: 700,
                                                color: 'var(--text-secondary)',
                                                background: 'var(--surface)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.5px'
                                            }}>
                                                {company.reviewCount} reviews
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '8px',
                                marginTop: '48px',
                                paddingBottom: '60px'
                            }}>
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px',
                                        background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px',
                                        color: pagination.page === 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                                        cursor: pagination.page === 1 ? 'not-allowed' : 'pointer', fontSize: '14px',
                                        marginRight: '8px'
                                    }}
                                >
                                    <ChevronLeft size={16} /> Prev
                                </button>

                                {(() => {
                                    const { page, totalPages } = pagination;
                                    const pages = [];
                                    if (totalPages <= 5) {
                                        for (let i = 1; i <= totalPages; i++) pages.push(i);
                                    } else {
                                        pages.push(1);
                                        if (page > 3) pages.push('...');
                                        const start = Math.max(2, page - 1);
                                        const end = Math.min(totalPages - 1, page + 1);
                                        for (let i = start; i <= end; i++) pages.push(i);
                                        if (page < totalPages - 2) pages.push('...');
                                        pages.push(totalPages);
                                    }

                                    return pages.map((p, idx) => (
                                        typeof p === 'number' ? (
                                            <button
                                                key={`page-${p}-${idx}`}
                                                onClick={() => handlePageChange(p)}
                                                style={{
                                                    minWidth: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    background: page === p ? 'var(--accent)' : 'var(--surface)',
                                                    color: page === p ? 'white' : 'var(--text-primary)',
                                                    border: page === p ? 'none' : '1px solid var(--border)',
                                                    borderRadius: '8px', fontWeight: page === p ? 'bold' : 'normal',
                                                    cursor: 'pointer', transition: 'all 0.2s', fontSize: '14px'
                                                }}
                                            >
                                                {p}
                                            </button>
                                        ) : (
                                            <span key={`ellipsis-${idx}`} style={{ color: 'var(--text-tertiary)', padding: '0 8px' }}>{p}</span>
                                        )
                                    ));
                                })()}

                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 12px',
                                        background: 'transparent', border: '1px solid var(--border)', borderRadius: '8px',
                                        color: pagination.page === pagination.totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                                        cursor: pagination.page === pagination.totalPages ? 'not-allowed' : 'pointer', fontSize: '14px',
                                        marginLeft: '8px'
                                    }}
                                >
                                    Next <ChevronRight size={16} />
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
