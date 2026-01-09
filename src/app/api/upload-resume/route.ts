// API Route: POST /api/upload-resume
// Upload a PDF resume, parse it with Gemini, and store the result

import { NextRequest, NextResponse } from 'next/server';
import { insertResume, getResumes, setDefaultResume } from '@/lib/db';

// Force Node.js runtime (not Edge) for file buffer handling
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const setAsDefault = formData.get('setAsDefault') === 'true';

        if (!file) {
            return NextResponse.json(
                { error: 'No file provided' },
                { status: 400 }
            );
        }

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json(
                { error: 'Only PDF files are allowed' },
                { status: 400 }
            );
        }

        // Get file buffer
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Check if this is the first resume (should be default)
        const existingResumes = await getResumes();
        const shouldBeDefault = setAsDefault || existingResumes.length === 0;

        // Store in database WITHOUT parsing (Lazy parsing happens later)
        const resume = await insertResume(
            file.name,
            {} as any, // parsedJson null/empty initially
            shouldBeDefault,
            buffer
        );

        return NextResponse.json({
            success: true,
            resume: {
                id: resume.id,
                filename: resume.filename,
                is_default: resume.is_default,
                parsed_json: null, // Explicitly null
            },
        });
    } catch (error) {
        console.error('Error uploading resume:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload resume' },
            { status: 500 }
        );
    }
}

// GET: List all resumes
export async function GET() {
    try {
        const resumes = await getResumes();
        return NextResponse.json({ resumes });
    } catch (error) {
        console.error('Error fetching resumes:', error);
        return NextResponse.json(
            { error: 'Failed to fetch resumes' },
            { status: 500 }
        );
    }
}

// PUT: Set a resume as default
export async function PUT(request: NextRequest) {
    try {
        const { resumeId } = await request.json();

        if (!resumeId) {
            return NextResponse.json(
                { error: 'Resume ID is required' },
                { status: 400 }
            );
        }

        await setDefaultResume(resumeId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error setting default resume:', error);
        return NextResponse.json(
            { error: 'Failed to set default resume' },
            { status: 500 }
        );
    }
}

// PATCH: Set default or other actions
export async function PATCH(request: NextRequest) {
    try {
        const { resumeId, action } = await request.json();

        if (!resumeId) {
            return NextResponse.json(
                { error: 'Resume ID is required' },
                { status: 400 }
            );
        }

        if (action === 'setDefault') {
            await setDefaultResume(resumeId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
        );
    } catch (error) {
        console.error('Error updating resume:', error);
        return NextResponse.json(
            { error: 'Failed to update resume' },
            { status: 500 }
        );
    }
}

// DELETE: Delete a resume
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Resume ID is required' },
                { status: 400 }
            );
        }

        const { deleteResume } = await import('@/lib/db');
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
