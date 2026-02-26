/**
 * Shared PDF Renderer
 * Uses Puppeteer to render a TailoredResumeData into a PDF buffer.
 */

import { renderResumeHtml } from '@/lib/resume-templates';
import type { TailoredResumeData } from '@/types';
import puppeteer from 'puppeteer';

/**
 * Generate a PDF buffer from a TailoredResumeData object.
 * Uses Puppeteer to render the resume HTML into a letter-sized PDF.
 * Supports multi-page output - content can flow to additional pages naturally.
 */
export async function generatePdfBuffer(resume: TailoredResumeData): Promise<Buffer> {
    const html = renderResumeHtml(resume);

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
            pageRanges: '',
            margin: {
                top: '0.5in',
                right: '0.5in',
                bottom: '0.5in',
                left: '0.5in',
            },
        });

        return Buffer.from(pdfBuffer);
    } finally {
        await browser.close();
    }
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
