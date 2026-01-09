/**
 * Client-side PDF generation utility
 * Uses html2canvas + jsPDF to generate PDFs directly in the browser
 * This bypasses all serverless limitations (Vercel, Lambda, etc.)
 */

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface PDFGenerationOptions {
    filename: string;
    format?: 'letter' | 'a4';
    orientation?: 'portrait' | 'landscape';
    margin?: number; // in pixels
    scale?: number;
}

/**
 * Generate PDF from an HTML element and trigger download
 */
export async function generatePDFFromElement(
    element: HTMLElement,
    options: PDFGenerationOptions
): Promise<void> {
    const {
        filename,
        format = 'letter',
        orientation = 'portrait',
        margin = 0,
        scale = 2, // Higher scale = better quality
    } = options;

    // Capture the element as canvas
    const canvas = await html2canvas(element, {
        scale,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
    });

    // Calculate dimensions
    const imgData = canvas.toDataURL('image/png');

    // Page dimensions in mm (jsPDF uses mm by default)
    const pageWidth = format === 'letter' ? 215.9 : 210; // Letter vs A4
    const pageHeight = format === 'letter' ? 279.4 : 297;

    // Calculate image dimensions to fit page with margins
    const marginMM = margin * 0.264583; // px to mm
    const contentWidth = pageWidth - (marginMM * 2);
    const contentHeight = pageHeight - (marginMM * 2);

    // Scale image to fit width
    const imgWidth = contentWidth;
    const imgHeight = (canvas.height * contentWidth) / canvas.width;

    // Create PDF
    const pdf = new jsPDF({
        orientation,
        unit: 'mm',
        format: format === 'letter' ? 'letter' : 'a4',
    });

    // Handle multi-page if content is taller than one page
    let heightLeft = imgHeight;
    let position = marginMM;
    let pageCount = 0;

    while (heightLeft > 0) {
        if (pageCount > 0) {
            pdf.addPage();
        }

        pdf.addImage(
            imgData,
            'PNG',
            marginMM,
            position - (pageCount * contentHeight),
            imgWidth,
            imgHeight
        );

        heightLeft -= contentHeight;
        pageCount++;
    }

    // Trigger download
    pdf.save(filename);
}

/**
 * Generate PDF from raw HTML string and trigger download
 * This creates a temporary container, renders it, captures it, then removes it
 */
export async function generatePDFFromHTML(
    html: string,
    css: string,
    options: PDFGenerationOptions
): Promise<void> {
    // Create a temporary container
    const container = document.createElement('div');
    container.style.cssText = `
    position: absolute;
    left: -9999px;
    top: -9999px;
    width: 8.5in;
    background: white;
    padding: 0.5in;
  `;

    // Add styles
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    container.appendChild(styleEl);

    // Add content
    const contentEl = document.createElement('div');
    contentEl.innerHTML = html;
    container.appendChild(contentEl);

    document.body.appendChild(container);

    try {
        await generatePDFFromElement(container, options);
    } finally {
        document.body.removeChild(container);
    }
}

/**
 * Generate Cover Letter PDF from plain text content
 */
export async function generateCoverLetterPDF(
    content: string,
    filename: string = 'cover_letter.pdf'
): Promise<void> {
    // Convert plain text to styled HTML
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    const html = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');

    const css = `
    body, div, p {
      font-family: 'Times New Roman', Times, serif;
      font-size: 12pt;
      line-height: 1.5;
      color: #000;
    }
    p {
      margin-bottom: 12px;
    }
  `;

    await generatePDFFromHTML(html, css, {
        filename,
        format: 'letter',
        margin: 72, // 1 inch in pixels
    });
}

/**
 * Simple text-based PDF for cover letters (no html2canvas needed)
 * More reliable and faster
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
