/**
 * AI Client - Using 3-Tier Provider Router
 * 
 * All AI calls go through the router which handles:
 * - Priority: Gemini A → Gemini B → OpenRouter
 * - Health tracking and cooldowns
 * - Rate limit detection
 * - Graceful fallbacks
 */

import { routeAICall, routeMultimodalCall, isAIAvailable, getStatusMessage } from './ai-router';
import {
    RESUME_PARSER_PROMPT,
    SCORER_PROMPT,
    COVER_LETTER_PROMPT,
    JOB_CLEANUP_PROMPT,
    BATCH_SCORER_PROMPT,
    TAILORED_RESUME_PROMPT,
    JOB_AUTHENTICITY_PROMPT
} from './gemini-prompts';
import type {
    ParsedResume,
    ScoreResult,
    CoverLetterResult,
    TailoredResumeResult,
    Job
} from '@/types';

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract JSON from AI text response (handles markdown code blocks)
 */
function extractJson<T>(text: string): T {
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) ||
        text.match(/```\s*([\s\S]*?)\s*```/) ||
        [null, text];

    const jsonStr = jsonMatch[1] || text;

    try {
        return JSON.parse(jsonStr.trim()) as T;
    } catch (error) {
        console.error('[AI Client] Failed to parse JSON:', error);
        console.error('[AI Client] Raw text:', text.substring(0, 500));
        throw new Error('Invalid AI response format');
    }
}

/**
 * Convert Buffer to inline data part for multimodal calls
 */
function toInlineData(buffer: Buffer, mimeType: string) {
    return {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType
        }
    };
}

/**
 * Generate a deterministic "jitter" value based on job characteristics
 * Ensures scores are precise (e.g., 73 not 70) without randomness
 */
