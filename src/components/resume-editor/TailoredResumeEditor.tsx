/**
 * TailoredResumeEditor - Main two-panel resume editing component
 * Features: Content tab, Design tab, Live preview, PDF export, Draft saving
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ContentPanel } from './ContentPanel';
import { DesignPanel } from './DesignPanel';
import { ResumePreview, getResumePreviewHtml } from './ResumePreview';
import { type TailoredResumeData, type KeywordAnalysis, DEFAULT_RESUME_DESIGN } from '@/types';
import { ParsingProgress, useParsingProgress } from './ParsingProgress';

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

type ActiveTab = 'content' | 'design';

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
    const [activeTab, setActiveTab] = useState<ActiveTab>('content');
    const [jobDescription, setJobDescription] = useState(initialJobDescription || '');
    const [resume, setResume] = useState<TailoredResumeData | null>(null);
    const [keywords, setKeywords] = useState<KeywordAnalysis | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasGenerated, setHasGenerated] = useState(false);
    const [generationStep, setGenerationStep] = useState<string>('');
    const [hasSavedToDocuments, setHasSavedToDocuments] = useState(false);
    const [showDownloadModal, setShowDownloadModal] = useState(false);
    const parsingProgress = useParsingProgress();
    const abortControllerRef = useRef<AbortController | null>(null);

    const previewRef = useRef<HTMLDivElement>(null);

    // Sync job description
    useEffect(() => {
        if (initialJobDescription) {
            setJobDescription(initialJobDescription);
        }
    }, [initialJobDescription]);

    // Reset on open
    useEffect(() => {
        if (isOpen && !hasGenerated) {
            setError(null);
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

            const reader = response.body?.getReader();
            if (!reader) {
                throw new Error('Failed to read response stream');
            }

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
                    if (!trimmed) {
                        currentEvent = 'message';
                        continue;
                    }

                    if (trimmed.startsWith('event: ')) {
                        currentEvent = trimmed.slice(7).trim();
                        continue;
                    }

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
                                console.log('[FRONTEND] Received done event with full data');
                                console.log('[FRONTEND] Raw AI logs count:', data.data.raw_ai_logs?.length || 0);
                                console.log('[FRONTEND] Structured data present:', !!data.data.structured_data);
                                
                                const structuredData = data.data.structured_data;
                                const rawAILogs = data.data.raw_ai_logs || [];
                                
                                if (structuredData) {
                                    console.log('[FRONTEND] Structured data - summary_keywords:', JSON.stringify(structuredData.summary_keywords || []));
                                    console.log('[FRONTEND] Structured data - prioritized_skills:', JSON.stringify(structuredData.prioritized_skills || []));
                                    console.log('[FRONTEND] Structured data - sections_order:', JSON.stringify(structuredData.sections_order || []));
                                    console.log('[FRONTEND] Structured data - experience_bullets keys:', Object.keys(structuredData.experience_bullets || {}).length);
                                    console.log('[FRONTEND] Structured data - composed_markdown length:', structuredData.composed_markdown?.length || 0);
                                }

                                if (!structuredData) {
                                    console.error('[FRONTEND] CRITICAL: No structured_data in response!');
                                    throw new Error('CRITICAL: No structured data returned from orchestrator. Cannot build resume.');
                                }

                                const missingFields: string[] = [];
                                if (!structuredData.profile) missingFields.push('profile');
                                if (!structuredData.composed_markdown) missingFields.push('composed_markdown');
                                if (!structuredData.experience_bullets) missingFields.push('experience_bullets');
                                if (!structuredData.summary_keywords) missingFields.push('summary_keywords');
                                if (!structuredData.prioritized_skills) missingFields.push('prioritized_skills');
                                if (!structuredData.sections_order) missingFields.push('sections_order');

                                if (missingFields.length > 0) {
                                    const errorMsg = `CRITICAL: Frontend received incomplete data. Missing: ${missingFields.join(', ')}`;
                                    console.error('[FRONTEND]', errorMsg);
                                    throw new Error(errorMsg);
                                }

                                console.log('[FRONTEND] All required fields validated ✓');
                                
                                const parsed = structuredData.profile;
                                
                                const initialResume: TailoredResumeData = {
                                    id: uuidv4(),
                                    contact: {
                                        name: parsed.basics?.name || parsed.basics?.full_name || '',
                                        email: parsed.basics?.email || '',
                                        phone: parsed.basics?.phone || '',
                                        linkedin: parsed.basics?.linkedin || '',
                                        location: parsed.basics?.location || '',
                                        github: parsed.basics?.portfolio ? [parsed.basics.portfolio] : [],
                                    },
                                    summary: parsed.summary || '',
                                    sections: [
                                        {
                                            id: 'exp',
                                            type: 'experience',
                                            title: 'Experience',
                                            items: (parsed.experience || []).map((exp: any) => ({
                                                id: uuidv4(),
                                                title: exp.title,
                                                subtitle: exp.company,
                                                location: exp.location,
                                                dates: `${exp.start_date} - ${exp.end_date}`,
                                                bullets: (exp.bullets || []).map((b: string) => ({ id: uuidv4(), text: b }))
                                            }))
                                        },
                                        {
                                            id: 'edu',
                                            type: 'education',
                                            title: 'Education',
                                            items: (parsed.education || []).map((edu: any) => ({
                                                id: uuidv4(),
                                                title: edu.degree,
                                                subtitle: edu.institution,
                                                dates: `${edu.start_date} - ${edu.end_date}`,
                                                bullets: []
                                            }))
                                        },
                                        {
                                            id: 'proj',
                                            type: 'projects',
                                            title: 'Projects',
                                            items: (parsed.projects || []).map((proj: any) => ({
                                                id: uuidv4(),
                                                title: proj.name || proj.title || '',
                                                bullets: (proj.bullets || []).map((b: string) => ({ id: uuidv4(), text: b }))
                                            }))
                                        },
                                    ],
                                    skills: {
                                        'Technical': parsed.skills?.technical || [],
                                        'Tools': parsed.skills?.tools || [],
                                        'Soft Skills': parsed.skills?.soft || [],
                                    },
                                    design: DEFAULT_RESUME_DESIGN,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                    jobId: jobId,
                                    jobTitle: jobTitle
                                };

                                console.log('[FRONTEND] Mapped resume - name:', initialResume.contact.name);
                                console.log('[FRONTEND] Mapped resume - summary length:', (initialResume.summary || '').length);
                                console.log('[FRONTEND] Mapped resume - experience items:', initialResume.sections[0].items.length);
                                console.log('[FRONTEND] Mapped resume - education items:', initialResume.sections[1].items.length);
                                console.log('[FRONTEND] Mapped resume - skills:', JSON.stringify(initialResume.skills));

                                setResume(initialResume);
                                setKeywords({ matched: [], missing: [] });
                                setHasGenerated(true);
                                parsingProgress.complete();
                            } else if (eventType === 'error') {
                                throw new Error(data.message);
                            }
                        } catch (e) {
                            console.error('Failed to parse SSE data:', e);
                        }
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Request cancelled');
            } else {
                console.error('Initialization error:', err);
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

    const handleRegenerate = () => {
        handleGenerate();
    };

    const getDownloadFilename = () => {
        if (!resume?.contact?.name) return 'Resume.pdf';
        
        const nameParts = resume.contact.name.split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join('_') || '';
        const companyName = (company || '').replace(/[^a-zA-Z0-9]/g, '');
        
        const filename = `${firstName}_${lastName}_${companyName}_resume.pdf`.toLowerCase();
        return filename.replace(/__/g, '_').replace(/^_|_$/g, '') || 'Resume.pdf';
    };

    const handleDownloadClick = () => {
        if (!hasSavedToDocuments) {
            setShowDownloadModal(true);
        } else {
            handleDownloadPdf();
        }
    };

    const handleDownloadAfterSave = async () => {
        await handleSaveToDocuments();
        setShowDownloadModal(false);
        await handleDownloadPdf();
    };

    const handleDownloadWithoutSaving = async () => {
        setShowDownloadModal(false);
        await handleDownloadPdf();
    };

    const handleDownloadPdf = async () => {
        if (!resume) return;

        setIsDownloading(true);

        try {
            const response = await fetch('/api/resume-export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resume }),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to generate PDF');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = getDownloadFilename();
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (err: any) {
            console.error('PDF generation error:', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleSaveToDocuments = async () => {
        if (!resume) return;

        setIsSaving(true);
        const btn = document.getElementById('save-documents-btn');
        if (btn) btn.textContent = 'Saving...';

        try {
            const response = await fetch('/api/save-tailored-resume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    resume,
                    jobTitle: jobTitle
                }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                setHasSavedToDocuments(true);
                if (btn) {
                    btn.textContent = '✓ Saved!';
                    setTimeout(() => {
                        if (btn) btn.textContent = '💾 Save to Documents';
                    }, 3000);
                }
            } else {
                alert('Failed to save resume: ' + (data.error || 'Unknown error'));
                if (btn) btn.textContent = '💾 Save to Documents';
            }
        } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save resume');
            if (btn) btn.textContent = '💾 Save to Documents';
        } finally {
            setIsSaving(false);
        }
    };

    const handleDesignChange = (newDesign: TailoredResumeData['design']) => {
        if (resume) {
            setResume({
                ...resume,
                design: newDesign,
                updatedAt: new Date().toISOString(),
            });
        }
    };

    const handleResetDesign = () => {
        if (resume) {
            setResume({
                ...resume,
                design: {
                    template: 'classic',
                    fontFamily: "'Times New Roman', Georgia, serif",
                    fontSize: 12,
                    accentColor: '#1a365d',
                    margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
                },
                updatedAt: new Date().toISOString(),
            });
        }
    };

    const addKeywordToResume = (keyword: string) => {
        if (!resume) return;

        // Add to 'Other' skills bucket (dynamic Record<string, string[]> shape)
        const otherSkills = resume.skills?.['Other'] ?? [];
        setResume({
            ...resume,
            skills: {
                ...resume.skills,
                'Other': [...otherSkills, keyword],
            },
            updatedAt: new Date().toISOString(),
        });

        // Remove from missing keywords
        if (keywords) {
            setKeywords({
                ...keywords,
                matched: [...keywords.matched, keyword],
                missing: keywords.missing.filter(k => k !== keyword),
                atsScore: keywords.atsScore ? {
                    ...keywords.atsScore,
                    matchedCount: keywords.atsScore.matchedCount + 1,
                    raw: Math.round(((keywords.atsScore.matchedCount + 1) / keywords.atsScore.totalCount) * 100),
                } : undefined,
            });
        }
    };

    const handleAddAllMissingKeywords = () => {
        if (!resume || !keywords || keywords.missing.length === 0) return;

        const confirmed = window.confirm(
            `Add ${keywords.missing.length} missing keywords to the Skills section?`
        );

        if (!confirmed) return;

        // Add all missing keywords to 'Other' skills bucket
        const otherSkills = resume.skills?.['Other'] ?? [];
        setResume({
            ...resume,
            skills: {
                ...resume.skills,
                'Other': [...otherSkills, ...keywords.missing],
            },
            updatedAt: new Date().toISOString(),
        });

        // Update keywords - all are now matched
        setKeywords({
            ...keywords,
            matched: [...keywords.matched, ...keywords.missing],
            missing: [],
            matchedCritical: [...(keywords.matchedCritical || []), ...(keywords.missingCritical || [])],
            missingCritical: [],
            atsScore: keywords.atsScore ? {
                ...keywords.atsScore,
                matchedCount: keywords.atsScore.totalCount,
                raw: 100,
            } : undefined,
        });
    };

    if (!isOpen) return null;

    const isSetupMode = !hasGenerated;

    // Conditional Styles
    const containerStyle: React.CSSProperties = isSetupMode ? {
        // Setup Mode (Match CoverLetterSetupModal)
        maxWidth: '600px',
        width: '95%',
        maxHeight: '85vh',
        display: 'flex',
        flexDirection: 'column',
    } : {
        // Editor Mode (Full Screen)
        width: '95vw',
        maxWidth: '1400px',
        height: '90vh',
        padding: 0, // Override class padding
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--background)',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
    };

    const headerStyle: React.CSSProperties = isSetupMode ? {
        paddingBottom: '16px',
        borderBottom: '1px solid var(--border)',
        marginBottom: '16px'
    } : {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
    };

    return (
        <div
            className="modal-backdrop"
            onClick={(e) => e.target === e.currentTarget && !isGenerating && onClose()}
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.7)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <div
                className="modal-content"
                style={containerStyle}
            >
                {/* Header */}
                <div style={headerStyle}>
                    <div style={isSetupMode ? { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } : undefined}>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Resume Parser (Strict JSON)
                            </h2>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                Parse your default resume into a strict standardized JSON layout.
                            </p>
                        </div>
                        {isSetupMode && (
                            <button onClick={onClose} className="btn btn-ghost btn-icon" disabled={isGenerating}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {!isSetupMode && (
                        <button onClick={onClose} className="btn btn-ghost btn-icon" disabled={isGenerating}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                {/* Main Content */}
                <div style={{ flex: 1, display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>
                    {isSetupMode ? (
                        // Initial Setup View - Match CoverLetterSetupModal content structure
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>
                                    Job Description <span style={{ color: 'var(--error)' }}>*</span>
                                </label>
                                <textarea
                                    value={jobDescription}
                                    onChange={(e) => setJobDescription(e.target.value)}
                                    placeholder="Paste the full job description here..."
                                    style={{
                                        width: '100%',
                                        minHeight: '200px',
                                        padding: '12px',
                                        fontSize: '14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: '1px solid var(--border)',
                                        resize: 'vertical',
                                        background: 'var(--background)',
                                        color: 'var(--text-primary)'
                                    }}
                                    disabled={isGenerating}
                                />
                                {error && (
                                    <p style={{ color: 'var(--error)', fontSize: '13px', marginTop: '8px' }}>
                                        ⚠️ {error}
                                    </p>
                                )}
                            </div>
                        </div>
                    ) : resume ? (
                        // Two-Panel Editor View
                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', height: '100%' }}>
                            {/* Left Panel */}
                            <div style={{
                                width: '400px',
                                display: 'flex',
                                flexDirection: 'column',
                                borderRight: '1px solid var(--border)',
                            }}>
                                {/* Tabs */}
                                <div style={{
                                    display: 'flex',
                                    borderBottom: '1px solid var(--border)',
                                    background: 'var(--surface)',
                                }}>
                                    <button
                                        onClick={() => setActiveTab('content')}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: activeTab === 'content' ? '2px solid var(--accent)' : '2px solid transparent',
                                            color: activeTab === 'content' ? 'var(--accent)' : 'var(--text-secondary)',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        📝 Content
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('design')}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            background: 'transparent',
                                            border: 'none',
                                            borderBottom: activeTab === 'design' ? '2px solid var(--accent)' : '2px solid transparent',
                                            color: activeTab === 'design' ? 'var(--accent)' : 'var(--text-secondary)',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        🎨 Design
                                    </button>
                                </div>

                                {/* Keywords */}
                                {keywords && (
                                    <div style={{
                                        padding: '12px 16px',
                                        borderBottom: '1px solid var(--border)',
                                        background: 'var(--background-secondary)',
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '12px', fontWeight: 600 }}>
                                                🔑 Keywords
                                            </span>
                                            {keywords.atsScore && (
                                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                    <span
                                                        className="badge"
                                                        style={{
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            background: keywords.atsScore.raw >= 80 ? 'var(--success-muted)' : keywords.atsScore.raw >= 50 ? 'var(--warning-muted)' : 'var(--error-muted)',
                                                            color: keywords.atsScore.raw >= 80 ? 'var(--success)' : keywords.atsScore.raw >= 50 ? 'var(--warning)' : 'var(--error)',
                                                        }}
                                                    >
                                                        ATS: {keywords.atsScore.raw}%
                                                    </span>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
                                                        ({keywords.atsScore.matchedCount}/{keywords.atsScore.totalCount})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                                            {keywords.matched.slice(0, 8).map((k, i) => (
                                                <span key={i} className="badge" style={{ fontSize: '10px', background: 'var(--success-muted)', color: 'var(--success)' }}>
                                                    ✓ {k}
                                                </span>
                                            ))}
                                            {keywords.matched.length > 8 && (
                                                <span className="badge" style={{ fontSize: '10px', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                                                    +{keywords.matched.length - 8} more
                                                </span>
                                            )}
                                        </div>
                                        {keywords.missing.length > 0 && (
                                            <>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Missing:</span>
                                                    <button
                                                        onClick={handleAddAllMissingKeywords}
                                                        className="btn btn-ghost"
                                                        style={{ fontSize: '10px', padding: '2px 6px', color: 'var(--accent)' }}
                                                        title="Add all missing keywords to Skills section"
                                                    >
                                                        + Add All to Skills
                                                    </button>
                                                </div>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {keywords.missing.slice(0, 10).map((k, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => addKeywordToResume(k)}
                                                            className="badge"
                                                            style={{
                                                                fontSize: '10px',
                                                                background: 'var(--error-muted)',
                                                                color: 'var(--error)',
                                                                cursor: 'pointer',
                                                                border: 'none',
                                                            }}
                                                            title="Click to add to Skills"
                                                        >
                                                            + {k}
                                                        </button>
                                                    ))}
                                                    {keywords.missing.length > 10 && (
                                                        <span className="badge" style={{ fontSize: '10px', background: 'var(--surface)', color: 'var(--text-secondary)' }}>
                                                            +{keywords.missing.length - 10} more
                                                        </span>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}

                                {/* Content Panel */}
                                <div style={{ flex: 1, overflow: 'auto' }}>
                                    {activeTab === 'content' ? (
                                        <ContentPanel resume={resume} onChange={setResume} />
                                    ) : (
                                        <DesignPanel
                                            design={resume.design}
                                            onChange={handleDesignChange}
                                            onReset={handleResetDesign}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Right Panel - Preview */}
                            <ResumePreview
                                resume={resume}
                                onDownloadPdf={handleDownloadPdf}
                                isDownloading={isDownloading}
                            />
                        </div>
                    ) : null}
                </div>

                {/* Footer Actions */}
                {isSetupMode ? (
                    <div style={{
                        paddingTop: '16px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        {isGenerating && (
                            <ParsingProgress 
                                stages={parsingProgress.stages} 
                                currentStageIndex={parsingProgress.currentStageIndex}
                                onCancel={handleCancelParsing}
                            />
                        )}

                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            {jobUrl ? (
                                <a
                                    href={jobUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-ghost"
                                    style={{ color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                                        <polyline points="15 3 21 3 21 9" />
                                        <line x1="10" y1="14" x2="21" y2="3" />
                                    </svg>
                                    View Original Job
                                </a>
                            ) : <div></div>}

                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={onClose} className="btn btn-ghost">
                                    Cancel
                                </button>
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !jobDescription.trim()}
                                    className="btn btn-primary"
                                >
                                    {isGenerating ? (
                                        <>
                                            <span className="loading-spin" style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block' }} />
                                            Parsing (Takes ~30s)...
                                        </>
                                    ) : (
                                        'Parse & Edit Resume'
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    hasGenerated && resume && (
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 20px',
                            borderTop: '1px solid var(--border)',
                            background: 'var(--surface)',
                        }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                                Last updated: {new Date(resume.updatedAt).toLocaleTimeString()}
                            </span>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={handleRegenerate}
                                    disabled={isGenerating}
                                    className="btn btn-secondary"
                                >
                                    🔄 Regenerate
                                </button>
                                <button
                                    id="save-documents-btn"
                                    onClick={handleSaveToDocuments}
                                    disabled={isSaving}
                                    className="btn btn-secondary"
                                >
                                    {isSaving ? '...' : '💾 Save to Documents'}
                                </button>
                                <button
                                    onClick={handleDownloadClick}
                                    disabled={isDownloading}
                                    className="btn btn-primary"
                                >
                                    {isDownloading ? '...' : '📄 Download PDF'}
                                </button>
                            </div>
                        </div>
                    )
                )}
            </div>

            {/* Download Confirmation Modal */}
            {showDownloadModal && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 2000,
                    }}
                    onClick={() => setShowDownloadModal(false)}
                >
                    <div 
                        style={{
                            background: 'var(--surface)',
                            borderRadius: '12px',
                            padding: '24px',
                            maxWidth: '400px',
                            width: '90%',
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: '0 0 12px', fontSize: '18px', fontWeight: 600 }}>
                            Save Before Downloading?
                        </h3>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', fontSize: '14px' }}>
                            Would you like to save your resume to Documents before downloading? This helps keep your files organized.
                        </p>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button 
                                onClick={handleDownloadWithoutSaving}
                                className="btn btn-ghost"
                            >
                                Download Only
                            </button>
                            <button 
                                onClick={handleDownloadAfterSave}
                                className="btn btn-primary"
                            >
                                Save & Download
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
