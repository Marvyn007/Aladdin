'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

interface Company {
    name: string;
    questionCount: number;
    logoUrl?: string | null;
    domain?: string | null;
}

const LOGO_DEV_TOKEN = 'pk_By0CIs75Tsy8K9CqV4sT7w';

function getLogoUrl(company: Company): string {
    if (company.logoUrl) return company.logoUrl;
    return '/default company icon.png';
}

export function CompanyGridView({ searchQuery }: { searchQuery: string }) {
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const res = await fetch('/api/practice/companies');
                const data = await res.json();
                setCompanies(data);
            } catch (err) {
                console.error('Failed to fetch companies:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCompanies();
    }, []);

    const filteredCompanies = companies.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentCompanies = filteredCompanies.slice(startIndex, startIndex + itemsPerPage);

    // Reset pagination when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery]);

    const formatCompanyName = (name: string) => {
        if (!name) return "";
        return name
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px', gap: '16px' }}>
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: 500 }}>Loading Companies...</p>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: '48px' }}>
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', 
                gap: '48px 32px',
                padding: '32px 24px 48px 12px',
            }}>
                {currentCompanies.map(company => (
                    <Link
                        key={company.name}
                        href={`/practice/${encodeURIComponent(company.name)}`}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            textDecoration: 'none',
                            cursor: 'pointer',
                            position: 'relative',
                            transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.transform = 'scale(1.05)';
                            const title = e.currentTarget.querySelector('.company-name') as HTMLElement;
                            if (title) title.style.color = 'var(--text-primary)';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                            const title = e.currentTarget.querySelector('.company-name') as HTMLElement;
                            if (title) title.style.color = 'var(--text-secondary)';
                        }}
                    >
                        <div style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '25px',
                            background: '#34C759', // Light Green
                            color: 'white',
                            fontSize: '13px',
                            fontWeight: 700,
                            padding: '4px 10px',
                            borderRadius: '14px',
                            boxShadow: '0 4px 12px rgba(52, 199, 89, 0.4)',
                            zIndex: 10,
                            border: '3px solid var(--background)',
                            pointerEvents: 'none'
                        }}>
                            {company.questionCount}
                        </div>

                        <div style={{ 
                            width: '120px', 
                            height: '120px', 
                            background: '#ffffff', 
                            borderRadius: '28px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.06), 0 2px 6px rgba(0,0,0,0.03)',
                            marginBottom: '16px',
                            position: 'relative',
                            zIndex: 5
                        }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img 
                                src={getLogoUrl(company)} 
                                alt={company.name}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement!.innerHTML = `<span style="font-weight: 700; color: var(--accent); font-size: 38px; letter-spacing: -0.05em;">${company.name[0].toUpperCase()}</span>`;
                                }}
                            />
                        </div>
                        
                        <h3 className="company-name" style={{ 
                            fontSize: '16px', 
                            fontWeight: 600, 
                            color: 'var(--text-secondary)', 
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            letterSpacing: '-0.01em',
                            width: '100%',
                            transition: 'color 0.2s ease'
                        }}>
                            {formatCompanyName(company.name)}
                        </h3>
                    </Link>
                ))}

                {filteredCompanies.length === 0 && (
                    <div style={{ 
                        gridColumn: '1 / -1', 
                        padding: '80px', 
                        textAlign: 'center', 
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--background-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Search size={28} color="var(--text-tertiary)" />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>No companies found</h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '300px', margin: '0 auto' }}>Try a different search term to find what you're looking for.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                    <button 
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: currentPage === 1 ? 'var(--background-secondary)' : 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: currentPage === 1 ? 'var(--text-tertiary)' : 'var(--text-primary)',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 600
                        }}
                    >
                        Previous
                    </button>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500, margin: '0 8px' }}>
                        Page {currentPage} of {totalPages}
                    </span>
                    <button 
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '8px',
                            background: currentPage === totalPages ? 'var(--background-secondary)' : 'var(--surface)',
                            border: '1px solid var(--border)',
                            color: currentPage === totalPages ? 'var(--text-tertiary)' : 'var(--text-primary)',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                            fontSize: '14px',
                            fontWeight: 600
                        }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
