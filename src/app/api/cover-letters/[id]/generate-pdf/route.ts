import { NextRequest, NextResponse } from 'next/server';
import { updateCoverLetter, getCoverLetterById } from '@/lib/db';
import { uploadFileToS3, generateS3Key, getSignedDownloadUrl } from '@/lib/s3';

export const runtime = 'nodejs';
export const maxDuration = 60; // Allow up to 60 seconds for PDF generation

import { auth } from '@clerk/nextjs/server';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { id } = await params;
        const { content_html } = await request.json();

        if (!id || !content_html) {
            return NextResponse.json({ error: 'Missing ID or content' }, { status: 400 });
        }

        // Verify cover letter exists
        const coverLetter = await getCoverLetterById(userId, id);
        if (!coverLetter) {
            return NextResponse.json({ error: 'Cover letter not found' }, { status: 404 });
        }

        // Sanitize HTML
        const sanitizedHtml = content_html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
            .replace(/on\w+="[^"]*"/g, "");

        // Update DB with latest content
        await updateCoverLetter(userId, id, { content_html: sanitizedHtml });

        // Generate PDF using Puppeteer
        // Use different setup for Vercel (serverless) vs local
        let browser;

        const isVercel = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME;

        if (isVercel) {
            // Vercel/Lambda: Use @sparticuz/chromium
            const chromium = await import('@sparticuz/chromium');
            const puppeteerCore = await import('puppeteer-core');

            browser = await puppeteerCore.default.launch({
                args: chromium.default.args,
                executablePath: await chromium.default.executablePath(),
                headless: true,
            });
        } else {
            // Local: Use regular puppeteer
            const puppeteer = await import('puppeteer');
            browser = await puppeteer.default.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
            });
        }

        const page = await browser.newPage();

        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: 'Times New Roman', serif; padding: 40px; font-size: 12pt; line-height: 1.5; }
                    p { margin-bottom: 15px; }
                </style>
            </head>
            <body>
                ${sanitizedHtml}
            </body>
            </html>
        `, { waitUntil: 'domcontentloaded' });

        const pdfBuffer = await page.pdf({
            format: 'Letter',
            printBackground: true,
            margin: {
                top: '1in',
                bottom: '1in',
                left: '1in',
                right: '1in'
            }
        });

        await browser.close();

        // Upload to S3 with Content-Disposition for download
        const s3Key = generateS3Key('cover-letters', `cl_${id}.pdf`);
        await uploadFileToS3(Buffer.from(pdfBuffer), s3Key, 'application/pdf');

        // Get signed URL with download disposition
        const signedUrl = await getSignedDownloadUrl(s3Key, 3600, 'cover_letter.pdf');

        await updateCoverLetter(userId, id, {
            s3_key: s3Key,
            pdf_blob_url: signedUrl,
            status: 'generated'
        });

        return NextResponse.json({
            success: true,
            url: signedUrl,
            filename: 'cover_letter.pdf'
        });

    } catch (error: any) {
        console.error('PDF Generation Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF', details: error.message },
            { status: 500 }
        );
    }
}
