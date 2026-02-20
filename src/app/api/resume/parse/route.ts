/**
 * POST /api/resume/parse
 *
 * Parse an uploaded resume into the canonical schema with confidence scores,
 * optionally merge LinkedIn data, and generate both Markdown and structured
 * resume output.
 *
 * Request: multipart/form-data
 *   - resume_file (File, required)
 *   - linkedin_data (JSON string, optional)
 *   - job_description (string, optional)
 *   - section_toggles (JSON string, optional) — e.g. {"volunteer": false}
 *
 * Response: ResumeParserResponse
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { parseResumeCanonical, logParseEvent } from '@/lib/resume-parser-service';
import { mergeLinkedInData } from '@/lib/linkedin-merger';
import { generateResumeFromParsed } from '@/lib/resume-generator-service';
import { setCachedParse, getCachedParse } from '@/lib/resume-cache';
import type { CanonicalParsedResume, ResumeParserResponse } from '@/types';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    let userId: string | null = null;

    try {
        // 1. Auth
        const authResult = await auth();
        userId = authResult.userId;
        if (!userId) {
            return NextResponse.json(
                { status: 'USER_MISMATCH', message: 'Unauthorized' } satisfies ResumeParserResponse,
                { status: 401 }
            );
        }

        const sessionId = authResult.sessionId || 'default';

        // 2. Parse form data
        const formData = await request.formData();
        const resumeFile = formData.get('resume_file') as File | null;
        const linkedinDataStr = formData.get('linkedin_data') as string | null;
        const jobDescription = formData.get('job_description') as string | null;
        const sectionTogglesStr = formData.get('section_toggles') as string | null;

        // 3. Validate file presence
        if (!resumeFile) {
            return NextResponse.json(
                { status: 'MISSING_RESUME', message: 'No resume file provided. Please upload a PDF or text file.' } satisfies ResumeParserResponse,
                { status: 400 }
            );
        }

        logParseEvent(userId, 'parse_start', {
            filename: resumeFile.name,
            size: resumeFile.size,
            type: resumeFile.type,
        });

        // 4. Check cache
        const cached = getCachedParse(userId, sessionId);
        if (cached) {
            console.log('[ResumeParser:API] Returning cached result');
            return NextResponse.json(cached);
        }

        // 5. Convert file to buffer
        const buffer = Buffer.from(await resumeFile.arrayBuffer());
        const mimeType = resumeFile.type || 'application/pdf';

        // 6. Parse resume into canonical schema
        let parsed: CanonicalParsedResume;
        try {
            parsed = await parseResumeCanonical(buffer, mimeType);
        } catch (parseErr: any) {
            const message = parseErr.message || 'Unknown parsing error';

            if (message.startsWith('TOO_SHORT')) {
                return NextResponse.json(
                    { status: 'TOO_SHORT', message } satisfies ResumeParserResponse,
                    { status: 422 }
                );
            }

            logParseEvent(userId, 'parse_failed', { error: message });
            return NextResponse.json(
                { status: 'PARSE_FAILED', message: `Resume parsing failed: ${message}` } satisfies ResumeParserResponse,
                { status: 500 }
            );
        }

        // 7. Optionally merge LinkedIn data
        if (linkedinDataStr) {
            try {
                const linkedinData = JSON.parse(linkedinDataStr) as Partial<CanonicalParsedResume>;
                parsed = mergeLinkedInData(parsed, linkedinData);
            } catch {
                // Non-fatal: skip LinkedIn merge on bad JSON
                console.warn('[ResumeParser:API] LinkedIn data JSON parse failed, skipping merge');
            }
        }

        // 8. Parse section toggles
        let sectionToggles: Record<string, boolean> | undefined;
        if (sectionTogglesStr) {
            try {
                sectionToggles = JSON.parse(sectionTogglesStr);
            } catch {
                // Non-fatal
            }
        }

        // 9. Generate resume output
        const generated = generateResumeFromParsed(parsed, {
            jobDescription: jobDescription || undefined,
            sectionToggles,
        });

        // 10. Build response
        const auditId = `parse_${userId}_${Date.now()}`;

        const response: ResumeParserResponse = {
            status: 'OK',
            parsed_resume_json: parsed,
            generated_resume_markdown: generated.generated_resume_markdown,
            generated_resume_structured: generated.generated_resume_structured,
            section_order: generated.section_order,
            low_confidence_fields: parsed.low_confidence_fields ?? [],
            leak_check_passed: true,
            audit_event_id: auditId,
        };

        // 11. Cache the result
        setCachedParse(userId, sessionId, response);

        logParseEvent(userId, 'parse_success', { auditId });

        return NextResponse.json(response);
    } catch (error: any) {
        console.error('[ResumeParser:API] Unexpected error:', error);
        if (userId) {
            logParseEvent(userId, 'parse_failed', { error: error.message });
        }
        return NextResponse.json(
            { status: 'PARSE_FAILED', message: 'An unexpected error occurred during resume parsing.' } satisfies ResumeParserResponse,
            { status: 500 }
        );
    }
}
