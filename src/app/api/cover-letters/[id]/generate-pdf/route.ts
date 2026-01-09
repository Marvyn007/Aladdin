import { NextRequest, NextResponse } from 'next/server';
import { updateCoverLetter, getCoverLetterById, getJobById } from '@/lib/db';
import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { content_html } = await request.json();

        if (!id || !content_html) {
            return NextResponse.json({ error: 'Missing ID or content' }, { status: 400 });
        }

        // Verify cover letter exists
        const coverLetter = await getCoverLetterById(id);
        if (!coverLetter) {
            return NextResponse.json({ error: 'Cover letter not found' }, { status: 404 });
        }

        // Sanitize HTML (Basic strip)
        const sanitizedHtml = content_html
            .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "")
            .replace(/on\w+="[^"]*"/g, "");

        // 1. Update DB with latest content
        await updateCoverLetter(id, { content_html: sanitizedHtml });

        // 2. Generate PDF using Puppeteer
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'] // Safer for containerized envs if any
        });
        const page = await browser.newPage();

        // Set content with some basic styling for PDF
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

        // 3. Save PDF to public/downloads
        const downloadsDir = path.join(process.cwd(), 'public', 'downloads');
        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir, { recursive: true });
        }

        // Generate filename
        const filename = `cover_letter_${id}_${Date.now()}.pdf`;
        const filePath = path.join(downloadsDir, filename);

        fs.writeFileSync(filePath, pdfBuffer);

        // 4. Update DB with URL
        const downloadUrl = `/downloads/${filename}`;
        await updateCoverLetter(id, { pdf_blob_url: downloadUrl });

        return NextResponse.json({
            success: true,
            url: downloadUrl,
            filename: 'marvin_chaudhary_cover_letter.pdf' // Suggested filename for client
        });

    } catch (error) {
        console.error('PDF Generation Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate PDF' },
            { status: 500 }
        );
    }
}
