/**
 * Tailored Resume Service
 * Handles resume generation with AI optimization
 */

import {
    getJobById,
    getDefaultResume,
    getResumeById,
    updateResume,
    getLinkedInProfile,
} from '@/lib/db';
import { generateTailoredResume, parseResumeFromPdf } from '@/lib/gemini';
import type { TailoredResumeResult } from '@/types';

export interface TailoredResumeGenerationResult {
    success: boolean;
    result?: TailoredResumeResult;
    error?: string;
    isRetryable?: boolean;
}

/**
 * Core logic to generate a tailored resume.
 * Handles lazy parsing, LinkedIn data, and AI generation.
 */
export async function performTailoredResumeGeneration(
    userId: string,
    jobId: string,
    jobDescription: string,
    resumeId?: string
): Promise<TailoredResumeGenerationResult> {
    try {
        // 1. Get Job (for context)
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

        if (!resumeData) throw new Error('No resume found. Please upload a resume first.');

        // 3. Lazy Parse Resume
        let parsedResume = resumeData.resume.parsed_json;
        if (!parsedResume && resumeData.file_data) {
            console.log(`[TailoredResume] Lazy parsing resume ${resumeData.resume.id}`);
            try {
                parsedResume = await parseResumeFromPdf(resumeData.file_data);
                await updateResume(userId, resumeData.resume.id, { parsed_json: parsedResume });
            } catch (err) {
                console.error("Failed to parse resume:", err);
                throw new Error("Failed to parse resume PDF");
            }
        }

        if (!parsedResume) throw new Error('Resume could not be parsed');

        // 4. Get LinkedIn (Optional)
        const linkedInProfile = await getLinkedInProfile(userId);

        // 5. Use provided job description OR fallback to stored text
        const effectiveJobDescription = jobDescription || job.normalized_text || job.raw_text_summary || '';

        if (!effectiveJobDescription) {
            throw new Error('No job description available');
        }

        // 6. Generate with AI
        const result = await generateTailoredResume(
            parsedResume,
            linkedInProfile?.parsed_json || null,
            effectiveJobDescription
        );

        return {
            success: true,
            result
        };

    } catch (error: any) {
        console.error('[TailoredResume] Generation failed:', error);

        const msg = error.message || '';
        const isTimeout = msg.includes('timed out') || msg.includes('timeout');
        const isAIError = msg.includes('429') || msg.includes('503') || msg.includes('unavailable');

        return {
            success: false,
            error: msg,
            isRetryable: isTimeout || isAIError
        };
    }
}
