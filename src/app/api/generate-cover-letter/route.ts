import { NextRequest, NextResponse } from 'next/server';
import {
    getJobById,
    getDefaultResume,
    getResumeById,
    updateResume,
    getLinkedInProfile,
    insertCoverLetter,
    getCoverLetterById // Added this check? No, used in service.
} from '@/lib/db';
import { generateCoverLetter, parseResumeFromPdf } from '@/lib/gemini';
import { performCoverLetterGeneration, queueCoverLetterGeneration } from '@/lib/cover-letter-service';

import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { job_id, resume_id, queue, job_description } = await request.json();

        if (!job_id) {
            return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
        }

        // Handle Queue Request
        if (queue) {
            const coverLetter = await queueCoverLetterGeneration(userId, job_id, resume_id);
            return NextResponse.json({
                success: true,
                queued: true,
                message: "Cover letter generation queued.",
                coverLetter: { id: coverLetter.id, status: 'pending' }
            });
        }

        // Handle Immediate Generation
        const result = await performCoverLetterGeneration(userId, job_id, resume_id, undefined, job_description);

        if (result.success && result.coverLetter) {
            return NextResponse.json({
                success: true,
                text: result.coverLetter.content_text,
                provider: result.coverLetter.provider || 'unknown',
                coverLetter: result.coverLetter
            });
        } else {
            // Error handling - be specific about the error
            const msg = result.error || 'Generation failed';
            const isTimeout = msg.includes('timeout') || msg.includes('timed out');
            const isRetryable = result.isRetryable || isTimeout;

            return NextResponse.json(
                {
                    success: false,
                    error: isTimeout
                        ? 'Still generating… click retry to continue.'
                        : result.error || 'Generation failed',
                    errorCode: isRetryable ? 'RETRYABLE' : 'INTERNAL_ERROR',
                    isRetryable
                },
                { status: isRetryable ? 503 : 500 }
            );
        }

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
