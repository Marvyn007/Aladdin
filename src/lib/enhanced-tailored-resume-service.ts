/**
 * Enhanced Tailored Resume Service
 * Handles AI generation with structured JSON output, keyword analysis, and draft management
 */

import { v4 as uuid } from 'uuid';
import {
    getJobById,
    getDefaultResume,
    getResumeById,
    updateResume,
    getLinkedInProfile,
    createDraft,
    getDraft as getDbDraft,
    listDrafts as listDbDrafts,
    deleteDraft as deleteDbDraft,
} from '@/lib/db';
import { parseResumeFromPdf } from '@/lib/gemini';
import { routeAICallWithDetails, isAIAvailable } from '@/lib/ai-router';
import { ENHANCED_TAILORED_RESUME_PROMPT } from '@/lib/enhanced-resume-prompt';
import { analyzeJobForATS, type ATSScore } from '@/lib/keyword-extractor';
import {
    TailoredResumeData,
    TailoredResumeGenerationResponse,
    KeywordAnalysis,
    DEFAULT_CONTACT_INFO,
    DEFAULT_RESUME_DESIGN,
} from '@/types';

// Rate limiting state (in-memory for now)
const rateLimitState: Record<string, { count: number; resetAt: number }> = {};
const DAILY_QUOTA = 20;

/**
 * Log AI provider usage for diagnosis
 */
function logAIProviderUsage(data: {
    provider?: string;
    tokens?: number;
    latency: number;
    error?: string;
    timestamp: string;
}) {
    // In production (Vercel), we log to stdout/stderr which keeps logs in Vercel/AWS CloudWatch
    const logEntry = JSON.stringify(data);
    if (data.error) {
        console.error('[AI-Log]', logEntry);
    } else {
        console.log('[AI-Log]', logEntry);
    }
}

/**
 * Check rate limit for user
 */
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

/**
 * Increment rate limit counter
 */
function incrementRateLimit(userId: string = 'default') {
    if (rateLimitState[userId]) {
        rateLimitState[userId].count++;
    }
}

/**
 * Fetch job description from URL
 */
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

        // Basic HTML to text extraction
        const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return text.substring(0, 10000); // Limit to 10k chars
    } catch (error) {
        console.error('Failed to fetch job URL:', error);
        throw new Error('Could not fetch job description from URL');
    }
}

/**
 * Extract JSON from AI response
 */
function extractJson<T>(text: string): T {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('No JSON found in response');
    }

    return JSON.parse(jsonMatch[0]);
}

/**
 * Create default resume structure from parsed resume
 */
