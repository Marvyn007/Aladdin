
import { NextRequest, NextResponse } from 'next/server';
import {
    getResumes,
    insertResume,
    deleteResume,
    setDefaultResume
} from '@/lib/db';
import { auth } from '@clerk/nextjs/server';


export const runtime = 'nodejs';

// GET: List all resumes
export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const resumes = await getResumes(userId);
        return NextResponse.json({ resumes });
    } catch (error) {
        console.error('Error fetching resumes:', error);
        return NextResponse.json(
            { error: 'Failed to fetch resumes' },
            { status: 500 }
        );
    }
}

// POST: Upload a new resume
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const setAsDefault = formData.get('setAsDefault') === 'true';

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        if (!file.name.toLowerCase().endsWith('.pdf')) {
            return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Insert resume (lazy parsing assumed or not triggered here, standard insertResume logic)
        // Note: insertResume signature: (userId, filename, parsedJson, isDefault, fileData)
        // We pass empty object for parsedJson initially, usually parsed later or if fileData is passed, maybe db parses? 
        // No, based on upload-linkedin, we pass empty object.
        const resume = await insertResume(
            userId,
            file.name,
            {} as any,
            setAsDefault,
            buffer
        );

        return NextResponse.json({ success: true, resume });
    } catch (error) {
        console.error('Error uploading resume:', error);
        return NextResponse.json(
            { error: 'Failed to upload resume' },
            { status: 500 }
        );
    }
}

// PATCH: Update resume (e.g. set default)
export async function PATCH(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { resumeId, action } = await request.json();

        if (action === 'setDefault' && resumeId) {
            await setDefaultResume(userId, resumeId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
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
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Resume ID is required' }, { status: 400 });
        }

        await deleteResume(userId, id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting resume:', error);
        return NextResponse.json(
            { error: 'Failed to delete resume' },
            { status: 500 }
        );
    }
}
