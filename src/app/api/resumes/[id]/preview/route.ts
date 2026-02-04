
import { NextRequest, NextResponse } from 'next/server';
import { getResumeMetadata } from '@/lib/db';
import { getSignedDownloadUrl } from '@/lib/s3';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        if (!id) {
            return NextResponse.json({ error: 'Resume ID is required' }, { status: 400 });
        }

        // Fetch resume metadata (RLS enforced by getResumeMetadata)
        const resume = await getResumeMetadata(userId, id);

        if (!resume) {
            return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
        }

        if (!resume.s3_key) {
            return NextResponse.json({ error: 'Resume file not found (no S3 key)' }, { status: 404 });
        }

        // Generate signed URL
        const url = await getSignedDownloadUrl(resume.s3_key);

        // Redirect to the signed URL
        return NextResponse.redirect(url);

    } catch (error) {
        console.error('Error in resume preview:', error);
        return NextResponse.json(
            { error: 'Internal User Error' },
            { status: 500 }
        );
    }
}
