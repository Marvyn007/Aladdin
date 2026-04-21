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
import { generatePDFFromServerless } from '@/lib/client-pdf';
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
    const [loadProgress, setLoadProgress] = useState(0);
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
    const [isFullView, setIsFullView] = useState(false);
    const [showZoomIndicator, setShowZoomIndicator] = useState(false);

    // History
    const [history, setHistory] = useState<TailoredResumeData[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const isUndoingRedoingRef = useRef(false);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    const canvasRef = useRef<HTMLDivElement>(null);
    const iframeContentHeightRef = useRef(RESUME_HEIGHT);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const zoomTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isInitializedRef = useRef(false);

    // ── Load & parse resume on mount ─────────────────────────────────────────
    const loadResume = useCallback(async () => {
        setLoadState('loading');
        setLoadProgress(0);
        setLoadError(null);
        try {
            setLoadProgress(10);                                               // request sent
            const res = await fetch('/api/parse-resume-base', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ s3Key }),
            });
            const json = await res.json();
            setLoadProgress(70);                                               // response received
            if (!res.ok || !json.success) throw new Error(json.error || 'Failed to parse resume.');
            const editorData = toEditorFormat(json.data as DynamicParsedResume);
            setLoadProgress(90);                                               // parsed & formatted
            setResume(editorData);
            setEditorResume(editorData);
            setHistory([editorData]);
            setHistoryIndex(0);
            setLoadProgress(100);                                              // ready
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

    // ── isFullView ↔ paperHeight ───────────────────────────────────────────────
    useEffect(() => {
        if (isFullView) {
            setPaperHeight(iframeContentHeightRef.current);
        } else {
            setPaperHeight(RESUME_HEIGHT);
        }
    }, [isFullView]);

    // ── Poll iframe height ────────────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => {
            const iframe = document.querySelector('.resume-document iframe') as HTMLIFrameElement;
            if (iframe?.contentWindow) {
                const h = iframe.contentWindow.document.body.scrollHeight;
                if (h > 0) {
                    iframeContentHeightRef.current = h;
                    if (isFullView) setPaperHeight(h);
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [isFullView]);

    // ── Scroll-to-zoom ────────────────────────────────────────────────────────
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            const path = e.composedPath?.() || [];
            const isOverContent = path.some((el: EventTarget) =>
                el && (el as Element).classList?.contains?.('content-panel')
            );
            const isOverDesign = path.some((el: EventTarget) =>
                el && (el as Element).classList?.contains?.('design-panel')
            );
            const isOverResume = path.some((el: EventTarget) =>
                el && (el as Element).classList?.contains?.('resume-document')
            );
            if (isOverContent || isOverDesign || isOverResume) return;

            e.preventDefault();
            e.stopPropagation();
            const delta = -e.deltaY * 0.0012;
            setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)));
            setShowZoomIndicator(true);
            if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
            zoomTimerRef.current = setTimeout(() => setShowZoomIndicator(false), 800);
        };

        document.addEventListener('wheel', handleWheel, { capture: true, passive: false });
        return () => {
            document.removeEventListener('wheel', handleWheel, { capture: true });
            if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
        };
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

    // ── Zoom controls ─────────────────────────────────────────────────────────
    const zoomIn = useCallback(() => setZoom(prev => Math.min(MAX_ZOOM, prev + 0.1)), []);
    const zoomOut = useCallback(() => setZoom(prev => Math.max(MIN_ZOOM, prev - 0.1)), []);

    const handleCenterView = useCallback(() => {
        setIsFullView(false);
        setZoom(calculateFitZoom());
        setOffset({ x: 0, y: 0 });
    }, [calculateFitZoom]);

    // ── Undo / redo ───────────────────────────────────────────────────────────
    const undo = useCallback(() => {
        if (!canUndo) return;
        isUndoingRedoingRef.current = true;
        const prev = history[historyIndex - 1];
        setHistoryIndex(historyIndex - 1);
        setResume(prev);
        setEditorResume(prev);
        setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
    }, [canUndo, history, historyIndex]);

    const redo = useCallback(() => {
        if (!canRedo) return;
        isUndoingRedoingRef.current = true;
        const next = history[historyIndex + 1];
        setHistoryIndex(historyIndex + 1);
        setResume(next);
        setEditorResume(next);
        setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
    }, [canRedo, history, historyIndex]);

    // ── Debounced preview update ───────────────────────────────────────────────
    const updatePreview = useCallback((newResume: TailoredResumeData) => {
        setEditorResume(newResume);
        setIsPreviewUpdating(true);
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            setResume(newResume);
            setIsPreviewUpdating(false);
            if (!isUndoingRedoingRef.current) {
                setHistory(prev => {
                    const trimmed = prev.slice(0, historyIndex + 1);
                    return [...trimmed, newResume];
                });
                setHistoryIndex(prev => prev + 1);
            }
        }, 300);
    }, [historyIndex]);

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
            await generatePDFFromServerless(
                html, 
                filename, 
                undefined, // jobTitle not in base editor
                editorResume.contact?.name,
                editorResume.design.margins
            );
        } catch (error) {
            console.error('Server PDF generation failed:', error);
            alert('Failed to generate PDF. Please try again or check your network connection.');
        } finally {
            setIsDownloading(false);
        }
    };

    const leftWidth = leftCollapsed ? 0 : leftPanelWidth;
    const rightWidth = rightCollapsed ? 0 : rightPanelWidth;

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loadState === 'loading') {
        return <BaseResumeEditorLoader progress={loadProgress} />;
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
                        {isDownloading ? 'Downloading...' : 'Download'}
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

                    {/* Zoom indicator */}
                    {showZoomIndicator && (
                        <div style={{
                            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '6px 14px',
                            borderRadius: 20, fontSize: 12, fontWeight: 600, zIndex: 50,
                            pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                        }}>
                            {Math.round(zoom * 100)}%
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

                    {/* Floating Toolbar */}
                    <div style={{
                        position: 'absolute', bottom: 30, left: '50%', transform: 'translateX(-50%)',
                        display: 'flex', alignItems: 'center', gap: 4,
                        background: '#1a1a1a', padding: '6px 12px', borderRadius: 100,
                        boxShadow: '0 10px 25px rgba(0,0,0,0.3)', zIndex: 100,
                        border: '1px solid rgba(255,255,255,0.1)',
                    }}>
                        {/* Undo */}
                        <button
                            onClick={undo} disabled={!canUndo}
                            style={{ background: 'transparent', border: 'none', padding: 8, color: canUndo ? '#fff' : '#555', cursor: canUndo ? 'pointer' : 'default', display: 'flex' }}
                            title="Undo (Ctrl+Z)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                        </button>
                        {/* Redo */}
                        <button
                            onClick={redo} disabled={!canRedo}
                            style={{ background: 'transparent', border: 'none', padding: 8, color: canRedo ? '#fff' : '#555', cursor: canRedo ? 'pointer' : 'default', display: 'flex' }}
                            title="Redo (Ctrl+Y)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
                        </button>

                        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

                        {/* Zoom out */}
                        <button onClick={zoomOut} style={{ background: 'transparent', border: 'none', padding: 8, color: '#fff', cursor: 'pointer', display: 'flex' }} title="Zoom Out">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </button>
                        <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, width: 40, textAlign: 'center' }}>
                            {Math.round(zoom * 100)}%
                        </div>
                        {/* Zoom in */}
                        <button onClick={zoomIn} style={{ background: 'transparent', border: 'none', padding: 8, color: '#fff', cursor: 'pointer', display: 'flex' }} title="Zoom In">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </button>

                        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

                        {/* Center view */}
                        <button onClick={handleCenterView} style={{ background: 'transparent', border: 'none', padding: 8, color: '#fff', cursor: 'pointer', display: 'flex' }} title="Center View">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>

                        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

                        {/* Full view toggle */}
                        <button
                            onClick={() => setIsFullView(!isFullView)}
                            style={{
                                background: isFullView ? 'rgba(59,130,246,0.5)' : 'transparent',
                                border: 'none', padding: 8, color: '#fff', cursor: 'pointer', display: 'flex', borderRadius: 4,
                            }}
                            title={isFullView ? 'Standard A4 View' : 'View Full Resume'}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {isFullView
                                    ? <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"/>
                                    : <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/>
                                }
                            </svg>
                        </button>

                        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

                        {/* Download PDF */}
                        <button onClick={handleDownload} style={{ background: 'transparent', border: 'none', padding: 8, color: '#fff', cursor: 'pointer', display: 'flex' }} title="Download PDF">
                            <Download size={18} />
                        </button>
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

// ── Branded loading screen driven by real progress ────────────────────────────
// Stages advance only when real progress crosses their threshold.
const LOADER_STAGES = [
    { label: 'Authenticating\u2026',  threshold: 0   },
    { label: 'Resume found',           threshold: 70  },
    { label: 'Preparing editor\u2026', threshold: 90  },
    { label: 'Ready',                  threshold: 100 },
] as const;

function BaseResumeEditorLoader({ progress }: { progress: number }) {
    // Which stage does the current real progress map to?
    const stageIndex = LOADER_STAGES.reduce(
        (best, stage, i) => (progress >= stage.threshold ? i : best),
        0,
    );

    const [displayText, setDisplayText] = useState('');
    const [typedStage, setTypedStage] = useState(-1);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef  = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Start typing the new label only when the real stage changes
    useEffect(() => {
        if (stageIndex === typedStage) return;
        if (intervalRef.current) clearInterval(intervalRef.current);
        setTypedStage(stageIndex);
        const label = LOADER_STAGES[stageIndex].label;
        let charIndex = 0;
        setDisplayText('');
        intervalRef.current = setInterval(() => {
            if (!mountedRef.current) return;
            charIndex++;
            setDisplayText(label.slice(0, charIndex));
            if (charIndex === label.length) {
                clearInterval(intervalRef.current!);
                intervalRef.current = null;
            }
        }, 45);
    }, [stageIndex, typedStage]);

    return (
        <>
            <style>{`
                @keyframes re-sheen {
                    0%   { left: -60%; }
                    100% { left: 110%; }
                }
                @keyframes re-blink {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0; }
                }
            `}</style>
            <div style={{
                display: 'grid', placeItems: 'center', height: '100vh',
                background: '#faf8f5',
                fontFamily: '-apple-system, "Segoe UI", Inter, system-ui, sans-serif',
                overflow: 'hidden',
            }}>
                <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    gap: 40, width: 'min(400px, calc(100vw - 48px))',
                    textAlign: 'center', transform: 'translateY(-5%)',
                }}>
                    <div style={{
                        width: 56, height: 56, background: 'rgba(35,131,226,0.1)',
                        borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                            stroke="#2383e2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                    </div>
                    <div>
                        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#37352f', letterSpacing: '-0.4px', marginBottom: 8 }}>
                            Opening your resume
                        </h2>
                        <p style={{ fontSize: 14, color: '#8a8884' }}>This only takes a moment</p>
                    </div>
                    <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                            <span style={{ fontSize: 13, color: '#8a8884', fontVariantNumeric: 'tabular-nums' }}>{progress}%</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(55,53,47,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', background: '#2383e2', borderRadius: 99,
                                width: `${progress}%`, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
                                position: 'relative', overflow: 'hidden',
                            }}>
                                <div style={{
                                    position: 'absolute', top: 0, left: '-60%', width: '50%', height: '100%',
                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
                                    animation: 're-sheen 1.6s ease-in-out infinite',
                                }} />
                            </div>
                        </div>
                    </div>
                    <div style={{
                        fontSize: 14, fontWeight: 600, color: '#37352f', height: 22,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
                    }}>
                        <span>{displayText}</span>
                        <span style={{
                            display: 'inline-block', width: 2, height: 16, background: '#2383e2',
                            borderRadius: 1, marginLeft: 1, verticalAlign: 'middle',
                            animation: 're-blink 0.8s step-end infinite',
                        }} />
                    </div>
                </div>
            </div>
        </>
    );
}
