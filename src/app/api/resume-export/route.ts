/**
 * Resume PDF Export API Route
 * POST /api/resume-export
 *
 * Exports resume to PDF using the exact content from the editor
 * Returns application/pdf with filename marvin_chaudhary_resume.pdf
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderResumeHtml } from '@/lib/resume-templates';
import type { TailoredResumeData } from '@/types';
import puppeteer from 'puppeteer';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { resume } = body as { resume: TailoredResumeData };

        if (!resume) {
            return NextResponse.json(
                { error: 'Resume data is required' },
                { status: 400 }
            );
        }

        // Generate full HTML document
        const html = renderResumeHtml(resume);

        // Launch Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        const page = await browser.newPage();

        // Set content and wait for network idle (fonts, images)
        await page.setContent(html, {
            waitUntil: 'networkidle0',
        });

        // Generate PDF
        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            margin: {
                top: '0in',
                right: '0in',
                bottom: '0in',
                left: '0in',
            },
        });

        await browser.close();

        // Return PDF
        return new NextResponse(Buffer.from(pdfBuffer), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="marvin_chaudhary_resume.pdf"',
            },
        });

    } catch (error: any) {
        console.error('Resume export error:', error);
        return NextResponse.json(
            { error: 'Failed to export resume', details: error.message },
            { status: 500 }
        );
    }
}
