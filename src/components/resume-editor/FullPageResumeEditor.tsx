'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Home, Download, Save, Loader2, FileText, Palette, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripHorizontal } from 'lucide-react';
import type { TailoredResumeData, KeywordAnalysis } from '@/types';
import { ContentPanel } from '@/components/resume-editor/ContentPanel';
import { DesignPanel } from '@/components/resume-editor/DesignPanel';
import { ResumePreview } from '@/components/resume-editor/ResumePreview';
import { renderResumeHtml, upgradeLegacyTimesFontInResume } from '@/lib/resume-templates';
import { buildTailoredResumeSavePayload } from '@/lib/tailored-resume-bundle';
import { generatePDFFromServerless } from '@/lib/client-pdf';
import { AtsScoreWidget } from '@/components/resume-editor/AtsScoreWidget';
import { HoneypotAlertModal } from '@/components/resume-editor/HoneypotAlertModal';
import type { HoneypotReport } from '@/types';

const GOOGLE_FONTS_MAP: Record<string, string> = {
    "'Inter', 'Segoe UI', sans-serif": 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    "'Roboto', sans-serif": 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
    "'Open Sans', sans-serif": 'https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;600;700&display=swap',
};

function injectFontsForPdf(html: string, fontFamily: string): string {
    const url = GOOGLE_FONTS_MAP[fontFamily];
    if (!url) return html; // system font stack (Georgia, Arial, Helvetica, etc.) — no injection needed
    const linkTag = `<link rel="stylesheet" href="${url}">`;
    return html.replace('</head>', `${linkTag}</head>`);
}


interface FullPageResumeEditorProps {
    jobId: string;
    jobTitle: string;
    company: string | null;
    initialFull: TailoredResumeData;
    /** When null, only the full resume exists (legacy saves). */
    initialOnePage: TailoredResumeData | null;
    initialKeywords: KeywordAnalysis | null;
    jobDescription?: string | null;
}

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.0;
const MIN_PANEL_WIDTH = 240;
const MAX_PANEL_WIDTH = 420;
const COLLAPSE_THRESHOLD = 100;
const RESUME_WIDTH = 794; // A4 width at 96 DPI
const RESUME_HEIGHT = 1123; // A4 height at 96 DPI

