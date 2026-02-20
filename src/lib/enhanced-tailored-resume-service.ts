/**
 * Enhanced Tailored Resume Service
 *
 * User-scoped, profession-agnostic, ATS-optimized resume engine.
 * Uses ONLY data from: user's resume, LinkedIn, and job description.
 * Zero hardcoded personal data, projects, or defaults.
 */

import { v4 as uuid } from 'uuid';
import {
    getJobById,
    getDefaultResume,
    getResumeById,
    updateResume,
    getLinkedInProfile,
} from '@/lib/db';
import { parseResumeFromPdf } from '@/lib/gemini';
import { routeAICallWithDetails, isAIAvailable } from '@/lib/ai-router';
import { ENHANCED_TAILORED_RESUME_PROMPT } from '@/lib/enhanced-resume-prompt';
import { analyzeJobForATS, type ATSScore } from '@/lib/keyword-extractor';
import {
    TailoredResumeData,
    TailoredResumeGenerationResponse,
    KeywordAnalysis,
    LeakCheckResult,
    DEFAULT_RESUME_DESIGN,
} from '@/types';

// ============================================================================
// Rate Limiting
// ============================================================================

const rateLimitState: Record<string, { count: number; resetAt: number }> = {};
const DAILY_QUOTA = 20;

function logAIProviderUsage(data: {
    provider?: string;
    tokens?: number;
    latency: number;
    error?: string;
    timestamp: string;
}) {
    const logEntry = JSON.stringify(data);
    if (data.error) {
        console.error('[AI-Log]', logEntry);
    } else {
        console.log('[AI-Log]', logEntry);
    }
}

function checkRateLimit(userId: string = 'default'): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const dayStart = new Date().setHours(0, 0, 0, 0);

    if (!rateLimitState[userId] || rateLimitState[userId].resetAt < dayStart) {
        rateLimitState[userId] = { count: 0, resetAt: dayStart + 86400000 };
    }

    const state = rateLimitState[userId];
    const remaining = DAILY_QUOTA - state.count;

    return { allowed: remaining > 0, remaining };
}

function incrementRateLimit(userId: string = 'default') {
    if (rateLimitState[userId]) {
        rateLimitState[userId].count++;
    }
}

// ============================================================================
// Utilities
// ============================================================================

async function fetchJobDescriptionFromUrl(url: string): Promise<string> {
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; JobHuntVibe/1.0)',
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch URL: ${response.status}`);
        }

        const html = await response.text();

        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // No truncation — send full data to AI
        return text;
    } catch (error) {
        console.error('Failed to fetch job URL:', error);
        throw new Error('Could not fetch job description from URL');
    }
}

function extractJson<T>(text: string): T {
    // 1. Strip markdown code fences
    let cleaned = text.trim();
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    // 2. Extract the outermost JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No JSON found in AI response');
    }

    let jsonStr = jsonMatch[0];

    // 3. Try direct parse first
    try {
        return JSON.parse(jsonStr) as T;
    } catch (firstError) {
        // Continue to repair attempts
    }

    // 4. Repair common AI JSON issues
    jsonStr = repairJson(jsonStr);

    try {
        return JSON.parse(jsonStr) as T;
    } catch (repairError: any) {
        // 5. Last resort: try to close truncated JSON by balancing braces/brackets
        const balanced = balanceJson(jsonStr);
        try {
            return JSON.parse(balanced) as T;
        } catch (finalError: any) {
            throw new Error(
                `AI response parsing failed: ${finalError.message}. Please try again.`
            );
        }
    }
}

/**
 * Repair common JSON issues produced by AI models:
 * - Trailing commas before } or ]
 * - Single-line // comments
 * - Unescaped newlines inside strings
 * - Unescaped control characters
 */
function repairJson(json: string): string {
    let result = json;

    // Remove single-line comments (// ...) that aren't inside strings
    result = result.replace(/(?<!")\/\/[^\n]*/g, '');

    // Remove trailing commas: ,} or ,]
    result = result.replace(/,\s*([\]}])/g, '$1');

    // Fix unescaped newlines inside string values (common AI mistake)
    // This is tricky — we replace literal newlines between quotes
    result = result.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/g, (match) => {
        return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
    });

    return result;
}

/**
 * Balance truncated JSON by closing any unclosed braces/brackets.
 * Handles the case where the AI response was cut off mid-stream.
 */
function balanceJson(json: string): string {
    let result = json;

    // Remove any trailing partial key-value pair (incomplete string or value)
    // e.g., `"someKey": "unterminated va` → remove the dangling pair
    result = result.replace(/,\s*"[^"]*":\s*"[^"]*$/g, '');
    result = result.replace(/,\s*"[^"]*":\s*$/g, '');
    result = result.replace(/,\s*"[^"]*$/g, '');
    // Remove trailing comma
    result = result.replace(/,\s*$/, '');

    // Count unclosed braces and brackets
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;

    for (const char of result) {
        if (escaped) {
            escaped = false;
            continue;
        }
        if (char === '\\') {
            escaped = true;
            continue;
        }
        if (char === '"') {
            inString = !inString;
            continue;
        }
        if (inString) continue;
        if (char === '{') openBraces++;
        if (char === '}') openBraces--;
        if (char === '[') openBrackets++;
        if (char === ']') openBrackets--;
    }

    // Close any unterminated string
    if (inString) {
        result += '"';
    }

    // Close unclosed brackets and braces
    while (openBrackets > 0) {
        result += ']';
        openBrackets--;
    }
    while (openBraces > 0) {
        result += '}';
        openBraces--;
    }

    return result;
}

