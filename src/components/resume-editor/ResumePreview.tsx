/**
 * ResumePreview - Right panel showing live PDF preview
 * Features: WYSIWYG rendering, real-time updates
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import type { TailoredResumeData } from '@/types';
import { renderResumeHtml, CLASSIC_TEMPLATE_CSS, MODERN_TEMPLATE_CSS } from '@/lib/resume-templates';

interface ResumePreviewProps {
    resume: TailoredResumeData;
    onDownloadPdf: () => void;
    isDownloading?: boolean;
}

export function ResumePreview({ resume, onDownloadPdf, isDownloading }: ResumePreviewProps) {
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const [scale, setScale] = useState(0.7);

    // Update iframe content when resume changes
    useEffect(() => {
        if (!iframeRef.current) return;

        const html = renderResumeHtml(resume);
        const doc = iframeRef.current.contentDocument;

        if (doc) {
            doc.open();
            doc.write(html);
            doc.close();
        }
    }, [resume]);

    return (
        <div className="resume-preview" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--background)',
            overflow: 'hidden',
        }}>
            {/* Preview Controls */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 16px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Zoom:</span>
                    <button
                        onClick={() => setScale(Math.max(0.4, scale - 0.1))}
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                        −
                    </button>
                    <span style={{ fontSize: '12px', minWidth: '40px', textAlign: 'center' }}>
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={() => setScale(Math.min(1.2, scale + 0.1))}
                        className="btn btn-ghost"
                        style={{ padding: '4px 8px', fontSize: '12px' }}
                    >
                        +
                    </button>
                </div>
                <button
                    onClick={onDownloadPdf}
                    disabled={isDownloading}
                    className="btn btn-primary"
                    style={{ fontSize: '12px' }}
                >
                    {isDownloading ? (
                        <>
                            <span className="loading-spin" style={{ width: 14, height: 14, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                            Generating...
                        </>
                    ) : (
                        <>📄 Download PDF</>
                    )}
                </button>
            </div>

            {/* Preview Area */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                display: 'flex',
                justifyContent: 'center',
                padding: '24px',
                background: '#525659',
            }}>
                <div style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top center',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                }}>
                    <iframe
                        ref={iframeRef}
                        title="Resume Preview"
                        style={{
                            width: '8.5in',
                            height: '11in',
                            background: '#fff',
                            border: 'none',
                        }}
                    />
                </div>
            </div>

            {/* Page indicator */}
            <div style={{
                textAlign: 'center',
                padding: '8px',
                fontSize: '11px',
                color: 'var(--text-tertiary)',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface)',
            }}>
                Page 1 of 1 • Letter (8.5" × 11")
            </div>
        </div>
    );
}

/**
 * Get resume preview HTML for external rendering
 */
export function getResumePreviewHtml(resume: TailoredResumeData): string {
    return renderResumeHtml(resume);
}
