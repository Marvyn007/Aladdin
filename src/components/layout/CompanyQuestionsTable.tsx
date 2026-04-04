'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Question {
    id: string;
    number: number;
    title: string;
    url: string;
    difficulty: string;
    acceptanceRate: number | null;
    frequency: number | null;
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

export function CompanyQuestionsTable({ companyName }: { companyName: string }) {
    const router = useRouter();
    const [questions, setQuestions] = useState<Question[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filter, setFilter] = useState<'All Questions' | 'Easy' | 'Medium' | 'Hard' | 'Unsolved'>('All Questions');
    const [currentPage, setCurrentPage] = useState(1);
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);
    const itemsPerPage = 20;

    const [progress, setProgress] = useState<Record<string, boolean>>({});

    useEffect(() => {
        const fetchCompanyQuestions = async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/practice/companies/${encodeURIComponent(companyName)}`);
                const data = await res.json();
                if (data.questions) {
                    setQuestions(data.questions);
                    setCompanyLogo(data.companyInfo?.logoUrl || null);
                } else {
                    setQuestions(data);
                }
            } catch (err) {
                console.error('Failed to fetch company questions:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchCompanyQuestions();
        
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
    }, [companyName]);

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
        });

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
                <p style={{ color: '#64748b', fontSize: '14px', fontWeight: 500 }}>Loading {companyName} Questions...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '32px 40px 64px 40px', height: '100%', overflowY: 'auto', background: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            
            {/* Back Button */}
            <div style={{ marginBottom: '24px' }}>
                <button 
                    onClick={() => router.push('/practice')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                    <ChevronLeft size={18} />
                    Back to Practice
                </button>
            </div>

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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src={companyLogo || '/default company icon.png'} 
                            alt={companyName}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = `<span style="font-weight: 700; color: #3b82f6; font-size: 32px;">${companyName[0].toUpperCase()}</span>`;
                            }}
                        />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                            <h2 style={{ fontSize: '32px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1, textTransform: 'capitalize' }}>{companyName}</h2>
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

            {/* Top Toolbar (Filters & Search) */}
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

                <div style={{ position: 'relative', width: '300px' }}>
                    <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#94a3b8' }} />
                    <input 
                        type="text" 
                        placeholder="Search questions by # or title..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 14px 12px 40px',
                            background: '#fff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '16px',
                            fontSize: '14px',
                            color: '#0f172a',
                            outline: 'none',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.1)'; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.02)'; }}
                    />
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
                    <table style={{ minWidth: '900px', width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc' }}>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '60px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>#</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '60px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '160px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Acceptance</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '120px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Difficulty</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '140px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Frequency</th>
                                <th style={{ padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: '#64748b', width: '100px', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentQuestions.map((q, idx) => {
                                const { text: diffColor, bg: diffBg } = getDifficultyColor(q.difficulty);
                                const freqValue = q.frequency || 0;
                                const isCompleted = progress[q.id];
                                
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

                {displayQuestions.length === 0 && !isLoading && (
                    <div style={{ padding: '80px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', background: '#fff' }}>
                        <Search size={36} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                        <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>No questions found</h3>
                        <p style={{ color: '#64748b', fontSize: '15px', marginTop: '8px' }}>Try adjusting your search criteria or filters.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
