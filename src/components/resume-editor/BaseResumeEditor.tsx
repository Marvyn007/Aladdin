'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import {
    Home, Download, Save, Loader2,
    PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripHorizontal,
} from 'lucide-react';
import type { TailoredResumeData } from '@/types';
import { DEFAULT_RESUME_DESIGN } from '@/types';
import { ContentPanel } from '@/components/resume-editor/ContentPanel';
import { DesignPanel } from '@/components/resume-editor/DesignPanel';
import { ResumePreview } from '@/components/resume-editor/ResumePreview';
import { renderResumeHtml } from '@/lib/resume-templates';
import { generatePDFFromElement } from '@/lib/client-pdf';
import { toEditorFormat } from '@/lib/resume-generation/toEditorFormat';
import type { DynamicParsedResume } from '@/lib/resume-generation/types';

const GOOGLE_FONTS_MAP: Record<string, string> = {
    "'Inter', 'Segoe UI', sans-serif": 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    "'Roboto', sans-serif": 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    "'Open Sans', sans-serif": 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap',
};

function injectFontsForPdf(html: string, fontFamily: string): string {
    const url = GOOGLE_FONTS_MAP[fontFamily];
    if (!url) return html;
    return html.replace('</head>', `<link rel="stylesheet" href="${url}"></head>`);
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.0;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 420;
const COLLAPSE_THRESHOLD = 100;
const RESUME_WIDTH = 794;
const RESUME_HEIGHT = 1123;

interface BaseResumeEditorProps {
    s3Key: string;
    resumeFilename: string;
}

type LoadState = 'loading' | 'ready' | 'error';

export function BaseResumeEditor({ s3Key, resumeFilename }: BaseResumeEditorProps) {
    const [loadState, setLoadState] = useState<LoadState>('loading');
    const [loadError, setLoadError] = useState<string | null>(null);
    const [resume, setResume] = useState<TailoredResumeData | null>(null);
    const [editorResume, setEditorResume] = useState<TailoredResumeData | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isPreviewUpdating, setIsPreviewUpdating] = useState(false);

    const [leftCollapsed, setLeftCollapsed] = useState(false);
    const [rightCollapsed, setRightCollapsed] = useState(false);
    const [leftPanelWidth, setLeftPanelWidth] = useState(420);
    const [rightPanelWidth, setRightPanelWidth] = useState(380);
    const [isResizingLeft, setIsResizingLeft] = useState(false);
    const [isResizingRight, setIsResizingRight] = useState(false);

    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    const [paperHeight, setPaperHeight] = useState(RESUME_HEIGHT);

    const canvasRef = useRef<HTMLDivElement>(null);
    const iframeContentHeightRef = useRef(RESUME_HEIGHT);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isInitializedRef = useRef(false);

    // ── Load & parse resume on mount ─────────────────────────────────────────
    const loadResume = useCallback(async () => {
        setLoadState('loading');
        setLoadError(null);
        try {
            const res = await fetch('/api/parse-resume-base', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ s3Key }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || 'Failed to parse resume.');
            const editorData = toEditorFormat(json.data as DynamicParsedResume);
            setResume(editorData);
            setEditorResume(editorData);
            setLoadState('ready');
        } catch (err: unknown) {
            setLoadError(err instanceof Error ? err.message : 'Failed to load resume.');
            setLoadState('error');
        }
    }, [s3Key]);

    useEffect(() => { loadResume(); }, [loadResume]);

    // ── Canvas sizing ─────────────────────────────────────────────────────────
    useEffect(() => {
        const update = () => {
            if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                setCanvasSize({ width: rect.width, height: rect.height });
            }
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    const calculateFitZoom = useCallback(() => {
        if (!canvasRef.current || canvasSize.width === 0) return 0.7;
        const padding = 40;
        const fitZoom = Math.min(
            (canvasSize.width - padding * 2) / RESUME_WIDTH,
            (canvasSize.height - padding * 2) / RESUME_HEIGHT
        );
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));
    }, [canvasSize]);

    useEffect(() => {
        if (!isInitializedRef.current && canvasSize.width > 0 && loadState === 'ready') {
            isInitializedRef.current = true;
            setZoom(calculateFitZoom());
            setOffset({ x: 0, y: 0 });
        }
    }, [canvasSize, loadState, calculateFitZoom]);

    // ── Poll iframe height ────────────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            const iframe = document.querySelector('.resume-document iframe') as HTMLIFrameElement;
            if (iframe?.contentWindow) {
                const h = iframe.contentWindow.document.body.scrollHeight;
                if (h > 0) {
                    iframeContentHeightRef.current = h;
                    setPaperHeight(h);
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // ── Panel resize ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isResizingLeft && !isResizingRight) return;
        const handleMove = (e: MouseEvent) => {
            if (isResizingLeft) {
                const newW = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, e.clientX));
                if (newW < COLLAPSE_THRESHOLD + MIN_PANEL_WIDTH) setLeftCollapsed(true);
                else { setLeftCollapsed(false); setLeftPanelWidth(newW); }
            }
            if (isResizingRight) {
                const newW = Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, window.innerWidth - e.clientX));
                if (newW < COLLAPSE_THRESHOLD + MIN_PANEL_WIDTH) setRightCollapsed(true);
                else { setRightCollapsed(false); setRightPanelWidth(newW); }
            }
        };
        const handleUp = () => { setIsResizingLeft(false); setIsResizingRight(false); };
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleUp);
        return () => { window.removeEventListener('mousemove', handleMove); window.removeEventListener('mouseup', handleUp); };
    }, [isResizingLeft, isResizingRight]);

    // ── Pan / drag ────────────────────────────────────────────────────────────
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0 || isResizingLeft || isResizingRight) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }, [offset, isResizingLeft, isResizingRight]);

    const handleDrag = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }, [isDragging, dragStart]);

    const handleDragEnd = useCallback(() => setIsDragging(false), []);

    useEffect(() => {
        const up = () => setIsDragging(false);
        window.addEventListener('mouseup', up);
        return () => window.removeEventListener('mouseup', up);
    }, []);

    // ── Debounced preview update ───────────────────────────────────────────────
    const updatePreview = useCallback((newResume: TailoredResumeData) => {
        setEditorResume(newResume);
        setIsPreviewUpdating(true);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setResume(newResume);
            setIsPreviewUpdating(false);
        }, 300);
    }, []);

    useEffect(() => () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current); }, []);

    // ── Save ──────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!editorResume) return;
        setIsSaving(true);
        setIsSaved(false);
        setSaveError(null);
        try {
            const res = await fetch('/api/save-base-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ resumeData: editorResume }),
            });
            const json = await res.json();
            if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');
            setIsSaved(true);
            setTimeout(() => setIsSaved(false), 2000);
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Download PDF ──────────────────────────────────────────────────────────
    const handleDownload = async () => {
        if (!editorResume) return;
        setIsDownloading(true);

        const name = (editorResume.contact?.name ?? '').trim().toLowerCase().replace(/\s+/g, '_');
        const now = new Date();
        const month = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
        const year = now.getFullYear();
        const filename = name
            ? `${name}_${month}_${year}_resume.pdf`
            : `resume_${month}_${year}.pdf`;

        const baseHtml = renderResumeHtml(editorResume);
        const html = injectFontsForPdf(baseHtml, editorResume.design.fontFamily);

        try {
            const res = await fetch('/api/resume-export', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html, contactName: editorResume.contact?.name }),
            });
            if (!res.ok) throw new Error('Server PDF failed');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch {
            // Fallback: client-side PDF
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(baseHtml, 'text/html');
                const container = document.createElement('div');
                container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:8.5in;background:white;';
                doc.head.querySelectorAll('style').forEach((s) => container.appendChild(s.cloneNode(true)));
                if (doc.body.firstElementChild) container.appendChild(doc.body.firstElementChild.cloneNode(true));
                document.body.appendChild(container);
                try {
                    await generatePDFFromElement(container, { filename, format: 'letter' });
                } finally {
                    document.body.removeChild(container);
                }
            } catch {
                alert('Failed to generate PDF. Please try again.');
            }
        } finally {
            setIsDownloading(false);
        }
    };

    const leftWidth = leftCollapsed ? 0 : leftPanelWidth;
    const rightWidth = rightCollapsed ? 0 : rightPanelWidth;

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loadState === 'loading') {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100vh', gap: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
            }}>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
                <p style={{ fontSize: 15, color: '#475569', margin: 0 }}>Loading your resume...</p>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>{resumeFilename}</p>
            </div>
        );
    }

    if (loadState === 'error' || !resume || !editorResume) {
        return (
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: '100vh', gap: 16, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
            }}>
                <p style={{ fontSize: 15, color: '#dc2626', margin: 0 }}>
                    {loadError || 'Failed to load resume.'}
                </p>
                <button
                    onClick={loadResume}
                    style={{
                        padding: '8px 20px', borderRadius: 8, fontSize: 14, fontWeight: 600,
                        background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer',
                    }}
                >
                    Try again
                </button>
            </div>
        );
    }

    // ── Editor layout ─────────────────────────────────────────────────────────
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', height: '100vh', width: '100%',
            overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
            position: 'relative',
        }}>
            {/* ── Header ── */}
            <header style={{
                position: 'fixed', top: 0, left: 0, right: 0, height: 56,
                background: '#ffffff', borderBottom: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 16px', zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
                {/* Left: panel toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                        onClick={() => setLeftCollapsed(!leftCollapsed)}
                        title={leftCollapsed ? 'Show Content Panel' : 'Hide Content Panel'}
                        style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        {leftCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                    </button>
                </div>

                {/* Center: title */}
                <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12, whiteSpace: 'nowrap' }}>
                    <Link
                        href="/"
                        style={{ display: 'flex', alignItems: 'center', color: '#64748b', transition: 'color 0.15s ease' }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#111827'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                        title="Home"
                    >
                        <Home size={18} />
                    </Link>
                    <span style={{ color: '#cbd5e1', fontSize: 14 }}>/</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Resume Editor</span>
                </div>

                {/* Right: Save + Download + right panel toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {saveError && (
                        <span style={{ fontSize: 12, color: '#dc2626' }}>{saveError}</span>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                            background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8,
                            fontSize: 13, fontWeight: 600, color: '#475569',
                            cursor: isSaving ? 'not-allowed' : 'pointer', opacity: isSaving ? 0.7 : 1,
                            transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => { if (!isSaving) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#d1d5db'; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                    >
                        {isSaving
                            ? <Loader2 size={14} className="animate-spin" style={{ color: '#2563eb' }} />
                            : isSaved
                                ? <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth={2.5}><polyline points="20 6 9 17 4 12" /></svg>
                                : <Save size={14} />}
                        {isSaving ? 'Saving...' : isSaved ? 'Saved!' : 'Save'}
                    </button>

                    <button
                        onClick={handleDownload}
                        disabled={isDownloading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
                            background: 'linear-gradient(90deg, #2563eb, #1d4ed8)', border: 'none',
                            borderRadius: 8, fontSize: 13, fontWeight: 600, color: '#ffffff',
                            cursor: isDownloading ? 'not-allowed' : 'pointer', opacity: isDownloading ? 0.7 : 1,
                            transition: 'all 0.15s ease', boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                        }}
                    >
                        {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        {isDownloading ? 'Generating...' : 'Export'}
                    </button>

                    <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />

                    <button
                        onClick={() => setRightCollapsed(!rightCollapsed)}
                        title={rightCollapsed ? 'Show Design Panel' : 'Hide Design Panel'}
                        style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: '#f1f5f9', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        {rightCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
                    </button>
                </div>
            </header>

            {/* ── Main Content ── */}
            <div style={{ display: 'flex', height: '100%', paddingTop: 56, position: 'relative', overflow: 'hidden' }}>

                {/* Left resize handle */}
                {!leftCollapsed && (
                    <div
                        onMouseDown={() => setIsResizingLeft(true)}
                        style={{
                            position: 'fixed', left: leftWidth, top: 56, bottom: 0, width: 10,
                            cursor: 'col-resize', zIndex: 60, background: isResizingLeft ? '#2563eb' : 'transparent',
                            transition: 'background 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#cbd5e1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isResizingLeft ? '#2563eb' : 'transparent'; }}
                    >
                        <GripHorizontal size={14} color="#94a3b8" />
                    </div>
                )}

                {/* Canvas */}
                <div
                    ref={canvasRef}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDrag}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    style={{
                        flex: 1, minHeight: 0, background: '#edf2f7',
                        display: 'flex', justifyContent: 'center', alignItems: 'center',
                        overflow: 'hidden', cursor: isDragging ? 'grabbing' : 'grab',
                        position: 'relative',
                        marginLeft: leftWidth,
                        marginRight: rightWidth,
                        transition: isResizingLeft || isResizingRight ? 'none' : 'margin 0.2s ease',
                    }}
                >
                    {isPreviewUpdating && (
                        <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.9)', padding: '4px 10px', borderRadius: 6, fontSize: 11, color: '#64748b' }}>
                            <Loader2 size={12} className="animate-spin" /> Updating...
                        </div>
                    )}
                    <div style={{
                        transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                        transformOrigin: 'center center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease',
                        minHeight: 0, display: 'flex', alignItems: 'flex-start',
                    }}>
                        <div
                            className="resume-document"
                            style={{
                                boxShadow: '0 10px 30px rgba(8,10,14,0.08)', borderRadius: 4,
                                background: '#fff', width: RESUME_WIDTH, height: paperHeight,
                                minWidth: RESUME_WIDTH, overflowX: 'hidden', boxSizing: 'border-box',
                                position: 'relative', transition: 'height 0.35s cubic-bezier(0.4,0,0.2,1)',
                            }}
                        >
                            <ResumePreview resume={resume} />
                        </div>
                    </div>
                </div>

                {/* Right resize handle */}
                {!rightCollapsed && (
                    <div
                        onMouseDown={() => setIsResizingRight(true)}
                        style={{
                            position: 'fixed', right: rightWidth, top: 56, bottom: 0, width: 10,
                            cursor: 'col-resize', zIndex: 60, background: isResizingRight ? '#2563eb' : 'transparent',
                            transition: 'background 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#cbd5e1'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = isResizingRight ? '#2563eb' : 'transparent'; }}
                    >
                        <GripHorizontal size={14} color="#94a3b8" />
                    </div>
                )}

                {/* Left: Content panel (fixed) */}
                <div style={{
                    position: 'fixed', left: 0, top: 56, bottom: 0,
                    width: leftCollapsed ? 0 : leftPanelWidth,
                    background: '#ffffff', borderRight: leftCollapsed ? 'none' : '1px solid #e5e7eb',
                    overflow: 'hidden', transition: 'width 0.25s ease, border 0.25s ease',
                    zIndex: 50, display: 'flex', flexDirection: 'column',
                }}>
                    {!leftCollapsed && (
                        <div style={{ height: '100%', overflowY: 'auto', overflowX: 'hidden' }}>
                            <ContentPanel
                                resume={editorResume}
                                onChange={(data) => updatePreview({ ...data, updatedAt: new Date().toISOString() })}
                            />
                        </div>
                    )}
                </div>

                {/* Right: Design panel (fixed) */}
                <div style={{
                    position: 'fixed', right: 0, top: 56, bottom: 0,
                    width: rightCollapsed ? 0 : rightPanelWidth,
                    background: '#ffffff', borderLeft: rightCollapsed ? 'none' : '1px solid #e5e7eb',
                    overflow: 'hidden', transition: 'width 0.25s ease, border 0.25s ease',
                    zIndex: 50, display: 'flex', flexDirection: 'column',
                }}>
                    {!rightCollapsed && (
                        <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>Design</span>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                                <DesignPanel
                                    design={editorResume.design}
                                    onChange={(design) => updatePreview({ ...editorResume, design, updatedAt: new Date().toISOString() })}
                                    onReset={() => updatePreview({ ...editorResume, design: DEFAULT_RESUME_DESIGN, updatedAt: new Date().toISOString() })}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
