/**
 * Enhanced Tailored Resume API Route
 * POST /api/generate-tailored-resume
 * 
 * Streams SSE progress events during generation, then sends the final result.
 * Events: fetch_resume | parse_resume | fetch_linkedin | ai_generate | complete | error
 */

import { NextRequest } from 'next/server';
import { generateEnhancedTailoredResume } from '@/lib/enhanced-tailored-resume-service';
import { auth } from '@clerk/nextjs/server';

/** Shape of each SSE progress event */
interface ProgressEvent {
    step: string;
    status: 'running' | 'done' | 'error';
    detail?: string;
}

function sseData(event: string, data: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
    // ----- auth check (must happen before stream starts) -----
    let userId: string;
    try {
        const session = await auth();
        if (!session.userId) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }
        userId = session.userId;
    } catch {
        return new Response(JSON.stringify({ error: 'Auth failed' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // ----- parse body -----
    let body: any;
    try {
        body = await request.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    const { job_id, job_description, job_url, resume_id } = body;

    if (!job_id && !job_description && !job_url) {
        return new Response(
            JSON.stringify({ error: 'Either job_id, job_description, or job_url is required' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
    }

    // ----- SSE stream -----
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(sseData(event, data)));
            };

            try {
                // Progress: starting generation
                send('progress', { step: 'fetch_resume', status: 'running', detail: 'Loading your resume…' } satisfies ProgressEvent);

                // Kick off the actual generation (it handles all sub-steps internally)
                send('progress', { step: 'ai_generate', status: 'running', detail: 'AI is tailoring your resume…' } satisfies ProgressEvent);

                const result = await generateEnhancedTailoredResume(
                    job_id,
                    userId,
                    job_description,
                    job_url,
                    resume_id || undefined,
                );

                if (result.success && result.resume) {
                    send('progress', { step: 'ai_generate', status: 'done', detail: 'Resume generated' } satisfies ProgressEvent);

                    // Send the final result
                    send('complete', {
                        success: true,
                        resume: result.resume,
                        keywords: result.keywords,
                        provider: result.provider,
                        latencyMs: result.latencyMs,
                    });
                } else {
                    send('progress', { step: 'ai_generate', status: 'error', detail: result.error } satisfies ProgressEvent);
                    send('error', {
                        success: false,
                        error: result.error || 'Generation failed',
                        errorCode: result.isRetryable ? 'RETRYABLE' : 'INTERNAL_ERROR',
                        isRetryable: result.isRetryable || false,
                    });
                }
            } catch (error: any) {
                console.error('[generate-tailored-resume] Stream error:', error);
                send('error', {
                    success: false,
                    error: 'Internal Server Error',
                    details: error.message,
                });
            } finally {
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