// ============================================================================
// Leak Detection — validates that ZERO fabricated data made it into output
// ============================================================================

/**
 * Validates that every field in the generated resume can be traced back
 * to the source resume, LinkedIn data, or job description.
 *
 * Checks: contact info, section items, skills, project names, org names.
 */
export function validateNoLeakedData(
    generated: TailoredResumeData,
    sourceResumeText: string,
    sourceLinkedInText: string,
    sourceJobDescription: string,
): LeakCheckResult {
    const leaked: string[] = [];
    const allSourceText = `${sourceResumeText} ${sourceLinkedInText} ${sourceJobDescription}`.toLowerCase();

    // Check contact fields
    const contact = generated.contact;
    if (contact.name && !allSourceText.includes(contact.name.toLowerCase())) {
        leaked.push(`contact.name: "${contact.name}"`);
    }
    if (contact.email && !allSourceText.includes(contact.email.toLowerCase())) {
        leaked.push(`contact.email: "${contact.email}"`);
    }
    if (contact.phone) {
        // Normalize phone for comparison (strip formatting)
        const phoneDigits = contact.phone.replace(/\D/g, '');
        const sourceDigits = allSourceText.replace(/\D/g, '');
        if (phoneDigits.length >= 7 && !sourceDigits.includes(phoneDigits)) {
            leaked.push(`contact.phone: "${contact.phone}"`);
        }
    }
    if (contact.linkedin && !allSourceText.includes(contact.linkedin.toLowerCase())) {
        leaked.push(`contact.linkedin: "${contact.linkedin}"`);
    }

    // Check skills — each skill should appear in source data
    if (generated.skills) {
        for (const [category, skills] of Object.entries(generated.skills)) {
            if (Array.isArray(skills)) {
                for (const skill of skills) {
                    if (!allSourceText.includes(skill.toLowerCase())) {
                        leaked.push(`skills.${category}: "${skill}"`);
                    }
                }
            }
        }
    }

    // Check section item titles (companies, schools, projects, orgs)
    for (const section of generated.sections || []) {
        for (const item of section.items || []) {
            if (item.title) {
                // Use a relaxed check: at least one significant word should match
                const words = item.title.split(/\s+/).filter(w => w.length > 3);
                const matchCount = words.filter(w => allSourceText.includes(w.toLowerCase())).length;
                if (words.length > 0 && matchCount === 0) {
                    leaked.push(`${section.type}.item.title: "${item.title}"`);
                }
            }
        }
    }

    return {
        passed: leaked.length === 0,
        leaked_fields: leaked,
        details: leaked.length > 0
            ? `LEAK_DETECTED: ${leaked.length} field(s) contain data not found in any source input.`
            : undefined,
    };
}

// ============================================================================
// Resume Building — user data ONLY, no defaults, no templates
// ============================================================================

/**
 * Build a resume data structure using ONLY the user's parsed resume data.
 * No fallback defaults, no hardcoded items.
 */
