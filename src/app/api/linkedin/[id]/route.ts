
import { NextRequest, NextResponse } from 'next/server';
import { getLinkedInProfileById, deleteLinkedInProfile } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export const runtime = 'nodejs';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) return new NextResponse('Unauthorized', { status: 401 });

        const { id } = await params;
        const result = await getLinkedInProfileById(userId, id);

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
        const { userId } = await auth();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { id } = await params;
        await deleteLinkedInProfile(userId, id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting LinkedIn profile:', error);
        return NextResponse.json(
            { error: 'Failed to delete LinkedIn profile' },
            { status: 500 }
        );
    }
}
