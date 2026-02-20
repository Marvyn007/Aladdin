/**
 * Resume PDF Export API Route
 * POST /api/resume-export
 *
 * Exports resume to PDF using the exact content from the editor.
 * Returns application/pdf with dynamic filename.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePdfBuffer, buildResumeFilename } from '@/lib/pdf-renderer';
import type { TailoredResumeData } from '@/types';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { resume, jobTitle } = body as { resume: TailoredResumeData; jobTitle?: string };

        if (!resume) {
            return NextResponse.json(
                { error: 'Resume data is required' },
                { status: 400 }
            );
        }

        const pdfBuffer = await generatePdfBuffer(resume);
        const filename = buildResumeFilename(resume.contact?.name, jobTitle);

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