export function FullPageResumeEditor({
    jobId,
    jobTitle,
    company,
    initialFull,
    initialOnePage,
    initialKeywords,
    jobDescription,
}: FullPageResumeEditorProps) {
    const seedFull = upgradeLegacyTimesFontInResume(initialFull);
    const hasOnePage = initialOnePage != null;
    const seedOne = hasOnePage && initialOnePage ? upgradeLegacyTimesFontInResume(initialOnePage) : null;

    const [variant, setVariant] = useState<'full' | 'onePage'>('full');
    const [editorFull, setEditorFull] = useState(seedFull);
    const [resumeFull, setResumeFull] = useState(seedFull);
    const [editorOnePage, setEditorOnePage] = useState<TailoredResumeData | null>(seedOne);
    const [resumeOnePage, setResumeOnePage] = useState<TailoredResumeData | null>(seedOne);

    const editorResume = variant === 'onePage' && hasOnePage && editorOnePage ? editorOnePage : editorFull;
    const resume = variant === 'onePage' && hasOnePage && resumeOnePage ? resumeOnePage : resumeFull;
    const [keywords, setKeywords] = useState<KeywordAnalysis | null>(initialKeywords);
    const [isSaving, setIsSaving] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
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
    const [showZoomIndicator, setShowZoomIndicator] = useState(false);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
    
    // Resume View state
    const [isFullView, setIsFullView] = useState(false);
    const [paperHeight, setPaperHeight] = useState(RESUME_HEIGHT);
    
    const canvasRef = useRef<HTMLDivElement>(null);
    const transformLayerRef = useRef<HTMLDivElement>(null);
    const iframeContentHeightRef = useRef(RESUME_HEIGHT);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const zoomTimerRef = useRef<NodeJS.Timeout | null>(null);
    const isInitializedRef = useRef(false);
    const variantRef = useRef(variant);
    const hasOnePageRef = useRef(hasOnePage);
    useEffect(() => {
        variantRef.current = variant;
    }, [variant]);
    useEffect(() => {
        hasOnePageRef.current = hasOnePage;
    }, [hasOnePage]);

    // Honeypot modal state — shown once per mount if confidence >= 0.9
    const honeypotReport = initialKeywords?.honeypot ?? null;
    const [honeypotModalOpen, setHoneypotModalOpen] = useState<boolean>(
        !!(honeypotReport?.detected && honeypotReport.confidence >= 0.9)
    );

    // History state (per variant when one-page exists)
    const [historyFull, setHistoryFull] = useState<TailoredResumeData[]>([seedFull]);
    const [historyIndexFull, setHistoryIndexFull] = useState(0);
    const [historyOnePage, setHistoryOnePage] = useState<TailoredResumeData[]>(() => (seedOne ? [seedOne] : []));
    const [historyIndexOnePage, setHistoryIndexOnePage] = useState(0);
    const isUndoingRedoingRef = useRef(false);
    const historyIndexFullRef = useRef(0);
    const historyIndexOnePageRef = useRef(0);
    useEffect(() => {
        historyIndexFullRef.current = historyIndexFull;
    }, [historyIndexFull]);
    useEffect(() => {
        historyIndexOnePageRef.current = historyIndexOnePage;
    }, [historyIndexOnePage]);

    const onePageBranch = variant === 'onePage' && hasOnePage;
    const activeHistory = onePageBranch ? historyOnePage : historyFull;
    const activeHistoryIndex = onePageBranch ? historyIndexOnePage : historyIndexFull;

    const canUndo = activeHistoryIndex > 0;
    const canRedo = activeHistoryIndex < activeHistory.length - 1;

    const undo = useCallback(() => {
        if (!canUndo) return;
        isUndoingRedoingRef.current = true;
        if (variantRef.current === 'onePage' && hasOnePageRef.current) {
            const prev = historyOnePage[historyIndexOnePage - 1];
            setHistoryIndexOnePage(historyIndexOnePage - 1);
            setResumeOnePage(prev);
            setEditorOnePage(prev);
        } else {
            const prev = historyFull[historyIndexFull - 1];
            setHistoryIndexFull(historyIndexFull - 1);
            setResumeFull(prev);
            setEditorFull(prev);
        }
        setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
    }, [canUndo, historyFull, historyIndexOnePage, historyIndexFull, historyOnePage]);

    const redo = useCallback(() => {
        if (!canRedo) return;
        isUndoingRedoingRef.current = true;
        if (variantRef.current === 'onePage' && hasOnePageRef.current) {
            const next = historyOnePage[historyIndexOnePage + 1];
            setHistoryIndexOnePage(historyIndexOnePage + 1);
            setResumeOnePage(next);
            setEditorOnePage(next);
        } else {
            const next = historyFull[historyIndexFull + 1];
            setHistoryIndexFull(historyIndexFull + 1);
            setResumeFull(next);
            setEditorFull(next);
        }
        setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
    }, [canRedo, historyFull, historyIndexFull, historyIndexOnePage, historyOnePage]);

    const calculateFitZoom = useCallback(() => {
        if (!canvasRef.current || canvasSize.width === 0) return 0.7;
        
        const padding = 40; // Reduced padding for better fit
        const availableWidth = canvasSize.width - padding * 2;
        const availableHeight = canvasSize.height - padding * 2;
        
        const fitZoom = Math.min(
            availableWidth / RESUME_WIDTH,
            availableHeight / RESUME_HEIGHT
        );
        
        return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom));
    }, [canvasSize]);

    const handleCenterView = useCallback(() => {
        setIsFullView(false);
        const fitZoom = calculateFitZoom();
        setZoom(fitZoom);
        setOffset({ x: 0, y: 0 });
    }, [calculateFitZoom]);

    const zoomIn = useCallback(() => {
        setZoom(prev => Math.min(MAX_ZOOM, prev + 0.1));
    }, []);

    const zoomOut = useCallback(() => {
        setZoom(prev => Math.max(MIN_ZOOM, prev - 0.1));
    }, []);

    const leftWidth = leftCollapsed ? 0 : leftPanelWidth;
    const rightWidth = rightCollapsed ? 0 : rightPanelWidth;

    useEffect(() => {
        const updateCanvasSize = () => {
            if (canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                setCanvasSize({ width: rect.width, height: rect.height });
            }
        };
        
        updateCanvasSize();
        window.addEventListener('resize', updateCanvasSize);
        return () => window.removeEventListener('resize', updateCanvasSize);
    }, []);

    // Use effect to sync paperHeight with isFullView
    useEffect(() => {
        if (isFullView) {
            setPaperHeight(iframeContentHeightRef.current);
        } else {
            setPaperHeight(RESUME_HEIGHT);
        }
    }, [isFullView]);

    // Poll iframe content height to keep iframeContentHeightRef updated
    useEffect(() => {
        const interval = setInterval(() => {
            const iframe = document.querySelector('.resume-document iframe') as HTMLIFrameElement;
            if (iframe && iframe.contentWindow) {
                const height = iframe.contentWindow.document.body.scrollHeight;
                if (height > 0) {
                    iframeContentHeightRef.current = height;
                    // If already in full view, keep height synced
                    if (isFullView) {
                        setPaperHeight(height);
                    }
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isFullView]);


    useEffect(() => {
        if (!isInitializedRef.current && canvasSize.width > 0) {
            isInitializedRef.current = true;
            const fitZoom = calculateFitZoom();
            setZoom(fitZoom);
            setOffset({ x: 0, y: 0 });
        }
    }, [canvasSize, calculateFitZoom]);

    // Handle mouse wheel zoom on the canvas only (when NOT over scrollable content)
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => {
            const path = e.composedPath?.() || [];
            
            // Check if wheel is over scrollable content areas - allow native scroll
            const isOverContent = path.some((el: EventTarget) => 
                el && (el as Element).classList?.contains?.('content-panel')
            );
            const isOverDesign = path.some((el: EventTarget) => 
                el && (el as Element).classList?.contains?.('design-panel')
            );
            const isOverResume = path.some((el: EventTarget) => 
                el && (el as Element).classList?.contains?.('resume-document')
            );
            
            // If over any scrollable content, allow native scroll
            if (isOverContent || isOverDesign || isOverResume) {
                return;
            }
            
            // Otherwise, handle zoom
            e.preventDefault();
            e.stopPropagation();
            
            const delta = -e.deltaY * 0.0012;
            setZoom(prev => {
                const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
                return newZoom;
            });
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

    // Handle left resize
    const handleLeftResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizingLeft(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    }, []);

    const handleRightResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizingRight(true);
        setDragStart({ x: e.clientX, y: e.clientY });
    }, []);

    useEffect(() => {
        const handleResizeMove = (e: MouseEvent) => {
            if (isResizingLeft) {
                const deltaX = e.clientX - dragStart.x;
                const newWidth = leftPanelWidth + deltaX;
                if (newWidth <= COLLAPSE_THRESHOLD) {
                    setLeftCollapsed(true);
                    setLeftPanelWidth(MIN_PANEL_WIDTH);
                } else {
                    setLeftCollapsed(false);
                    setLeftPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
                }
                setDragStart({ x: e.clientX, y: e.clientY });
            }
            if (isResizingRight) {
                const deltaX = dragStart.x - e.clientX;
                const newWidth = rightPanelWidth + deltaX;
                if (newWidth <= COLLAPSE_THRESHOLD) {
                    setRightCollapsed(true);
                    setRightPanelWidth(MIN_PANEL_WIDTH);
                } else {
                    setRightCollapsed(false);
                    setRightPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, newWidth)));
                }
                setDragStart({ x: e.clientX, y: e.clientY });
            }
        };

        const handleResizeEnd = () => {
            setIsResizingLeft(false);
            setIsResizingRight(false);
        };

        if (isResizingLeft || isResizingRight) {
            window.addEventListener('mousemove', handleResizeMove);
            window.addEventListener('mouseup', handleResizeEnd);
        }

        return () => {
            window.removeEventListener('mousemove', handleResizeMove);
            window.removeEventListener('mouseup', handleResizeEnd);
        };
    }, [isResizingLeft, isResizingRight, dragStart, leftPanelWidth, rightPanelWidth]);

    // Handle drag start
    const handleDragStart = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        if (isResizingLeft || isResizingRight) return;
        setIsDragging(true);
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    }, [offset, isResizingLeft, isResizingRight]);

    // Handle drag
    const handleDrag = useCallback((e: React.MouseEvent) => {
        if (!isDragging) return;
        setOffset({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        });
    }, [isDragging, dragStart]);

    // Handle drag end
    const handleDragEnd = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Cleanup drag events on unmount
    useEffect(() => {
        const handleGlobalMouseUp = () => setIsDragging(false);
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

    // Debounced preview update (active variant only)
    const updatePreview = useCallback((newResume: TailoredResumeData) => {
        const oneBranch = variantRef.current === 'onePage' && hasOnePageRef.current;
        if (oneBranch) {
            setEditorOnePage(newResume);
        } else {
            setEditorFull(newResume);
        }
        setIsPreviewUpdating(true);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            const one = variantRef.current === 'onePage' && hasOnePageRef.current;
            if (one) {
                setResumeOnePage(newResume);
            } else {
                setResumeFull(newResume);
            }
            setIsPreviewUpdating(false);

            if (!isUndoingRedoingRef.current) {
                if (one) {
                    setHistoryOnePage(prev => {
                        const idx = historyIndexOnePageRef.current;
                        return [...prev.slice(0, idx + 1), newResume];
                    });
                    setHistoryIndexOnePage((i) => i + 1);
                } else {
                    setHistoryFull(prev => {
                        const idx = historyIndexFullRef.current;
                        return [...prev.slice(0, idx + 1), newResume];
                    });
                    setHistoryIndexFull((i) => i + 1);
                }
            }
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
                    resumeData: hasOnePage && editorOnePage
                        ? buildTailoredResumeSavePayload(editorFull, editorOnePage)
                        : editorFull,
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
        const companyStr = company ? `${company.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
        const downloadFilename = `Tailored_Resume_${companyStr}${jobId.substring(0, 4)}.pdf`;
        const baseHtml = renderResumeHtml(editorResume);
        const html = injectFontsForPdf(baseHtml, editorResume.design.fontFamily);

        try {
            await generatePDFFromServerless(
                html, 
                downloadFilename, 
                jobTitle, 
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

    return (
        <div 
            style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100vh', 
                width: '100%', 
                overflow: 'hidden', 
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Inter, sans-serif',
                position: 'relative'
            }}
        >
            {/* Header - Fixed Top */}
            <header style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '56px',
                background: '#ffffff',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                zIndex: 100,
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
            }}>
                {/* Left Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Panel Toggle */}
                    <button
                        onClick={() => setLeftCollapsed(!leftCollapsed)}
                        title={leftCollapsed ? 'Show Content Panel' : 'Hide Content Panel'}
                        aria-label={leftCollapsed ? 'Show Content Panel' : 'Hide Content Panel'}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#f1f5f9',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        {leftCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                    </button>
                    
                </div>

                {/* Center: Document Name */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    position: 'absolute',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap'
                }}>
                    <Link href="/" style={{
                        display: 'flex',
                        alignItems: 'center',
                        color: '#64748b',
                        transition: 'color 0.15s ease'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = '#111827'}
                    onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                    title="Home"
                    >
                        <Home size={18} />
                    </Link>
                    
                    <span style={{ color: '#cbd5e1', fontSize: '14px' }}>/</span>

                    <span style={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#1e293b'
                    }}>
                        {jobTitle} {company ? `at ${company}` : ''}
                    </span>
                </div>

                {/* Right Section: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            background: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#475569',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.7 : 1,
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { if (!isSaving) { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#d1d5db'; } }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#ffffff'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
                    >
                        {isSaving ? <Loader2 size={14} className="animate-spin" style={{ color: '#2563eb' }} /> : (isSaved ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg></> : <Save size={14} />)} 
                        {isSaving ? 'Saving...' : (isSaved ? 'Saved!' : 'Save')}
                    </button>
                    <button 
                        onClick={handleDownloadPdf} 
                        disabled={isDownloading}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 16px',
                            background: 'linear-gradient(90deg, #2563eb, #1d4ed8)',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#ffffff',
                            cursor: isDownloading ? 'not-allowed' : 'pointer',
                            opacity: isDownloading ? 0.7 : 1,
                            transition: 'all 0.15s ease',
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
                        }}
                    >
                        {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} 
                        {isDownloading ? 'Downloading...' : 'Download'}
                    </button>
                    
                    <div style={{ width: '1px', height: '24px', background: '#e5e7eb', margin: '0 4px' }} />
                    
                    {/* Design Panel Toggle */}
                    <button
                        onClick={() => setRightCollapsed(!rightCollapsed)}
                        title={rightCollapsed ? 'Show Design Panel' : 'Hide Design Panel'}
                        aria-label={rightCollapsed ? 'Show Design Panel' : 'Hide Design Panel'}
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#f1f5f9',
                            color: '#64748b',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#334155'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#64748b'; }}
                    >
                        {rightCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div style={{ display: 'flex', height: '100%', paddingTop: '56px', position: 'relative', overflow: 'hidden' }}>
                
                {/* Left Resize Handle */}
                {!leftCollapsed && (
                    <div
                        onMouseDown={handleLeftResizeStart}
                        role="separator"
                        aria-label="Resize content panel"
                        aria-valuenow={leftPanelWidth}
                        aria-valuemin={MIN_PANEL_WIDTH}
                        aria-valuemax={MAX_PANEL_WIDTH}
                        title="Drag to resize"
                        style={{
                            position: 'fixed',
                            left: `${leftWidth}px`,
                            top: '56px',
                            bottom: 0,
                            width: '10px',
                            cursor: 'col-resize',
                            zIndex: 60,
                            background: isResizingLeft ? '#2563eb' : 'transparent',
                            transition: 'background 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseLeave={(e) => e.currentTarget.style.background = isResizingLeft ? '#2563eb' : 'transparent'}
                    >
                        <GripHorizontal size={14} color="#94a3b8" />
                    </div>
                )}

                {/* Resume Canvas - Full Page Background */}
                <div 
                    ref={canvasRef}
                    onMouseDown={handleDragStart}
                    onMouseMove={handleDrag}
                    onMouseUp={handleDragEnd}
                    onMouseLeave={handleDragEnd}
                    style={{
                        flex: 1,
                        minHeight: 0,
                        background: '#edf2f7',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden', // Remove scrollbars from container
                        cursor: isDragging ? 'grabbing' : 'grab',
                        position: 'relative',
                        marginLeft: `${leftWidth}px`,
                        marginRight: `${rightWidth}px`,
                        transition: isResizingLeft || isResizingRight ? 'none' : 'margin 0.2s ease'
                    }}
                >
                    {/* Zoom indicator - shows briefly on zoom change */}
                    {showZoomIndicator && (
                        <div style={{
                            position: 'fixed',
                            bottom: '20px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.75)',
                            color: '#fff',
                            padding: '6px 14px',
                            borderRadius: '20px',
                            fontSize: '12px',
                            fontWeight: 600,
                            zIndex: 50,
                            pointerEvents: 'none',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}>
                            {Math.round(zoom * 100)}%
                        </div>
                    )}

                    {/* Transform Layer */}
                    <div 
                        ref={transformLayerRef}
                        style={{
                            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                            transformOrigin: 'center center',
                            transition: isDragging ? 'none' : 'transform 0.1s ease',
                            minHeight: 0,
                            display: 'flex',
                            alignItems: 'flex-start'
                        }}
                    >
                        {/* Resume Document */}
                        <div 
                            style={{
                                boxShadow: '0 10px 30px rgba(8,10,14,0.08)',
                                borderRadius: '4px',
                                background: '#fff',
                                width: RESUME_WIDTH,
                                height: paperHeight,
                                minWidth: RESUME_WIDTH,
                                overflowX: 'hidden',
                                boxSizing: 'border-box',
                                position: 'relative',
                                transition: 'height 0.35s cubic-bezier(0.4, 0, 0.2, 1)'
                            }}
                            className="resume-document"
                        >
                            <ResumePreview resume={resume} />
                        </div>
                    </div>

                    {/* Floating Toolbar */}
                    <div style={{
                        position: 'absolute',
                        bottom: '30px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#1a1a1a',
                        padding: '6px 12px',
                        borderRadius: '100px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                        zIndex: 100,
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <button 
                            onClick={undo}
                            disabled={!canUndo}
                            style={{ background: 'transparent', border: 'none', padding: '8px', color: canUndo ? '#fff' : '#666', cursor: canUndo ? 'pointer' : 'default', display: 'flex' }}
                            title="Undo (Ctrl+Z)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
                        </button>
                        <button 
                            onClick={redo}
                            disabled={!canRedo}
                            style={{ background: 'transparent', border: 'none', padding: '8px', color: canRedo ? '#fff' : '#666', cursor: canRedo ? 'pointer' : 'default', display: 'flex' }}
                            title="Redo (Ctrl+Y)"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13"/></svg>
                        </button>
                        
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />
                        
                        <button 
                            onClick={zoomOut}
                            style={{ background: 'transparent', border: 'none', padding: '8px', color: '#fff', cursor: 'pointer', display: 'flex' }}
                            title="Zoom Out"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </button>
                        <div style={{ color: '#fff', fontSize: '12px', fontWeight: 600, width: '40px', textAlign: 'center' }}>
                            {Math.round(zoom * 100)}%
                        </div>
                        <button 
                            onClick={zoomIn}
                            style={{ background: 'transparent', border: 'none', padding: '8px', color: '#fff', cursor: 'pointer', display: 'flex' }}
                            title="Zoom In"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                        </button>
                        
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />
                        
                        <button 
                            onClick={handleCenterView}
                            style={{ background: 'transparent', border: 'none', padding: '8px', color: '#fff', cursor: 'pointer', display: 'flex' }}
                            title="Center View"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/><circle cx="12" cy="12" r="3"/></svg>
                        </button>
                        
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />

                        <button 
                            onClick={() => setIsFullView(!isFullView)}
                            style={{ 
                                background: isFullView ? 'rgba(59, 130, 246, 0.5)' : 'transparent', 
                                border: 'none', 
                                padding: '8px', 
                                color: '#fff', 
                                cursor: 'pointer', 
                                display: 'flex',
                                borderRadius: '4px'
                            }}
                            title={isFullView ? "Standard A4 View" : "View Full Resume"}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {isFullView ? (
                                    <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5"/>
                                ) : (
                                    <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5"/>
                                )}
                            </svg>
                        </button>
                        
                        <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.1)', margin: '0 8px' }} />
                        
                        <button 
                            onClick={handleDownloadPdf}
                            style={{ background: 'transparent', border: 'none', padding: '8px', color: '#fff', cursor: 'pointer', display: 'flex' }}
                            title="Export to PDF"
                        >
                            <Download size={18} />
                        </button>
                    </div>
                </div>

                {/* Right Resize Handle */}
                {!rightCollapsed && (
                    <div
                        onMouseDown={handleRightResizeStart}
                        role="separator"
                        aria-label="Resize design panel"
                        aria-valuenow={rightPanelWidth}
                        aria-valuemin={MIN_PANEL_WIDTH}
                        aria-valuemax={MAX_PANEL_WIDTH}
                        title="Drag to resize"
                        style={{
                            position: 'fixed',
                            right: `${rightWidth}px`,
                            top: '56px',
                            bottom: 0,
                            width: '10px',
                            cursor: 'col-resize',
                            zIndex: 60,
                            background: isResizingRight ? '#2563eb' : 'transparent',
                            transition: 'background 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#cbd5e1'}
                        onMouseLeave={(e) => e.currentTarget.style.background = isResizingRight ? '#2563eb' : 'transparent'}
                    >
                        <GripHorizontal size={14} color="#94a3b8" />
                    </div>
                )}

                {/* Content Panel - Floating Left */}
                <div 
                    className="content-panel"
                    style={{
                        position: 'fixed',
                        left: 0,
                        top: '56px',
                        bottom: 0,
                        width: leftCollapsed ? 0 : `${leftPanelWidth}px`,
                        background: '#ffffff',
                        borderRight: leftCollapsed ? 'none' : '1px solid #e5e7eb',
                        overflow: 'hidden',
                        transition: 'width 0.25s ease, border 0.25s ease',
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {!leftCollapsed && (
                        <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {/* Panel Header */}
                            <div style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexShrink: 0
                            }}>
                                <div style={{ 
                                    width: '28px', 
                                    height: '28px', 
                                    borderRadius: '6px', 
                                    background: '#e8f4ff', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    color: '#2563eb'
                                }}>
                                    <FileText size={16} />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Content</span>
                            </div>
                            
                            {/* Scrollable Content */}
                            <div 
                                className="content-panel-scroll"
                                style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
                            >
                                {/* Moved Keywords Optimization Header Inside Scroll Area */}
                                {keywords && (keywords.missing.length > 0 || (keywords.autoAdded && keywords.autoAdded.length > 0) || keywords.atsScore) && (
                                    <AtsScoreWidget
                                        keywords={keywords}
                                        resume={resume}
                                        editorResume={editorResume}
                                        updatePreview={updatePreview}
                                        setKeywords={setKeywords}
                                    />
                                )}
                                
                                <ContentPanel
                                    resume={editorResume}
                                    onChange={(data) => updatePreview({ ...data, updatedAt: new Date().toISOString() })}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Design Panel - Floating Right */}
                <div 
                    className="design-panel"
                    style={{
                        position: 'fixed',
                        right: 0,
                        top: '56px',
                        bottom: 0,
                        width: rightCollapsed ? 0 : `${rightPanelWidth}px`,
                        background: '#ffffff',
                        borderLeft: rightCollapsed ? 'none' : '1px solid #e5e7eb',
                        overflow: 'hidden',
                        transition: 'width 0.25s ease, border 0.25s ease',
                        zIndex: 50,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    {!rightCollapsed && (
                        <div style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            {/* Panel Header */}
                            <div style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                flexShrink: 0
                            }}>
                                <div style={{ 
                                    width: '28px', 
                                    height: '28px', 
                                    borderRadius: '6px', 
                                    background: '#e8f4ff', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    color: '#2563eb'
                                }}>
                                    <Palette size={16} />
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Design</span>
                            </div>
                            
                            {/* Scrollable Content */}
                            <div 
                                className="design-panel-scroll"
                                style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
                            >
                                <DesignPanel
                                    design={editorResume.design}
                                    onChange={(design) => updatePreview({ ...editorResume, design, updatedAt: new Date().toISOString() })}
                                    onReset={() => updatePreview({
                                        ...editorResume,
                                        design: {
                                            template: 'classic',
                                            fontFamily: "'Roboto', sans-serif",
                                            fontSize: 12,
                                            accentColor: '#1a365d',
                                            margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 }
                                        },
                                        updatedAt: new Date().toISOString()
                                    })}
                                    onePageToggle={hasOnePage ? {
                                        active: variant === 'onePage',
                                        onChange: (next) => setVariant(next ? 'onePage' : 'full'),
                                    } : undefined}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                * {
                    box-sizing: border-box;
                }
                body {
                    margin: 0;
                    padding: 0;
                    overflow: hidden;
                }
                .resume-preview-wrapper {
                    overflow: hidden;
                }
                .resume-document {
                    aspect-ratio: 210 / 297;
                    overflow-y: auto;
                    overflow-x: hidden;
                    -webkit-overflow-scrolling: touch;
                    width: 794px;
                    max-width: 100%;
                    box-sizing: border-box;
                }
                .resume-document iframe {
                    display: block;
                    border: none;
                    width: 100%;
                    height: auto;
                }
                .content-panel .content-panel-scroll,
                .design-panel .design-panel-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 transparent;
                }
                .content-panel .content-panel-scroll::-webkit-scrollbar,
                .design-panel .design-panel-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                .content-panel .content-panel-scroll::-webkit-scrollbar-track,
                .design-panel .design-panel-scroll::-webkit-scrollbar-track {
                    background: transparent;
                }
                .content-panel .content-panel-scroll::-webkit-scrollbar-thumb,
                .design-panel .design-panel-scroll::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 3px;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                }
                .content-panel:hover .content-panel-scroll::-webkit-scrollbar-thumb,
                .design-panel:hover .design-panel-scroll::-webkit-scrollbar-thumb,
                .content-panel:focus-within .content-panel-scroll::-webkit-scrollbar-thumb,
                .design-panel:focus-within .design-panel-scroll::-webkit-scrollbar-thumb {
                    opacity: 1;
                }
                .content-panel:hover .content-panel-scroll,
                .design-panel:hover .content-panel-scroll,
                .content-panel:focus-within .content-panel-scroll,
                .design-panel:focus-within .design-panel-scroll {
                    scrollbar-color: #cbd5e1 #f1f5f9;
                }
            `}</style>

            {/* Honeypot Alert Modal */}
            {honeypotReport && (
                <HoneypotAlertModal
                    open={honeypotModalOpen}
                    report={honeypotReport as HoneypotReport}
                    onClose={() => setHoneypotModalOpen(false)}
                />
            )}
        </div>
    );
}
