/**
 * Save Tailored Resume API Route
 * POST /api/save-tailored-resume
 *
 * Renders the resume as PDF, uploads to S3, and saves to the DB
 * alongside user's uploaded resumes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { generatePdfBuffer, buildResumeFilename } from '@/lib/pdf-renderer';
import { insertResume } from '@/lib/db';
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
        const { resume, jobTitle } = body as {
            resume: TailoredResumeData;
            jobTitle?: string;
        };

        if (!resume) {
            return NextResponse.json(
                { error: 'Resume data is required' },
                { status: 400 }
            );
        }

        // 1. Build filename: firstName_lastName_jobTitle.pdf
        const filename = buildResumeFilename(resume.contact?.name, jobTitle);

        // 2. Render to PDF buffer
        const pdfBuffer = await generatePdfBuffer(resume);

        // 3. Insert into DB + upload to S3 (using existing insertResume)
        //    insertResume handles: S3 upload via generateS3Key + uploadFileToS3, then DB insert
        const savedResume = await insertResume(
            userId,
            filename,
            {} as any, // parsed_json not needed for generated resumes
            false,      // not default
            pdfBuffer,
        );

        return NextResponse.json({
            success: true,
            resumeId: savedResume.id,
            filename,
        });

    } catch (error: any) {
        console.error('[save-tailored-resume] Error:', error);
        return NextResponse.json(
            { error: 'Failed to save resume', details: error.message },
            { status: 500 }
        );
    }
}
