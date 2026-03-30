'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface LeetCodeQuestionRow {
    id: string;
    number: number;
    title: string;
    url: string;
    difficulty: string;
    acceptanceRate: number | null;
    frequency: number | null;
    companies: { name: string; logoUrl: string | null }[];
}

const LeetCodeLogo = () => (
    <img src="/leetcode-icon.png" width="24" height="24" alt="LeetCode" style={{ display: 'block' }} />
);

const SignalBars = ({ value }: { value: number }) => {
    let bars = 1;
    if (value > 25) bars = 2;
    if (value > 50) bars = 3;
    if (value > 75) bars = 4;

    return (
        <div style={{ display: 'flex', gap: '3px', alignItems: 'flex-end', height: '14px' }}>
            {[1, 2, 3, 4].map(idx => (
                <div 
                    key={idx} 
                    style={{
                        width: '4px',
                        height: `${idx * 3.5}px`,
                        background: idx <= bars ? '#3b82f6' : '#e2e8f0',
                        borderRadius: '1px'
                    }}
                />
            ))}
        </div>
    );
};

export function QuestionTableView({ searchQuery }: { searchQuery: string }) {
    const router = useRouter();
    const [questions, setQuestions] = useState<LeetCodeQuestionRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<'All Questions' | 'Easy' | 'Medium' | 'Hard' | 'Unsolved'>('All Questions');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const [openCompanyPopover, setOpenCompanyPopover] = useState<{ id: string; top: number; right: number; compList: { name: string; logoUrl: string | null }[] } | null>(null);
    const [progress, setProgress] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchQuestions = async () => {
            try {
                const res = await fetch('/api/practice/questions');
                const data = await res.json();
                // API returns companyNames (string[]), transform to companies objects
                const logoToken = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
                const mapped = data.map((q: Record<string, unknown>) => ({
                    ...q,
                    companies: (q.companyNames as string[] || []).map((name: string) => {
                        const domain = name.replace(/-/g, '') + '.com';
                        return {
                            name,
                            logoUrl: logoToken
                                ? `https://img.logo.dev/${domain}?token=${logoToken}&size=64`
                                : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=64`
                        };
                    })
                }));
                setQuestions(mapped);
            } catch (err) {
                console.error('Failed to fetch questions:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchQuestions();
        
        // Fetch User Progress
        fetch('/api/practice/progress')
            .then(res => res.json())
            .then(data => {
                if (data.completedIds) {
                    const progMap: Record<string, boolean> = {};
                    data.completedIds.forEach((id: string) => { progMap[id] = true; });
                    setProgress(progMap);
                }
            })
            .catch(console.error);
    }, []);

    const toggleProgress = async (questionId: string) => {
        const isCompleted = !!progress[questionId];
        setProgress(prev => ({ ...prev, [questionId]: !isCompleted }));
        try {
            await fetch('/api/practice/progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ questionId, status: !isCompleted })
            });
        } catch (err) {
             setProgress(prev => ({ ...prev, [questionId]: isCompleted }));
        }
    };

    const displayQuestions = questions
        .filter(q => 
            q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.number.toString().includes(searchQuery)
        )
        .filter(q => {
            if (filter === 'All Questions') return true;
            if (filter === 'Unsolved') return !progress[q.id];
            return q.difficulty.toLowerCase() === filter.toLowerCase();
        })
        .sort((a, b) => a.number - b.number);

    const totalPages = Math.ceil(displayQuestions.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentQuestions = displayQuestions.slice(startIndex, startIndex + itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, filter]);

    const completedCount = questions.filter(q => progress[q.id]).length;
    const totalCount = questions.length;
    const progressPercentage = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    const getDifficultyColor = (difficulty: string) => {
        switch (difficulty.toLowerCase()) {
            case 'easy': return { text: '#00b8a3', bg: 'rgba(0, 184, 163, 0.15)' };
            case 'medium': return { text: '#ffc01e', bg: 'rgba(255, 192, 30, 0.15)' };
            case 'hard': return { text: '#ef4743', bg: 'rgba(239, 71, 67, 0.15)' };
            default: return { text: '#64748b', bg: '#f1f5f9' };
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px', gap: '16px' }}>
                <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-500 rounded-full animate-spin" />
                <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Loading LeetCode Questions...</p>
            </div>
        );
    }

    return (
        <>
        <div style={{ padding: '0 0 48px 0', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {/* Header Section floating layout matches Twilio */}
            <div style={{ 
                marginBottom: '40px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '24px'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <div style={{ width: '80px', height: '80px', background: '#fff', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' }}>
                        <LeetCodeLogo />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1 }}>All Problems</h2>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', color: '#64748b', fontSize: '14px', fontWeight: 500 }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <strong style={{ color: '#334155' }}>{totalCount}</strong> Questions
                            </span>
                        </div>
                    </div>
                </div>

                {/* Progress / Actions mimicking Twilio's right side buttons */}
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '200px', background: '#fff', padding: '12px 16px', borderRadius: '16px', boxShadow: '0 4px 14px rgba(0,0,0,0.04)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px', fontWeight: 700 }}>
                            <span style={{ color: '#64748b', textTransform: 'uppercase' }}>Your Progress</span>
                            <span style={{ color: progressPercentage === 100 ? '#10b981' : '#3b82f6' }}>{completedCount} / {totalCount}</span>
                        </div>
                        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${progressPercentage}%`, height: '100%', background: progressPercentage === 100 ? '#10b981' : '#3b82f6', borderRadius: '3px', transition: 'width 0.4s ease' }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Toolbar (Filters & Search) - Removed standalone search because overall page handles it... wait question view doesn't have local search? Actually the user prop searchQuery is passed, so we can stick with the prop instead of adding one locally. */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', marginRight: '8px' }}>
                        Filter by:
                    </span>
                    {['All Questions', 'Easy', 'Medium', 'Hard', 'Unsolved'].map(pill => (
                        <button
                            key={pill}
                            onClick={() => setFilter(pill as any)}
                            style={{
                                padding: '8px 18px',
                                borderRadius: '24px',
                                fontSize: '13.5px',
                                fontWeight: 600,
                                background: filter === pill ? '#3b82f6' : '#fff',
                                color: filter === pill ? '#fff' : '#475569',
                                border: filter === pill ? '1px solid #3b82f6' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: filter === pill ? '0 4px 12px rgba(59, 130, 246, 0.25)' : '0 1px 2px rgba(0,0,0,0.02)'
                            }}
                            onMouseOver={(e) => { 
                                if (filter !== pill) { e.currentTarget.style.background = '#f8fafc'; }
                            }}
                            onMouseOut={(e) => { 
                                if (filter !== pill) { e.currentTarget.style.background = '#fff'; }
                            }}
                        >
                            {pill}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Container exactly like Twilio */}
            <div style={{ 
                background: '#fff', 
                border: '1px solid #e2e8f0', 
                borderRadius: '20px', 
                overflow: 'hidden', 
                boxShadow: '0 10px 30px rgba(0,0,0,0.04), 0 1px 3px rgba(0,0,0,0.02)'
            }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ minWidth: '940px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '60px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '60px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '160px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acceptance</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '120px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Difficulty</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '140px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frequency</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '140px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Companies</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '100px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentQuestions.map((q, idx) => {
                                const { text: diffColor, bg: diffBg } = getDifficultyColor(q.difficulty);
                                const freqValue = q.frequency || 0;
                                const isCompleted = progress[q.id];
                                const compList = q.companies || [];
                                const hasMoreCompanies = compList.length > 3;
                                
                                return (
                                    <tr 
                                        key={q.id}
                                        style={{ 
                                            borderTop: '1px solid #f1f5f9', 
                                            transition: 'background-color 0.2s ease', 
                                            backgroundColor: '#fff' 
                                        }}
                                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fff'; }}
                                    >
                                        <td style={{ padding: '12px 24px', fontSize: '14.5px', color: '#94a3b8', fontWeight: 600 }}>{q.number}</td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <button 
                                                onClick={() => toggleProgress(q.id)}
                                                style={{
                                                    width: '22px',
                                                    height: '22px',
                                                    borderRadius: '6px',
                                                    border: isCompleted ? 'none' : '2px solid #cbd5e1',
                                                    background: isCompleted ? '#10b981' : '#fff',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s ease',
                                                    boxShadow: isCompleted ? '0 2px 6px rgba(16, 185, 129, 0.4)' : 'inset 0 1px 2px rgba(0,0,0,0.05)'
                                                }}
                                            >
                                                {isCompleted && <Check size={14} color="#fff" strokeWidth={3} />}
                                            </button>
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <a 
                                                href={q.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{ 
                                                    fontWeight: 700, 
                                                    color: '#0f172a', 
                                                    fontSize: '15px', 
                                                    textDecoration: 'none',
                                                    transition: 'color 0.2s',
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.textDecoration = 'underline'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.textDecoration = 'none'; }}
                                            >
                                                {q.title}
                                            </a>
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ width: '36px', height: '4px', background: '#f1f5f9', borderRadius: '2px', overflow: 'hidden' }}>
                                                    <div style={{ 
                                                        width: `${q.acceptanceRate || 0}%`, 
                                                        height: '100%', 
                                                        background: q.acceptanceRate && q.acceptanceRate > 50 ? '#10b981' : (q.acceptanceRate && q.acceptanceRate > 35 ? '#f59e0b' : '#ef4444'),
                                                        borderRadius: '2px'
                                                    }} />
                                                </div>
                                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>
                                                    {q.acceptanceRate ? `${q.acceptanceRate.toFixed(1)}%` : '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <span style={{ 
                                                fontSize: '11.5px', 
                                                fontWeight: 700, 
                                                color: diffColor,
                                                background: diffBg,
                                                padding: '4px 10px',
                                                borderRadius: '6px',
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.02em'
                                            }}>
                                                {q.difficulty}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <SignalBars value={freqValue} />
                                        </td>
                                        <td style={{ padding: '12px 24px', position: 'relative' }}>
                                            <div 
                                                style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (openCompanyPopover?.id === q.id) {
                                                        setOpenCompanyPopover(null);
                                                    } else {
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        setOpenCompanyPopover({
                                                            id: q.id,
                                                            top: rect.top + rect.height / 2,
                                                            right: window.innerWidth - rect.left + 16,
                                                            compList: compList
                                                        });
                                                    }
                                                }}
                                            >
                                                {compList.slice(0, 3).map((comp, idx) => (
                                                    <div 
                                                        key={comp.name} 
                                                        style={{ 
                                                            width: '32px', height: '32px', borderRadius: '8px', 
                                                            background: '#fff', border: '2px solid #fff',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                            marginLeft: idx > 0 ? '-12px' : 0, zIndex: 3 - idx,
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                                                        }}
                                                        title={comp.name}
                                                    >
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img 
                                                            src={comp.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(comp.name)}&background=random`} 
                                                            alt={comp.name}
                                                            style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                                                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                        />
                                                    </div>
                                                ))}
                                                {hasMoreCompanies && (
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '8px',
                                                        background: '#f8fafc', border: '2px solid #fff',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        marginLeft: '-12px', zIndex: 0, fontSize: '11px', fontWeight: 600, color: '#64748b',
                                                        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
                                                    }}>
                                                        +{compList.length - 3}
                                                    </div>
                                                )}
                                            </div>

                                        </td>
                                        <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                                            <a 
                                                href={q.url} 
                                                target="_blank" 
                                                rel="noopener noreferrer"
                                                style={{ 
                                                    display: 'inline-flex', 
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    transition: 'transform 0.2s ease'
                                                }}
                                                onMouseOver={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1.1)';
                                                }}
                                                onMouseOut={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                }}
                                            >
                                                <LeetCodeLogo />
                                            </a>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Footer Pagination Toolbar mimicking Twilio bottom */}
                <div style={{ 
                    padding: '20px 24px', 
                    background: '#f8fafc', 
                    borderTop: '1px solid #f1f5f9',
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                }}>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                        Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, displayQuestions.length)} of {displayQuestions.length} questions
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: currentPage === 1 ? '#cbd5e1' : '#64748b', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = currentPage;
                                if (currentPage <= 3) pageNum = i + 1;
                                else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                                else pageNum = currentPage - 2 + i;
                                
                                if (pageNum < 1 || pageNum > totalPages) return null;
                                
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        style={{
                                            width: '32px', height: '32px', borderRadius: '8px',
                                            background: currentPage === pageNum ? '#3b82f6' : 'transparent',
                                            color: currentPage === pageNum ? '#fff' : '#64748b',
                                            border: 'none',
                                            fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                                            transition: 'all 0.2s ease'
                                        }}
                                        onMouseOver={(e) => { if (currentPage !== pageNum) e.currentTarget.style.background = '#e2e8f0'; }}
                                        onMouseOut={(e) => { if (currentPage !== pageNum) e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', color: currentPage === totalPages ? '#cbd5e1' : '#64748b', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
            {/* Popover rendered at root to avoid stacking context issues */}
            {openCompanyPopover && openCompanyPopover.compList.length > 0 && (
                <>
                    <div 
                        style={{ position: 'fixed', inset: 0, zIndex: 99998 }} 
                        onClick={(e) => { e.stopPropagation(); setOpenCompanyPopover(null); }} 
                    />
                    <div 
                        className="no-scrollbar"
                        style={{
                            position: 'fixed',
                            top: openCompanyPopover.top,
                            right: openCompanyPopover.right,
                        transform: 'translateY(-50%)',
                        background: '#fff',
                        borderRadius: '16px',
                        padding: '16px',
                        width: '240px',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        boxShadow: '0 12px 48px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 99999,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
                                {openCompanyPopover.compList.length} Companies
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); setOpenCompanyPopover(null); }}
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {openCompanyPopover.compList.map(comp => (
                                <div 
                                    key={comp.name} 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        router.push(`/practice/${comp.name.toLowerCase()}`); 
                                    }}
                                    style={{ 
                                        display: 'flex', alignItems: 'center', gap: '12px', 
                                        padding: '8px', borderRadius: '10px', 
                                        cursor: 'pointer', transition: 'background-color 0.2s'
                                    }}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                                >
                                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'transparent', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img 
                                            src={comp.logoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(comp.name)}&background=random`} 
                                            alt={comp.name} 
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                            onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                                        />
                                    </div>
                                    <span style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a' }}>
                                        {comp.name.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
