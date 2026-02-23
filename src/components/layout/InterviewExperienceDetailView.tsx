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
    Clock
} from 'lucide-react';

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
    const [expandedReview, setExpandedReview] = useState<string | null>(null);
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
                const res = await fetch(`/api/interview-experiences/${encodeURIComponent(companyName)}`);
                if (!res.ok) {
                    const err = await res.json();
                    setError(err.error || 'Failed to fetch reviews');
                    return;
                }
                const result = await res.json();
                setData(result);
                if (result.experiences.length > 0) {
                    setExpandedReview(null); // Default closed as requested
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

        // Apply Role Filter
        if (roleFilter) {
            const query = roleFilter.toLowerCase();
            filtered = filtered.filter(exp =>
                exp.role.toLowerCase().includes(query)
            );
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

                {/* Company Logo & Name */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    <div style={{
                        height: '100px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {data.company.logoUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={data.company.logoUrl} alt={data.company.name} style={{ maxHeight: '100%', maxWidth: '250px', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ width: '80px', height: '80px', borderRadius: '20px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.05)' }}>
                                <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#000' }}>{data.company.name.charAt(0)}</span>
                            </div>
                        )}
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

                    <div style={{ width: '1px', height: '24px', background: 'var(--border)' }}></div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ color: '#f59e0b' }}><Globe size={18} /></div>
                        <span style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                            {data.experiences.length > 0 ? Array.from(new Set(data.experiences.map(e => e.location))).length : 0}
                        </span>
                        <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>Global Locations</span>
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
                                placeholder="Search by role (e.g. Software Engineer)..."
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '1000px', margin: '0 auto', width: '100%' }}>
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
                                borderRadius: '24px',
                                overflow: 'hidden',
                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                boxShadow: expandedReview === exp.id ? '0 12px 32px -8px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.02)'
                            }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                    e.currentTarget.style.boxShadow = '0 0 15px rgba(var(--accent-rgb), 0.3)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = 'var(--border)';
                                    e.currentTarget.style.boxShadow = expandedReview === exp.id ? '0 12px 32px -8px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.02)';
                                }}>
                                {/* Card Header */}
                                <div
                                    onClick={() => setExpandedReview(expandedReview === exp.id ? null : exp.id)}
                                    style={{
                                        padding: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                        cursor: 'pointer', background: expandedReview === exp.id ? 'var(--background-secondary)' : 'var(--surface)'
                                    }}
                                >
                                    <div style={{ display: 'flex', gap: '24px' }}>
                                        <div style={{
                                            width: '72px', height: '72px',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={data.company.logoUrl || ''} alt={data.company.name} style={{ width: '100%', height: '100%', objectFit: 'contain', mixBlendMode: 'multiply' }} />
                                        </div>
                                        <div>
                                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 12px 0' }}>
                                                {exp.role} @ {data.company.name}
                                            </h3>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', marginTop: '12px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                    <span style={{ color: exp.offerStatus === 'Yes' ? 'var(--success)' : exp.offerStatus === 'No' ? 'var(--error)' : 'var(--warning)', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                                                        {exp.offerStatus === 'Yes' ? 'Got Offer' : exp.offerStatus === 'No' ? 'No Offer' : 'Pending'}
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
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '10px', borderRadius: '12px', background: 'var(--background-secondary)',
                                        color: 'var(--text-tertiary)', transition: 'all 0.2s'
                                    }}>
                                        {expandedReview === exp.id ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
                                    </div>
                                </div>

                                {/* Card Body */}
                                {expandedReview === exp.id && (
                                    <div style={{ padding: '0 32px 32px 32px', display: 'flex', flexDirection: 'column', gap: '40px', background: 'var(--background-secondary)' }}>
                                        <div style={{ height: '1px', background: 'var(--border)', width: '100%' }} />

                                        {/* Timeline */}
                                        {exp.processSteps && exp.processSteps.length > 0 && (
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                                        <Clock size={16} />
                                                    </div>
                                                    <h4 style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Detailed Interview Process</h4>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '16px' }}>
                                                    {exp.processSteps.map((step: any, idx: number) => (
                                                        <div key={idx} style={{ display: 'flex', gap: '32px' }}>
                                                            <div style={{ width: '80px', fontSize: '12px', color: 'var(--text-tertiary)', textAlign: 'right', paddingTop: '6px' }}>
                                                                {step.date ? new Date(step.date).toLocaleDateString() : 'N/A'}
                                                            </div>
                                                            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                                <div style={{
                                                                    width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent)',
                                                                    border: '4px solid var(--background-secondary)', zIndex: 1
                                                                }} />
                                                                {idx < exp.processSteps.length - 1 && <div style={{ width: '2px', flex: 1, background: 'var(--border)', minHeight: '40px' }} />}
                                                            </div>
                                                            <div style={{ paddingBottom: '32px', flex: 1 }}>
                                                                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{step.step}</div>
                                                                <div style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{step.type} {step.durationMinutes ? `• ${step.durationMinutes} mins` : ''}</div>

                                                                {exp.interviewDetails && exp.interviewDetails[`${step.step}-${step.type}-${idx}`] && (
                                                                    <div style={{
                                                                        padding: '16px', background: 'var(--surface)',
                                                                        borderRadius: '16px', fontSize: '14px', color: 'var(--text-primary)',
                                                                        lineHeight: 1.6, whiteSpace: 'pre-wrap', border: '1px solid var(--border)'
                                                                    }}>
                                                                        {exp.interviewDetails[`${step.step}-${step.type}-${idx}`]}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px' }}>
                                            {/* Salary Detail */}
                                            <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border)' }}>
                                                <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>Financial Info</h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(var(--accent-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                                                        <DollarSign size={20} />
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>
                                                            {exp.salaryHourly ? `$${exp.salaryHourly.toFixed(2)} / hr` : 'Not reported'}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Hourly Salary</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* User Info */}
                                            <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border)' }}>
                                                <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '12px' }}>Shared By</h4>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{
                                                        width: '40px', height: '40px', borderRadius: '50%', background: 'var(--background-secondary)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: 'var(--text-secondary)'
                                                    }}>
                                                        {exp.user?.imageUrl ? (
                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                            <img src={exp.user.imageUrl} alt="User" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                        ) : (
                                                            <User size={20} />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>
                                                            {exp.user?.firstName} {exp.user?.lastName ? exp.user.lastName.charAt(0) + '.' : ''}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Verified Aladdin User</div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Additional Comments */}
                                        {exp.additionalComments && (
                                            <div style={{ background: 'var(--surface)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border)' }}>
                                                <h4 style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '16px' }}>Additional Comments</h4>
                                                <p style={{ fontSize: '14px', color: 'var(--text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
                                                    {exp.additionalComments}
                                                </p>
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