function createDefaultResumeData(parsedResume: any): TailoredResumeData {
    const now = new Date().toISOString();

    // 1. Education section - Include coursework and details as separate bullets
    const educationItems = (parsedResume.education || []).map((edu: any) => {
        const bullets: { id: string; text: string; isSuggested: boolean }[] = [];

        // Add relevant coursework if available
        if (edu.relevant_coursework) {
            bullets.push({
                id: uuid(),
                text: `Relevant Coursework: ${edu.relevant_coursework}`,
                isSuggested: false
            });
        }

        // Add description/additional details if available
        if (edu.description) {
            bullets.push({
                id: uuid(),
                text: edu.description,
                isSuggested: false
            });
        }

        // Add notes (GPA, honors, etc.) if available
        if (edu.notes) {
            bullets.push({
                id: uuid(),
                text: edu.notes,
                isSuggested: false
            });
        }

        // FALLBACK: Add default coursework if no bullets exist
        if (bullets.length === 0) {
            bullets.push({
                id: uuid(),
                text: 'Relevant Coursework: Data Structures, Algorithms, Database Management, Computer Networks, Operating Systems, Software Engineering, Object-Oriented Programming',
                isSuggested: false
            });
        }

        return {
            id: uuid(),
            title: edu.school,
            subtitle: edu.degree,
            dates: `${edu.start || ''} - ${edu.end || ''}`,
            bullets
        };
    });

    // 2. Separate Experience and Community Involvement
    // First, check if parsed resume has a dedicated community_involvement field
    const allRoles = parsedResume.roles || [];
    const communityFromParsed = parsedResume.community_involvement || [];

    // Keywords to identify community roles if they're mixed in with regular roles
    const communityKeywords = ['hacklabs', 'atlassian', 'rsp', 'hackathon', 'club', 'founder', 'president', 'organizer'];

    // Filter experience roles (exclude community-related)
    const experienceRoles = allRoles.filter((r: any) =>
        !communityKeywords.some(k => ((r.company || '') + (r.title || '')).toLowerCase().includes(k))
    );

    // Get community roles from the roles array (if any were mixed in)
    const communityFromRoles = allRoles.filter((r: any) =>
        communityKeywords.some(k => ((r.company || '') + (r.title || '')).toLowerCase().includes(k))
    );

    const experienceItems = experienceRoles.map((role: any) => ({
        id: uuid(),
        title: role.company,
        subtitle: role.title,
        dates: `${role.start || ''} - ${role.end || 'Present'}`,
        bullets: role.description
            ? role.description.split('\n').filter(Boolean).map((b: string) => ({
                id: uuid(),
                text: b.trim(),
                isSuggested: false,
            }))
            : [],
    }));

    // Build community items from BOTH the dedicated field AND any roles that match keywords
    const communityItems: any[] = [];

    // Add items from the dedicated community_involvement field
    communityFromParsed.forEach((item: any) => {
        communityItems.push({
            id: uuid(),
            title: item.organization || item.title,
            subtitle: item.title !== item.organization ? item.title : '',
            dates: `${item.start || ''} - ${item.end || ''}`,
            bullets: item.description
                ? item.description.split('\n').filter(Boolean).map((b: string) => ({
                    id: uuid(),
                    text: b.trim(),
                    isSuggested: false,
                }))
                : [],
        });
    });

    // Also add any community roles that were mixed in with regular roles
    communityFromRoles.forEach((role: any) => {
        communityItems.push({
            id: uuid(),
            title: role.company || role.title,
            subtitle: role.title !== role.company ? role.title : '',
            dates: `${role.start || ''} - ${role.end || ''}`,
            bullets: role.description
                ? role.description.split('\n').filter(Boolean).map((b: string) => ({
                    id: uuid(),
                    text: b.trim(),
                    isSuggested: false,
                }))
                : [],
        });
    });

    // 3. Projects section
    const existingProjects = (parsedResume.projects || []).map((proj: any) => {
        const isAmorChai = (proj.title || '').toLowerCase().includes('amor') || (proj.title || '').toLowerCase().includes('chai');
        return {
            id: uuid(),
            title: proj.title,
            technologies: (proj.tech || []).join(', '),
            bullets: proj.description
                ? [{ id: uuid(), text: proj.description, isSuggested: false }]
                : [],
            links: isAmorChai
                ? [{ label: 'Deployed at www.drinkamorchai.store', url: 'https://www.drinkamorchai.store' }]
                : proj.link
                    ? [{ label: 'View', url: proj.link }]
                    : [],
        };
    });

    // Add fixed projects if missing
    const fixedProjects = [
        {
            title: "TurboMC: Sub-Second Monte Carlo Options Pricer",
            technologies: "C++, Multi-threading, OpenMP",
            bullets: [
                "Implemented Monte Carlo simulation for European options pricing with 10M+ path executions and <0.05% pricing error.",
                "Engineered C++ multi-threading solution achieving 6.9x speedup (44.25s → 6.45s) for call options and 6.8x (42.45s → 6.28s) for put options.",
                "Optimized with OpenMP parallel processing, reducing 10M simulation runtime by 90% (6.3s → 0.7s) across 8 CPU cores."
            ]
        },
        {
            title: "Ravi’s Study Program: Leetcode Bot",
            technologies: "Python, Discord.py, Google API",
            bullets: [
                "Engineered a Discord.py bot with OAuth2 and RESTful API integration to automate LeetCode data tracking, creating a data pipeline that eliminated manual spreadsheet entry for students."
            ]
        },
        {
            title: "Technical Indicator LFT System",
            technologies: "Python, TA-Lib, Pandas",
            bullets: [
                "Developed an algorithmic trading system using Python and Pandas to back-test RSI/Bollinger strategies, achieving 342.42% ROI on TSLA data (vs. 196% benchmark) via optimized risk parameters."
            ]
        }
    ];

    const projectItems = [...existingProjects];

    // Helper function to check if a project already exists (more robust matching)
    const projectExists = (searchTerms: string[]) => {
        return projectItems.some(p => {
            const titleLower = (p.title || '').toLowerCase();
            return searchTerms.some(term => titleLower.includes(term.toLowerCase()));
        });
    };

    for (const fixed of fixedProjects) {
        // Extract multiple search terms from the fixed project title
        const titleParts = fixed.title.toLowerCase().split(/[:\s-]+/).filter(p => p.length > 3);
        // Add specific keywords for better matching
        const searchTerms = [
            ...titleParts,
            fixed.title.split(':')[0].toLowerCase().trim()
        ];

        if (!projectExists(searchTerms)) {
            projectItems.push({
                id: uuid(),
                title: fixed.title,
                technologies: fixed.technologies,
                bullets: fixed.bullets.map(b => ({ id: uuid(), text: b, isSuggested: false })),
                links: []
            });
        }
    }

    // Add fixed community involvement items (always include these)
    const fixedCommunityItems = [
        {
            title: "HackLabs",
            subtitle: "Founder & President",
            dates: "",
            bullets: [
                "Established and scaled a technical community to 50+ members, driving innovation through weekly project-based workshops and hackathon training.",
                "Led a 9-member delegation to secure three podium finishes at Vibeathon, winning $2,500, directing the rapid delivery of six AI-integrated healthcare solutions in a 22-hour sprint.",
                "Organized and executed 15+ technical workshops covering full-stack development, cloud computing, and competitive programming fundamentals."
            ]
        },
        {
            title: "Atlassian Hackathon",
            subtitle: "Finalist",
            dates: "",
            bullets: [
                "Architected an AI-powered onboarding assistant on Atlassian Forge using JavaScript and ROVO Agents, implementing Jira tracking and NLP-based Confluence summarization.",
                "Collaborated with a cross-functional team to deliver a production-ready MVP in 48 hours, demonstrating rapid prototyping and agile development skills."
            ]
        },
        {
            title: "Ravi's Study Program (RSP)",
            subtitle: "Community Member & Mentor",
            dates: "",
            bullets: [
                "Delivered algorithms and system design mentorship to 300+ peers through semi-weekly mock interviews, enhancing technical readiness for top-tier software engineering roles.",
                "Contributed to curriculum development for interview preparation, creating problem sets covering arrays, trees, graphs, and dynamic programming.",
                "Organized study groups focused on LeetCode hard problems and system design case studies for FAANG-level interview preparation."
            ]
        }
    ];

    // Add fixed community items to the communityItems array (with robust deduplication)
    const communityExists = (searchTerms: string[]) => {
        return communityItems.some(c => {
            const titleLower = (c.title || '').toLowerCase();
            return searchTerms.some(term => titleLower.includes(term.toLowerCase()));
        });
    };

    for (const fixed of fixedCommunityItems) {
        const titleParts = fixed.title.toLowerCase().split(/[\s()]+/).filter(p => p.length > 2);
        const searchTerms = [...titleParts, fixed.title.split(' ')[0].toLowerCase().trim()];

        if (!communityExists(searchTerms)) {
            communityItems.push({
                id: uuid(),
                title: fixed.title,
                subtitle: fixed.subtitle,
                dates: fixed.dates,
                bullets: fixed.bullets.map(b => ({ id: uuid(), text: b, isSuggested: false }))
            });
        }
    }

    // 4. Skills - Take ALL skills from parsed resume
    // We assume parsedResume.skills contains objects { name: string } or strings.
    // We will attempt to categorize, but ensure all are included.
    const rawSkills = parsedResume.skills || [];
    const processedSkills = {
        languages: [] as string[],
        frameworks: [] as string[],
        tools: [] as string[],
        databases: [] as string[]
    };

    // Helper to check if skill is already added
    const isAdded = (name: string) => Object.values(processedSkills).flat().includes(name);

    // Pre-categorized lists for buckets
    const cats = {
        languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'c#', 'scala'],
        frameworks: ['react', 'angular', 'vue', 'next', 'node', 'express', 'django', 'flask', 'spring', 'rails', 'svelte', 'fastapi'],
        tools: ['docker', 'kubernetes', 'aws', 'git', 'jenkins', 'terraform', 'ansible', 'linux', 'bash', 'circleci'],
        databases: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'sqlite', 'supabase', 'cassandra']
    };

    // First pass: Categorize known skills
    if (Array.isArray(rawSkills)) {
        rawSkills.forEach((s: any) => {
            const name = typeof s === 'string' ? s : s.name;
            if (!name) return;

            const lower = name.toLowerCase();
            if (cats.languages.some(k => lower.includes(k))) processedSkills.languages.push(name);
            else if (cats.frameworks.some(k => lower.includes(k))) processedSkills.frameworks.push(name);
            else if (cats.databases.some(k => lower.includes(k))) processedSkills.databases.push(name);
            else if (cats.tools.some(k => lower.includes(k))) processedSkills.tools.push(name);
        });

        // Second pass: Dump remaining into Tools (or distribute if needed, but Tools is safest catch-all for "Technical Skills")
        rawSkills.forEach((s: any) => {
            const name = typeof s === 'string' ? s : s.name;
            if (!name || isAdded(name)) return;
            // If completely unknown, put in tools or frameworks depending on heuristic? 
            // Putting in Tools to ensure "ALL skills" are present.
            processedSkills.tools.push(name);
        });
    }

    // Also merge explicit categories if they existed in parsed JSON
    if (parsedResume.languages) processedSkills.languages = [...new Set([...processedSkills.languages, ...parsedResume.languages])];
    if (parsedResume.frameworks) processedSkills.frameworks = [...new Set([...processedSkills.frameworks, ...parsedResume.frameworks])];
    if (parsedResume.tools) processedSkills.tools = [...new Set([...processedSkills.tools, ...parsedResume.tools])];

    // FALLBACK: Add default skills if sections are empty
    const defaultSkills = {
        languages: ['Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'SQL', 'HTML/CSS'],
        frameworks: ['React', 'Next.js', 'Node.js', 'Express', 'Django', 'Flask', 'FastAPI'],
        tools: ['Git', 'Docker', 'AWS', 'Linux', 'VS Code', 'Postman', 'CI/CD', 'GitHub Actions'],
        databases: ['PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Supabase', 'SQLite']
    };

    if (processedSkills.languages.length === 0) processedSkills.languages = defaultSkills.languages;
    if (processedSkills.frameworks.length === 0) processedSkills.frameworks = defaultSkills.frameworks;
    if (processedSkills.tools.length === 0) processedSkills.tools = defaultSkills.tools;
    if (processedSkills.databases.length === 0) processedSkills.databases = defaultSkills.databases;

    return {
        id: uuid(),
        contact: {
            ...DEFAULT_CONTACT_INFO,
            name: parsedResume.name || DEFAULT_CONTACT_INFO.name,
        },
        sections: [
            { id: uuid(), type: 'education', title: 'Education', items: educationItems },
            { id: uuid(), type: 'experience', title: 'Experience', items: experienceItems },
            { id: uuid(), type: 'projects', title: 'Projects', items: projectItems },
            { id: uuid(), type: 'community', title: 'Community Involvement', items: communityItems },
            { id: uuid(), type: 'skills', title: 'Technical Skills', items: [] },
        ],
        skills: processedSkills,
        design: DEFAULT_RESUME_DESIGN,
        createdAt: now,
        updatedAt: now,
    };
}

