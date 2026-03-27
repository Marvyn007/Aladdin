/**
 * Resume PDF Export API Route
 * POST /api/resume-export
 *
 * Accepts pre-rendered HTML from the client (same HTML the preview displays).
 * Returns application/pdf with dynamic filename.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePdfBufferFromHtml, buildResumeFilename } from '@/lib/pdf-renderer';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { html, jobTitle, contactName } = body as {
            html: string;
            jobTitle?: string;
            contactName?: string;
        };

        if (!html) {
            return NextResponse.json({ error: 'HTML is required' }, { status: 400 });
        }

        const pdfBuffer = await generatePdfBufferFromHtml(html);
        const filename = buildResumeFilename(contactName, jobTitle);

        return new NextResponse(pdfBuffer as any, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${filename}"`,
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
