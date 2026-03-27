/**
 * Shared PDF Renderer
 * Uses Puppeteer to render a TailoredResumeData into a PDF buffer.
 */

import { renderResumeHtml } from '@/lib/resume-templates';
import type { TailoredResumeData } from '@/types';
import puppeteer from 'puppeteer';

/**
 * Core Puppeteer render — launches browser, loads HTML, exports PDF, closes browser.
 * All spacing comes from CSS; no Puppeteer margin override.
 */
async function renderHtmlToPdf(html: string): Promise<Buffer> {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: 'networkidle0',
        });

        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            preferCSSPageSize: false,
            margin: { top: '0', right: '0', bottom: '0', left: '0' },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
}

/**
 * Generate a PDF buffer from a TailoredResumeData object.
 * Uses Puppeteer to render the resume HTML into a letter-sized PDF.
 * Supports multi-page output - content can flow to additional pages naturally.
 */
export async function generatePdfBuffer(resume: TailoredResumeData): Promise<Buffer> {
    return renderHtmlToPdf(renderResumeHtml(resume));
}

/**
 * Generate a PDF buffer from a pre-rendered HTML string.
 * The client sends exactly the HTML the preview rendered, with fonts injected.
 * Puppeteer margins are zeroed — all spacing comes from CSS.
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
