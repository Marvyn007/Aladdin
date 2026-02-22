import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadFileToS3, generateS3Key } from '@/lib/s3';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const companyName = formData.get('name') as string;
        const logoFile = formData.get('logo') as File | null;
        const logoUrl = formData.get('logoUrl') as string | null;

        if (!companyName || companyName.trim().length === 0) {
            return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
        }

        let finalLogoUrl = null;

        // Note: For custom companies attached immediately to jobs,
        // we essentially just need to accept the file, upload to S3, and return the URL.
        // The Job posting itself handles row insertion in DB.

        if (logoFile && logoFile.size > 0) {
            if (logoFile.size > MAX_FILE_SIZE) {
                return NextResponse.json({ error: 'Logo file too large. Max 5MB.' }, { status: 400 });
            }

            const ext = logoFile.name.split('.').pop() || 'png';
            const s3Key = generateS3Key('companies', `${userId}_${Date.now()}_logo.${ext}`);
            const buffer = await logoFile.arrayBuffer();

            finalLogoUrl = await uploadFileToS3(Buffer.from(buffer), s3Key, logoFile.type);
        } else if (logoUrl && logoUrl.trim().length > 0) {
            // Basic validation
            try {
                new URL(logoUrl);
                finalLogoUrl = logoUrl.trim();
            } catch (e) {
                return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
            }
        }

        // Return the resolved items for the frontend to bind
        return NextResponse.json({
            success: true,
            company: {
                name: companyName.trim(),
                logo_url: finalLogoUrl
            }
        });

    } catch (error: any) {
        console.error('[Company API] POST Error:', error);
        return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
    }
}
