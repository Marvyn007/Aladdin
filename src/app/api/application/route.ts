// API Route: /api/application
// CRUD operations for job applications (Kanban tracker)

import { NextRequest, NextResponse } from 'next/server';
import {
    getApplications,
    createApplication,
    updateApplicationColumn,
    deleteApplication,
    getJobById,
    getApplicationByJobId
} from '@/lib/db';
import type { ApplicationColumn } from '@/types';
import { auth } from '@clerk/nextjs/server';

// GET: List all applications
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const applications = await getApplications(userId);
        return NextResponse.json({ applications });
    } catch (error) {
        console.error('Error fetching applications:', error);
        return NextResponse.json(
            { error: 'Failed to fetch applications' },
            { status: 500 }
        );
    }
}

// POST: Create a new application
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { job_id } = await request.json();

        if (!job_id) {
            return NextResponse.json(
                { error: 'Job ID is required' },
                { status: 400 }
            );
        }

        // Check if job exists
        const job = await getJobById(userId, job_id);
        if (!job) {
            return NextResponse.json(
                { error: 'Job not found' },
                { status: 404 }
            );
        }

        // Check if application already exists
        const existingApp = await getApplicationByJobId(userId, job_id);
        if (existingApp) {
            return NextResponse.json(
                { error: 'Application already exists for this job' },
                { status: 409 }
            );
        }

        // Create application
        const application = await createApplication(userId, job_id, job.source_url);

        return NextResponse.json({
            success: true,
            application,
        });
    } catch (error) {
        console.error('Error creating application:', error);
        return NextResponse.json(
            { error: 'Failed to create application' },
            { status: 500 }
        );
    }
}

// PUT: Update application (move between columns)
export async function PUT(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { application_id, column_name } = await request.json();

        if (!application_id || !column_name) {
            return NextResponse.json(
                { error: 'Application ID and column name are required' },
                { status: 400 }
            );
        }

        const validColumns: ApplicationColumn[] = [
            'Applied',
            'Got OA',
            'Interview R1',
            'Interview R2',
            'Interview R3',
            'Interview R4',
            'Got Offer',
        ];

        if (!validColumns.includes(column_name)) {
            return NextResponse.json(
                { error: 'Invalid column name' },
                { status: 400 }
            );
        }

        await updateApplicationColumn(userId, application_id, column_name);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating application:', error);
        return NextResponse.json(
            { error: 'Failed to update application' },
            { status: 500 }
        );
    }
}

// DELETE: Soft delete an application
export async function DELETE(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const applicationId = searchParams.get('id');

        if (!applicationId) {
            return NextResponse.json(
                { error: 'Application ID is required' },
                { status: 400 }
            );
        }

        await deleteApplication(userId, applicationId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting application:', error);
        return NextResponse.json(
            { error: 'Failed to delete application' },
            { status: 500 }
        );
    }
}
