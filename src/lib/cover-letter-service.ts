import {
    getJobById,
    getDefaultResume,
    getResumeById,
    updateResume,
    getLinkedInProfile,
    insertCoverLetter,
    updateCoverLetter
} from '@/lib/db';
import { generateCoverLetter, parseResumeFromPdf } from '@/lib/openai';
import { callLLM } from './resume-generation/utils';
import { MASTER_PROFILE_SYSTEM_PROMPT, buildMasterProfileUserPrompt } from './resume-generation/prompts';
import type { MasterProfile } from './resume-generation/types';

export interface GenerationResult {
    success: boolean;
    coverLetter?: any;
    error?: string;
    isRetryable?: boolean;
}

interface MasterProfileWithMeta extends MasterProfile {
    _meta?: {
        generated_at: string;
        sources: {
            resume: boolean;
            linkedin: boolean;
        };
    };
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
    userId: string,
    jobId: string,
    resumeId?: string,
    existingCoverLetterId?: string,
    jobDescription?: string
): Promise<GenerationResult> {
    try {
        // 1. Get Job
        const job = await getJobById(userId, jobId);
        if (!job) throw new Error('Job not found');

        // 2. Get Resume
        let resumeData = null;
        if (resumeId) {
            resumeData = await getResumeById(userId, resumeId);
        } else {
            const defaultResume = await getDefaultResume(userId);
            if (defaultResume) {
                resumeData = await getResumeById(userId, defaultResume.id);
            }
        }

        if (!resumeData) throw new Error('No resume found');

        // 3. Lazy Parse Resume (or force re-parse if data looks invalid)
        let parsedResume = resumeData.resume.parsed_json;

        // Check if we need to re-parse (missing data or placeholder data detected)
        const needsReparsing = !parsedResume ||
            !parsedResume.name ||
            parsedResume.name === 'John Doe' ||
            parsedResume.name === 'Name' ||
            parsedResume.name === '[Your Name]' ||
            (parsedResume.roles?.length === 0 && parsedResume.projects?.length === 0);

        if (needsReparsing && resumeData.file_data) {
            console.log(`[Service] Parsing resume ${resumeData.resume.id} (force: previous data was invalid or empty)`);
            try {
                parsedResume = await parseResumeFromPdf(resumeData.file_data);
                if (!parsedResume) throw new Error("Failed to parse resume content");
                await updateResume(userId, resumeData.resume.id, { parsed_json: parsedResume });
                console.log(`[Service] Resume re-parsed successfully, name: ${parsedResume.name}`);
            } catch (err) {
                console.error("Failed to parse resume:", err);
                throw new Error("Failed to parse resume PDF");
            }
        }

        if (!parsedResume) throw new Error('Resume could not be parsed');

        // 4. Get LinkedIn (Optional)
        const linkedInProfile = await getLinkedInProfile(userId);

        // DEBUG: Log what data is being passed to AI
        console.log('[Cover Letter] Resume data being used:', {
            name: parsedResume.name,
            email: parsedResume.email,
            rolesCount: parsedResume.roles?.length || 0,
            firstRole: parsedResume.roles?.[0] ? {
                title: parsedResume.roles[0].title,
                company: parsedResume.roles[0].company
            } : null,
            skillsCount: parsedResume.skills?.length || 0,
            projectsCount: parsedResume.projects?.length || 0,
            firstProject: parsedResume.projects?.[0]?.title || null
        });

        if (linkedInProfile?.parsed_json) {
            console.log('[Cover Letter] LinkedIn data being used:', {
                name: linkedInProfile.parsed_json.name,
                rolesCount: linkedInProfile.parsed_json.roles?.length || 0
            });
        } else {
            console.log('[Cover Letter] No LinkedIn profile available');
        }

        // 5. Build Master Profile by merging Resume + LinkedIn
        console.log('[Cover Letter] Building Master Profile...');
        const masterProfilePrompt = buildMasterProfileUserPrompt(
            parsedResume,
            linkedInProfile?.parsed_json || undefined
        );

        const masterProfileResponse = await callLLM(
            [
                { role: "system", content: MASTER_PROFILE_SYSTEM_PROMPT },
                { role: "user", content: masterProfilePrompt }
            ],
            {
                model: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
                jsonMode: true
            }
        );

        const masterProfile: MasterProfileWithMeta = JSON.parse(masterProfileResponse);
        masterProfile._meta = {
            generated_at: new Date().toISOString(),
            sources: {
                resume: true,
                linkedin: !!linkedInProfile?.parsed_json
            }
        };

        console.log('[Cover Letter] Master Profile built successfully');

        // 6. Generate with AI using Master Profile
        const result = await generateCoverLetter(
            masterProfile,
            job,
            jobDescription
        );

        // 7. Format HTML from plain text
        const contentHtml = `
      <div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; max-width: 700px; color: #000;">
        ${result.text.split('\n\n').map(p => `<p style="margin-bottom: 1em;">${p.replace(/\n/g, '<br>')}</p>`).join('')}
      </div>
    `;

        // 8. Store Result (including master profile JSON for audit/debug)
        let coverLetter;
        const coverLetterData: any = {
            content_html: contentHtml,
            content_text: result.text,
            status: 'generated'
        };

        // Store master profile in metadata for audit/debug (if the table supports it)
        // We'll store it as a temporary field - the DB might not have this column but that's OK
        // The key thing is it's available in memory for the current generation attempt

        if (existingCoverLetterId) {
            coverLetter = await updateCoverLetter(userId, existingCoverLetterId, coverLetterData);
        } else {
            coverLetter = await insertCoverLetter(
                userId,
                jobId,
                resumeData.resume.id,
                contentHtml,
                result.text,
                'generated'
            );
        }

        // Log the master profile for audit
        console.log('[Cover Letter] Master Profile (for audit/debug):', {
            name: masterProfile.basics?.name,
            email: masterProfile.basics?.email,
            sections: masterProfile.sections?.map(s => s.name),
            skillsCount: masterProfile.skills?.length || 0
        });

        return {
            success: true,
            coverLetter: {
                ...coverLetter,
                provider: result.provider,
                masterProfile: masterProfile // Include for debugging/verification
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
            await updateCoverLetter(userId, existingCoverLetterId, { status: 'failed' });
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
export async function queueCoverLetterGeneration(userId: string, jobId: string, resumeId?: string) {
    return await insertCoverLetter(
        userId,
        jobId,
        resumeId || null,
        null,
        null,
        'pending' // Status
    );
}