function buildResumeFromParsed(parsedResume: any): TailoredResumeData {
    const now = new Date().toISOString();

    // 1. Education — from parsed data only
    const educationItems = (parsedResume.education || []).map((edu: any) => {
        const bullets: { id: string; text: string; isSuggested: boolean }[] = [];

        if (edu.relevant_coursework) {
            bullets.push({
                id: uuid(),
                text: `Relevant Coursework: ${edu.relevant_coursework}`,
                isSuggested: false,
            });
        }
        if (edu.description) {
            bullets.push({
                id: uuid(),
                text: edu.description,
                isSuggested: false,
            });
        }
        if (edu.notes) {
            bullets.push({
                id: uuid(),
                text: edu.notes,
                isSuggested: false,
            });
        }
        // NO fallback coursework — if the user has none, this stays empty

        return {
            id: uuid(),
            title: edu.school,
            subtitle: edu.degree,
            dates: `${edu.start || ''} - ${edu.end || ''}`,
            bullets,
        };
    });

    // 2. Experience — all roles from the resume, no filtering by keywords
    const experienceItems = (parsedResume.roles || []).map((role: any) => ({
        id: uuid(),
        title: role.company,
        subtitle: role.title,
        dates: `${role.start || ''} - ${role.end || 'Present'}`,
        bullets: role.description
            ? role.description
                .split('\n')
                .filter(Boolean)
                .map((b: string) => ({
                    id: uuid(),
                    text: b.trim(),
                    isSuggested: false,
                }))
            : [],
    }));

    // 3. Community/Volunteer — from parsed data only, no injections
    const communityItems = (parsedResume.community_involvement || []).map((item: any) => ({
        id: uuid(),
        title: item.organization || item.title,
        subtitle: item.title !== item.organization ? item.title : '',
        dates: `${item.start || ''} - ${item.end || ''}`,
        bullets: item.description
            ? item.description
                .split('\n')
                .filter(Boolean)
                .map((b: string) => ({
                    id: uuid(),
                    text: b.trim(),
                    isSuggested: false,
                }))
            : [],
    }));

    // 4. Projects — from parsed data only, no fixed projects
    const projectItems = (parsedResume.projects || []).map((proj: any) => ({
        id: uuid(),
        title: proj.title,
        technologies: (proj.tech || []).join(', '),
        bullets: proj.description
            ? [{ id: uuid(), text: proj.description, isSuggested: false }]
            : [],
        links: proj.link ? [{ label: 'View', url: proj.link }] : [],
    }));

    // 5. Skills — from parsed data only, dynamically categorized
    const rawSkills = parsedResume.skills || [];
    const processedSkills: Record<string, string[]> = {};

    // Known categories for auto-detection
    const categoryMap: Record<string, string[]> = {
        Languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'sql', 'html', 'css'],
        Frameworks: ['react', 'angular', 'vue', 'next', 'node', 'express', 'django', 'flask', 'spring', 'rails', 'svelte', 'fastapi', 'laravel', '.net'],
        'Tools & Platforms': ['docker', 'kubernetes', 'aws', 'azure', 'gcp', 'git', 'jenkins', 'terraform', 'ansible', 'linux', 'bash', 'ci/cd', 'heroku', 'vercel'],
        Databases: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'sqlite', 'supabase', 'cassandra', 'firebase'],
    };

    function categorizeSkill(name: string): string {
        const lower = name.toLowerCase();
        for (const [category, patterns] of Object.entries(categoryMap)) {
            if (patterns.some(p => lower.includes(p))) {
                return category;
            }
        }
        return 'Other';
    }

    if (Array.isArray(rawSkills)) {
        rawSkills.forEach((s: any) => {
            const name = typeof s === 'string' ? s : s.name;
            if (!name) return;
            const cat = categorizeSkill(name);
            if (!processedSkills[cat]) processedSkills[cat] = [];
            if (!processedSkills[cat].some(existing => existing.toLowerCase() === name.toLowerCase())) {
                processedSkills[cat].push(name);
            }
        });
    }

    // Also merge explicit categories if they exist in parsed JSON
    const categoryKeys = ['languages', 'frameworks', 'tools', 'databases'];
    for (const key of categoryKeys) {
        if (parsedResume[key] && Array.isArray(parsedResume[key])) {
            const targetCat = key === 'tools' ? 'Tools & Platforms'
                : key.charAt(0).toUpperCase() + key.slice(1);
            if (!processedSkills[targetCat]) processedSkills[targetCat] = [];
            parsedResume[key].forEach((skill: string) => {
                if (!processedSkills[targetCat].some((e: string) => e.toLowerCase() === skill.toLowerCase())) {
                    processedSkills[targetCat].push(skill);
                }
            });
        }
    }

    // NO default skill fallbacks — if empty, it stays empty

    // Build sections — only include non-empty sections
    const sections: TailoredResumeData['sections'] = [];

    if (educationItems.length > 0) {
        sections.push({ id: uuid(), type: 'education', title: 'Education', items: educationItems });
    }
    if (experienceItems.length > 0) {
        sections.push({ id: uuid(), type: 'experience', title: 'Experience', items: experienceItems });
    }
    if (projectItems.length > 0) {
        sections.push({ id: uuid(), type: 'projects', title: 'Projects', items: projectItems });
    }
    if (communityItems.length > 0) {
        sections.push({ id: uuid(), type: 'community', title: 'Community Involvement', items: communityItems });
    }

    // Skills section is always present if we have any skills
    if (Object.keys(processedSkills).length > 0) {
        sections.push({ id: uuid(), type: 'skills', title: 'Skills', items: [] });
    }

    // Contact — from parsed resume ONLY, no defaults
    const contact = {
        name: parsedResume.name || '',
        email: parsedResume.email || '',
        phone: parsedResume.phone || '',
        linkedin: parsedResume.linkedin || '',
        github: parsedResume.github || [],
        location: parsedResume.location || '',
    };

    return {
        id: uuid(),
        contact,
        sections,
        skills: processedSkills as any,
        design: DEFAULT_RESUME_DESIGN,
        createdAt: now,
        updatedAt: now,
    };
}

