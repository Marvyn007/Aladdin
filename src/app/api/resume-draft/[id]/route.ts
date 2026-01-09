/**
 * Resume Draft API Route
 * GET/PUT/DELETE /api/resume-draft/[id]
 */

import { NextRequest, NextResponse } from 'next/server';
import { saveDraft, loadDraft, deleteDraft } from '@/lib/enhanced-tailored-resume-service';

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET - Load a draft
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const userId = request.headers.get('x-user-id') || 'default';

        const draft = await loadDraft(userId, id);

        if (!draft) {
            return NextResponse.json(
                { error: 'Draft not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, resume: draft });
    } catch (error: any) {
        console.error('Failed to load draft:', error);
        return NextResponse.json(
            { error: 'Failed to load draft' },
            { status: 500 }
        );
    }
}

// PUT - Save/update a draft
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const userId = request.headers.get('x-user-id') || 'default';
        const body = await request.json();

        if (!body.resume) {
            return NextResponse.json(
                { error: 'Resume data is required' },
                { status: 400 }
            );
        }

        // Ensure ID matches
        body.resume.id = id;

        const result = await saveDraft(userId, body.resume);

        if (result.success) {
            return NextResponse.json({ success: true, id: result.id });
        } else {
            return NextResponse.json(
                { error: result.error },
                { status: 500 }
            );
        }
    } catch (error: any) {
        console.error('Failed to save draft:', error);
        return NextResponse.json(
            { error: 'Failed to save draft' },
            { status: 500 }
        );
    }
}

// DELETE - Remove a draft
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const userId = request.headers.get('x-user-id') || 'default';

        const success = await deleteDraft(userId, id);

        if (success) {
            return NextResponse.json({ success: true });
        } else {
            return NextResponse.json(
                { error: 'Draft not found or could not be deleted' },
                { status: 404 }
            );
        }
    } catch (error: any) {
        console.error('Failed to delete draft:', error);
        return NextResponse.json(
            { error: 'Failed to delete draft' },
            { status: 500 }
        );
    }
}
