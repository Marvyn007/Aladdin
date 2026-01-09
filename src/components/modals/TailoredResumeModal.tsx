// Tailored Resume Modal - Editable resume with PDF export

'use client';

import { useState, useEffect, useRef } from 'react';

interface TailoredResumeModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
    jobTitle: string;
    company: string | null;
    jobDescription: string;
    onRegenerate?: () => void;
    isGenerating?: boolean;
}

interface GenerationResult {
    success: boolean;
    resume_html?: string;
    added_keywords?: string[];
    confidence_score?: number;
    error?: string;
}

export function TailoredResumeModal({
    isOpen,
    onClose,
    jobId,
    jobTitle,
    company,
    jobDescription: initialJobDescription,
    onRegenerate,
    isGenerating: externalIsGenerating = false,
}: TailoredResumeModalProps) {
    const [jobDescription, setJobDescription] = useState(initialJobDescription || '');
    const [resumeHtml, setResumeHtml] = useState<string>('');
    const [addedKeywords, setAddedKeywords] = useState<string[]>([]);
    const [confidenceScore, setConfidenceScore] = useState<number>(0);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasGenerated, setHasGenerated] = useState(false);

    const resumeEditorRef = useRef<HTMLDivElement>(null);

    // Sync job description with props
    useEffect(() => {
        if (initialJobDescription) {
            setJobDescription(initialJobDescription);
        }
    }, [initialJobDescription]);

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (!hasGenerated) {
                setResumeHtml('');
                setAddedKeywords([]);
                setConfidenceScore(0);
            }
        }
    }, [isOpen, hasGenerated]);

    const handleGenerate = async () => {
        if (!jobDescription.trim()) {
            setError('Please enter a job description');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch('/api/generate-tailored-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_id: jobId,
                    job_description: jobDescription,
                }),
            });

            const data: GenerationResult = await response.json();

            if (data.success && data.resume_html) {
                setResumeHtml(data.resume_html);
                setAddedKeywords(data.added_keywords || []);
                setConfidenceScore(data.confidence_score || 0);
                setHasGenerated(true);
            } else {
                setError(data.error || 'Failed to generate tailored resume');
            }
        } catch (err: any) {
            console.error('Generation error:', err);
            setError('Network error. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRegenerate = () => {
        setHasGenerated(false);
        handleGenerate();
        onRegenerate?.();
    };

    const handleDownloadPdf = async () => {
        if (!resumeEditorRef.current) return;

        setIsDownloading(true);

        try {
            // Dynamic import for client-side only
            const html2canvas = (await import('html2canvas')).default;
            const { jsPDF } = await import('jspdf');

            const element = resumeEditorRef.current;

            // Render to canvas with high quality
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff',
            });

            // Create PDF (Letter size: 8.5 x 11 inches)
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'in',
                format: 'letter',
            });

            const imgData = canvas.toDataURL('image/png');
            const pageWidth = 8.5;
            const pageHeight = 11;
            const margin = 0.5;
            const contentWidth = pageWidth - (margin * 2);
            const contentHeight = (canvas.height / canvas.width) * contentWidth;

            // Scale to fit one page
            let finalWidth = contentWidth;
            let finalHeight = contentHeight;
            const maxContentHeight = pageHeight - (margin * 2);

            if (finalHeight > maxContentHeight) {
                const scale = maxContentHeight / finalHeight;
                finalWidth *= scale;
                finalHeight = maxContentHeight;
            }

            // Center horizontally
            const xOffset = (pageWidth - finalWidth) / 2;

            pdf.addImage(imgData, 'PNG', xOffset, margin, finalWidth, finalHeight);
            pdf.save('marvin_chaudhary_resume.pdf');
        } catch (err: any) {
            console.error('PDF generation error:', err);
            alert('Failed to generate PDF. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    if (!isOpen) return null;

    const showLoading = isGenerating || externalIsGenerating;

    return (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && !showLoading && onClose()}>
            <div
                className="modal-content"
                style={{
                    maxWidth: '900px',
                    width: '95%',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                }}
            >
                {/* Loading Overlay */}
                {showLoading && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(4px)',
                        zIndex: 20,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 'var(--radius-lg)',
                    }}>
                        <div className="loading-pulse" style={{ width: 60, height: 60, borderRadius: '50%', marginBottom: '16px' }} />
                        <p style={{ fontWeight: 600, color: 'var(--accent)' }}>Generating Tailored Resume...</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Analyzing job requirements and enhancing your resume</p>
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
                        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🧠 Tailored Resume
                        </h2>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {jobTitle} {company && `at ${company}`}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={showLoading}
                        className="btn btn-ghost btn-icon"
                        style={{ marginLeft: '12px' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: '16px' }}>
                    {!hasGenerated ? (
                        // Job Description Input
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '8px' }}>
                                Job Description
                            </label>
                            <textarea
                                value={jobDescription}
                                onChange={(e) => setJobDescription(e.target.value)}
                                placeholder="Paste the full job description here..."
                                style={{
                                    width: '100%',
                                    minHeight: '300px',
                                    padding: '16px',
                                    fontSize: '14px',
                                    lineHeight: 1.6,
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    resize: 'vertical',
                                    fontFamily: 'system-ui, sans-serif',
                                }}
                            />
                            {error && (
                                <p style={{ color: 'var(--error)', fontSize: '13px', marginTop: '8px' }}>
                                    {error}
                                </p>
                            )}
                            <button
                                onClick={handleGenerate}
                                disabled={showLoading || !jobDescription.trim()}
                                className="btn btn-primary"
                                style={{ marginTop: '16px' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2a10 10 0 1 0 10 10H12V2Z" />
                                    <path d="M12 2a10 10 0 0 1 10 10" />
                                </svg>
                                Generate Tailored Resume
                            </button>
                        </div>
                    ) : (
                        // Resume Editor
                        <div>
                            {/* Added Keywords */}
                            {addedKeywords.length > 0 && (
                                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--success-muted)', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--success)', marginBottom: '8px' }}>
                                        ✅ Added Keywords (Confidence: {Math.round(confidenceScore * 100)}%)
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                        {addedKeywords.map((keyword, i) => (
                                            <span key={i} className="badge badge-success" style={{ fontSize: '12px' }}>
                                                {keyword}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Editable Resume */}
                            <div
                                ref={resumeEditorRef}
                                contentEditable
                                suppressContentEditableWarning
                                dangerouslySetInnerHTML={{ __html: resumeHtml }}
                                style={{
                                    padding: '32px',
                                    background: '#fff',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    minHeight: '500px',
                                    fontSize: '13px',
                                    lineHeight: 1.5,
                                    fontFamily: "'Times New Roman', Georgia, serif",
                                    color: '#000',
                                    outline: 'none',
                                    boxShadow: 'var(--shadow-sm)',
                                }}
                            />
                            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px', textAlign: 'center' }}>
                                ✏️ Click anywhere in the resume to edit. Your changes will be reflected in the PDF.
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {hasGenerated && (
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
                            ATS-optimized • One page • Professional
                        </span>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                                onClick={handleRegenerate}
                                disabled={showLoading}
                                className="btn btn-secondary"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <polyline points="23 4 23 10 17 10" />
                                    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
                                </svg>
                                Regenerate
                            </button>
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isDownloading || showLoading}
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

            {/* Resume Styles (injected for print/PDF) */}
            <style>{`
                .resume {
                    font-family: 'Times New Roman', Georgia, serif;
                    max-width: 700px;
                    margin: 0 auto;
                    color: #000;
                }
                .resume header {
                    text-align: center;
                    margin-bottom: 16px;
                    border-bottom: 2px solid #1a365d;
                    padding-bottom: 12px;
                }
                .resume header h1 {
                    font-size: 24px;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin: 0 0 8px 0;
                }
                .resume header .contact {
                    font-size: 12px;
                    color: #444;
                }
                .resume section {
                    margin-bottom: 16px;
                }
                .resume section h2 {
                    font-size: 14px;
                    font-weight: 700;
                    text-transform: uppercase;
                    border-bottom: 1px solid #ccc;
                    padding-bottom: 4px;
                    margin-bottom: 8px;
                    color: #1a365d;
                }
                .resume .skills p {
                    margin: 4px 0;
                    font-size: 12px;
                }
                .resume .role, .resume .project, .resume .edu-entry {
                    margin-bottom: 12px;
                }
                .resume .role-header, .resume .project-header {
                    display: flex;
                    justify-content: space-between;
                    font-weight: 600;
                    font-size: 13px;
                }
                .resume .role-title {
                    font-style: italic;
                    font-size: 12px;
                    color: #444;
                }
                .resume .tech {
                    font-style: italic;
                    color: #666;
                    font-size: 12px;
                }
                .resume ul {
                    margin: 4px 0 0 0;
                    padding-left: 20px;
                }
                .resume li {
                    font-size: 12px;
                    margin-bottom: 2px;
                }
                .resume .edu-entry {
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                }
                .resume .edu-entry .school {
                    font-weight: 600;
                }
                .resume .edu-entry .degree {
                    width: 100%;
                    font-size: 12px;
                    color: #444;
                }
            `}</style>
        </div>
    );
}
