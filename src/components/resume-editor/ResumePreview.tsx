/**
 * ResumePreview - Canvas component for resume display
 * Features: Simple iframe rendering, no controls (zoom/pan handled by parent)
 */

'use client';

import { useEffect, useRef } from 'react';
import type { TailoredResumeData } from '@/types';
import { renderResumeHtml } from '@/lib/resume-templates';

/** A4 at 96 CSS px/in — keep in sync with FullPageResumeEditor RESUME_* constants */
const A4_PREVIEW_PX_W = 794;
const A4_PREVIEW_PX_H = 1123;

interface ResumePreviewProps {
    resume: TailoredResumeData;
    onDownloadPdf?: () => void;
    isDownloading?: boolean;
    /** Scale content down so the entire resume fits in one A4 viewport; no outer scroll. */
    fitA4SinglePage?: boolean;
}

export function ResumePreview({ resume, onDownloadPdf, isDownloading, fitA4SinglePage }: ResumePreviewProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Update iframe content when resume changes
    useEffect(() => {
        if (!iframeRef.current) return;

        const html = renderResumeHtml(resume);
        const doc = iframeRef.current.contentDocument;

        if (doc) {
            const scrollbarHideCSS = `
                <style>
                    html, body {
                        overflow: hidden !important;
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                    }
                    html::-webkit-scrollbar, body::-webkit-scrollbar {
                        display: none !important;
                        width: 0 !important;
                        height: 0 !important;
                    }
                    #resume-scale-root {
                        box-sizing: border-box;
                    }
                </style>
            `;
            const htmlWithScrollbarHide = html.replace('</head>', `${scrollbarHideCSS}</head>`);
            
            doc.open();
            doc.write(htmlWithScrollbarHide);
            doc.close();

            const applyFitScale = () => {
                if (!iframeRef.current?.contentWindow) return;
                const win = iframeRef.current.contentWindow;
                const b = win.document.body;
                if (!b) return;

                let root = win.document.getElementById('resume-scale-root') as HTMLDivElement | null;
                if (!root) {
                    root = win.document.createElement('div');
                    root.id = 'resume-scale-root';
                    while (b.firstChild) {
                        root.appendChild(b.firstChild);
                    }
                    b.appendChild(root);
                }

                const h = Math.max(root.scrollHeight, root.offsetHeight);
                const w = Math.max(root.scrollWidth, root.offsetWidth, 1);
                const scale = Math.min(1, (A4_PREVIEW_PX_H - 2) / h, (A4_PREVIEW_PX_W - 2) / w);
                root.style.transformOrigin = 'top center';
                root.style.transform = scale < 0.999 ? `scale(${scale})` : 'none';
                root.style.width = '100%';

                iframeRef.current.style.height = `${A4_PREVIEW_PX_H}px`;
                iframeRef.current.style.maxHeight = `${A4_PREVIEW_PX_H}px`;
                iframeRef.current.style.overflow = 'hidden';
            };

            // Set height after content is written and rendered
            const updateHeight = () => {
                if (!iframeRef.current?.contentWindow) return;
                const body = iframeRef.current.contentWindow.document.body;
                const htmlElement = iframeRef.current.contentWindow.document.documentElement;

                if (fitA4SinglePage) {
                    applyFitScale();
                    return;
                }

                const height = Math.max(
                    body.scrollHeight,
                    body.offsetHeight,
                    htmlElement.clientHeight,
                    htmlElement.scrollHeight,
                    htmlElement.offsetHeight
                );
                iframeRef.current.style.height = `${height}px`;
                iframeRef.current.style.maxHeight = 'none';
                iframeRef.current.style.overflow = 'hidden';
            };

            updateHeight();
            iframeRef.current.onload = updateHeight;
            setTimeout(updateHeight, 200);
            setTimeout(updateHeight, 500);
        }
    }, [resume, fitA4SinglePage]);

    return (
        <iframe
            ref={iframeRef}
            title="Resume Preview"
            style={{
                width: '100%',
                background: '#fff',
                border: 'none',
                display: 'block',
                overflow: 'hidden'
            }}
        />
    );
}

/**
 * Get resume preview HTML for external rendering
 */
export function getResumePreviewHtml(resume: TailoredResumeData): string {
    return renderResumeHtml(resume);
}
