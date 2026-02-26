import { routeAICallWithDetails, AIGenerateResult } from './ai-router';
import { CandidateProfile } from './gemini-merge-strict';
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
config({ path: '.env.local' });

export interface BulletInput {
    original: string;
    rewritten: string;
    fallback_used: boolean;
}

export interface ComposeResumeInput {
    candidate_json: CandidateProfile;
    job_json: any;
    bullets: BulletInput[];
    meta: {
        years_experience: number;
        jd_top_10_keywords?: string[];
    };
    reqId?: string;
}

export interface ComposeResumeOutput {
    basics: any;
    summary: string;
    skills: {
        technical: string[];
        tools: string[];
        soft: string[];
    };
    experience: any[];
    education: any[];
    projects: any[];
    community: any[];
}

export interface StrictComposeResult {
    success: boolean;
    failedTests: string[];
    output?: ComposeResumeOutput;
    raw_response?: string;
    provider?: string;
    model?: string;
}

const SYSTEM_PROMPT = `You are a strict ATS resume composer in BUILD mode.
You are composing a final optimized resume from structured verified data.
You must NOT output markdown. Output ONLY valid JSON.
You must not invent or modify factual content.
You may only reorganize, summarize, and prioritize content.

CRITICAL: Use deterministic output. Do not shuffle sections or add randomness.
Preserve original section order: Experience, Education, Skills, Projects, Community.

IMPORTANT: Resume may exceed one page if needed to preserve completeness and impact. Do not truncate content to fit a single page.

Output STRICT JSON matching this schema exactly:
{
  "basics": { "name": "", "email": "", "phone": "", "location": "" },
  "summary": "string up to 100 words",
  "skills": { "technical": [], "tools": [], "soft": [] },
  "experience": [{ "title": "", "company": "", "start_date": "", "end_date": "", "location": "", "bullets": [] }],
  "education": [{ "institution": "", "degree": "", "start_date": "", "end_date": "", "relevant_coursework": [] }],
  "projects": [{ "name": "", "description": "", "technologies": [] }],
  "community": [{ "organization": "", "role": "", "description": "" }]
}

Rules:
- Keep all original experience entries unless explicitly removed with reason in a "removal_reason" field
- Keep all original skills. If reducing, ensure at least 50% of original skills remain
- Keep community section separate from experience
- Keep relevant_coursework inside education if originally present
- Use rewritten bullets from input where available
- Resume may exceed one page if needed to preserve completeness and impact
- Do not truncate sections or enforce word limits
- Do not shuffle section order - preserve original ordering
- Return ONLY valid JSON. No markdown, no explanations, no text before or after.`;

function saveRawOutput(reqId: string | undefined, stage: string, rawOutput: string): void {
    if (!reqId) return;
    const dir = `/tmp/resume_tasks/${reqId}`;
    const filePath = path.join(dir, `raw_${stage}.txt`);
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, rawOutput);
        console.log(`[RAW OUTPUT] Saved to ${filePath}`);
    } catch (e: any) {
        console.error(`[RAW OUTPUT ERROR] Failed to save: ${e.message}`);
    }
}

function saveComposeResponse(reqId: string | undefined, data: any): void {
    if (!reqId) return;
    const dir = `/tmp/resume_tasks/${reqId}`;
    const filePath = path.join(dir, 'compose_response.json');
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        console.log(`[COMPOSE RESPONSE] Saved to ${filePath}`);
    } catch (e: any) {
        console.error(`[COMPOSE RESPONSE ERROR] ${e.message}`);
    }
}

