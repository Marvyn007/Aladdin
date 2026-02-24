import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDefaultResume } from '@/lib/db';
import { getS3Client } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { parseResumeFromPdfStrict, StrictParseResult } from '@/lib/gemini-strict';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
// Need longer timeout for OCR + JSON AI parsing
export const maxDuration = 60;

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 1. Fetch default resume details
        const resume = await getDefaultResume(userId);
        if (!resume) {
            return NextResponse.json({ error: 'No default resume found to parse.' }, { status: 404 });
        }

        // 2. Fetch PDF from S3
        if (!resume.s3_key) {
            return NextResponse.json({ error: 'Resume PDF missing in S3 storage.' }, { status: 404 });
        }

        const s3 = getS3Client();
        const getCommand = new GetObjectCommand({
            Bucket: process.env.AWS_S3_BUCKET_NAME!,
            Key: resume.s3_key,
        });

        const s3Response = await s3.send(getCommand);
        if (!s3Response.Body) {
            return NextResponse.json({ error: 'Failed to download resume PDF.' }, { status: 500 });
        }

        const byteArray = await s3Response.Body.transformToByteArray();
        const fileBuffer = Buffer.from(byteArray);

        // 3. Strict Parser
        const parseResult: StrictParseResult = await parseResumeFromPdfStrict(fileBuffer);

        if (!parseResult.success) {
            return NextResponse.json({
                error: 'Resume parsing failed strict tests.',
                failed_tests: parseResult.failedTests,
                raw_text: parseResult.rawTextExtract // For debugging
            }, { status: 400 });
        }

        // Wait to update DB or return? For now, we return the JSON
        // to be handled by the frontend, or perhaps we update the DB here.
        // Let's return it so the frontend can preview it, or we could save it.
        // As per the prompt, this B and C steps are part of the strict parser. Return the output cleanly.

        return NextResponse.json({
            success: true,
            data: parseResult.data,
            raw_text: parseResult.rawTextExtract
        });

    } catch (error: any) {
        console.error('Error in strict parser:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to parse resume.' },
            { status: 500 }
        );
    }
}
