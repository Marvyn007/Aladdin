/**
 * Resume PDF Rendering API Route
 * POST /api/render-resume-pdf
 *
 * Renders resume data to PDF and returns the PDF binary
 */

import { NextRequest, NextResponse } from 'next/server';
import { renderResumeHtml, CLASSIC_TEMPLATE_CSS, MODERN_TEMPLATE_CSS } from '@/lib/resume-templates';
import type { TailoredResumeData } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { resume } = body as { resume: TailoredResumeData };

        if (!resume) {
            return NextResponse.json(
                { error: 'Resume data is required' },
                { status: 400 }
            );
        }

        // Render to HTML with full page structure
        const html = renderResumeHtml(resume);

        // For now, return HTML - client will use html2canvas + jsPDF
        // In the future, we could use Puppeteer for server-side PDF generation
        return NextResponse.json({
            success: true,
            html,
            css: resume.design.template === 'modern' ? MODERN_TEMPLATE_CSS : CLASSIC_TEMPLATE_CSS,
        });

    } catch (error: any) {
        console.error('PDF render error:', error);
        return NextResponse.json(
            { error: 'Failed to render PDF', details: error.message },
            { status: 500 }
        );
    }
}
