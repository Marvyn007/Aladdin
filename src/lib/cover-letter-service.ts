
import {
    getJobById,
    getDefaultResume,
    getResumeById,
    updateResume,
    getLinkedInProfile,
    insertCoverLetter,
    updateCoverLetter
} from '@/lib/db';
import { generateCoverLetter, parseResumeFromPdf } from '@/lib/gemini';

export interface GenerationResult {
    success: boolean;
    coverLetter?: any;
    error?: string;
    isRetryable?: boolean;
}

/**
 * Core logic to generate a cover letter.
 * Handles lazy parsing, LinkedIn data, and AI generation.
 * 
 * @param jobId - The job ID
 * @param resumeId - Optional specific resume ID (uses default if null)
 * @param existingCoverLetterId - If provided, updates this record instead of creating new
 */
export async function performCoverLetterGeneration(
    jobId: string,
    resumeId?: string,
    existingCoverLetterId?: string,
    jobDescription?: string
): Promise<GenerationResult> {
    try {
        // 1. Get Job
        const job = await getJobById(jobId);
        if (!job) throw new Error('Job not found');

        // 2. Get Resume
        let resumeData = null;
        if (resumeId) {
            resumeData = await getResumeById(resumeId);
        } else {
            const defaultResume = await getDefaultResume();
            if (defaultResume) {
                resumeData = await getResumeById(defaultResume.id);
            }
        }

        if (!resumeData) throw new Error('No resume found');

        // 3. Lazy Parse Resume
        let parsedResume = resumeData.resume.parsed_json;
        if (!parsedResume && resumeData.file_data) {
            console.log(`[Service] Lazy parsing resume ${resumeData.resume.id}`);
            try {
                parsedResume = await parseResumeFromPdf(resumeData.file_data);
                await updateResume(resumeData.resume.id, { parsed_json: parsedResume });
            } catch (err) {
                console.error("Failed to parse resume:", err);
                throw new Error("Failed to parse resume PDF");
            }
        }

        if (!parsedResume) throw new Error('Resume could not be parsed');

        // 4. Get LinkedIn (Optional)
        const linkedInProfile = await getLinkedInProfile();

        // 5. Generate with AI (returns plain text now)
        const result = await generateCoverLetter(
            parsedResume,
            linkedInProfile?.parsed_json || null,
            job,
            jobDescription
        );

        // 6. Format HTML from plain text
        const contentHtml = `
      <div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; max-width: 700px; color: #000;">
        ${result.text.split('\n\n').map(p => `<p style="margin-bottom: 1em;">${p.replace(/\n/g, '<br>')}</p>`).join('')}
      </div>
    `;

        // 7. Store Result
        let coverLetter;
        if (existingCoverLetterId) {
            coverLetter = await updateCoverLetter(existingCoverLetterId, {
                content_html: contentHtml,
                content_text: result.text,
                status: 'generated'
            });
        } else {
            coverLetter = await insertCoverLetter(
                jobId,
                resumeData.resume.id,
                contentHtml,
                result.text,
                'generated'
            );
        }

        return {
            success: true,
            coverLetter: {
                ...coverLetter,
                provider: result.provider
            }
        };

    } catch (error: any) {
        console.error('[Service] Generation failed:', error);

        // Handle AI Errors
        const msg = error.message || '';

        // Check if it's a timeout (local AI still working)
        const isTimeout = msg.includes('timed out') || msg.includes('timeout');

        // Check if it's a retryable AI error
        const isAIError = msg.includes('429') || msg.includes('503') || msg.includes('unavailable');

        // If updating an existing record, mark as failed
        if (existingCoverLetterId) {
            await updateCoverLetter(existingCoverLetterId, { status: 'failed' });
        }

        // Return user-friendly error message
        if (isTimeout) {
            return {
                success: false,
                error: 'Local AI is still working on your cover letter. Please wait and retry in a moment.',
                isRetryable: true
            };
        }

        return {
            success: false,
            error: msg,
            isRetryable: isAIError
        };
    }
}

/**
 * Queue a generation task
 */
export async function queueCoverLetterGeneration(jobId: string, resumeId?: string) {
    return await insertCoverLetter(
        jobId,
        resumeId || null,
        null,
        null,
        'pending' // Status
    );
}
