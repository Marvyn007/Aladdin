'use client';

import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ParsingProgress, useParsingProgress } from './ParsingProgress';
import type { TailoredResumeData } from '@/types';
import { DEFAULT_RESUME_DESIGN } from '@/types';

interface TailoredResumeEditorProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
    jobTitle: string;
    company: string | null;
    jobDescription: string;
    jobUrl?: string;
    linkedinProfileUrl?: string;
    linkedinData?: string;
}

export function TailoredResumeEditor({
    isOpen,
    onClose,
    jobId,
    jobTitle,
    company,
    jobDescription: initialJobDescription,
    jobUrl,
    linkedinProfileUrl,
    linkedinData,
}: TailoredResumeEditorProps) {
    const [jobDescription, setJobDescription] = useState(initialJobDescription || '');
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasGenerated, setHasGenerated] = useState(false);
    const parsingProgress = useParsingProgress();
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (initialJobDescription) {
            setJobDescription(initialJobDescription);
        }
    }, [initialJobDescription]);

    useEffect(() => {
        if (isOpen && !hasGenerated) {
            setError(null);
            parsingProgress.reset();
        }
    }, [isOpen, hasGenerated]);

    const handleGenerate = async () => {
        if (!jobDescription.trim()) {
            setError('Please enter a job description');
            return;
        }

        setIsGenerating(true);
        setError(null);
        parsingProgress.reset();
        abortControllerRef.current = new AbortController();

        try {
            const response = await fetch('/api/generate-tailored-resume-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId,
                    jobDescription,
                    linkedinProfileUrl,
                    linkedinData
                }),
                signal: abortControllerRef.current.signal
            });

            if (!response.ok) throw new Error(`Server returned ${response.status}`);

            const reader = response.body?.getReader();
            if (!reader) throw new Error('Failed to read response stream');

            const decoder = new TextDecoder();
            let buffer = '';
            let currentEvent = 'message';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) { currentEvent = 'message'; continue; }
                    if (trimmed.startsWith('event: ')) { currentEvent = trimmed.slice(7).trim(); continue; }
                    
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const eventType = currentEvent;

                            if (eventType === 'stage') {
                                parsingProgress.updateStage(data.stageId);
                            } else if (eventType === 'log') {
                                parsingProgress.addLog(data.stageId, data.log);
                            } else if (eventType === 'complete') {
                                parsingProgress.completeStage(data.stageId);
                            } else if (eventType === 'done') {
                                const parsed = data.status === 'success' ? data.final_resume_json : data.final_resume_json;
                                
                                if (!parsed) throw new Error('Empty resume returned');

                                let skillsFlat: string[] = [];
                                let skillsRecord: Record<string, string[]> = {};
                                if (Array.isArray(parsed.skills)) {
                                    skillsFlat = parsed.skills;
                                    skillsRecord = { 'Skills': parsed.skills };
                                } else if (parsed.skills && typeof parsed.skills === 'object') {
                                    skillsRecord = parsed.skills;
                                    skillsFlat = Object.values(parsed.skills).flat() as string[];
                                }

                                const mappedSections = (parsed.sections || []).map((sec: any) => ({
                                    id: uuidv4(),
                                    type: sec.name.toLowerCase().replace(/[^a-z]/g, ''),
                                    title: sec.name,
                                    items: (sec.entries || []).map((entry: any) => ({
                                        id: uuidv4(),
                                        title: entry.title || '',
                                        subtitle: entry.subtitle || '',
                                        location: entry.location || '',
                                        dates: entry.startDate && entry.endDate ? `${entry.startDate} - ${entry.endDate}` : (entry.startDate || entry.dates || ''),
                                        bullets: (entry.bullets || []).map((b: string) => ({ id: uuidv4(), text: b }))
                                    }))
                                }));

                                if (!mappedSections.some((s: any) => s.type === 'skills')) {
                                    const dev = { id: uuidv4(), type: 'skills', title: 'Skills', items: [] };
                                    mappedSections.push(dev);
                                }

                                const initialResume: TailoredResumeData = {
                                    id: uuidv4(),
                                    contact: {
                                        name: parsed.basics?.name || parsed.basics?.full_name || '',
                                        email: parsed.basics?.email || '',
                                        phone: parsed.basics?.phone || '',
                                        linkedin: parsed.basics?.linkedin || '',
                                        location: parsed.basics?.location || '',
                                        github: parsed.basics?.website ? [parsed.basics.website] : (parsed.basics?.portfolio ? [parsed.basics.portfolio] : []),
                                    },
                                    summary: parsed.summary || '',
                                    sections: mappedSections,
                                    skills: skillsRecord,
                                    design: DEFAULT_RESUME_DESIGN,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    jobId: jobId,
                                    jobTitle: jobTitle
                                };

                                const missingSkills: string[] = parsed.missingSkills || data.missingSkills || [];
                                const autoAddedSkills: string[] = parsed.autoAddedSkills || data.autoAddedSkills || [];
                                
                                let matchedSkills = skillsFlat;
                                if (autoAddedSkills.length > 0) {
                                    matchedSkills = skillsFlat.filter(s => !autoAddedSkills.includes(s));
                                }

                                setHasGenerated(true);
                                parsingProgress.complete();

                                // Automatically save the newly generated resume to the DB
                                try {
                                    await fetch('/api/tailored-resume', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            jobId,
                                            resumeData: initialResume,
                                            keywordsData: { matched: matchedSkills, missing: missingSkills, autoAdded: autoAddedSkills }
                                        }),
                                    });
                                } catch (err) {
                                    console.error('Auto-save failed:', err);
                                }

                                // Snappier redirect to the editor
                                setTimeout(() => {
                                    window.location.href = `/resume-editor/${jobId}`;
                                }, 300);

                            } else if (eventType === 'error') {
                                throw new Error(data.message || 'Stream error');
                            }
                        } catch (e) {
                            console.error('Stream parse error:', e);
                        }
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setError(err.message || 'Failed to parse resume from PDF.');
            }
        } finally {
            if (!parsingProgress.isComplete) {
                setIsGenerating(false);
            }
            abortControllerRef.current = null;
        }
    };

    const handleCancelParsing = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsGenerating(false);
        parsingProgress.reset();
    };

    if (!isOpen) return null;

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
        }}>
            <div style={{
                background: '#ffffff', borderRadius: '12px',
                width: '90%', maxWidth: '600px', maxHeight: '90vh',
                display: 'flex', flexDirection: 'column',
                boxShadow: '0 20px 60px rgba(12,24,40,0.35)',
                overflow: 'hidden', border: '1px solid #e6e9ee'
            }}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e6e9ee' }}>
                    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between' }}>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0 }}>Tailored Resume Editor</h2>
                            <p style={{ marginTop: '4px', fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
                                {jobTitle} {company && `at ${company}`}
                            </p>
                        </div>
                        <button 
                            onClick={onClose} 
                            style={{ 
                                padding: '8px', 
                                marginTop: '-4px', 
                                marginRight: '-4px',
                                color: '#94a3b8', 
                                background: 'transparent',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.color = '#64748b';
                                e.currentTarget.style.background = '#f1f5f9';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.color = '#94a3b8';
                                e.currentTarget.style.background = 'transparent';
                            }}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>

                {/* Setup / Loading Area */}
                <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
                    {error && (
                        <div style={{
                            padding: '12px 16px', background: '#fef2f2',
                            color: '#dc2626', borderRadius: '8px',
                            marginBottom: '20px', fontSize: '14px',
                            border: '1px solid #fecaca'
                        }}>
                            {error}
                        </div>
                    )}

                    {!isGenerating && !hasGenerated ? (
                        <div className="flex flex-col gap-2">
                            <label style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                Job Description <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <textarea
                                style={{ 
                                    width: '100%', 
                                    background: '#fff', 
                                    border: '1px solid #e6e9ee', 
                                    borderRadius: '8px', 
                                    padding: '12px 14px', 
                                    fontSize: '14px', 
                                    resize: 'vertical',
                                    color: '#334155',
                                    lineHeight: 1.6,
                                    outline: 'none',
                                    minHeight: '200px',
                                    transition: 'all 0.2s ease'
                                }}
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the target job description here..."
                            />
                        </div>
                    ) : (
                        <div style={{ padding: '20px 0' }}>
                            <ParsingProgress 
                                stages={parsingProgress.stages}
                                currentStageIndex={parsingProgress.currentStageIndex}
                            />
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid #e6e9ee', background: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {isGenerating ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                            <button 
                                onClick={handleCancelParsing} 
                                style={{ 
                                    padding: '8px 16px',
                                    fontSize: '13px', 
                                    fontWeight: 600, 
                                    color: '#dc2626', 
                                    background: '#fef2f2', 
                                    border: '1px solid #fecaca',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                Stop Generation
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ flex: 1 }}>
                                {jobUrl && (
                                    <a 
                                        href={jobUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        style={{ 
                                            fontSize: '13px', 
                                            fontWeight: 600, 
                                            color: '#3b82f6', 
                                            textDecoration: 'none',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px'
                                        }}
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                                        View Original Job 
                                    </a>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <button 
                                    onClick={onClose} 
                                    style={{ 
                                        padding: '10px 16px',
                                        fontSize: '13px', 
                                        fontWeight: 600, 
                                        color: '#64748b', 
                                        background: 'transparent',
                                        border: '1px solid #e6e9ee',
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={!jobDescription.trim()}
                                    style={{ 
                                        padding: '10px 20px',
                                        background: jobDescription.trim() ? '#3b82f6' : '#94a3b8',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '8px',
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        cursor: jobDescription.trim() ? 'pointer' : 'not-allowed',
                                        transition: 'all 0.2s ease',
                                        boxShadow: jobDescription.trim() ? '0 4px 12px rgba(59, 130, 246, 0.25)' : 'none'
                                    }}
                                >
                                    Parse & Edit Resume
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
