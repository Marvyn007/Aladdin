'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { InterviewExperienceModal } from '@/components/modals/InterviewExperienceModal';

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
    const [isLoading, setIsLoading] = useState(true);
    const [pagination, setPagination] = useState<PaginationData>({
        page: 1,
        limit: 36,
        total: 0,
        totalPages: 0
    });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetchCompanies(1);
    }, [searchQuery]);

    const fetchCompanies = async (page: number) => {
        try {
            setIsLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '36',
                ...(searchQuery ? { q: searchQuery } : {})
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
        <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--background)' }}>
            {/* Header Area */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '20px' }}>
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
            <div style={{ padding: '16px 32px', background: 'var(--background-secondary)', borderBottom: '1px solid var(--border)' }}>
                <div style={{ position: 'relative', maxWidth: '400px' }}>
                    <Search
                        size={18}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                    />
                    <input
                        type="text"
                        placeholder="Search companies..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 40px',
                            background: 'var(--surface)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: 'var(--text-primary)',
                            outline: 'none',
                        }}
                    />
                </div>
            </div>

            {/* Content Area - Grid */}
            <div style={{ flex: 1, padding: '32px', overflowY: 'auto' }}>
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
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
                        >
                            {companies.map((company) => (
                                <div
                                    key={company.name}
                                    onClick={() => router.push(`/interview-experiences/${encodeURIComponent(company.name)}`)}
                                    style={{
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '12px',
                                        padding: '20px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}
                                    className="company-card"
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--accent)';
                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                        e.currentTarget.style.boxShadow = '0 8px 16px -4px rgba(0,0,0,0.1)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = 'var(--border)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <div style={{
                                            width: '40px',
                                            height: '40px',
                                            borderRadius: '8px',
                                            background: '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            flexShrink: 0,
                                            border: '1px solid var(--border)'
                                        }}>
                                            {company.logoUrl ? (
                                                <img
                                                    src={company.logoUrl}
                                                    alt={company.name}
                                                    style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '4px' }}
                                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                />
                                            ) : (
                                                <span style={{ fontSize: '16px', fontWeight: 'bold' }}>{company.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {company.name}
                                        </span>
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Reviews</p>
                                            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{company.reviewCount}</p>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg. Pay</p>
                                            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {company.avgSalaryHourly ? `$${company.avgSalaryHourly.toFixed(0)}/hr` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div style={{
                                display: 'flex',
                                justifyContent: 'center',
                                alignItems: 'center',
                                gap: '16px',
                                marginTop: '48px',
                                paddingBottom: '20px'
                            }}>
                                <button
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page === 1}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '8px 12px',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: pagination.page === 1 ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                                        cursor: pagination.page === 1 ? 'not-allowed' : 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    <ChevronLeft size={16} />
                                    Previous
                                </button>

                                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                    Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong>
                                </span>

                                <button
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page === pagination.totalPages}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '8px 12px',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        color: pagination.page === pagination.totalPages ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                                        cursor: pagination.page === pagination.totalPages ? 'not-allowed' : 'pointer',
                                        fontSize: '14px'
                                    }}
                                >
                                    Next
                                    <ChevronRight size={16} />
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
