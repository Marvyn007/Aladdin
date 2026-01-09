// API Route: GET/DELETE /api/resume/[id]
// Get resume PDF for preview or delete a resume

import { NextRequest, NextResponse } from 'next/server';
import { getResumeById, deleteResume, getDefaultResume } from '@/lib/db';

// Force Node.js runtime for file buffer handling
export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const result = await getResumeById(id);

        if (!result) {
            return NextResponse.json(
                { error: 'Resume not found' },
                { status: 404 }
            );
        }

        if (!result.file_data) {
            return NextResponse.json(
                { error: 'Resume file data not available' },
                { status: 404 }
            );
        }

        // Return PDF binary with correct headers
        return new NextResponse(new Uint8Array(result.file_data), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${result.resume.filename}"`,
            },
        });
    } catch (error) {
        console.error('Error fetching resume:', error);
        return NextResponse.json(
            { error: 'Failed to fetch resume' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        // Check if this is the default resume
        const defaultResume = await getDefaultResume();
        if (defaultResume?.id === id) {
            return NextResponse.json(
                { error: 'Cannot delete the default resume. Set another resume as default first.' },
                { status: 400 }
            );
        }

        // Check if resume exists
        const result = await getResumeById(id);
        if (!result) {
            return NextResponse.json(
                { error: 'Resume not found' },
                { status: 404 }
            );
        }

        await deleteResume(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting resume:', error);
        return NextResponse.json(
            { error: 'Failed to delete resume' },
            { status: 500 }
        );
    }
}
