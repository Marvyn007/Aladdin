// API Route: POST /api/upload-linkedin
// Upload a LinkedIn PDF export, parse it with Gemini, and store the result

import { NextRequest, NextResponse } from 'next/server';
import { insertLinkedInProfile, getLinkedInProfile } from '@/lib/db';

// Force Node.js runtime (not Edge) for file buffer handling
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

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

        // Store in database WITHOUT parsing
        const profile = await insertLinkedInProfile(
            file.name,
            {} as any, // parsedJson null/empty
            buffer
        );

        return NextResponse.json({
            success: true,
            profile: {
                id: profile.id,
                filename: profile.filename,
                parsed_json: null,
            },
        });
    } catch (error) {
        console.error('Error uploading LinkedIn profile:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to upload LinkedIn profile' },
            { status: 500 }
        );
    }
}

// GET: Get all LinkedIn profiles
export async function GET() {
    try {
        const { getAllLinkedInProfiles } = await import('@/lib/db');
        const profiles = await getAllLinkedInProfiles();
        return NextResponse.json({ profiles });
    } catch (error) {
        console.error('Error fetching LinkedIn profiles:', error);
        return NextResponse.json(
            { error: 'Failed to fetch LinkedIn profiles' },
            { status: 500 }
        );
    }
}
