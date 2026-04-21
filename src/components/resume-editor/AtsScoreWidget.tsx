'use client';

import React from 'react';
import { KeywordAnalysis, TailoredResumeData } from '@/types';
interface AtsScoreWidgetProps {
    keywords: KeywordAnalysis;
    resume: TailoredResumeData;
    editorResume: TailoredResumeData;
    updatePreview: (data: TailoredResumeData) => void;
    setKeywords: React.Dispatch<React.SetStateAction<KeywordAnalysis | null>>;
}

export function AtsScoreWidget({ keywords, resume, editorResume, updatePreview, setKeywords }: AtsScoreWidgetProps) {
    // Determine ATS metrics
    const ats = keywords.atsScore || { raw: 0, weighted: 0, matchedCount: 0, totalCount: 0, skillsMatch: 0, formattingCheck: true };
    const score = ats.weighted || 0;

    // Choose color based on score
    let strokeColor = '#84cc16'; // Green
    if (score < 60) strokeColor = '#ef4444'; // Red
    else if (score < 80) strokeColor = '#fb923c'; // Orange

    // SVGRect math
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (score / 100) * circumference;

    const originalMatchedCount = ats.matchedCount ?? keywords.matched.length;
    const computedTotal = keywords.matched.length + keywords.missing.length + (keywords.autoAdded?.length || 0);
    const totalCount = (ats.totalCount && ats.totalCount > 0) ? ats.totalCount : computedTotal;

    const keywordsPercent = totalCount > 0 ? Math.round((originalMatchedCount / totalCount) * 100) : 0;
    const skillsMatch = ats.skillsMatch ?? score; // Fallback to score if missing

    // Freeze the original auto-added count so the ATS metrics don't jump around when user modifies pills manually
    const [initialAutoAddedCount] = React.useState(keywords.autoAdded?.length || 0);

    // Calculate new keyword match after AI auto-additions (frozen)
    const currentMatchedKeywords = originalMatchedCount + initialAutoAddedCount;
    const newKeywordPercent = totalCount > 0 ? Math.round((currentMatchedKeywords / totalCount) * 100) : 0;

    return (
        <div style={{ padding: '20px 14px', borderBottom: '1px solid #f1f5f9', background: '#ffffff', display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%', boxSizing: 'border-box', gap: '24px' }}>

            {/* BEFORE SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '16px 14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Original Profile Analytics</span>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '5px', textAlign: 'center' }}>Original Resume ATS Score</h3>


                {/* Circular Progress */}
                <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '20px', alignSelf: 'center' }}>
                    <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                        {/* Background Ring */}
                        <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="transparent"
                            stroke="#f1f5f9"
                            strokeWidth="8"
                        />
                        {/* Progress Ring */}
                        <circle
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="transparent"
                            stroke={strokeColor}
                            strokeWidth="8"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                        />
                    </svg>
                    <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '32px', fontWeight: 800, color: strokeColor
                    }}>
                        {score}%
                    </div>
                </div>

                {/* Keyword Progress */}
                <div style={{ width: '100%', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>
                        <span>Keywords Found:</span>
                        <span style={{ fontWeight: 500 }}>{originalMatchedCount}/{totalCount}</span>
                    </div>
                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            background: '#84cc16',
                            width: `${keywordsPercent}%`,
                            borderRadius: '4px',
                            transition: 'width 1s ease-in-out'
                        }} />
                    </div>
                </div>



                {/* Skills Match Progress */}
                <div style={{ width: '100%', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>
                        <span>Skills Match:</span>
                        <span style={{ fontWeight: 500 }}>{skillsMatch}%</span>
                    </div>
                    <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            background: '#84cc16',
                            width: `${skillsMatch}%`,
                            borderRadius: '4px',
                            transition: 'width 1s ease-in-out'
                        }} />
                    </div>
                </div>
            </div>

            {/* AFTER SECTION */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', padding: '16px 14px', background: '#f5f3ff', borderRadius: '12px', border: '1px solid #ddd6fe' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', justifyContent: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Aladdin Tailoring Results</span>
                </div>


                {/* Auto Added Pills — full panel width + dense wrap so fewer rows */}
                {keywords.autoAdded && keywords.autoAdded.length > 0 && (
                    <div style={{ width: '100%', textAlign: 'left' }}>
                        <span style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginBottom: '8px', fontWeight: 600 }}>Missing keywords & skills added:</span>
                        <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '8px 10px',
                                alignContent: 'flex-start',
                                lineHeight: 1.35,
                            }}
                        >
                            {keywords.autoAdded.map((k, i) => (
                                <button
                                    key={`auto-${i}`}
                                    type="button"
                                    aria-label={`Remove ${k} from resume`}
                                    onClick={() => {
                                        let updatedSkills = { ...resume.skills } as any;
                                        if (resume.skills && !Array.isArray(resume.skills)) {
                                            for (const cat in updatedSkills) {
                                                if (updatedSkills[cat].includes(k)) {
                                                    updatedSkills[cat] = updatedSkills[cat].filter((skill: string) => skill !== k);
                                                }
                                            }
                                        }
                                        updatePreview({ ...editorResume, skills: updatedSkills, updatedAt: new Date().toISOString() });
                                        setKeywords(prev => ({
                                            ...prev!,
                                            matched: prev!.matched.filter(match => match !== k),
                                            missing: [...prev!.missing, k],
                                            autoAdded: prev!.autoAdded ? prev!.autoAdded.filter(add => add !== k) : []
                                        }));
                                    }}
                                    style={{
                                        padding: '8px 14px',
                                        minHeight: '36px',
                                        background: '#dcfce7',
                                        color: '#15803d',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        transition: 'background 0.2s',
                                        maxWidth: '100%',
                                        whiteSpace: 'normal',
                                        textAlign: 'left',
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#bbf7d0'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#dcfce7'}
                                    title="Remove from resume (moves to Still Missing)"
                                >
                                    <span
                                        aria-hidden
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '20px',
                                            height: '20px',
                                            flexShrink: 0,
                                            borderRadius: '6px',
                                            background: 'rgba(21, 128, 61, 0.18)',
                                            color: '#14532d',
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            lineHeight: 1,
                                        }}
                                    >
                                        ×
                                    </span>
                                    <span style={{ textAlign: 'left' }}>{k}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Aladdin Optimized Match Line */}
                <div style={{ width: '100%', marginBottom: '4px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#1e293b', marginBottom: '6px' }}>
                        <span style={{ fontWeight: 600 }}>New Keyword Score:</span>
                        <span style={{ fontWeight: 600 }}>{newKeywordPercent}%</span>
                    </div>
                    <div style={{ height: '10px', background: '#ffffff', borderRadius: '5px', overflow: 'hidden', border: '1px solid #ddd6fe' }}>
                        <div style={{
                            background: '#8ad617ff',
                            height: '100%',
                            width: `${newKeywordPercent - 1}%`,
                            borderRadius: '5px',
                            transition: 'width 1s ease-in-out'
                        }} />
                    </div>
                </div>

            </div>

            {/* Manual Optimization Footer */}
            {keywords.missing.length > 0 && (
                <div style={{ width: '100%', textAlign: 'left', marginTop: '0px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#b91c1c', display: 'block', marginBottom: '6px' }}>
                        Still missing <span style={{ fontWeight: 500, color: '#991b1b' }}>(tap to add)</span>:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 10px', alignContent: 'flex-start' }}>
                        {keywords.missing.slice(0, 8).map((k, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Add ${k} to resume`}
                                onClick={async () => {
                                    try {
                                        const currentSkillsObj = (resume.skills && !Array.isArray(resume.skills)) ? resume.skills : {};
                                        const res = await fetch('/api/categorize-skills', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ currentSkills: currentSkillsObj, newSkills: [k] })
                                        });
                                        const data = await res.json();
                                        updatePreview({ ...editorResume, skills: data.updatedSkills || currentSkillsObj, updatedAt: new Date().toISOString() });
                                        setKeywords(prev => ({
                                            ...prev!,
                                            matched: [...prev!.matched, k],
                                            missing: prev!.missing.filter(missingKey => missingKey !== k)
                                        }));
                                    } catch (e) { console.error('Categorize failed', e); }
                                }}
                                style={{
                                    padding: '8px 14px',
                                    minHeight: '36px',
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    border: '1px solid #fecaca',
                                    borderRadius: '10px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    transition: 'background 0.15s ease, border-color 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = '#fecaca';
                                    e.currentTarget.style.borderColor = '#f87171';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = '#fee2e2';
                                    e.currentTarget.style.borderColor = '#fecaca';
                                }}
                                title="Add to resume skills"
                            >
                                <span
                                    aria-hidden
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '20px',
                                        height: '20px',
                                        flexShrink: 0,
                                        borderRadius: '6px',
                                        background: 'rgba(185, 28, 28, 0.2)',
                                        color: '#7f1d1d',
                                        fontSize: '15px',
                                        fontWeight: 700,
                                        lineHeight: 1,
                                    }}
                                >
                                    +
                                </span>
                                <span>{k}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
