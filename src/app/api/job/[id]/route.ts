// API Route: GET /api/job/[id]
// Get a single job by ID

import { NextRequest, NextResponse } from 'next/server';
import { getJobById, getApplicationByJobId } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const job = await getJobById(id);

        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Also get application status if exists
        const application = await getApplicationByJobId(id);

        return NextResponse.json({
            job,
            application: application || null,
        });
    } catch (error) {
        console.error('Error fetching job:', error);
        return NextResponse.json(
            { error: 'Failed to fetch job' },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { status } = body;

        // validate status
        if (!status || (status !== 'archived' && status !== 'fresh')) {
            return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        // Import dynamically to avoid circular dependencies if any, though db functions are safe
        const { updateJobStatus } = await import('@/lib/db');
        await updateJobStatus(id, status);

        return NextResponse.json({ success: true, message: `Job ${status === 'archived' ? 'archived' : 'restored'} successfully` });
    } catch (error) {
        console.error('Error updating job:', error);
        return NextResponse.json({
            error: 'Failed to update job',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}


export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { deleteJob } = await import('@/lib/db');
        await deleteJob(id);
        return NextResponse.json({ success: true, message: 'Job deleted successfully' });
    } catch (error) {
        console.error('Error deleting job:', error);
        return NextResponse.json({
            error: 'Failed to delete job',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