function strictJsonParse<T>(rawOutput: string, reqId: string | undefined, stage: string, schemaFields: string[]): T {
    let cleanStr = rawOutput.trim();
    const match = cleanStr.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
    if (match) cleanStr = match[1].trim();

    try {
        const parsed = JSON.parse(cleanStr);
        
        for (const field of schemaFields) {
            if (!(field in parsed)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        return parsed as T;
    } catch (e: any) {
        console.error(`[JSON PARSE ERROR] ${stage}: ${e.message}`);
        saveRawOutput(reqId, stage, rawOutput);
        throw new Error(`JSON parse failed for ${stage}: ${e.message}. Raw output saved.`);
    }
}

function countSkills(skills: any): number {
    return (skills?.technical?.length || 0) + 
           (skills?.tools?.length || 0) + 
           (skills?.soft?.length || 0);
}

function flattenBullets(bullets: BulletInput[]): Map<string, string> {
    const map = new Map<string, string>();
    bullets.forEach((b, idx) => {
        if (b.original && b.rewritten) {
            map.set(b.original, b.rewritten);
        }
    });
    return map;
}

function applyRewrittenBullets(experience: any[], bulletMap: Map<string, string>): any[] {
    return experience.map(exp => {
        if (exp.bullets && Array.isArray(exp.bullets)) {
            const newBullets = exp.bullets.map((b: string) => bulletMap.get(b) || b);
            return { ...exp, bullets: newBullets };
        }
        return exp;
    });
}

export async function validateComposeOutput(
    input: ComposeResumeInput,
    output: ComposeResumeOutput
): Promise<StrictComposeResult> {
    const failedTests: string[] = [];

    const requiredFields = ['basics', 'summary', 'skills', 'experience', 'education', 'projects', 'community'];
    for (const field of requiredFields) {
        if (!(field in output)) {
            failedTests.push(`GUARDRAIL FAILED: Missing required field "${field}"`);
        }
    }

    if (failedTests.length > 0) {
        return { success: false, failedTests };
    }

    const outExp = output.experience || [];
    if (outExp.length === 0) {
        failedTests.push(`GUARDRAIL FAILED: experience.length == 0 - cannot proceed with empty experience`);
    }

    const outEdu = output.education || [];
    if (!outEdu || outEdu.length === 0) {
        failedTests.push(`GUARDRAIL FAILED: education missing - cannot proceed without education`);
    }

    const outSkills = output.skills;
    if (!outSkills || (countSkills(outSkills) === 0)) {
        failedTests.push(`GUARDRAIL FAILED: skills missing - cannot proceed without skills`);
    }

    const origSectionCount = getSectionCount(input.candidate_json);
    const outSectionCount = getSectionCount(output);
    
    if (origSectionCount > 0 && outSectionCount < origSectionCount * 0.5) {
        failedTests.push(`GUARDRAIL FAILED: section count dropped by >50% (${origSectionCount} -> ${outSectionCount})`);
    }

    const origExp = input.candidate_json.experience || [];
    
    if (outExp.length < origExp.length) {
        const removed = origExp.length - outExp.length;
        const hasReasons = outExp.some((e: any) => e.removal_reason);
        if (!hasReasons) {
            failedTests.push(`GUARDRAIL FAILED: Experience count reduced by ${removed} but no removal_reason provided`);
        }
    }

    const origSkillsCount = countSkills(input.candidate_json.skills);
    const outSkillsCount = countSkills(output.skills);
    
    if (origSkillsCount > 0 && outSkillsCount < origSkillsCount * 0.5) {
        failedTests.push(`GUARDRAIL FAILED: Skills reduced by more than 50% (${origSkillsCount} -> ${outSkillsCount})`);
    }

    const origHasCommunity = input.candidate_json.community && input.candidate_json.community.length > 0;
    const outHasCommunity = output.community && output.community.length > 0;
    
    if (origHasCommunity && !outHasCommunity) {
        failedTests.push(`GUARDRAIL FAILED: Community section was present in input but missing in output`);
    }

    const communityInExperience = outExp.some((e: any) => 
        e.company?.toLowerCase().includes('community') || 
        e.title?.toLowerCase().includes('volunteer') ||
        e.bullets?.some((b: string) => b.toLowerCase().includes('community') && b.toLowerCase().includes('volunteer'))
    );
    
    if (origHasCommunity && communityInExperience) {
        failedTests.push(`GUARDRAIL FAILED: community merged into experience - community must remain separate`);
    }

    const origEducation = input.candidate_json.education || [];
    for (const edu of origEducation) {
        if (edu.relevant_coursework && edu.relevant_coursework.length > 0) {
            const outEduItem = output.education?.find((e: any) => e.institution === edu.institution);
            if (outEduItem && (!outEduItem.relevant_coursework || outEduItem.relevant_coursework.length === 0)) {
                failedTests.push(`GUARDRAIL FAILED: relevant_coursework was present in education but missing in output`);
            }
        }
    }

    return {
        success: failedTests.length === 0,
        failedTests,
        output
    };
}

function getSectionCount(profile: any): number {
    let count = 0;
    if (profile.experience?.length > 0) count++;
    if (profile.education?.length > 0) count++;
    if (profile.skills && countSkills(profile.skills) > 0) count++;
    if (profile.projects?.length > 0) count++;
    if (profile.community?.length > 0) count++;
    if (profile.certifications?.length > 0) count++;
    return count;
}

export async function composeResumeStrictPipeline(
    input: ComposeResumeInput
): Promise<StrictComposeResult> {

    const bulletMap = flattenBullets(input.bullets || []);
    const userPrompt = `Candidate Profile:
${JSON.stringify(input.candidate_json, null, 2)}

Job Description:
${JSON.stringify(input.job_json, null, 2)}

Rewritten Bullets (use these for experience):
${JSON.stringify(Array.from(bulletMap.entries()), null, 2)}

Meta:
- Years of Experience: ${input.meta.years_experience}
- JD Keywords: ${JSON.stringify(input.meta.jd_top_10_keywords || [])}

IMPORTANT:
- Output ONLY valid JSON (no markdown)
- Experience must include all original entries unless explicitly removed with removal_reason
- Keep at least 50% of original skills
- Keep community separate from experience
- Keep relevant_coursework in education if originally present
- Use rewritten bullets from input`;

    const fullPrompt = `${SYSTEM_PROMPT}\n\n${userPrompt}`;

    let aiResult: AIGenerateResult | null = null;
    let aiResultStr = "";
    try {
        aiResult = await routeAICallWithDetails(fullPrompt, 0.2);
        aiResultStr = aiResult.text;
    } catch (e: any) {
        return { success: false, failedTests: ["AI Call failed: " + e.message] };
    }

    let parsedOutput: ComposeResumeOutput;
    try {
        parsedOutput = strictJsonParse<ComposeResumeOutput>(
            aiResultStr,
            input.reqId,
            'compose_1',
            ['basics', 'summary', 'skills', 'experience', 'education', 'projects', 'community']
        );
    } catch (e: any) {
        return { 
            success: false, 
            failedTests: ["JSON Parse Error (Strict): " + e.message],
            raw_response: aiResultStr,
            provider: aiResult?.provider,
            model: aiResult?.model
        };
    }

    parsedOutput.experience = applyRewrittenBullets(parsedOutput.experience || [], bulletMap);

    let val1 = await validateComposeOutput(input, parsedOutput);
    if (val1.success) {
        saveComposeResponse(input.reqId, {
            parsed_json: parsedOutput,
            raw_response: aiResultStr,
            success: true,
            timestamp: new Date().toISOString()
        });
        return {
            ...val1,
            raw_response: aiResultStr,
            provider: aiResult?.provider,
            model: aiResult?.model
        };
    }

    saveComposeResponse(input.reqId, {
        parsed_json: parsedOutput,
        raw_response: aiResultStr,
        success: false,
        errors: val1.failedTests,
        timestamp: new Date().toISOString()
    });

    // Failure -> retry
    let aiResult2: AIGenerateResult | null = null;
    let aiResultStr2 = "";
    try {
        aiResult2 = await routeAICallWithDetails(fullPrompt + "\n\nPREVIOUS VALIDATION FAILURES:\n" + val1.failedTests.join("\n") + "\nFix these issues and output valid JSON.", 0.2);
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

    try {
        parsedOutput = strictJsonParse<ComposeResumeOutput>(
            aiResultStr2,
            input.reqId,
            'compose_2',
            ['basics', 'summary', 'skills', 'experience', 'education', 'projects', 'community']
        );
    } catch (e: any) {
        return { 
            success: false, 
            failedTests: val1.failedTests.concat(["JSON Parse Error (Retry): " + e.message]),
            raw_response: aiResultStr2,
            provider: aiResult2?.provider || aiResult?.provider,
            model: aiResult2?.model || aiResult?.model
        };
    }

    parsedOutput.experience = applyRewrittenBullets(parsedOutput.experience || [], bulletMap);

    let val2 = await validateComposeOutput(input, parsedOutput);
    if (val2.success) {
        saveComposeResponse(input.reqId, {
            parsed_json: parsedOutput,
            raw_response: aiResultStr2,
            success: true,
            timestamp: new Date().toISOString()
        });
        return {
            ...val2,
            raw_response: aiResultStr2,
            provider: aiResult2?.provider || aiResult?.provider,
            model: aiResult2?.model || aiResult?.model
        };
    }

    saveComposeResponse(input.reqId, {
        parsed_json: parsedOutput,
        raw_response: aiResultStr2,
        success: false,
        errors: val2.failedTests,
        timestamp: new Date().toISOString()
    });

    // Both failed
    saveComposeResponse(input.reqId, {
        parsed_json: null,
        raw_response: aiResultStr2 || aiResultStr,
        success: false,
        errors: val2.failedTests,
        timestamp: new Date().toISOString()
    });

    saveRawOutput(input.reqId, 'compose_failed', aiResultStr2 || aiResultStr);

    return {
        success: false,
        failedTests: ["ATTEMPT 1 FAILED:", ...val1.failedTests, "ATTEMPT 2 FAILED:", ...val2.failedTests],
        raw_response: aiResultStr2 || aiResultStr,
        provider: aiResult2?.provider || aiResult?.provider,
        model: aiResult2?.model || aiResult?.model
    };
}
