/**
 * ResumePreview - Canvas component for resume display
 * Features: Simple iframe rendering, no controls (zoom/pan handled by parent)
 */

'use client';

import { useEffect, useRef } from 'react';
import type { TailoredResumeData } from '@/types';
import { renderResumeHtml } from '@/lib/resume-templates';

interface ResumePreviewProps {
    resume: TailoredResumeData;
    onDownloadPdf?: () => void;
    isDownloading?: boolean;
}

export function ResumePreview({ resume, onDownloadPdf, isDownloading }: ResumePreviewProps) {
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
                </style>
            `;
            const htmlWithScrollbarHide = html.replace('</head>', `${scrollbarHideCSS}</head>`);
            
            doc.open();
            doc.write(htmlWithScrollbarHide);
            doc.close();

            // Set height after content is written and rendered
            const updateHeight = () => {
                if (iframeRef.current && iframeRef.current.contentWindow) {
                    const body = iframeRef.current.contentWindow.document.body;
                    const htmlElement = iframeRef.current.contentWindow.document.documentElement;
                    const height = Math.max(
                        body.scrollHeight,
                        body.offsetHeight,
                        htmlElement.clientHeight,
                        htmlElement.scrollHeight,
                        htmlElement.offsetHeight
                    );
                    iframeRef.current.style.height = `${height}px`;
                }
            };

            updateHeight();
            iframeRef.current.onload = updateHeight;
            setTimeout(updateHeight, 200);
        }
    }, [resume]);

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
