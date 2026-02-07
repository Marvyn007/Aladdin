'use client';

import React from 'react';
import { useStoreActions, useStore } from '@/store/useStore';
import { Search, Briefcase, MapPin, Building2 } from 'lucide-react';

const POPULAR_SEARCHES = [
    { label: 'Software Engineer', icon: Briefcase },
    { label: 'Data Scientist', icon: Briefcase },
    { label: 'Product Manager', icon: Briefcase },
    { label: 'Remote Jobs', icon: MapPin },
    { label: 'Intern', icon: Building2 },
];

export function SearchEmptyState() {
    const { performServerSearch } = useStoreActions();
    const searchQuery = useStore(state => state.searchQuery);

    const handleTrySearch = (term: string) => {
        performServerSearch(term);
    };

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '300px',
                textAlign: 'center',
                padding: '32px 20px',
            }}
        >
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🧐</div>
            <h3 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                No jobs found for "{searchQuery}"
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '24px', lineHeight: 1.6 }}>
                We couldn't find any jobs matching your search. Try different keywords or browse popular searches below.
            </p>

            {/* Popular Searches */}
            <div style={{ marginBottom: '24px' }}>
                <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginBottom: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Try these searches
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', maxWidth: '360px' }}>
                    {POPULAR_SEARCHES.map(({ label, icon: Icon }) => (
                        <button
                            key={label}
                            onClick={() => handleTrySearch(label)}
                            style={{
                                padding: '6px 12px',
                                background: 'var(--surface-hover)',
                                color: 'var(--text-secondary)',
                                border: '1px solid var(--border)',
                                borderRadius: '16px',
                                fontSize: '13px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                transition: 'all 0.15s ease',
                            }}
                            className="popular-search-btn"
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Divider */}
            <div style={{
                width: '60px',
                height: '1px',
                background: 'var(--border)',
                marginBottom: '24px'
            }} />

            {/* Back to listings */}
            <button
                onClick={() => window.location.href = '/'}
                style={{
                    padding: '10px 20px',
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '24px',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'transform 0.1s, box-shadow 0.1s',
                }}
                className="back-btn"
            >
                <Search size={16} />
                Back to full job listings
            </button>

            {/* Import hint */}
            <p style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                marginTop: '16px',
                maxWidth: '320px',
                lineHeight: 1.5
            }}>
                Can't find what you're looking for? You can import any job from another source using Aladdin's tools.
            </p>

            <style jsx>{`
                .popular-search-btn:hover {
                    background: var(--accent-muted);
                    border-color: var(--accent);
                    color: var(--accent);
                }
                .back-btn:hover {
                    transform: scale(1.02);
                    box-shadow: var(--shadow-md);
                }
            `}</style>
        </div>
    );
}