export interface EnhancedGenerationResult {
    success: boolean;
    resume?: TailoredResumeData;
    keywords?: KeywordAnalysis;
    error?: string;
    isRetryable?: boolean;
    provider?: string;
    latencyMs?: number;
}

/**
 * Generate a tailored resume with structured JSON output
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
        // Check rate limit
        const rateCheck = checkRateLimit(userId);
        if (!rateCheck.allowed) {
            return {
                success: false,
                error: `Daily quota exceeded. ${rateCheck.remaining} requests remaining. Resets at midnight.`,
                isRetryable: false,
            };
        }

        // Check AI availability
        if (!isAIAvailable()) {
            return {
                success: false,
                error: 'AI services are temporarily unavailable',
                isRetryable: true,
            };
        }

        // Get job description
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

        // Get resume data
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

        // Parse resume if needed
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

        // Get LinkedIn data if available
        const linkedIn = await getLinkedInProfile(userId);

        // Build the prompt
        const resumeText = JSON.stringify(parsedResume, null, 2).substring(0, 8000);
        const linkedInText = linkedIn?.parsed_json
            ? JSON.stringify(linkedIn.parsed_json, null, 2).substring(0, 4000)
            : '';
        const jobText = effectiveJobDescription.substring(0, 6000);

        const prompt = `${ENHANCED_TAILORED_RESUME_PROMPT}

SOURCE RESUME:
${resumeText}

${linkedInText ? `LINKEDIN DATA:\n${linkedInText}\n` : ''}

JOB DESCRIPTION:
${jobText}

Generate the tailored resume JSON now. Remember to:
1. Include Amor+Chai project link: www.drinkamorchai.store
2. Use fixed contact info as specified
3. Mark uncertain additions with isSuggested: true
4. Return ONLY valid JSON`;

        // Call AI
        const result = await routeAICallWithDetails(prompt);
        const latencyMs = Date.now() - startTime;

        // Log usage
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

        // Increment rate limit
        incrementRateLimit(userId);

        // Parse response
        try {
            const parsed = extractJson<{ resume: TailoredResumeData; keywords: KeywordAnalysis }>(result.text);

            // Ensure required fields
            if (!parsed.resume) {
                throw new Error('Missing resume in response');
            }

            // Set timestamps and IDs if missing
            const now = new Date().toISOString();
            parsed.resume.id = parsed.resume.id || uuid();
            parsed.resume.createdAt = parsed.resume.createdAt || now;
            parsed.resume.updatedAt = now;
            parsed.resume.jobId = jobId;

            // Ensure contact info defaults
            parsed.resume.contact = {
                ...DEFAULT_CONTACT_INFO,
                ...parsed.resume.contact,
            };

            // Ensure design defaults
            parsed.resume.design = {
                ...DEFAULT_RESUME_DESIGN,
                ...parsed.resume.design,
            };

            // Ensure skills section exists
            if (!parsed.resume.sections.some(s => s.type === 'skills')) {
                parsed.resume.sections.push({
                    id: uuid(),
                    type: 'skills',
                    title: 'Technical Skills',
                    items: [],
                });
            }

            // --- Post-Processing Enforcement ---

            // 1. Move Community Items from Experience
            const communityKeywords = ['hacklabs', 'atlassian', 'rsp', 'hackathon'];
            const expSection = parsed.resume.sections.find(s => s.type === 'experience');
            let communitySection = parsed.resume.sections.find(s => s.type === 'community');

            if (!communitySection) {
                communitySection = { id: uuid(), type: 'community', title: 'Community Involvement', items: [] };
                // Insert after projects if possible, or push
                const projIndex = parsed.resume.sections.findIndex(s => s.type === 'projects');
                if (projIndex !== -1) {
                    parsed.resume.sections.splice(projIndex + 1, 0, communitySection);
                } else {
                    parsed.resume.sections.push(communitySection);
                }
            }

            if (expSection) {
                const itemsToMove = expSection.items.filter(item =>
                    communityKeywords.some(k => (item.title || '' + item.subtitle || '').toLowerCase().includes(k))
                );

                if (itemsToMove.length > 0) {
                    expSection.items = expSection.items.filter(item => !itemsToMove.includes(item));
                    itemsToMove.forEach(item => {
                        if (!communitySection!.items.some(existing => existing.title === item.title)) {
                            communitySection!.items.push(item);
                        }
                    });
                }
            }

            // 2. Enforce Fixed Projects
            const fixedProjects = [
                {
                    title: "TurboMC: Sub-Second Monte Carlo Options Pricer",
                    technologies: "C++, Multi-threading, OpenMP",
                    bullets: [
                        "Implemented Monte Carlo simulation for European options pricing with 10M+ path executions and <0.05% pricing error.",
                        "Engineered C++ multi-threading solution achieving 6.9x speedup (44.25s → 6.45s) for call options and 6.8x (42.45s → 6.28s) for put options.",
                        "Optimized with OpenMP parallel processing, reducing 10M simulation runtime by 90% (6.3s → 0.7s) across 8 CPU cores."
                    ]
                },
                {
                    title: "Ravi’s Study Program: Leetcode Bot",
                    technologies: "Python, Discord.py, Google API",
                    bullets: [
                        "Engineered a Discord.py bot with OAuth2 and RESTful API integration to automate LeetCode data tracking, creating a data pipeline that eliminated manual spreadsheet entry for students."
                    ]
                },
                {
                    title: "Technical Indicator LFT System",
                    technologies: "Python, TA-Lib, Pandas",
                    bullets: [
                        "Developed an algorithmic trading system using Python and Pandas to back-test RSI/Bollinger strategies, achieving 342.42% ROI on TSLA data (vs. 196% benchmark) via optimized risk parameters."
                    ]
                }
            ];

            let projectSection = parsed.resume.sections.find(s => s.type === 'projects');
            if (!projectSection) {
                projectSection = { id: uuid(), type: 'projects', title: 'Projects', items: [] };
                parsed.resume.sections.push(projectSection);
            }

            // Helper function for robust project matching
            const projectExistsInSection = (searchTerms: string[]) => {
                return projectSection!.items.some(p => {
                    const titleLower = (p.title || '').toLowerCase();
                    return searchTerms.some(term => titleLower.includes(term.toLowerCase()));
                });
            };

            for (const fixed of fixedProjects) {
                // Extract multiple search terms from the fixed project title
                const titleParts = fixed.title.toLowerCase().split(/[:\s-]+/).filter(p => p.length > 3);
                const searchTerms = [
                    ...titleParts,
                    fixed.title.split(':')[0].toLowerCase().trim()
                ];

                if (!projectExistsInSection(searchTerms)) {
                    projectSection.items.push({
                        id: uuid(),
                        title: fixed.title,
                        technologies: fixed.technologies,
                        bullets: fixed.bullets.map(b => ({ id: uuid(), text: b, isSuggested: false })),
                        links: []
                    });
                }
            }

            // 3. Update Amor+Chai link
            projectSection.items.forEach(p => {
                if (p.title.toLowerCase().includes('amor') || p.title.toLowerCase().includes('chai')) {
                    p.links = [{ label: 'Deployed at www.drinkamorchai.store', url: 'https://www.drinkamorchai.store' }];
                }
            });

            // 3.5. Enforce Fixed Community Involvement Items
            const fixedCommunityItems = [
                {
                    title: "HackLabs",
                    subtitle: "Founder & President",
                    dates: "",
                    bullets: [
                        "Established and scaled a technical community to 50+ members, driving innovation through weekly project-based workshops and hackathon training.",
                        "Led a 9-member delegation to secure three podium finishes at Vibeathon, winning $2,500, directing the rapid delivery of six AI-integrated healthcare solutions in a 22-hour sprint."
                    ]
                },
                {
                    title: "Atlassian Hackathon",
                    subtitle: "Finalist",
                    dates: "",
                    bullets: [
                        "Architected an AI-powered onboarding assistant on Atlassian Forge using JavaScript and ROVO Agents, implementing Jira tracking and NLP-based Confluence summarization."
                    ]
                },
                {
                    title: "Ravi's Study Program (RSP)",
                    subtitle: "Community Member",
                    dates: "",
                    bullets: [
                        "Delivered algorithms and system design mentorship to 300+ peers through semi-weekly mock interviews, enhancing technical readiness for top-tier software engineering roles."
                    ]
                }
            ];

            // Ensure community section exists
            if (!communitySection) {
                communitySection = { id: uuid(), type: 'community', title: 'Community Involvement', items: [] };
                const projIndex = parsed.resume.sections.findIndex(s => s.type === 'projects');
                if (projIndex !== -1) {
                    parsed.resume.sections.splice(projIndex + 1, 0, communitySection);
                } else {
                    parsed.resume.sections.push(communitySection);
                }
            }

            // Add fixed community items if not already present (with robust deduplication)
            const communityExistsInSection = (searchTerms: string[]) => {
                return communitySection!.items.some(c => {
                    const titleLower = (c.title || '').toLowerCase();
                    return searchTerms.some(term => titleLower.includes(term.toLowerCase()));
                });
            };

            for (const fixed of fixedCommunityItems) {
                const titleParts = fixed.title.toLowerCase().split(/[\s()]+/).filter(p => p.length > 2);
                const searchTerms = [...titleParts, fixed.title.split(' ')[0].toLowerCase().trim()];

                if (!communityExistsInSection(searchTerms)) {
                    communitySection.items.push({
                        id: uuid(),
                        title: fixed.title,
                        subtitle: fixed.subtitle,
                        dates: fixed.dates,
                        bullets: fixed.bullets.map(b => ({ id: uuid(), text: b, isSuggested: false }))
                    });
                }
            }

            // 4. Ensure ALL Source Skills are present
            const sourceSkills = parsedResume.skills || [];
            const destSkills = parsed.resume.skills || { languages: [], frameworks: [], tools: [], databases: [] };
            parsed.resume.skills = destSkills; // ensure ref

            const cats = {
                languages: ['javascript', 'typescript', 'python', 'java', 'c++', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin', 'c#', 'scala'],
                frameworks: ['react', 'angular', 'vue', 'next', 'node', 'express', 'django', 'flask', 'spring', 'rails', 'svelte', 'fastapi'],
                tools: ['docker', 'kubernetes', 'aws', 'git', 'jenkins', 'terraform', 'ansible', 'linux', 'bash', 'circleci'],
                databases: ['postgresql', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'dynamodb', 'sqlite', 'supabase', 'cassandra']
            };

            const addSkill = (name: string) => {
                const lower = name.toLowerCase();
                if (Object.values(destSkills).flat().some(s => s.toLowerCase() === lower)) return; // Already exists

                if (cats.languages.some(k => lower.includes(k))) destSkills.languages.push(name);
                else if (cats.frameworks.some(k => lower.includes(k))) destSkills.frameworks.push(name);
                else if (cats.databases.some(k => lower.includes(k))) destSkills.databases.push(name);
                else destSkills.tools.push(name); // Default to tools
            };

            if (Array.isArray(sourceSkills)) {
                sourceSkills.forEach((s: any) => {
                    const name = typeof s === 'string' ? s : s.name;
                    if (name) addSkill(name);
                });
            }
            // Also check specific source categories if they exist
            if (parsedResume.languages) parsedResume.languages.forEach((s: string) => addSkill(s));
            if (parsedResume.frameworks) parsedResume.frameworks.forEach((s: string) => addSkill(s));
            if (parsedResume.tools) parsedResume.tools.forEach((s: string) => addSkill(s));

            // Calculate deterministic ATS score
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
            };
        } catch (parseError: any) {
            console.error('Failed to parse AI response:', parseError);

            // Fallback: create default structure from parsed resume
            const fallbackResume = createDefaultResumeData(parsedResume);

            // Still calculate ATS score for fallback
            const resumeFullText = JSON.stringify(fallbackResume);
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
                resume: fallbackResume,
                keywords: keywordsWithScore,
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
// Draft Management
// ============================================================================

// ============================================================================
// Draft Management
// ============================================================================

/**
 * Save a resume draft
 */
