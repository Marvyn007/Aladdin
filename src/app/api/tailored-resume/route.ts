/**
 * Tailored Resume API Route
 * GET  /api/tailored-resume?jobId=xxx  — Load saved tailored resume
 * POST /api/tailored-resume            — Save/update tailored resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { saveTailoredResume, getTailoredResumeByUserJob } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const jobId = request.nextUrl.searchParams.get('jobId');
        if (!jobId) {
            return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
        }

        const saved = await getTailoredResumeByUserJob(userId, jobId);

        if (!saved) {
            return NextResponse.json({ exists: false });
        }

        return NextResponse.json({
            exists: true,
            id: saved.id,
            resumeData: saved.resumeData,
            keywordsData: saved.keywordsData,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
        });
    } catch (error: any) {
        console.error('[tailored-resume GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to load tailored resume', details: error.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { jobId, resumeData, keywordsData } = body;

        if (!jobId || !resumeData) {
            return NextResponse.json(
                { error: 'jobId and resumeData are required' },
                { status: 400 }
            );
        }

        const result = await saveTailoredResume(userId, jobId, resumeData, keywordsData);

        return NextResponse.json({
            success: true,
            id: result.id,
        });
    } catch (error: any) {
        console.error('[tailored-resume POST] Error:', error);
        return NextResponse.json(
            { error: 'Failed to save tailored resume', details: error.message },
            { status: 500 }
        );
    }
}
