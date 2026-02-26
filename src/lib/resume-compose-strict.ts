import { routeAICall, routeAICallWithDetails, AIGenerateResult } from './ai-router';
import { CandidateProfile } from './gemini-merge-strict';
import { config } from 'dotenv';
config({ path: '.env.local' });

export interface ComposeResumeInput {
    candidate_profile: CandidateProfile;
    rewritten_bullets_json: Record<string, string[]>; // mapping company_title -> bullets
    jd_top_10_keywords: string[];
    years_experience: number;
    jd_raw_text: string;
}

export interface ComposeResumeOutput {
    rewritten_resume_markdown: string;
    summary_used_keywords: string[];
    skills_prioritized: string[];
    sections_order: string[];
    length_estimate_words: number;
}

export interface StrictComposeResult {
    success: boolean;
    failedTests: string[];
    output?: ComposeResumeOutput;
    raw_response?: string;
    provider?: string;
    model?: string;
}

const ACTION_VERBS = [
    "achieved", "added", "administered", "advised", "analyzed", "architected", "arranged", "assembled", "assessed",
    "authored", "budgeted", "built", "calculated", "catalyzed", "chaired", "coached", "collaborated", "communicated",
    "completed", "conceived", "conducted", "constructed", "consulted", "controlled", "coordinated", "created",
    "cultivated", "decreased", "delivered", "demonstrated", "designed", "developed", "devised", "directed", "discovered",
    "driven", "drove", "earned", "edited", "educated", "eliminated", "enabled", "engineered", "enhanced", "established",
    "evaluated", "executed", "expanded", "expedited", "facilitated", "forecasted", "formed", "formulated", "founded",
    "generated", "guided", "headed", "identified", "implemented", "improved", "increased", "influenced", "initiated",
    "innovated", "installed", "instituted", "instructed", "integrated", "introduced", "invented", "investigated", "launched",
    "led", "managed", "maximized", "mentored", "minimized", "modeled", "monitored", "motivated", "negotiated", "operated",
    "optimized", "orchestrated", "organized", "originated", "outperformed", "overhauled", "oversaw", "participated",
    "performed", "pioneered", "planned", "prepared", "presented", "produced", "programmed", "projected", "promoted",
    "proposed", "provided", "published", "rebuilt", "redesigned", "reduced", "reengineered", "regulated", "reorganized",
    "resolved", "restructured", "revamped", "reviewed", "revised", "revitalized", "saved", "scheduled", "secured",
    "simplified", "solved", "spearheaded", "standardized", "steered", "streamlined", "structured", "succeeded", "supervised",
    "supported", "surpassed", "synthesized", "systematized", "taught", "tested", "trained", "transformed", "translated",
    "troubleshot", "updated", "upgraded", "utilized", "validated", "wrote"
];

const SYSTEM_PROMPT = `You are a strict ATS resume composer.
You are assembling a final optimized resume from structured verified data.
You must not invent or modify factual content.
You may only reorganize, summarize, and prioritize content.
Return ONLY valid JSON in the required schema:
{
  "rewritten_resume_markdown": "Full markdown string",
  "summary_used_keywords": ["keyword1"],
  "skills_prioritized": ["skill1"],
  "sections_order": ["Summary", "Skills", "Experience", "Education"],
  "length_estimate_words": 500
}`;

function getWordTokens(text: string): string[] {
    if (!text) return [];
    return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 0);
}

function extractJsonTokens(obj: any): string[] {
    let vals: string[] = [];
    if (Array.isArray(obj)) {
        obj.forEach(i => vals.push(...extractJsonTokens(i)));
    } else if (typeof obj === 'object' && obj !== null) {
        Object.values(obj).forEach(v => vals.push(...extractJsonTokens(v)));
    } else if (typeof obj === 'string') {
        vals.push(obj);
    }
    return vals;
}