// ============================================================================
// Main Generation
// ============================================================================

export interface EnhancedGenerationResult {
    success: boolean;
    resume?: TailoredResumeData;
    keywords?: KeywordAnalysis;
    error?: string;
    isRetryable?: boolean;
    provider?: string;
    latencyMs?: number;
    leakCheck?: LeakCheckResult;
}

/**
 * Generate a tailored resume with structured JSON output.
 * Uses ONLY user data — no hardcoded defaults.
 */
export async function generateEnhancedTailoredResume(
    jobId: string,
    userId: string,
    jobDescription?: string,
    jobUrl?: string,
    resumeId?: string,
): Promise<EnhancedGenerationResult> {
    const startTime = Date.now();

    try {
        // 1. Check rate limit
        const rateCheck = checkRateLimit(userId);
        if (!rateCheck.allowed) {
            return {
                success: false,
                error: `Daily quota exceeded. ${rateCheck.remaining} requests remaining. Resets at midnight.`,
                isRetryable: false,
            };
        }

        // 2. Check AI availability
        if (!isAIAvailable()) {
            return {
                success: false,
                error: 'AI services are temporarily unavailable',
                isRetryable: true,
            };
        }

        // 3. Get job description — no truncation
        let effectiveJobDescription = jobDescription;
        if (!effectiveJobDescription && jobUrl) {
            effectiveJobDescription = await fetchJobDescriptionFromUrl(jobUrl);
        }
        if (!effectiveJobDescription && jobId) {
            const job = await getJobById(userId, jobId);
            effectiveJobDescription = job?.raw_text_summary || job?.normalized_text || '';
        }

        if (!effectiveJobDescription) {
            return {
                success: false,
                error: 'No job description provided',
                isRetryable: false,
            };
        }

        // 4. Get resume data
        let resumeData = null;
        if (resumeId) {
            resumeData = await getResumeById(userId, resumeId);
        } else {
            const defaultResume = await getDefaultResume(userId);
            if (defaultResume) {
                resumeData = await getResumeById(userId, defaultResume.id);
            }
        }

        if (!resumeData) {
            return {
                success: false,
                error: 'No resume found. Please upload a resume first.',
                isRetryable: false,
            };
        }

        // 5. Parse resume if needed
        let parsedResume = resumeData.resume.parsed_json;
        if (!parsedResume && resumeData.file_data) {
            parsedResume = await parseResumeFromPdf(resumeData.file_data);
            await updateResume(userId, resumeData.resume.id, { parsed_json: parsedResume });
        }

        if (!parsedResume) {
            return {
                success: false,
                error: 'Could not parse resume',
                isRetryable: false,
            };
        }

        // 6. Get LinkedIn data if available
        const linkedIn = await getLinkedInProfile(userId);

        // 7. Build prompt — NO truncation, send full data
        const resumeText = JSON.stringify(parsedResume, null, 2);
        const linkedInText = linkedIn?.parsed_json
            ? JSON.stringify(linkedIn.parsed_json, null, 2)
            : '';
        const jobText = effectiveJobDescription;

        const prompt = `${ENHANCED_TAILORED_RESUME_PROMPT}

SOURCE RESUME:
${resumeText}

${linkedInText ? `LINKEDIN DATA:\n${linkedInText}\n` : ''}

JOB DESCRIPTION:
${jobText}

Generate the tailored resume JSON now. Remember:
1. Use ONLY data from the sources above — NEVER fabricate, inject defaults, or add template data
2. Contact info comes from SOURCE RESUME / LINKEDIN only
3. Skills come from SOURCE RESUME / LINKEDIN only
4. Mark uncertain enhancements with isSuggested: true
5. Detect the user's profession and adapt language accordingly
6. Return ONLY valid JSON`;

        // 8. Call AI
        const result = await routeAICallWithDetails(prompt);
        const latencyMs = Date.now() - startTime;

        logAIProviderUsage({
            provider: result.provider,
            latency: latencyMs,
            error: result.success ? undefined : result.error,
            timestamp: new Date().toISOString(),
        });

        if (!result.success) {
            return {
                success: false,
                error: result.error || 'AI generation failed',
                isRetryable: true,
                latencyMs,
            };
        }

        // 9. Increment rate limit
        incrementRateLimit(userId);

        // 10. Parse response
        try {
            const parsed = extractJson<{ resume: TailoredResumeData; keywords: KeywordAnalysis }>(result.text);

            if (!parsed.resume) {
                throw new Error('Missing resume in response');
            }

            // CRITICAL: Regenerate ALL IDs with real UUIDs
            // AI models often reuse placeholder IDs, causing React duplicate-key errors
            const now = new Date().toISOString();
            parsed.resume.id = uuid();
            parsed.resume.createdAt = parsed.resume.createdAt || now;
            parsed.resume.updatedAt = now;
            parsed.resume.jobId = jobId;

            // Regenerate section, item, and bullet IDs
            if (parsed.resume.sections) {
                for (const section of parsed.resume.sections) {
                    section.id = uuid();
                    if (section.items) {
                        for (const item of section.items) {
                            item.id = uuid();
                            if (item.bullets) {
                                for (const bullet of item.bullets) {
                                    bullet.id = uuid();
                                }
                            }
                        }
                    }
                }
            }

            // Ensure contact exists
            parsed.resume.contact = parsed.resume.contact || { name: '', email: '', phone: '', linkedin: '', github: [] };
            // Ensure github is an array
            if (!Array.isArray(parsed.resume.contact.github)) {
                parsed.resume.contact.github = [];
            }

            // Ensure skills is a valid Record
            if (!parsed.resume.skills || typeof parsed.resume.skills !== 'object') {
                parsed.resume.skills = {};
            }

            // Regenerate IDs in hiddenContext too
            if (parsed.resume.hiddenContext && Array.isArray(parsed.resume.hiddenContext)) {
                for (const section of parsed.resume.hiddenContext) {
                    section.id = uuid();
                    if (section.items) {
                        for (const item of section.items) {
                            item.id = uuid();
                            if (item.bullets) {
                                for (const bullet of item.bullets) {
                                    bullet.id = uuid();
                                }
                            }
                        }
                    }
                }
            }

            // Remove empty sections (sections with 0 items, except 'skills' which uses the top-level skills object)
            parsed.resume.sections = (parsed.resume.sections || []).filter(
                s => s.type === 'skills' || (s.items && s.items.length > 0)
            );

            // Design defaults are OK — they're aesthetic, not personal data
            parsed.resume.design = {
                ...DEFAULT_RESUME_DESIGN,
                ...parsed.resume.design,
            };

            // Ensure skills section exists if AI returned skills
            if (parsed.resume.skills && Object.keys(parsed.resume.skills).length > 0) {
                if (!parsed.resume.sections.some(s => s.type === 'skills')) {
                    parsed.resume.sections.push({
                        id: uuid(),
                        type: 'skills',
                        title: 'Technical Skills',
                        items: [],
                    });
                }
            }

            // NO post-processing injection of fixed projects, community, or skills.
            // The AI was instructed to use source data only.

            // 11. Leak detection — validate no fabricated data
            const leakCheck = validateNoLeakedData(
                parsed.resume,
                resumeText,
                linkedInText,
                jobText,
            );

            if (!leakCheck.passed) {
                console.warn('[ResumeService] LEAK_DETECTED:', leakCheck.leaked_fields);
                // Still return the resume, but flag the leak for the frontend
            }

            // 12. Calculate deterministic ATS score
            const resumeFullText = JSON.stringify(parsed.resume);
            const linkedInFullText = linkedIn?.parsed_json ? JSON.stringify(linkedIn.parsed_json) : '';
            const atsAnalysis = analyzeJobForATS(effectiveJobDescription, resumeFullText, linkedInFullText);

            const keywordsWithScore: KeywordAnalysis = {
                matched: atsAnalysis.match.matched,
                missing: atsAnalysis.match.missing,
                matchedCritical: atsAnalysis.match.matchedCritical,
                missingCritical: atsAnalysis.match.missingCritical,
                atsScore: {
                    raw: atsAnalysis.score.raw,
                    weighted: atsAnalysis.score.weighted,
                    matchedCount: atsAnalysis.score.matchedCount,
                    totalCount: atsAnalysis.score.totalCount,
                },
            };

            return {
                success: true,
                resume: parsed.resume,
                keywords: keywordsWithScore,
                provider: result.provider,
                latencyMs,
                leakCheck,
            };
        } catch (parseError: any) {
            console.error('Failed to parse AI response:', parseError);

            // NO FALLBACK to createDefaultResumeData — return error
            return {
                success: false,
                error: `AI response parsing failed: ${parseError.message}. Please try again.`,
                isRetryable: true,
                provider: result.provider,
                latencyMs,
            };
        }

    } catch (error: any) {
        const latencyMs = Date.now() - startTime;

        logAIProviderUsage({
            latency: latencyMs,
            error: error.message,
            timestamp: new Date().toISOString(),
        });

        return {
            success: false,
            error: error.message,
            isRetryable: error.message?.includes('timeout') || error.message?.includes('503'),
            latencyMs,
        };
    }
}

