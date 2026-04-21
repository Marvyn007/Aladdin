/**
 * Client-side PDF generation utility
 * Uses jsPDF to generate simple PDFs directly in the browser
 */

import jsPDF from 'jspdf';

export interface PDFGenerationOptions {
    filename: string;
    format?: 'letter' | 'a4';
    orientation?: 'portrait' | 'landscape';
    margin?: number; // in pixels
    scale?: number;
}

/**
 * Simple text-based PDF for cover letters
 * Reliable and fast
 */
export function generateSimpleCoverLetterPDF(
    content: string,
    filename: string = 'cover_letter.pdf'
): void {
    const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'in',
        format: 'letter',
    });

    // Set font
    pdf.setFont('times', 'normal');
    pdf.setFontSize(12);

    // Page dimensions and margins
    const pageWidth = 8.5;
    const pageHeight = 11;
    const margin = 1;
    const contentWidth = pageWidth - (margin * 2);
    const lineHeight = 0.25; // inches

    // Split content into lines that fit the page width
    const lines = pdf.splitTextToSize(content, contentWidth);

    let y = margin;
    let pageNum = 1;

    for (const line of lines) {
        // Check if we need a new page
        if (y > pageHeight - margin) {
            pdf.addPage();
            pageNum++;
            y = margin;
        }

        pdf.text(line, margin, y);
        y += lineHeight;
    }

    pdf.save(filename);
}

/**
 * Generate PDF using the new Serverless API Route
 * Sends raw HTML/CSS to the backend Puppeteer instance.
 */
export async function generatePDFFromServerless(
    html: string,
    filename: string,
    jobTitle?: string,
    contactName?: string,
    margins?: { top: number; right: number; bottom: number; left: number }
): Promise<void> {
    const response = await fetch('/api/generate-pdf-serverless', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            html,
            jobTitle,
            contactName,
            margins,
        }),
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Failed to generate PDF from serverless API');
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
