/**
 * Quick test route for Hugging Face provider
 * GET /api/debug/test-huggingface
 */

import { NextResponse } from 'next/server';
import { callHuggingFace, getHuggingFaceStatus } from '@/lib/adapters/huggingface';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET() {
    const start = Date.now();

    try {
        // Test with simple prompt
        const result = await callHuggingFace('Reply with the word OK.');

        return NextResponse.json({
            status: 'SUCCESS',
            result: result.slice(0, 100),
            latency_ms: Date.now() - start,
            models: getHuggingFaceStatus()
        });
    } catch (error: any) {
        return NextResponse.json({
            status: 'FAILED',
            error: error.message,
            latency_ms: Date.now() - start,
            models: getHuggingFaceStatus()
        }, { status: 500 });
    }
}
