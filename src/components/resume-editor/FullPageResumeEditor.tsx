'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Download, Save, Loader2, Home } from 'lucide-react';
import type { TailoredResumeData, KeywordAnalysis } from '@/types';
import { ContentPanel } from '@/components/resume-editor/ContentPanel';
import { DesignPanel } from '@/components/resume-editor/DesignPanel';
import { ResumePreview, getResumePreviewHtml } from '@/components/resume-editor/ResumePreview';

interface FullPageResumeEditorProps {
    jobId: string;
    jobTitle: string;
    company: string | null;
    initialResumeData: TailoredResumeData;
    initialKeywords: KeywordAnalysis | null;
}

export function FullPageResumeEditor({
    jobId,
    jobTitle,
    company,
    initialResumeData,
    initialKeywords
}: FullPageResumeEditorProps) {
    const [resume, setResume] = useState<TailoredResumeData>(initialResumeData);
    const [keywords, setKeywords] = useState<KeywordAnalysis | null>(initialKeywords);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPreviewUpdating, setIsPreviewUpdating] = useState(false);
    const previewRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Debounced preview update
    const updatePreview = useCallback((newResume: TailoredResumeData) => {
        setIsPreviewUpdating(true);
        
        // Clear any existing timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        
        // Set new timer for debounce
        debounceTimerRef.current = setTimeout(() => {
            setResume(newResume);
            setIsPreviewUpdating(false);
        }, 300);
    }, []);

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const handleSave = async () => {
        setIsSaving(true);
        setIsSaved(false);
        try {
            const response = await fetch('/api/tailored-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId,
                    resumeData: resume,
                    keywordsData: keywords,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to save resume');
            }
            
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch (error) {
            console.error('Save error:', error);
            alert('Failed to save resume');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadPdf = async () => {
        setIsDownloading(true);
        try {
            const html = getResumePreviewHtml(resume);
            
            const response = await fetch('/api/pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html, isTailored: true }),
            });

            if (!response.ok) throw new Error('PDF generation failed');

            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const companyStr = company ? `${company.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
            a.download = `Tailored_Resume_${companyStr}${jobId.substring(0, 4)}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('PDF error:', error);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', background: '#f8fafc' }}>
            {/* Header - Reactive Resume Style */}
            <header style={{
                position: 'sticky',
                top: 0,
                height: '64px',
                background: '#ffffff',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 24px',
                zIndex: 50,
                flexShrink: 0
            }}>
                {/* Left Side: Back to Dashboard */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-start' }}>
                    <Link href="/" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        color: '#6b7280',
                        fontSize: '14px',
                        fontWeight: 500,
                        textDecoration: 'none',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        transition: 'all 0.15s ease',
                        border: '1px solid transparent'
                    }}
                    onMouseOver={(e) => {
                        e.currentTarget.style.color = '#111827';
                        e.currentTarget.style.background = '#f3f4f6';
                    }}
                    onMouseOut={(e) => {
                        e.currentTarget.style.color = '#6b7280';
                        e.currentTarget.style.background = 'transparent';
                    }}
                    >
                        <ChevronLeft size={18} />
                        Dashboard
                    </Link>
                </div>

                {/* Center: Home / Document Name (Breadcrumb Style) */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: 500,
                    color: '#111827'
                }}>
                    <Link href="/" style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: '#6b7280',
                        textDecoration: 'none',
                        transition: 'color 0.15s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#111827'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#6b7280'}
                    >
                        <Home size={18} strokeWidth={2.5} />
                    </Link>
                    <span style={{ color: '#d1d5db' }}>/</span>
                    <span style={{
                        background: '#f3f4f6',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#111827',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                    }}>
                        {jobTitle} {company ? `at ${company}` : ''} Resume
                    </span>
                </div>

                {/* Right Side: Actions */}
                <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button 
                        onClick={handleSave} 
                        disabled={isSaving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 16px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 500,
                            color: '#374151',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.7 : 1,
                            transition: 'all 0.15s ease'
                        }}
                        onMouseOver={(e) => {
                            if (!isSaving) {
                                e.currentTarget.style.background = '#f9fafb';
                                e.currentTarget.style.borderColor = '#d1d5db';
                            }
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = '#ffffff';
                            e.currentTarget.style.borderColor = '#e5e7eb';
                        }}
                    >
                        {isSaving ? <Loader2 size={16} className="animate-spin" style={{ color: '#3b82f6' }} /> : (isSaved ? '✓' : <Save size={16} style={{ color: '#6b7280' }} />)} 
                        {isSaving ? 'Saving...' : (isSaved ? 'Saved!' : 'Save Draft')}
                    </button>
                    <button 
                        onClick={handleDownloadPdf} 
                        disabled={isDownloading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '10px 20px',
                            background: '#3b82f6',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: '#ffffff',
                            cursor: isDownloading ? 'not-allowed' : 'pointer',
                            opacity: isDownloading ? 0.7 : 1,
                            transition: 'all 0.15s ease',
                            boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                        }}
                        onMouseOver={(e) => {
                            if (!isDownloading) {
                                e.currentTarget.style.background = '#2563eb';
                            }
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = '#3b82f6';
                        }}
                    >
                        {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} 
                        {isDownloading ? 'Downloading...' : 'Export PDF'}
                    </button>
                </div>
            </header>

            {/* Main 3-Column Layout */}
            <main 
                className="editor-layout"
                style={{
                    display: 'grid',
                    gridTemplateColumns: '420px 1fr 380px',
                    height: 'calc(100vh - 64px)',
                    overflow: 'hidden',
                    backgroundColor: '#f8fafc'
                }}
            >
                {/* Column 1: Content Editor (Left) */}
                <div 
                    className="editor-panel panel-left" 
                    style={{ 
                        height: '100%', 
                        minHeight: 0, 
                        overflowY: 'auto',
                        background: '#ffffff',
                        borderRight: '1px solid #e8ebef'
                    }}
                >
                    {/* Keywords Optimization Header (if keywords exist) */}
                    {keywords && (keywords.missing.length > 0 || (keywords.autoAdded && keywords.autoAdded.length > 0)) && (
                        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8ebef', background: '#f9fafb', flexShrink: 0 }}>
                            {keywords.autoAdded && keywords.autoAdded.length > 0 && (
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>Smart ATS Optimization (Added)</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {keywords.autoAdded.map((k, i) => (
                                            <button
                                                key={`auto-${i}`}
                                                onClick={() => {
                                                    let updatedSkills = { ...resume.skills } as any;
                                                    if (resume.skills && !Array.isArray(resume.skills)) {
                                                        for (const cat in updatedSkills) {
                                                            if (updatedSkills[cat].includes(k)) {
                                                                updatedSkills[cat] = updatedSkills[cat].filter((skill: string) => skill !== k);
                                                            }
                                                        }
                                                    }
                                                    setResume(prev => ({ ...prev, skills: updatedSkills, updatedAt: new Date().toISOString() }));
                                                    setKeywords(prev => ({
                                                        ...prev!,
                                                        matched: prev!.matched.filter(match => match !== k),
                                                        missing: [...prev!.missing, k],
                                                        autoAdded: prev!.autoAdded ? prev!.autoAdded.filter(add => add !== k) : []
                                                    }));
                                                }}
                                                style={{
                                                    padding: '4px 10px',
                                                    background: '#ecfdf5',
                                                    color: '#059669',
                                                    border: '1px solid #a7f3d0',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title="Added via AI mapping. Click to remove."
                                            >
                                                ✕ {k}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {keywords.missing.length > 0 && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                        <span style={{ fontSize: '12px', fontWeight: 500, color: '#6b7280' }}>Missing Keywords</span>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {keywords.missing.slice(0, 10).map((k, i) => (
                                            <button
                                                key={i}
                                                onClick={async () => {
                                                    try {
                                                        const currentSkillsObj = (resume.skills && !Array.isArray(resume.skills)) ? resume.skills : {};
                                                        const res = await fetch('/api/categorize-skills', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ currentSkills: currentSkillsObj, newSkills: [k] })
                                                        });
                                                        const data = await res.json();
                                                        setResume(prev => ({ ...prev, skills: data.updatedSkills || currentSkillsObj, updatedAt: new Date().toISOString() }));
                                                        setKeywords(prev => ({
                                                            ...prev!,
                                                            matched: [...prev!.matched, k],
                                                            missing: prev!.missing.filter(missingKey => missingKey !== k)
                                                        }));
                                                    } catch (e) { console.error('Categorize failed', e); }
                                                }}
                                                style={{
                                                    padding: '4px 10px',
                                                    background: '#f3f4f6',
                                                    color: '#6b7280',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: 500,
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s ease'
                                                }}
                                                title="Click to categorize into Skills via AI"
                                            >
                                                + {k}
                                            </button>
                                        ))}
                                        {keywords.missing.length > 10 && (
                                            <span style={{ padding: '4px 10px', background: '#f3f4f6', color: '#9ca3af', borderRadius: '6px', fontSize: '11px', fontWeight: 500 }}>
                                                +{keywords.missing.length - 10} more
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* Content Panel */}
                    <div style={{ flex: 1 }}>
                        <ContentPanel
                            resume={resume}
                            onChange={(data) => updatePreview({ ...data, updatedAt: new Date().toISOString() })}
                        />
                    </div>
                </div>

                {/* Column 2: Resume Preview (Center) */}
                <div 
                    className="editor-panel panel-center custom-scrollbar"
                    style={{ position: 'relative', height: '100%', minHeight: 0, overflowY: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '32px', backgroundColor: '#f1f5f9' }}
                >
                    {/* Preview Updating Indicator */}
                    {isPreviewUpdating && (
                        <div style={{
                            position: 'absolute',
                            top: '12px',
                            right: '12px',
                            zIndex: 10,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            background: 'rgba(59, 130, 246, 0.9)',
                            color: '#fff',
                            borderRadius: '16px',
                            fontSize: '12px',
                            fontWeight: 500,
                            boxShadow: '0 2px 8px rgba(59, 130, 246, 0.3)'
                        }}>
                            <Loader2 size={12} className="animate-spin" />
                            Updating preview...
                        </div>
                    )}
                    <div className="w-full max-w-[840px] transform transition-all duration-500" style={{ maxWidth: '840px' }}>
                        <div className="bg-white shadow-[0_32px_64px_-12px_rgba(0,0,0,0.12)] rounded-lg overflow-hidden" style={{ borderRadius: '8px', boxShadow: '0 4px 10px rgba(11,24,40,0.04), 0 32px 64px -12px rgba(0,0,0,0.12)' }}>
                            <ResumePreview 
                                resume={resume} 
                                onDownloadPdf={handleDownloadPdf}
                                isDownloading={isDownloading} 
                            />
                        </div>
                    </div>
                </div>

                {/* Column 3: Design Controls (Right) */}
                <div className="editor-panel panel-right custom-scrollbar" style={{ height: '100%', minHeight: 0, overflowY: 'auto', backgroundColor: '#fff' }}>
                    <div className="flex-1">
                        <DesignPanel
                            design={resume.design}
                            onChange={(design) => setResume(prev => ({ ...prev, design, updatedAt: new Date().toISOString() }))}
                            onReset={() => setResume(prev => ({ 
                                ...prev, 
                                design: { 
                                    template: 'classic', 
                                    fontFamily: "'Times New Roman', Georgia, serif", 
                                    fontSize: 12, 
                                    accentColor: '#1a365d', 
                                    margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 } 
                                },
                                updatedAt: new Date().toISOString() 
                            }))}
                        />
                    </div>
                </div>
            </main>

            
            <style jsx global>{`
                :root {
                    --primary: #3b82f6;
                    --primary-dark: #2563eb;
                }
                .editor-layout {
                    display: grid;
                    grid-template-columns: 420px 1fr 380px;
                    height: calc(100vh - 64px);
                    overflow: hidden;
                }
                .editor-panel {
                    height: 100%;
                    min-height: 0;
                    overflow-y: auto;
                }
                .panel-center {
                    background-color: #f1f5f9;
                }
                .panel-right {
                    background-color: #ffffff;
                    border-left: 1px solid #e8ebef;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 8px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 20px;
                    border: 2px solid transparent;
                    background-clip: content-box;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #cbd5e1;
                    background-clip: content-box;
                }
                
                /* Premium Inputs */
                .content-panel input, .content-panel textarea {
                    transition: all 0.15s ease;
                }
                
                /* Animations */
                @keyframes slideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .content-panel > div {
                    animation: slideIn 0.4s ease-out forwards;
                }
            `}</style>
        </div>
    );
}