function mdEscapeToken(t: string): string {
    return t.replace(/[\*\_\[\]\(\)\#\-\+]/g, '');
}

export async function validateResumeComposeStrict(
    input: ComposeResumeInput,
    outputStr: string
): Promise<StrictComposeResult> {
    const failedTests: string[] = [];
    let parsed: ComposeResumeOutput;

    try {
        let cleanStr = outputStr.trim();
        const match = cleanStr.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
        if (match) cleanStr = match[1].trim();
        parsed = JSON.parse(cleanStr);
    } catch (e) {
        return { success: false, failedTests: ["JSON Parse Error"] };
    }

    if (!parsed.rewritten_resume_markdown) {
        return { success: false, failedTests: ["Missing rewritten_resume_markdown"] };
    }

    const md = parsed.rewritten_resume_markdown;
    const mdLower = md.toLowerCase();

    // C-1 Fact Integrity
    for (const exp of (input.candidate_profile.experience || [])) {
        if (exp.title && !mdLower.includes(exp.title.toLowerCase())) {
            failedTests.push(`TEST C-1 FAILED: Missing exact title "${exp.title}"`);
        }
        if (exp.company && !mdLower.includes(exp.company.toLowerCase())) {
            failedTests.push(`TEST C-1 FAILED: Missing exact company "${exp.company}"`);
        }
        if (exp.start_date && !mdLower.includes(exp.start_date.toLowerCase())) {
            failedTests.push(`TEST C-1 FAILED: Missing exact date "${exp.start_date}"`);
        }
        if (exp.end_date && !mdLower.includes(exp.end_date.toLowerCase())) {
            failedTests.push(`TEST C-1 FAILED: Missing exact date "${exp.end_date}"`);
        }
    }

    for (const edu of (input.candidate_profile.education || [])) {
        if (edu.institution && !mdLower.includes(edu.institution.toLowerCase())) {
            failedTests.push(`TEST C-1 FAILED: Missing exact institution "${edu.institution}"`);
        }
        if (edu.degree && !mdLower.includes(edu.degree.toLowerCase())) {
            failedTests.push(`TEST C-1 FAILED: Missing exact degree "${edu.degree}"`);
        }
    }

    // C-2 No New Tokens
    const allowSet = new Set([
        ...getWordTokens(extractJsonTokens(input.candidate_profile).join(' ')),
        ...getWordTokens(extractJsonTokens(input.rewritten_bullets_json).join(' ')),
        ...getWordTokens(input.jd_raw_text),
        ...ACTION_VERBS,
        "email", "phone", "location", "summary", "skills", "experience", "education", "certifications", "projects"
    ]);

    const mdTokens = getWordTokens(md);
    for (const token of mdTokens) {
        // Strip out MD syntax characters
        const t = mdEscapeToken(token);
        if (t.length > 0 && !allowSet.has(t) && !Number.isNaN(Number(t))) {
            if (t !== 's' && !t.includes('http') && !t.includes('www') && t !== 'com') {
                if (!/^\d+(\.\d+)?$/.test(t)) {
                    failedTests.push(`TEST C-2 FAILED: Hallucinated token "${t}" not found in allowed boundary sources.`);
                }
            }
        }
    }

    // C-3 Keyword Prioritization
    let foundKws = 0;
    const priorityZones = [
        ...parsed.summary_used_keywords,
        ...parsed.skills_prioritized
    ].map(k => k.toLowerCase());

    // Also include first experience role bullets
    if (input.candidate_profile.experience && input.candidate_profile.experience.length > 0) {
        const firstRole = input.candidate_profile.experience[0];
        const key = `${firstRole.company}_${firstRole.title}`;
        const firstRoleBullets = input.rewritten_bullets_json[key] || [];
        priorityZones.push(...getWordTokens(firstRoleBullets.join(' ')));
    }

    const zoneText = priorityZones.join(' ').toLowerCase();

    for (const kw of input.jd_top_10_keywords) {
        if (zoneText.includes(kw.toLowerCase())) {
            foundKws++;
        }
    }

    if (foundKws < 3 && input.jd_top_10_keywords.length >= 3) {
        // Only fail if JD had at least 3 to find, and we had them in our profile (assuming profile had them).
        // To be strictly fair, "At least 3 JD top_10_keywords must appear in summary OR skills OR first exp role" 
        // Fail if not.
        failedTests.push(`TEST C-3 FAILED: Only found ${foundKws} priority JD keywords deeply injected. Required 3.`);
    }

    // C-4 Length Rule
    const wc = mdTokens.length;
    if (input.years_experience < 10) {
        if (wc > 650) failedTests.push(`TEST C-4 FAILED: Word count (${wc}) exceeds <10y limit 650.`);
    } else {
        if (wc > 1200) failedTests.push(`TEST C-4 FAILED: Word count (${wc}) exceeds >10y limit 1200.`);
    }

    // C-5 Section Presence
    const reqSections = ["summary", "skills", "experience", "education"];
    for (const s of reqSections) {
        if (!mdLower.includes(s)) {
            failedTests.push(`TEST C-5 FAILED: Missing required section header phrase: "${s}"`);
        }
    }

    // C-6 Skills Integrity
    const origSkills = new Set([
        ...(input.candidate_profile.skills?.technical || []),
        ...(input.candidate_profile.skills?.tools || []),
        ...(input.candidate_profile.skills?.soft || [])
    ].map(s => s.toLowerCase()));

    for (const sk of parsed.skills_prioritized) {
        if (!origSkills.has(sk.toLowerCase())) {
            failedTests.push(`TEST C-6 FAILED: Skill "${sk}" was never in original candidate profile.`);
        }
    }

    return {
        success: failedTests.length === 0,
        failedTests,
        output: parsed
    };
}

export function generateDeterministicFallbackContent(input: ComposeResumeInput): string {
    let md = "";
    const b = input.candidate_profile.basics || {};
    md += `# ${b.name || b.full_name || "Applicant"}\n`;
    const contactInfo = [];
    if (b.email) contactInfo.push(b.email);
    if (b.phone) contactInfo.push(b.phone);
    if (b.location) contactInfo.push(typeof b.location === 'string' ? b.location : Object.values(b.location).join(', '));
    md += `${contactInfo.join(' | ')}\n\n`;

    if (input.candidate_profile.summary) {
        md += `## Summary\n${input.candidate_profile.summary}\n\n`;
    }

    const skills = [
        ...(input.candidate_profile.skills?.technical || []),
        ...(input.candidate_profile.skills?.tools || []),
        ...(input.candidate_profile.skills?.soft || [])
    ];
    if (skills.length > 0) {
        md += `## Skills\n${skills.slice(0, 12).join(', ')}\n\n`;
    }

    if (input.candidate_profile.experience && input.candidate_profile.experience.length > 0) {
        md += `## Experience\n`;
        for (const exp of input.candidate_profile.experience) {
            md += `### ${exp.title} - ${exp.company}\n`;
            md += `*${exp.start_date} - ${exp.end_date}* | ${exp.location || ""}\n\n`;

            const key = `${exp.company}_${exp.title}`;
            let bList = input.rewritten_bullets_json[key] || exp.bullets || [];
            bList = bList.slice(0, 5); // top 5
            for (const bullet of bList) {
                md += `- ${bullet}\n`;
            }
            md += `\n`;
        }
    }

    if (input.candidate_profile.education && input.candidate_profile.education.length > 0) {
        md += `## Education\n`;
        for (const edu of input.candidate_profile.education) {
            md += `### ${edu.institution}\n`;
            md += `${edu.degree} | *${edu.start_date || ""} - ${edu.end_date || ""}*\n\n`;
        }
    }

    return md;
}

export async function composeResumeStrictPipeline(
    input: ComposeResumeInput
): Promise<StrictComposeResult> {

    const userPrompt = `Candidate Profile JSON:
${JSON.stringify(input.candidate_profile)}

Rewritten Bullets:
${JSON.stringify(input.rewritten_bullets_json)}

JD Top 10 Keywords:
${JSON.stringify(input.jd_top_10_keywords)}

Years of Experience:
${input.years_experience}

Rules:
- Keep titles, companies, and dates EXACT.
- Do not add new bullets or roles.
- Summary must be <= 100 words.
- Use only verified skills.
- Optimize keyword placement in priority order.
- Limit max 12 skills.
- Reduce bullet count (3-5 top bullets) prioritizing JD matching.
- Length: ${input.years_experience < 10 ? "< 650" : "< 1200"} words.
- ONLY output JSON matching schema string exactly!`;

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

    let aiResult: AIGenerateResult | null = null;
    let aiResultStr = "";
    try {
        aiResult = await routeAICallWithDetails(fullPrompt);
        aiResultStr = aiResult.text;
    } catch (e: any) {
        return { success: false, failedTests: ["AI Call failed: " + e.message] };
    }

    let val1 = await validateResumeComposeStrict(input, aiResultStr);
    if (val1.success) {
        return {
            ...val1,
            raw_response: aiResultStr,
            provider: aiResult?.provider,
            model: aiResult?.model
        };
    }

    // Failure -> single retry
    let aiResult2: AIGenerateResult | null = null;
    let aiResultStr2 = "";
    try {
        aiResult2 = await routeAICallWithDetails(fullPrompt + "\n\nPREVIOUS FAILURE REASONS:\n" + val1.failedTests.join("\n") + "\nDO NOT REPEAT THESE MISTAKES. Follow the JSON schema strictly and do not hallucinate words.");
        aiResultStr2 = aiResult2.text;
    } catch (e: any) {
        return { 
            success: false, 
            failedTests: val1.failedTests.concat(["Retry AI Call failed: " + e.message]),
            raw_response: aiResultStr,
            provider: aiResult?.provider,
            model: aiResult?.model
        };
    }

    let val2 = await validateResumeComposeStrict(input, aiResultStr2);
    if (val2.success) {
        return {
            ...val2,
            raw_response: aiResultStr2,
            provider: aiResult2?.provider || aiResult?.provider,
            model: aiResult2?.model || aiResult?.model
        };
    }

    // Both failed -> deterministic layout
    const fallbackMd = generateDeterministicFallbackContent(input);
    const fallbackOutput: ComposeResumeOutput = {
        rewritten_resume_markdown: fallbackMd,
        summary_used_keywords: [],
        skills_prioritized: [],
        sections_order: ["Summary", "Skills", "Experience", "Education"],
        length_estimate_words: getWordTokens(fallbackMd).length
    };

    return {
        success: false,
        failedTests: ["ATTEMPT 1 FAILS:\n", ...val1.failedTests, "ATTEMPT 2 FAILS:\n", ...val2.failedTests, "FALLBACK USED"],
        output: fallbackOutput,
        raw_response: aiResultStr2 || aiResultStr,
        provider: aiResult2?.provider || aiResult?.provider,
        model: aiResult2?.model || aiResult?.model
    };
}
