
import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInProfileById, deleteLinkedInProfile } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const result = await getLinkedInProfileById(id);

        if (!result || !result.file_data) {
            return new NextResponse('Not found', { status: 404 });
        }

        return new NextResponse(new Uint8Array(result.file_data), {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="${result.profile.filename}"`,
            },
        });
    } catch (error) {
        console.error('Error serving LinkedIn PDF:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await deleteLinkedInProfile(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting LinkedIn profile:', error);
        return NextResponse.json(
            { error: 'Failed to delete LinkedIn profile' },
            { status: 500 }
        );
    }
}
