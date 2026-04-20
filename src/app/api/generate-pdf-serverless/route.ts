/**
 * Serverless Resume PDF Generation API Route
 * POST /api/generate-pdf-serverless
 *
 * Uses puppeteer-core + @sparticuz/chromium to generate PDF optimally.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateServerlessPdfBufferFromHtml } from '@/lib/serverless-pdf-renderer';
import { buildResumeFilename } from '@/lib/pdf-renderer';

// This gives Vercel 60 seconds (Hobby max allowed is less, but setting this guarantees it won't time out early)
export const maxDuration = 60; 
export const runtime = 'nodejs'; // Sparticuz Chromium requires Node.js runtime

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { html, jobTitle, contactName, margins } = body as {
            html: string;
            jobTitle?: string;
            contactName?: string;
            margins?: { top: number; right: number; bottom: number; left: number };
        };

        if (!html) {
            return NextResponse.json({ error: 'HTML is required' }, { status: 400 });
        }

        const pdfBuffer = await generateServerlessPdfBufferFromHtml(html, margins);
        const filename = buildResumeFilename(contactName, jobTitle) || 'resume.pdf';

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error: any) {
        console.error('Serverless PDF generation error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF via serverless engine', details: error.message },
            { status: 500 }
        );
    }
}
