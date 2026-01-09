/**
 * Enhanced Tailored Resume API Route
 * POST /api/generate-tailored-resume
 * 
 * Accepts jobDescription OR jobUrl, generates structured resume JSON
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateEnhancedTailoredResume } from '@/lib/enhanced-tailored-resume-service';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { job_id, job_description, job_url, resume_id, user_id = 'default' } = body;

        if (!job_id && !job_description && !job_url) {
            return NextResponse.json(
                { error: 'Either job_id, job_description, or job_url is required' },
                { status: 400 }
            );
        }

        // Generate tailored resume
        const result = await generateEnhancedTailoredResume(
            job_id,
            job_description,
            job_url,
            resume_id,
            user_id
        );

        if (result.success && result.resume) {
            return NextResponse.json({
                success: true,
                resume: result.resume,
                keywords: result.keywords,
                provider: result.provider,
                latencyMs: result.latencyMs,
            });
        } else {
            const isRetryable = result.isRetryable || false;

            return NextResponse.json(
                {
                    success: false,
                    error: result.error || 'Generation failed',
                    errorCode: isRetryable ? 'RETRYABLE' : 'INTERNAL_ERROR',
                    isRetryable,
                },
                { status: isRetryable ? 503 : 500 }
            );
        }

    } catch (error: any) {
        console.error('API Error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', details: error.message },
            { status: 500 }
        );
    }
}
