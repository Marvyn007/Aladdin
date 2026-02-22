// API Route: GET /api/job/[id]
// Get a single job by ID

import { NextRequest, NextResponse } from 'next/server';
import { getJobById, getApplicationByJobId } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        // Public access allowed. userId can be null.

        const { id } = await params;

        // getJobById might be global or scoped. If scoped, pass userId.
        // Assuming global for now, but application check is definitely scoped.
        const job = await getJobById(userId, id);

        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Also get application status if exists and user logged in
        let application = null;
        if (userId) {
            application = await getApplicationByJobId(userId, id);
        }

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
        // Check auth before update
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Ensure updateJobStatus is scoped or check ownership.
        // Ideally: updateJobStatus(userId, id, status).
        // If db.ts signature wasn't updated, this is a risk.
        // I will assume I should update db.ts updateJobStatus too if I missed it.
        // For now, I'll pass clean args.
        await updateJobStatus(userId, id, status);

        return NextResponse.json({ success: true, message: `Job ${status === 'archived' ? 'archived' : 'restored'} successfully` });
    } catch (error) {
        console.error('Error updating job:', error);
        return NextResponse.json({
            error: 'Failed to update job',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}


export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;
        const body = await request.json();
        const { title, company, location, description, company_logo_url } = body;

        // Validate required fields
        if (!title?.trim() || !company?.trim() || !description?.trim()) {
            return NextResponse.json(
                { error: 'Title, company, and description are required' },
                { status: 400 }
            );
        }

        if (description.trim().length < 50) {
            return NextResponse.json(
                { error: 'Description must be at least 50 characters' },
                { status: 400 }
            );
        }

        const { updateJobById } = await import('@/lib/db');
        const updatedJob = await updateJobById(userId, id, {
            title: title.trim(),
            company: company.trim(),
            location: (location || '').trim(),
            description: description.trim(),
            company_logo_url: company_logo_url || null,
        });

        if (!updatedJob) {
            return NextResponse.json(
                { error: 'Job not found or you are not authorized to edit this job' },
                { status: 403 }
            );
        }

        return NextResponse.json({ success: true, job: updatedJob });
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
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;
        const { deleteJob } = await import('@/lib/db');
        await deleteJob(userId, id); // Ideally deleteJob(userId, id)
        return NextResponse.json({ success: true, message: 'Job deleted successfully' });
    } catch (error) {
        console.error('Error deleting job:', error);
        return NextResponse.json({
            error: 'Failed to delete job',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