function getPrecisionOffset(job: Job): number {
    const str = `${job.id}${job.title}${job.company}${job.location}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash % 9) + 1;
}

/**
 * Ensure score is not a round number (ending in 0 or 5)
 */
function ensurePreciseScore(score: number, job: Job): number {
    const lastDigit = score % 10;
    if (lastDigit === 0 || lastDigit === 5) {
        const offset = getPrecisionOffset(job);
        if (score + offset <= 100) {
            return score + offset;
        } else {
            return score - offset;
        }
    }
    return score;
}

// pdf-parse doesn't have proper ESM exports
const pdfParse = require('pdf-parse');

// ============================================================================
// PUBLIC API FUNCTIONS
// ============================================================================

/**
 * Parse resume PDF directly using AI
 * Primary: Use Gemini multimodal (direct PDF parsing)
 * Fallback: Extract text from PDF, then use any available AI provider
 */
export async function parseResumeFromPdf(fileBuffer: Buffer): Promise<ParsedResume> {
    // First, try multimodal (Gemini only)
    try {
        console.log('[Resume Parser] Attempting multimodal PDF parsing...');
        const prompt = [
            RESUME_PARSER_PROMPT,
            toInlineData(fileBuffer, 'application/pdf')
        ];
        const text = await routeMultimodalCall(prompt);
        console.log('[Resume Parser] ✓ Multimodal parsing succeeded');
        return extractJson<ParsedResume>(text);
    } catch (multimodalError: any) {
        console.warn('[Resume Parser] Multimodal failed:', multimodalError.message);
        console.log('[Resume Parser] Falling back to text extraction + AI...');
    }

    // Fallback: Extract text from PDF, then use text-based AI (works with OpenRouter)
    try {
        const pdfData = await pdfParse(fileBuffer);
        const resumeText = pdfData.text;

        if (!resumeText || resumeText.trim().length < 50) {
            throw new Error('PDF text extraction returned too little content');
        }

        console.log(`[Resume Parser] Extracted ${resumeText.length} chars from PDF`);

        // Use text-based parsing (works with any provider including OpenRouter)
        const prompt = `${RESUME_PARSER_PROMPT}\n\nResume text:\n${resumeText}`;
        const text = await routeAICall(prompt);
        console.log('[Resume Parser] ✓ Text-based parsing succeeded');
        return extractJson<ParsedResume>(text);
    } catch (textError: any) {
        console.error('[Resume Parser] Text extraction fallback also failed:', textError.message);
        throw new Error('AI services temporarily unavailable. Please try again later.');
    }
}

/**
 * Parse resume text into structured JSON
 */
export async function parseResume(resumeText: string): Promise<ParsedResume> {
    const prompt = `${RESUME_PARSER_PROMPT}\n\nResume text:\n${resumeText}`;
    const text = await routeAICall(prompt);
    return extractJson<ParsedResume>(text);
}

/**
 * Score a single job against resume and optional LinkedIn profile
 */
export async function scoreJob(
    resumeJson: ParsedResume,
    linkedinJson: ParsedResume | null,
    job: Job
): Promise<ScoreResult> {
    const jobMeta = {
        id: job.id,
        title: job.title,
        company: job.company,
        location: job.location,
        posted_at: job.posted_at,
        source_url: job.source_url
    };

    // Guard: If no resume, return 0 score instantly
    if (!resumeJson || Object.keys(resumeJson).length === 0) {
        return {
            job_id: job.id,
            match_score: 0,
            matched_skills: [],
            missing_important_skills: [],
            level_match: 'no',
            why: 'No resume provided for scoring'
        };
    }

    const prompt = `${SCORER_PROMPT}

ResumeJSON:
${JSON.stringify(resumeJson, null, 2)}

${linkedinJson ? `LinkedInJSON:\n${JSON.stringify(linkedinJson, null, 2)}` : 'LinkedInJSON: null'}

JobText:
${job.normalized_text || job.raw_text_summary || job.title}

JobMeta:
${JSON.stringify(jobMeta, null, 2)}`;

    try {
        const text = await routeAICall(prompt);
        const parsed = extractJson<ScoreResult>(text);
        parsed.job_id = job.id;
        // Ensure score is precise (not a round number)
        parsed.match_score = ensurePreciseScore(parsed.match_score, job);
        return parsed;
    } catch (error) {
        console.error('[scoreJob] Error:', error);
        // Return fallback with precise score
        // Return 0 fallback score
        return {
            job_id: job.id,
            match_score: 0,
            matched_skills: [],
            missing_important_skills: [],
            level_match: 'no',
            why: 'AI services temporarily unavailable'
        };
    }
}

/**
 * Score multiple jobs relative to each other for accurate comparison
 * Produces distributed, precise scores (73, 86, 41) instead of round numbers
 */
export async function batchScoreJobs(
    resumeJson: ParsedResume,
    linkedinJson: ParsedResume | null,
    jobs: Job[]
): Promise<ScoreResult[]> {
    if (jobs.length === 0) return [];

    // Guard: If no resume, return 0 for all jobs
    if (!resumeJson || Object.keys(resumeJson).length === 0) {
        return jobs.map(j => ({
            job_id: j.id,
            match_score: 0,
            matched_skills: [],
            missing_important_skills: [],
            level_match: 'no',
            why: 'No resume provided'
        }));
    }

    // For small batches (1-2 jobs), use individual scoring
    if (jobs.length <= 2) {
        const results = await Promise.all(
            jobs.map(job => scoreJob(resumeJson, linkedinJson, job))
        );
        return results;
    }

    // For larger batches, use comparative scoring
    const jobsData = jobs.map(j => ({
        id: j.id,
        title: j.title,
        company: j.company,
        location: j.location,
        posted_at: j.posted_at,
        description: (j.normalized_text || j.raw_text_summary || '').substring(0, 600)
    }));

    const prompt = `${BATCH_SCORER_PROMPT}

ResumeJSON:
${JSON.stringify(resumeJson, null, 2)}

${linkedinJson ? `LinkedInJSON:\n${JSON.stringify(linkedinJson, null, 2)}` : 'LinkedInJSON: null'}

Jobs to Score (compare these against each other):
${JSON.stringify(jobsData, null, 2)}`;

    try {
        const text = await routeAICall(prompt);
        const parsed = extractJson<ScoreResult[]>(text);

        // Ensure all scores are precise
        const results = parsed.map((result, idx) => {
            result.job_id = jobs[idx]?.id || result.job_id;
            result.match_score = ensurePreciseScore(result.match_score, jobs[idx]);
            return result;
        });

        // Ensure no duplicate scores
        const seenScores = new Set<number>();
        for (const result of results) {
            while (seenScores.has(result.match_score)) {
                result.match_score = result.match_score > 50
                    ? result.match_score - 1
                    : result.match_score + 1;
            }
            seenScores.add(result.match_score);
        }

        return results;
    } catch (error) {
        console.error('[batchScoreJobs] Error, falling back to individual:', error);
        // Fallback to individual scoring
        const results = await Promise.all(
            jobs.map(job => scoreJob(resumeJson, linkedinJson, job))
        );
        return results;
    }
}

/**
 * Generate cover letter for a job
 * Returns plain text - NO JSON parsing
 */
export async function generateCoverLetter(
    resumeJson: ParsedResume,
    linkedinJson: ParsedResume | null,
    job: Job,
    jobDescription?: string
): Promise<{ text: string; provider?: string }> {
    const { truncateInput, INPUT_LIMITS } = await import('./adapters/ollama');
    const { routeAICallWithDetails } = await import('./ai-router');

    const jobMeta = {
        title: job.title,
        company: job.company,
        location: job.location
    };

    // Truncate inputs to prevent timeout
    const jobText = truncateInput(
        jobDescription || job.normalized_text || job.raw_text_summary || job.title,
        INPUT_LIMITS.JOB_TEXT,
        'jobText'
    );

    const resumeText = truncateInput(
        JSON.stringify(resumeJson, null, 2),
        INPUT_LIMITS.RESUME_TEXT,
        'resumeText'
    );

    const linkedinText = linkedinJson
        ? truncateInput(JSON.stringify(linkedinJson, null, 2), INPUT_LIMITS.LINKEDIN_TEXT, 'linkedinText')
        : null;

    // Extract key info for explicit highlighting
    const candidateName = resumeJson.name || 'Unknown';
    const candidateEmail = resumeJson.email || '';
    const recentRole = resumeJson.roles?.[0];
    const recentProject = resumeJson.projects?.[0];
    const topSkills = resumeJson.skills?.slice(0, 5).map(s => s.name).join(', ') || '';

    const prompt = `${COVER_LETTER_PROMPT}

=== CANDIDATE INFORMATION (USE THIS DATA) ===
Candidate Name: ${candidateName}
Email: ${candidateEmail}
${recentRole ? `Most Recent Role: ${recentRole.title} at ${recentRole.company}` : ''}
${recentProject ? `Notable Project: ${recentProject.title}` : ''}
Top Skills: ${topSkills}

=== FULL RESUME DATA (JSON) ===
${resumeText}

${linkedinText ? `=== LINKEDIN PROFILE DATA (JSON) ===\n${linkedinText}` : ''}

=== JOB TO APPLY FOR ===
Company: ${jobMeta.company}
Role: ${jobMeta.title}
Location: ${jobMeta.location}

Job Description:
${jobText}

IMPORTANT: Write the cover letter for ${candidateName}, referencing their experience at ${recentRole?.company || 'their previous company'} and their work on ${recentProject?.title || 'their projects'}. Sign the letter as "${candidateName}".`;

    console.log(`[Cover Letter] Prompt length: ${prompt.length} chars`);

    // Get result with provider details
    const result = await routeAICallWithDetails(prompt);

    if (!result.success) {
        throw new Error(result.error || 'Cover letter generation failed');
    }

    // Clean up the response - remove any markdown or code fences
    let cleanText = result.text.trim();

    // Remove code fences if present
    if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '');
    }

    // Remove JSON wrapper if AI included it anyway
    if (cleanText.startsWith('{') && cleanText.includes('"cover_letter"')) {
        try {
            const parsed = JSON.parse(cleanText);
            if (parsed.cover_letter) {
                cleanText = parsed.cover_letter;
            }
        } catch {
            // Not JSON, use as-is
        }
    }

    console.log(`[Cover Letter] Generated ${cleanText.length} chars via ${result.provider} (${result.model})`);

    return {
        text: cleanText,
        provider: result.provider
    };
}

/**
 * Filter a batch of jobs using AI
 */
export async function batchFilterJobs(jobs: Job[]): Promise<{ deleteIds: string[], reasons: Record<string, string> }> {
    if (jobs.length === 0) return { deleteIds: [], reasons: {} };

    const jobsData = jobs.map(j => ({
        id: j.id,
        title: j.title,
        company: j.company,
        description: (j.raw_text_summary || j.normalized_text || '').substring(0, 800)
    }));

    const prompt = `${JOB_CLEANUP_PROMPT}

Job List Input:
${JSON.stringify(jobsData, null, 2)}`;

    try {
        const text = await routeAICall(prompt);
        const parsed = extractJson<any>(text);
        return {
            deleteIds: parsed.delete_ids || [],
            reasons: parsed.reasons || {}
        };
    } catch (error) {
        console.error('[batchFilterJobs] Error:', error);
        return { deleteIds: [], reasons: {} };
    }
}

/**
 * Generate a tailored resume optimized for a specific job description
 * Enhances resume with missing keywords while preserving authenticity
 */
export async function generateTailoredResume(
    resumeJson: ParsedResume,
    linkedinJson: ParsedResume | null,
    jobDescription: string
): Promise<TailoredResumeResult> {
    const { truncateInput, INPUT_LIMITS } = await import('./adapters/ollama');
    const { routeAICallWithDetails } = await import('./ai-router');

    // Truncate inputs to prevent timeout
    const jobText = truncateInput(
        jobDescription,
        INPUT_LIMITS.JOB_TEXT,
        'jobDescription'
    );

    const resumeText = truncateInput(
        JSON.stringify(resumeJson, null, 2),
        INPUT_LIMITS.RESUME_TEXT,
        'resumeText'
    );

    const linkedinText = linkedinJson
        ? truncateInput(JSON.stringify(linkedinJson, null, 2), INPUT_LIMITS.LINKEDIN_TEXT, 'linkedinText')
        : null;

    const prompt = `${TAILORED_RESUME_PROMPT}

Base Resume:
${resumeText}

${linkedinText ? `LinkedIn:\n${linkedinText}` : ''}

Job Description:
${jobText}`;

    console.log(`[Tailored Resume] Prompt length: ${prompt.length} chars`);

    const result = await routeAICallWithDetails(prompt);

    if (!result.success) {
        throw new Error(result.error || 'Tailored resume generation failed');
    }

    // Parse JSON response
    try {
        const parsed = extractJson<TailoredResumeResult>(result.text);

        // Validate required fields
        if (!parsed.resume_html) {
            throw new Error('Missing resume_html in response');
        }

        console.log(`[Tailored Resume] Generated resume with ${parsed.added_keywords?.length || 0} added keywords, confidence: ${parsed.confidence_score}`);

        return {
            resume_html: parsed.resume_html,
            added_keywords: parsed.added_keywords || [],
            confidence_score: parsed.confidence_score || 0.5
        };
    } catch (parseError: any) {
        console.error('[Tailored Resume] Failed to parse AI response:', parseError.message);

        // Fallback: Return a minimal resume structure with original data
        console.log('[Tailored Resume] Using fallback - returning original resume as HTML');

        const fallbackHtml = generateFallbackResumeHtml(resumeJson);

        return {
            resume_html: fallbackHtml,
            added_keywords: [],
            confidence_score: 0.3
        };
    }
}

/**
 * Generate fallback HTML resume from parsed JSON (no AI enhancement)
 */
function generateFallbackResumeHtml(resume: ParsedResume): string {
    const skills = resume.skills?.map(s => s.name).join(', ') || '';
    const languages = resume.languages?.join(', ') || '';
    const frameworks = resume.frameworks?.join(', ') || '';
    const tools = resume.tools?.join(', ') || '';

    const experienceHtml = resume.roles?.map(role => `
        <div class="role">
            <div class="role-header">
                <span class="company">${role.company}</span>
                <span class="dates">${role.start || ''} - ${role.end || 'Present'}</span>
            </div>
            <div class="role-title">${role.title}</div>
            <ul>
                <li>${role.description}</li>
            </ul>
        </div>
    `).join('') || '';

    const projectsHtml = resume.projects?.map(project => `
        <div class="project">
            <div class="project-header">
                <span class="project-name">${project.title}</span>
                <span class="tech">${project.tech?.join(', ') || ''}</span>
            </div>
            <ul>
                <li>${project.description}</li>
            </ul>
        </div>
    `).join('') || '';

    const educationHtml = resume.education?.map(edu => `
        <div class="edu-entry">
            <span class="school">${edu.school}</span>
            <span class="dates">${edu.start} - ${edu.end}</span>
            <div class="degree">${edu.degree}</div>
        </div>
    `).join('') || '';

    return `
<div class="resume">
    <header>
        <h1>${resume.name || 'Name'}</h1>
        <div class="contact">${resume.email || ''} | ${resume.location || ''}</div>
    </header>
    
    <section class="skills">
        <h2>TECHNICAL SKILLS</h2>
        <p><strong>Languages:</strong> ${languages || skills}</p>
        <p><strong>Frameworks:</strong> ${frameworks}</p>
        <p><strong>Tools:</strong> ${tools}</p>
    </section>
    
    <section class="experience">
        <h2>EXPERIENCE</h2>
        ${experienceHtml}
    </section>
    
    <section class="projects">
        <h2>PROJECTS</h2>
        ${projectsHtml}
    </section>
    
    <section class="education">
        <h2>EDUCATION</h2>
        ${educationHtml}
    </section>
</div>
    `.trim();
}

/**
 * Check if AI is configured and accessible
 */
export async function checkGeminiConnection(): Promise<boolean> {
    if (!isAIAvailable()) {
        console.log('[AI Client] No providers available');
        return false;
    }

    try {
        await routeAICall('Say "OK" if you can read this.');
        return true;
    } catch (error) {
        console.error('[AI Client] Connection check failed:', error);
        return false;
    }
}

/**
 * Get status message for UI
 */
export function getAIStatus(): string {
    return getStatusMessage();
}

/**
 * Verify Job Authenticity (Mismatch and Fraud Check)
 */
export async function verifyJobAuthenticity(
    scrapedText: string,
    manualData: { title: string; company: string; description: string }
): Promise<{ isAuthentic: boolean; confidence: number; reasoning: string }> {
    const { truncateInput, INPUT_LIMITS } = await import('./adapters/ollama');

    // Truncate scraped text to avoid token bloat
    const cleanScraped = truncateInput(scrapedText, INPUT_LIMITS.JOB_TEXT, 'scrapedText');

    // Truncate manual description
    const cleanManual = truncateInput(manualData.description, INPUT_LIMITS.JOB_TEXT, 'manualDesc');

    const prompt = `${JOB_AUTHENTICITY_PROMPT}

=== SCRAPED PAGE DATA (Ground Truth) ===
${cleanScraped}

=== USER'S MANUAL INPUT ===
Title: ${manualData.title}
Company: ${manualData.company}

Description:
${cleanManual}

Output ONLY valid JSON evaluating if the User's Manual Input matches the Scraped Data AND checking the Scraped Data for scams.`;

    try {
        const text = await routeAICall(prompt);
        console.log('[verifyJobAuthenticity] Raw AI Response:', text);
        const parsed = extractJson<{ isAuthentic: boolean; confidence: number; reasoning: string }>(text);

        // Ensure defaults if AI acts weird
        return {
            isAuthentic: typeof parsed.isAuthentic === 'boolean' ? parsed.isAuthentic : false,
            confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
            reasoning: parsed.reasoning || "Failed to determine authenticity due to AI parsing error."
        };
    } catch (error: any) {
        console.error('[verifyJobAuthenticity] Error:', error.message);
        // Fail-safe: If AI is down, we allow the job to pass (or we could strictly block it).
        // Let's strictly block it or log warning. The user wants security.
        // Let's block it with a specific message.
        return {
            isAuthentic: false,
            confidence: 0,
            reasoning: "Authenticity verification service is temporarily unavailable. Please try again later."
        };
    }
}

/**
 * Re-export router utilities for direct access
 */
export { isAIAvailable, getStatusMessage } from './ai-router';
