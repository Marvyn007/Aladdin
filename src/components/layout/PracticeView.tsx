'use client';

import React, { useState, useEffect } from 'react';
import { CompanyGridView } from './CompanyGridView';
import { QuestionTableView } from './QuestionTableView';
import { Search, Globe, LayoutGrid, List } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export function PracticeView() {
    const pathname = usePathname();
    const router = useRouter();
    const view = pathname?.includes('/question-view') ? 'question' : 'company';

    const [searchQuery, setSearchQuery] = useState('');
    const [isMounted, setIsMounted] = useState(false);
    const [totalSolved, setTotalSolved] = useState<number | null>(null);

    useEffect(() => {
        setIsMounted(true);
        
        // Fetch global progress (total solved across all companies)
        fetch('/api/practice/progress')
            .then(res => res.json())
            .then(data => {
                if (data.completedIds) {
                    setTotalSolved(data.completedIds.length);
                }
            })
            .catch(console.error);
    }, []);

    if (!isMounted) return null;

    return (
        <div className="practice-container" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
            <div className="practice-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Practice</h1>
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Master LeetCode questions asked by top companies</p>
                    </div>
                    {totalSolved !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 14px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#059669' }}>
                                {totalSolved} Question{totalSolved !== 1 ? 's' : ''} Solved
                            </span>
                        </div>
                    )}
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    {/* Search Bar */}
                    <div style={{ position: 'relative', width: '300px' }}>
                        <Search style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', width: '16px', height: '16px' }} />
                        <input
                            type="text"
                            placeholder={view === 'company' ? "Search companies..." : "Search questions..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '8px 12px 8px 36px',
                                background: 'var(--surface)',
                                border: '1px solid var(--border)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: '14px',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* View Switcher */}
                    <div style={{ 
                        display: 'flex', 
                        background: 'var(--background-secondary)', 
                        padding: '4px', 
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)'
                    }}>
                        <button
                            onClick={() => router.push('/practice')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '13px',
                                fontWeight: 500,
                                background: view === 'company' ? 'var(--surface)' : 'transparent',
                                color: view === 'company' ? 'var(--accent)' : 'var(--text-secondary)',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: view === 'company' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            <LayoutGrid size={14} />
                            Companies
                        </button>
                        <button
                            onClick={() => router.push('/practice/question-view')}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '13px',
                                fontWeight: 500,
                                background: view === 'question' ? 'var(--surface)' : 'transparent',
                                color: view === 'question' ? 'var(--accent)' : 'var(--text-secondary)',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: view === 'question' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            <List size={14} />
                            Questions
                        </button>
                    </div>
                </div>
            </div>

            <div className="practice-content">
                {view === 'company' ? (
                    <CompanyGridView searchQuery={searchQuery} />
                ) : (
                    <QuestionTableView searchQuery={searchQuery} />
                )}
            </div>
        </div>
    );
}