export async function saveDraft(
    userId: string,
    resumeData: TailoredResumeData
): Promise<{ success: boolean; id: string; error?: string }> {
    try {
        await createDraft(resumeData.id, userId, resumeData, resumeData.jobId);
        return { success: true, id: resumeData.id };
    } catch (error: any) {
        return { success: false, id: resumeData.id, error: error.message };
    }
}

/**
 * Load a resume draft
 */
export async function loadDraft(
    userId: string,
    draftId: string
): Promise<TailoredResumeData | null> {
    try {
        const draft = await getDbDraft(draftId);
        if (draft && typeof draft === 'object' && 'id' in draft) {
            return draft as TailoredResumeData;
        }
        return draft;
    } catch (error) {
        console.error('Failed to load draft:', error);
        return null;
    }
}

/**
 * List all drafts for a user
 */
export async function listDrafts(userId: string): Promise<TailoredResumeData[]> {
    try {
        const drafts = await listDbDrafts(userId);
        return drafts as TailoredResumeData[];
    } catch (error) {
        console.error('Failed to list drafts:', error);
        return [];
    }
}

/**
 * delete a draft
 */
export async function deleteDraft(userId: string, draftId: string): Promise<boolean> {
    try {
        await deleteDbDraft(draftId);
        return true;
    } catch (error) {
        console.error('Failed to delete draft:', error);
        return false;
    }
}
