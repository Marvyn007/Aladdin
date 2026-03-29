/**
 * Shared PDF Renderer
 * Uses Puppeteer to render a TailoredResumeData into a PDF buffer.
 */

import { renderResumeHtml } from '@/lib/resume-templates';
import type { TailoredResumeData } from '@/types';
import puppeteer from 'puppeteer';

/**
 * Core Puppeteer render — launches browser, loads HTML, exports PDF, closes browser.
 *
 * The PDF width is fixed at 8.5in (letter width).
 * The PDF height matches the content height exactly — no forced page size, no scaling.
 * This produces a single-page PDF that looks identical to the in-app preview.
 */
async function renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();

        // 8.5in at 96dpi = 816px; tall enough viewport to render all content in one pass
        await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
        await page.setContent(html, { waitUntil: 'networkidle0' });

        // Measure actual content height so the PDF page is exactly as tall as the resume
        const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);

        const pdfBuffer = await page.pdf({
            width: '8.5in',
            height: scrollHeight + 'px',
            printBackground: true,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

/**
 * Generate a PDF buffer from a TailoredResumeData object.
 */
export async function generatePdfBuffer(resume: TailoredResumeData): Promise<Buffer> {
    return renderHtmlToPdf(renderResumeHtml(resume));
}

/**
 * Generate a PDF buffer from a pre-rendered HTML string.
 * The client sends exactly the HTML the preview rendered, with fonts injected.
 */
export async function generatePdfBufferFromHtml(html: string): Promise<Buffer> {
    return renderHtmlToPdf(html);
}

/**
 * Build a safe filename from contact name + job title.
 * e.g. "Jane Smith" + "Software Engineer" → "jane_smith_software_engineer.pdf"
 */
export function buildResumeFilename(contactName: string | undefined, jobTitle: string | undefined): string {
    const safeName = (contactName || 'resume').trim().replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');
    const safeTitle = (jobTitle || 'tailored').trim().replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '');
    return `${safeName}_${safeTitle}.pdf`;
}
