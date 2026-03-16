'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, Home, Download, Save, Loader2, FileText, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, GripHorizontal } from 'lucide-react';
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
    initialResumeData,
    initialKeywords
}: FullPageResumeEditorProps) {
    const [resume, setResume] = useState<TailoredResumeData>(initialResumeData);
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

    // History state
    const [history, setHistory] = useState<TailoredResumeData[]>([initialResumeData]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const isUndoingRedoingRef = useRef(false);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    const undo = useCallback(() => {
        if (canUndo) {
            isUndoingRedoingRef.current = true;
            const prev = history[historyIndex - 1];
            setHistoryIndex(historyIndex - 1);
            setResume(prev);
            setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
        }
    }, [canUndo, history, historyIndex]);

    const redo = useCallback(() => {
        if (canRedo) {
            isUndoingRedoingRef.current = true;
            const next = history[historyIndex + 1];
            setHistoryIndex(historyIndex + 1);
            setResume(next);
            setTimeout(() => { isUndoingRedoingRef.current = false; }, 50);
        }
    }, [canRedo, history, historyIndex]);

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

    // Debounced preview update
    const updatePreview = useCallback((newResume: TailoredResumeData) => {
        setIsPreviewUpdating(true);
        
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        
        debounceTimerRef.current = setTimeout(() => {
            setResume(newResume);
            setIsPreviewUpdating(false);

            // Add to history
            if (!isUndoingRedoingRef.current) {
                setHistory(prev => {
                    const newHistory = prev.slice(0, historyIndex + 1);
                    return [...newHistory, newResume];
                });
                setHistoryIndex(prev => prev + 1);
            }
        }, 300);
    }, [historyIndex]);

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
                    
                    <span style={{ color: '#cbd5e1', fontSize: '16px' }}>/</span>

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
                            padding: '8px 14px',
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
                        {isDownloading ? 'Generating...' : 'Export'}
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
                                {keywords && (keywords.missing.length > 0 || (keywords.autoAdded && keywords.autoAdded.length > 0)) && (
                                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
                                        {keywords.autoAdded && keywords.autoAdded.length > 0 && (
                                            <div style={{ marginBottom: '8px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Added Keywords</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
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
                                                                padding: '2px 8px',
                                                                background: '#ecfdf5',
                                                                color: '#059669',
                                                                border: '1px solid #a7f3d0',
                                                                borderRadius: '4px',
                                                                fontSize: '10px',
                                                                fontWeight: 500,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            {k}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        
                                        {keywords.missing.length > 0 && (
                                            <div>
                                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Missing</span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                                                    {keywords.missing.slice(0, 8).map((k, i) => (
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
                                                                padding: '2px 8px',
                                                                background: '#f1f5f9',
                                                                color: '#64748b',
                                                                border: '1px solid #e2e8f0',
                                                                borderRadius: '4px',
                                                                fontSize: '10px',
                                                                fontWeight: 500,
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            + {k}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                                
                                <ContentPanel
                                    resume={resume}
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
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
                                </div>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Design</span>
                            </div>
                            
                            {/* Scrollable Content */}
                            <div 
                                className="design-panel-scroll"
                                style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}
                            >
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
        </div>
    );
}
