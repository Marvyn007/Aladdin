// Cover Letter Modal component - Fully Editable with PDF Export

'use client';

import { useState, useEffect } from 'react';

interface CoverLetterModalProps {
    isOpen: boolean;
    onClose: () => void;
    coverLetterHtml: string;
    coverLetterText: string;
    jobTitle: string;
    company: string | null;
    coverLetterId?: string;
    error?: string | null;
    onRegenerate?: () => void;
    onQueue?: () => void;
    isGenerating?: boolean;
}

export function CoverLetterModal({
    isOpen,
    onClose,
    coverLetterHtml,
    coverLetterText,
    jobTitle,
    company,
    coverLetterId,
    error,
    onRegenerate,
    onQueue,
    isGenerating = false,
}: CoverLetterModalProps) {
    // Editable state - this is what the user can edit
    const [editedText, setEditedText] = useState<string>(coverLetterText || '');
    const [isDownloading, setIsDownloading] = useState(false);

    // Sync with props when new content is generated
    useEffect(() => {
        if (coverLetterText) {
            setEditedText(coverLetterText);
        }
    }, [coverLetterText]);

    // Handle PDF download using EDITED text
    const handleDownloadPdf = async () => {
        if (!editedText.trim()) {
            alert('No content to download');
            return;
        }

        setIsDownloading(true);
        try {
            // Convert plain text to HTML for PDF generation
            const htmlContent = `
                <div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; max-width: 700px; color: #000;">
                    ${editedText.split('\n\n').map(p =>
                `<p style="margin-bottom: 1em;">${p.replace(/\n/g, '<br>')}</p>`
            ).join('')}
                </div>
            `;

            // If we have a cover letter ID, use the API
            if (coverLetterId) {
                const res = await fetch(`/api/cover-letters/${coverLetterId}/generate-pdf`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ content_html: htmlContent }),
                });

                const data = await res.json();

                if (data.success && data.url) {
                    const link = document.createElement('a');
                    link.href = data.url;
                    link.download = data.filename || 'marvin_chaudhary_cover_letter.pdf';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                } else {
                    alert('PDF generation failed: ' + (data.error || 'Unknown error'));
                }
            } else {
                // Fallback: create a simple text file download
                const blob = new Blob([editedText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'marvin_chaudhary_cover_letter.txt';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Error downloading PDF:', error);
            alert('Failed to download PDF');
        } finally {
            setIsDownloading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !isGenerating && onClose()}>
            <div
                className="modal-content"
                style={{
                    maxWidth: '800px',
                    width: '95%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                }}
            >
                {/* Loading Overlay */}
                {isGenerating && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(255, 255, 255, 0.9)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-lg)',
                    }}>
                        <div className="loading-pulse" style={{ width: 60, height: 60, borderRadius: '50%', marginBottom: '16px' }} />
                        <p style={{ fontWeight: 600, color: 'var(--accent)' }}>Generating Cover Letter (cloud AI)…</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Analyzing your resume and job requirements</p>
                    </div>
                )}

                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: '16px',
                        paddingBottom: '12px',
                        borderBottom: '1px solid var(--border)',
                    }}
                >
                    <div>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px' }}>
                            {error ? 'Generation Failed' : 'Cover Letter'}
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {jobTitle} {company && `at ${company}`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="btn btn-ghost btn-icon"
                        style={{ marginLeft: '12px' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content Area */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        marginBottom: '16px',
                    }}
                >
                    {error ? (
                        // Error State UI
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100%',
                            textAlign: 'center',
                            padding: '40px'
                        }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="1.5" style={{ marginBottom: '16px' }}>
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Generation Issue</h3>
                            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px', marginBottom: '24px' }}>
                                {error}
                            </p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                {onRegenerate && (
                                    <button onClick={onRegenerate} className="btn btn-primary">
                                        Retry Now
                                    </button>
                                )}
                                {onQueue && (
                                    <button onClick={onQueue} className="btn btn-secondary">
                                        Queue for Later
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Editable Textarea
                        <>
                            <textarea
                                value={editedText}
                                onChange={(e) => setEditedText(e.target.value)}
                                disabled={isGenerating}
                                placeholder="Your cover letter will appear here..."
                                style={{
                                    width: '100%',
                                    minHeight: '400px',
                                    padding: '32px',
                                    fontSize: '14px',
                                    lineHeight: 1.8,
                                    fontFamily: "'Times New Roman', Georgia, serif",
                                    color: '#000',
                                    background: '#fff',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    outline: 'none',
                                    boxShadow: 'var(--shadow-sm)',
                                    resize: 'vertical',
                                    opacity: isGenerating ? 0.5 : 1,
                                }}
                            />
                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px', textAlign: 'center' }}>
                                ✏️ Edit the text above freely. Your changes will be saved when you download.
                            </p>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                {!error && (
                    <div
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: '12px',
                            borderTop: '1px solid var(--border)',
                        }}
                    >
                        <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                            {editedText.length} characters
                        </span>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            {onRegenerate && (
                                <button
                                    onClick={onRegenerate}
                                    disabled={isGenerating}
                                    className="btn btn-secondary"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="23 4 23 10 17 10" />
                                        <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                                    </svg>
                                    Regenerate
                                </button>
                            )}
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isDownloading || isGenerating || !editedText.trim()}
                                className="btn btn-primary"
                            >
                                {isDownloading ? (
                                    <>
                                        <span className="loading-spin" style={{ width: 16, height: 16, border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%' }} />
                                        Generating PDF...
                                    </>
                                ) : (
                                    <>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                            <polyline points="7 10 12 15 17 10" />
                                            <line x1="12" y1="15" x2="12" y2="3" />
                                        </svg>
                                        Download PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