// ============================================================================
// Draft Management (unchanged — these are user-scoped and data-agnostic)
// ============================================================================

// In-memory draft storage (user-scoped)
const draftStore = new Map<string, Map<string, { resumeData: TailoredResumeData; updatedAt: string }>>();

export async function saveDraft(
    userId: string,
    resumeData: TailoredResumeData
): Promise<{ success: boolean; id: string; error?: string }> {
    try {
        const id = resumeData.id || uuid();
        if (!draftStore.has(userId)) draftStore.set(userId, new Map());
        draftStore.get(userId)!.set(id, { resumeData, updatedAt: new Date().toISOString() });
        return { success: true, id };
    } catch (error: any) {
        return { success: false, id: '', error: error.message };
    }
}

export async function loadDraft(
    userId: string,
    draftId: string
): Promise<TailoredResumeData | null> {
    try {
        const userDrafts = draftStore.get(userId);
        if (!userDrafts) return null;
        const draft = userDrafts.get(draftId);
        return draft?.resumeData || null;
    } catch (error) {
        console.error('Error loading draft:', error);
        return null;
    }
}

export async function listDrafts(userId: string): Promise<TailoredResumeData[]> {
    try {
        const userDrafts = draftStore.get(userId);
        if (!userDrafts) return [];
        return Array.from(userDrafts.values()).map(d => d.resumeData);
    } catch (error) {
        console.error('Error listing drafts:', error);
        return [];
    }
}

export async function deleteDraft(userId: string, draftId: string): Promise<boolean> {
    try {
        const userDrafts = draftStore.get(userId);
        if (!userDrafts) return false;
        return userDrafts.delete(draftId);
    } catch (error) {
        console.error('Error deleting draft:', error);
        return false;
    }
}
