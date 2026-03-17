'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
    ChevronLeft,
    ChevronDown,
    ChevronUp,
    User,
    Calendar,
    DollarSign,
    Briefcase,
    MapPin,
    Globe,
    MessageSquare,
    Search,
    Filter,
    ArrowUpDown,
    Clock,
    CheckCircle2,
    Ban
} from 'lucide-react';
import { CompanyLogo } from '@/components/shared/CompanyLogo';

interface UserData {
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
}

interface InterviewExperience {
    id: string;
    role: string;
    location: string;
    workOption: string;
    offerStatus: string;
    salaryHourly: number | null;
    appliedDate: string | null;
    offerDate: string | null;
    processSteps: any[];
    interviewDetails: any;
    additionalComments: string | null;
    createdAt: string;
    user: UserData;
}

interface CompanyData {
    company: {
        name: string;
        logoUrl: string | null;
    };
    stats: {
        reviewCount: number;
        avgSalaryHourly: number | null;
    };
    experiences: InterviewExperience[];
}

interface Props {
    companyName: string;
}

export function InterviewExperienceDetailView({ companyName }: Props) {
    const [data, setData] = useState<CompanyData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedReviews, setExpandedReviews] = useState<string[]>([]);
    const [isMounted, setIsMounted] = useState(false);

    // Filtering State
    const [roleFilter, setRoleFilter] = useState('');
    const [workOptionFilter, setWorkOptionFilter] = useState('All');
    const [sortBy, setSortBy] = useState('recent'); // 'recent' or 'salary'

    const router = useRouter();

    useEffect(() => {
        setIsMounted(true);
        const fetchCompanyExperiences = async () => {
            try {
                setIsLoading(true);
                const res = await fetch(`/api/interview-experiences/by-company/${encodeURIComponent(companyName)}`);
                if (!res.ok) {
                    const err = await res.json();
                    setError(err.error || 'Failed to fetch reviews');
                    return;
                }
                const result = await res.json();
                setData(result);
                if (result.experiences.length > 0) {
                    setExpandedReviews([]); // Default closed as requested
                }
            } catch (err) {
                console.error('Failed to fetch:', err);
                setError('Internal server error');
            } finally {
                setIsLoading(false);
            }
        };

        if (companyName) {
            fetchCompanyExperiences();
        }
    }, [companyName]);

    // Derived filtered and sorted experiences
    const filteredExperiences = useMemo(() => {
        if (!data) return [];

        let filtered = [...data.experiences];

        // Apply Smarter Generalized Filter
        if (roleFilter) {
            const searchTerms = roleFilter.toLowerCase().trim().split(/\s+/);
            
            filtered = filtered.filter(exp => {
                const searchableText = [
                    exp.role,
                    exp.location,
                    exp.workOption,
                    exp.additionalComments || '',
                    exp.offerStatus
                ].join(' ').toLowerCase();

                return searchTerms.every(term => searchableText.includes(term));
            });
        }

        // Apply Work Option Filter
        if (workOptionFilter !== 'All') {
            filtered = filtered.filter(exp =>
                exp.workOption === workOptionFilter
            );
        }

        // Apply Sorting
        if (sortBy === 'recent') {
            filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } else if (sortBy === 'salary') {
            filtered.sort((a, b) => (b.salaryHourly || 0) - (a.salaryHourly || 0));
        }

        return filtered;
    }, [data, roleFilter, workOptionFilter, sortBy]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <div className="w-8 h-8 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ padding: '80px 48px', color: 'var(--error)', textAlign: 'center' }}>
                <p style={{ fontSize: '20px', fontWeight: 600, marginBottom: '24px' }}>{error || 'Company not found'}</p>
                <button
                    onClick={() => router.push('/interview-experiences')}
                    style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-primary)',
                        padding: '12px 24px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                    Back to Interview Experiences
                </button>
            </div>
        );
    }

    return (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--background)', overflowY: 'auto' }}>

            {/* Header Section */}
            <div style={{
                padding: '24px 64px 32px 64px',
                background: 'linear-gradient(180deg, var(--background-secondary) 0%, var(--background) 100%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px'
            }}>
                {/* Top Nav & Breadcrumb */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-start', marginLeft: '-32px', marginTop: '-8px' }}>
                    <button
                        onClick={() => router.push('/interview-experiences')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px',
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: 'var(--text-tertiary)', fontSize: '14px', transition: 'color 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                    >
                        <ChevronLeft size={18} />
                        Back to Companies
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        height: '100px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CompanyLogo 
                                companyName={data.company.name} 
                                logoUrl={data.company.logoUrl} 
                                size={80} 
                            />
                        </div>
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)', margin: 0, textAlign: 'center' }}>
                        {data.company.name}
                    </h1>
                </div>

                {/* Stats Row */}
                <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: '24px',
                    width: '100%',
                    maxWidth: '800px',
                    background: 'var(--surface)',
                    padding: '16px 24px',
                    borderRadius: '16px',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ color: 'var(--accent)' }}><DollarSign size={18} /></div>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {data.stats.avgSalaryHourly ? `$${data.stats.avgSalaryHourly.toFixed(1)}/hr` : 'N/A'}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Average Salary</span>
                    </div>

                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ color: '#10b981' }}><MessageSquare size={18} /></div>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {data.stats.reviewCount}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Total Reviews</span>
                    </div>

                </div>
            </div>

            {/* Main Content Area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 64px 64px 64px' }}>

                {/* Filters Section */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 0 32px 0',
                    position: 'sticky',
                    top: 0,
                    background: 'var(--background)',
                    zIndex: 10,
                    gap: '24px',
                    flexWrap: 'wrap'
                }}>
                    <div style={{ display: 'flex', gap: '16px', flex: 1, minWidth: '300px' }}>
                        <div style={{ position: 'relative', flex: 2 }}>
                            <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <input
                                type="text"
                                placeholder="Search by role, location, or keywords..."
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px 16px 12px 48px',
                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                    borderRadius: '12px', color: 'var(--text-primary)', outline: 'none'
                                }}
                            />
                        </div>
                        <div style={{ position: 'relative', flex: 1 }}>
                            <Filter size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                            <select
                                value={workOptionFilter}
                                onChange={(e) => setWorkOptionFilter(e.target.value)}
                                style={{
                                    width: '100%', padding: '12px 16px 12px 48px',
                                    background: 'var(--surface)', border: '1px solid var(--border)',
                                    borderRadius: '12px', color: 'var(--text-primary)', outline: 'none',
                                    appearance: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="All">All Work Options</option>
                                <option value="Remote">Remote</option>
                                <option value="Hybrid">Hybrid</option>
                                <option value="On-site">On-site</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '14px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <ArrowUpDown size={16} />
                            Sort by:
                        </span>
                        <div style={{ display: 'flex', background: 'var(--background-secondary)', borderRadius: '10px', padding: '4px' }}>
                            <button
                                onClick={() => setSortBy('recent')}
                                style={{
                                    padding: '6px 12px', fontSize: '12px', borderRadius: '8px', cursor: 'pointer', border: 'none',
                                    background: sortBy === 'recent' ? 'var(--surface)' : 'transparent',
                                    color: sortBy === 'recent' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                    fontWeight: sortBy === 'recent' ? 600 : 400,
                                    boxShadow: sortBy === 'recent' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                }}
                            >
                                Recent
                            </button>
                            <button
                                onClick={() => setSortBy('salary')}
                                style={{
                                    padding: '6px 12px', fontSize: '12px', borderRadius: '8px', cursor: 'pointer', border: 'none',
                                    background: sortBy === 'salary' ? 'var(--surface)' : 'transparent',
                                    color: sortBy === 'salary' ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                    fontWeight: sortBy === 'salary' ? 600 : 400,
                                    boxShadow: sortBy === 'salary' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                                }}
                            >
                                Highest Pay
                            </button>
                        </div>
                    </div>
                </div>

                {/* Experiences List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                    {filteredExperiences.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '64px 0', color: 'var(--text-tertiary)' }}>
                            <div style={{ marginBottom: '16px', opacity: 0.5 }}>
                                {roleFilter || workOptionFilter !== 'All' ? <Search size={48} style={{ margin: '0 auto' }} /> : <MessageSquare size={48} style={{ margin: '0 auto' }} />}
                            </div>
                            <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                                {roleFilter || workOptionFilter !== 'All' ? 'No matches found' : 'No reviews added'}
                            </p>
                            <p style={{ fontSize: '14px' }}>
                                {roleFilter || workOptionFilter !== 'All' ? 'Try adjusting your filters to see more results.' : 'Be the first to share your interview experience with this company!'}
                            </p>
                        </div>
                    ) : (
                        filteredExperiences.map((exp) => (
                            <div key={exp.id} style={{
                                background: 'var(--surface)',
                                border: '2px solid var(--border)',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                            }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 15px rgba(var(--accent-rgb), 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = expandedReviews.includes(exp.id) ? '0 12px 32px -8px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.02)';
                                }}>
                                {/* Card Header */}
                                <div
                                    onClick={() => setExpandedReviews(prev => prev.includes(exp.id) ? prev.filter(id => id !== exp.id) : [...prev, exp.id])}
                                    style={{
                                        padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                        cursor: 'pointer', background: 'var(--surface)'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '24px' }}>
                                        <div style={{
                                            width: '48px', height: '48px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, position: 'relative'
                                        }}>
                                            <CompanyLogo 
                                                companyName={data.company.name} 
                                                logoUrl={data.company.logoUrl} 
                                                size={32} 
                                            />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
                                                {exp.role} @ {data.company.name}
                                            </h3>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', marginTop: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                                                    {exp.offerStatus === 'Yes' ? (
                                                        <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                                                    ) : exp.offerStatus === 'No' ? (
                                                        <Ban size={14} style={{ color: 'var(--error)' }} />
                                                    ) : (
                                                        <Clock size={14} style={{ color: 'var(--warning)' }} />
                                                    )}
                                                    <span style={{ 
                                                        fontWeight: 600, 
                                                        color: exp.offerStatus === 'Yes' ? 'var(--success)' : exp.offerStatus === 'No' ? 'var(--error)' : 'var(--text-secondary)' 
                                                    }}>
                                                        {exp.offerStatus === 'Yes' ? 'Received Offer' : exp.offerStatus === 'No' ? 'No Offer' : 'Pending'}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    <MapPin size={14} style={{ color: 'var(--text-tertiary)' }} />
                                                    {exp.location}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    <Briefcase size={14} style={{ color: 'var(--text-tertiary)' }} />
                                                    {exp.workOption}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
                                                    {isMounted && exp.appliedDate ? new Date(exp.appliedDate).toLocaleDateString('en-US', { year: '2-digit', month: 'numeric' }) : 'N/A'}
                                                    {isMounted && exp.offerDate ? ` - ${new Date(exp.offerDate).toLocaleDateString('en-US', { year: '2-digit', month: 'numeric' })}` : ''}
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    <DollarSign size={14} style={{ color: 'var(--text-tertiary)' }} />
                                                    {exp.salaryHourly ? `${exp.salaryHourly}USD/hr` : 'N/A'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '10px', borderRadius: '12px', background: 'var(--background-secondary)',
                                        color: 'var(--text-tertiary)', transition: 'all 0.2s'
                                    }}>
                                        {expandedReviews.includes(exp.id) ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                    </div>
                                </div>

                                 {/* Card Body - Dense Text Form */}
                                 {expandedReviews.includes(exp.id) && (
                                     <div style={{ padding: '0 24px 24px 96px', display: 'flex', flexDirection: 'column', gap: '32px', background: 'var(--surface)' }}>
                                         
                                         {/* Interview Process Section */}
                                         {exp.processSteps && exp.processSteps.length > 0 && (
                                             <div>
                                                 <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '16px' }}>Interview Process</h4>
                                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                     {exp.processSteps.map((step: any, idx: number) => (
                                                         <div key={idx} style={{ fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', gap: '8px' }}>
                                                             <span style={{ color: 'var(--text-tertiary)', minWidth: '80px' }}>
                                                                 {step.date ? new Date(step.date).toLocaleDateString('en-US', { year: 'numeric', month: '2-digit' }) : 'N/A'}
                                                             </span>
                                                             <span style={{ color: 'var(--text-secondary)' }}>—</span>
                                                             <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{step.step}</span>
                                                             {step.type && <span style={{ color: 'var(--text-tertiary)' }}>({step.type})</span>}
                                                             {step.durationMinutes && <span style={{ color: 'var(--text-tertiary)' }}>, {step.durationMinutes} minutes</span>}
                                                         </div>
                                                     ))}
                                                 </div>
                                             </div>
                                         )}
 
                                         {/* Interview Information Section */}
                                         {(() => {
                                             const validRounds = exp.processSteps?.map((step: any, idx: number) => {
                                                 const details = exp.interviewDetails?.[`${step.step}-${step.type}-${idx}`] || exp.interviewDetails?.[`step_${idx}`] || exp.interviewDetails?.[step.step];
                                                 return details ? { ...step, details } : null;
                                             }).filter(Boolean);

                                             if (!validRounds || validRounds.length === 0) return null;

                                             return (
                                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                     <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>Interview information</h4>
                                                     <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                         {validRounds.map((round: any, idx: number) => (
                                                             <div key={idx} style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                                                 <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{idx + 1}. {round.step}</span>
                                                                 {round.type && <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}> ({round.type})</span>}
                                                                 <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}> : </span>
                                                                 <span>{round.details}</span>
                                                             </div>
                                                         ))}
                                                     </div>
                                                 </div>
                                             );
                                         })()}
 
                                         {/* Additional Comments (merged into text flow) */}
                                         {exp.additionalComments && (
                                             <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                 <h4 style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Overall Experience & Advice</h4>
                                                 <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{exp.additionalComments}</p>
                                             </div>
                                         )}


                                     </div>
                                 )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
