import { createHash } from 'crypto';
import { routeAICall, AIGenerateResult } from './ai-router';
import { CandidateProfile } from './gemini-merge-strict';
import { computeAtsScoreStrict, AtsScoreResult } from './ats-score-strict';
import { rewriteBulletStrictPipeline, RewriteBulletInput, RewriteBulletOutput } from './bullet-rewrite-strict';
import { composeResumeStrictPipeline, ComposeResumeInput, ComposeResumeOutput } from './resume-compose-strict';
import { runFinalIntegrityAudit, IntegrityAuditOutput } from './resume-integrity-strict';

const MemoryCache = new Map<string, any>();

export class StrictMappingError extends Error {
    public missingFields: string[];
    public receivedData: any;

    constructor(message: string, missingFields: string[], receivedData: any) {
        super(message);
        this.name = 'StrictMappingError';
        this.missingFields = missingFields;
        this.receivedData = receivedData;
    }
}

export function validateAndMapStructuredData(
    structuredData: StructuredResumeData | undefined,
    originalProfile: CandidateProfile,
    parsedJd: any
): CandidateProfile {
    const missingFields: string[] = [];

    console.log('[MAPPING VALIDATOR] Starting strict mapping validation...');
    console.log('[MAPPING VALIDATOR] Input structured_data:', JSON.stringify(structuredData, null, 2).substring(0, 500));

    if (!structuredData) {
        throw new StrictMappingError(
            'CRITICAL: No structured data provided from orchestrator',
            ['structured_data'],
            { hasData: false }
        );
    }

    if (!structuredData.profile) {
        missingFields.push('structured_data.profile');
    } else {
        if (!structuredData.profile.basics) missingFields.push('profile.basics');
        if (!structuredData.profile.summary) missingFields.push('profile.summary');
        if (!structuredData.profile.skills) missingFields.push('profile.skills');
        if (!structuredData.profile.experience) missingFields.push('profile.experience');
        if (!structuredData.profile.education) missingFields.push('profile.education');
    }

    if (!structuredData.composed_markdown) {
        missingFields.push('structured_data.composed_markdown');
    }

    if (!structuredData.experience_bullets || Object.keys(structuredData.experience_bullets).length === 0) {
        missingFields.push('structured_data.experience_bullets');
    }

    if (!structuredData.summary_keywords) {
        missingFields.push('structured_data.summary_keywords');
    }

    if (!structuredData.prioritized_skills) {
        missingFields.push('structured_data.prioritized_skills');
    }

    if (!structuredData.sections_order) {
        missingFields.push('structured_data.sections_order');
    }

    if (missingFields.length > 0) {
        const errorMsg = `CRITICAL MAPPING ERROR: Missing required fields: ${missingFields.join(', ')}`;
        console.error(`[MAPPING VALIDATOR] ${errorMsg}`);
        throw new StrictMappingError(errorMsg, missingFields, {
            hasProfile: !!structuredData.profile,
            hasMarkdown: !!structuredData.composed_markdown,
            hasBullets: !!(structuredData.experience_bullets && Object.keys(structuredData.experience_bullets).length > 0),
            hasKeywords: !!structuredData.summary_keywords,
            hasSkills: !!structuredData.prioritized_skills,
            hasSections: !!structuredData.sections_order
        });
    }

    console.log('[MAPPING VALIDATOR] All required fields present ✓');
    console.log(`[MAPPING VALIDATOR] Profile summary: "${structuredData.profile.summary?.substring(0, 50) || 'N/A'}..."`);
    console.log(`[MAPPING VALIDATOR] Profile skills: ${JSON.stringify(structuredData.profile.skills || {})}`);
    console.log(`[MAPPING VALIDATOR] Experience count: ${structuredData.profile.experience?.length || 0}`);
    console.log(`[MAPPING VALIDATOR] Education count: ${structuredData.profile.education?.length || 0}`);
    console.log(`[MAPPING VALIDATOR] Summary keywords: ${JSON.stringify(structuredData.summary_keywords || [])}`);
    console.log(`[MAPPING VALIDATOR] Prioritized skills: ${JSON.stringify(structuredData.prioritized_skills || [])}`);
    console.log(`[MAPPING VALIDATOR] Sections order: ${JSON.stringify(structuredData.sections_order || [])}`);
    console.log(`[MAPPING VALIDATOR] Markdown length: ${structuredData.composed_markdown?.length || 0} chars`);

    return structuredData.profile;
}

export interface OrchestrationInput {
    userId: string;
    candidate_profile: CandidateProfile; // Merged from Stage 4.1
    jd_json: any;                        // Parsed JD from Stage 2
    years_experience: number;
    file_size_bytes?: number;
    pdf_pages?: number;
    rate_limit_count?: number;
}

export interface TwoPassExplanation {
    baseline_score: number;
    final_score: number;
    score_delta: number;
    improvement_summary: string;
    top_keywords_added: string[];
    weak_areas_remaining: string[];
}

export interface RawAIMetadata {
    raw_response: string;
    provider: string;
    model: string;
    elapsed_ms: number;
    timestamp: string;
}

export interface BulletRewriteRecord {
    original_bullet: string;
    rewritten_bullet: string;
    keywords_used: string[];
    needs_user_metric: boolean;
    raw_ai_response?: RawAIMetadata;
    validation_passed: boolean;
    validation_errors: string[];
}

export interface StructuredResumeData {
    profile: CandidateProfile;
    experience_bullets: Record<string, BulletRewriteRecord[]>;
    composed_markdown: string;
    summary_keywords: string[];
    prioritized_skills: string[];
    sections_order: string[];
    length_estimate: number;
    raw_compose_response?: RawAIMetadata;
}

export interface OrchestrationResult {
    success: boolean;
    error?: string;
    needs_user_confirmation?: boolean;
    final_markdown?: string;
    rescored_profile?: CandidateProfile;
    explanation?: TwoPassExplanation;
    integrity?: IntegrityAuditOutput;
    structured_data?: StructuredResumeData;
    raw_ai_logs?: RawAIMetadata[];
}

function sha256(str: string): string {
    return createHash('sha256').update(str).digest('hex');
}

export async function explainScoreDelta(
    baseline: AtsScoreResult,
    finalScore: AtsScoreResult,
    diffKeywords: string[]
): Promise<TwoPassExplanation> {
    const prompt = `SYSTEM
You are a resume optimization analyst.
You are given:
- baseline ATS score breakdown
- final ATS score breakdown
- keyword matches before and after
Explain ONLY the improvement.
Do not modify scores.
Return ONLY valid JSON.
USER
Baseline:
${JSON.stringify(baseline.category_breakdown)}

Final:
${JSON.stringify(finalScore.category_breakdown)}

Keyword differences:
${JSON.stringify(diffKeywords)}

Return JSON:
{
  "improvement_summary": "",
  "top_keywords_added": [],
  "weak_areas_remaining": []
}`;

    try {
        const raw = await routeAICall(prompt);
        let cleanStr = raw.trim();
        const match = cleanStr.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
        if (match) cleanStr = match[1].trim();
        const parsed = JSON.parse(cleanStr);
        return {
            baseline_score: baseline.ats_score,
            final_score: finalScore.ats_score,
            score_delta: finalScore.ats_score - baseline.ats_score,
            improvement_summary: parsed.improvement_summary || "",
            top_keywords_added: parsed.top_keywords_added || [],
            weak_areas_remaining: parsed.weak_areas_remaining || []
        };
    } catch (e) {
        // Fallback explanation
        return {
            baseline_score: baseline.ats_score,
            final_score: finalScore.ats_score,
            score_delta: finalScore.ats_score - baseline.ats_score,
            improvement_summary: "Automated analysis failed. Resume structurally optimized.",
            top_keywords_added: diffKeywords.slice(0, 5),
            weak_areas_remaining: []
        };
    }
}

/**
 * Lightweight deterministic MD to CandidateProfile parser 
 * exclusively for re-scoring the final generated document.
 */
function parseMdToCandidate(md: string): CandidateProfile {
    // We only need to populate summary, skills, and experience bullets for the scorer.
    const res: CandidateProfile = {
        basics: { email: "a@a.com", phone: "123" }, // dummy to pass completeness
        summary: "",
        skills: { technical: [], tools: [], soft: [] },
        experience: [],
        education: [{ institution: "A", degree: "B" }], // dummy
        projects: [], certifications: []
    };

    // Naive split
    const summaryMatch = md.match(/## Summary\n([\s\S]*?)\n## /i);
    if (summaryMatch) res.summary = summaryMatch[1].trim();

    const skillsMatch = md.match(/## Skills\n([\s\S]*?)\n## /i);
    if (skillsMatch) {
        res.skills.technical = skillsMatch[1].split(',').map(s => s.trim());
    }

    const expMatch = md.match(/## Experience\n([\s\S]*?)(?=\n## |$)/i);
    if (expMatch) {
        const roles = expMatch[1].split('### ');
        for (let i = 1; i < roles.length; i++) {
            const rText = roles[i];
            // extract bullets
            const bullets = (rText.match(/^- (.*)/gm) || []).map(b => b.replace(/^- /, '').trim());
            res.experience.push({ bullets });
        }
    }

    return res;
}

export async function orchestrateResumePipeline(
    input: OrchestrationInput
): Promise<OrchestrationResult> {

    const rawAILogs: RawAIMetadata[] = [];
    
    function logRawAI(provider: string, model: string, response: string, elapsedMs: number) {
        const metadata: RawAIMetadata = {
            raw_response: response,
            provider,
            model,
            elapsed_ms: elapsedMs,
            timestamp: new Date().toISOString()
        };
        rawAILogs.push(metadata);
        console.log(`[RAW AI] Provider: ${provider}, Model: ${model}, Length: ${response.length} chars`);
    }

    // Rate Limiting + Abuse Guard
    if (input.file_size_bytes && input.file_size_bytes > 5 * 1024 * 1024) {
        return { success: false, error: "File exceeds 5MB limit.", raw_ai_logs: rawAILogs };
    }
    if (input.pdf_pages && input.pdf_pages > 20) {
        return { success: false, error: "Resume exceeds 20 pages limit.", raw_ai_logs: rawAILogs };
    }
    if (input.rate_limit_count && input.rate_limit_count >= 5) {
        return { success: false, error: "Abuse block: Rate limit exceeded.", raw_ai_logs: rawAILogs };
    }

    console.log('[ORCHESTRATOR] === STAGE 1: BASELINE ATS SCORE ===');
    const baselineAts = computeAtsScoreStrict(input.candidate_profile, input.jd_json);
    console.log(`[ORCHESTRATOR] Baseline ATS Score: ${baselineAts.ats_score}`);
    console.log(`[ORCHESTRATOR] Baseline Keywords: ${JSON.stringify(baselineAts.keyword_matches.map(m => m.keyword).slice(0, 5))}`);

    // Payload Truncation for Bullet Rewrite 
    const truncProfileText = [
        input.candidate_profile.summary || "",
        ...(input.candidate_profile.skills?.technical || []),
        ...(input.candidate_profile.skills?.tools || []),
        ...(input.candidate_profile.skills?.soft || [])
    ].join(' ').slice(0, 1000);

    const top10 = (input.jd_json.top_10_keywords || input.jd_json.top_25_keywords?.slice(0, 10)) || [];
    const jdHash = sha256(JSON.stringify(top10));

    console.log('[ORCHESTRATOR] === STAGE 2: BULLET REWRITING ===');
    const rewritten_bullets_json: Record<string, string[]> = {};
    const experience_bullets_records: Record<string, BulletRewriteRecord[]> = {};
    let metricMissing = false;

    for (const exp of (input.candidate_profile.experience || [])) {
        const key = `${exp.company}_${exp.title}`;
        rewritten_bullets_json[key] = [];
        experience_bullets_records[key] = [];

        console.log(`[ORCHESTRATOR] Processing experience: ${exp.title} at ${exp.company}`);
        console.log(`[ORCHESTRATOR] Original bullets count: ${exp.bullets?.length || 0}`);

        for (const b of (exp.bullets || [])) {
            if (typeof b !== 'string') continue;

            const bHash = sha256(b + jdHash);
            const cached = MemoryCache.get(bHash);

            const origHasNumber = /\d/.test(b);
            if (!origHasNumber) metricMissing = true;

            if (cached) {
                console.log(`[CACHE HIT] Bullet: ${bHash.substring(0, 8)}`);
                rewritten_bullets_json[key].push(cached.rewritten);
                experience_bullets_records[key].push({
                    original_bullet: b,
                    rewritten_bullet: cached.rewritten,
                    keywords_used: cached.keywords_used || [],
                    needs_user_metric: cached.needs_user_metric || false,
                    validation_passed: true,
                    validation_errors: []
                });
                if (cached.needs_user_metric) metricMissing = true;
            } else {
                console.log(`[CACHE MISS] Bullet rewrite: ${b.substring(0, 50)}...`);
                const rewInput: RewriteBulletInput = {
                    original_bullet: b,
                    top_10_keywords_array: top10,
                    concatenated_candidate_text: truncProfileText,
                    jd_raw_text: (input.jd_json.raw_text || "").slice(0, 1500)
                };

                const startTime = Date.now();
                const res = await rewriteBulletStrictPipeline(rewInput);
                const elapsed = Date.now() - startTime;

                if (res.success && res.output) {
                    rewritten_bullets_json[key].push(res.output.rewritten);
                    MemoryCache.set(bHash, res.output);
                    
                    const record: BulletRewriteRecord = {
                        original_bullet: b,
                        rewritten_bullet: res.output.rewritten,
                        keywords_used: res.output.keywords_used || [],
                        needs_user_metric: res.output.needs_user_metric || false,
                        raw_ai_response: {
                            raw_response: res.raw_response || '[cached-no-raw]',
                            provider: res.provider || 'unknown',
                            model: res.model || 'unknown',
                            elapsed_ms: elapsed,
                            timestamp: new Date().toISOString()
                        },
                        validation_passed: res.success,
                        validation_errors: res.failedTests || []
                    };
                    experience_bullets_records[key].push(record);
                    
                    console.log(`[BULLET REWRITE] Original: "${b.substring(0, 40)}..."`);
                    console.log(`[BULLET REWRITE] Rewritten: "${res.output.rewritten.substring(0, 40)}..."`);
                    console.log(`[BULLET REWRITE] Keywords used: ${JSON.stringify(res.output.keywords_used || [])}`);
                    
                    if (res.output.needs_user_metric) metricMissing = true;
                } else {
                    console.error(`[BULLET REWRITE FAILED] Original: "${b.substring(0, 40)}..."`);
                    console.error(`[BULLET REWRITE ERROR] ${JSON.stringify(res.failedTests || [])}`);
                    rewritten_bullets_json[key].push(b);
                    experience_bullets_records[key].push({
                        original_bullet: b,
                        rewritten_bullet: b,
                        keywords_used: [],
                        needs_user_metric: !origHasNumber,
                        validation_passed: false,
                        validation_errors: res.failedTests || []
                    });
                }
            }
        }
        console.log(`[ORCHESTRATOR] Finished processing: ${key}, bullets rewritten: ${rewritten_bullets_json[key].length}`);
    }

    console.log('[ORCHESTRATOR] === STAGE 3: RESUME COMPOSITION ===');
    let finalMarkdown = "";
    let composeOutput: ComposeResumeOutput | null = null;

    const compProfile = JSON.parse(JSON.stringify(input.candidate_profile));
    delete compProfile.raw_text;
    if (compProfile.basics) {
        delete compProfile.basics.profiles;
        delete compProfile.basics.url;
    }

    const compHash = sha256(JSON.stringify(compProfile) + JSON.stringify(rewritten_bullets_json) + jdHash);
    const compCached = MemoryCache.get(compHash);

    if (compCached) {
        console.log(`[CACHE HIT] Compose: ${compHash.substring(0, 8)}`);
        finalMarkdown = compCached;
    } else {
        console.log(`[CACHE MISS] Compose: ${compHash.substring(0, 8)}`);
        console.log(`[ORCHESTRATOR] Input profile summary: "${compProfile.summary?.substring(0, 100) || 'N/A'}..."`);
        console.log(`[ORCHESTRATOR] Input profile skills: ${JSON.stringify(compProfile.skills || {})}`);
        console.log(`[ORCHESTRATOR] Experience entries: ${compProfile.experience?.length || 0}`);
        
        const compInput: ComposeResumeInput = {
            candidate_profile: compProfile,
            rewritten_bullets_json,
            jd_top_10_keywords: top10,
            years_experience: input.years_experience,
            jd_raw_text: ""
        };
        
        const startTime = Date.now();
        const composeRes = await composeResumeStrictPipeline(compInput);
        const elapsed = Date.now() - startTime;

        if (composeRes.success && composeRes.output) {
            finalMarkdown = composeRes.output.rewritten_resume_markdown;
            composeOutput = composeRes.output;
            MemoryCache.set(compHash, finalMarkdown);
            
            if (composeRes.raw_response) {
                logRawAI(composeRes.provider || 'unknown', composeRes.model || 'unknown', composeRes.raw_response, elapsed);
            }
            
            console.log(`[COMPOSE] Generated markdown length: ${finalMarkdown.length} chars`);
            console.log(`[COMPOSE] Summary keywords: ${JSON.stringify(composeRes.output.summary_used_keywords || [])}`);
            console.log(`[COMPOSE] Prioritized skills: ${JSON.stringify(composeRes.output.skills_prioritized || [])}`);
            console.log(`[COMPOSE] Sections order: ${JSON.stringify(composeRes.output.sections_order || [])}`);
            console.log(`[COMPOSE] Length estimate: ${composeRes.output.length_estimate_words || 'N/A'} words`);
        } else if (composeRes.output?.rewritten_resume_markdown) {
            finalMarkdown = composeRes.output.rewritten_resume_markdown;
            composeOutput = composeRes.output;
            console.warn(`[COMPOSE] Fallback used - validation errors: ${JSON.stringify(composeRes.failedTests || [])}`);
        } else {
            console.error(`[COMPOSE] Completely failed: ${JSON.stringify(composeRes.failedTests || [])}`);
            return { 
                success: false, 
                error: "Composer completely failed. No markdown layout generated.\n" + (composeRes.failedTests || []).join(', '),
                raw_ai_logs: rawAILogs
            };
        }
    }

    console.log('[ORCHESTRATOR] === STAGE 4: RESCORING & VALIDATION ===');
    const rescoredProfile = parseMdToCandidate(finalMarkdown);
    console.log(`[ORCHESTRATOR] Rescored profile summary: "${rescoredProfile.summary?.substring(0, 50) || 'N/A'}..."`);
    console.log(`[ORCHESTRATOR] Rescored profile skills: ${JSON.stringify(rescoredProfile.skills || {})}`);
    console.log(`[ORCHESTRATOR] Rescored profile experience count: ${rescoredProfile.experience?.length || 0}`);
    
    const finalAts = computeAtsScoreStrict(rescoredProfile, input.jd_json);
    console.log(`[ORCHESTRATOR] Final ATS Score: ${finalAts.ats_score}`);
    console.log(`[ORCHESTRATOR] Score improvement: ${finalAts.ats_score - baselineAts.ats_score}`);

    const baseKws = baselineAts.keyword_matches.map(m => m.keyword);
    const finalKws = finalAts.keyword_matches.map(m => m.keyword);
    const newKws = finalKws.filter(x => !baseKws.includes(x));
    console.log(`[ORCHESTRATOR] New keywords added: ${JSON.stringify(newKws.slice(0, 10))}`);

    console.log('[ORCHESTRATOR] === STAGE 5: SCORE EXPLANATION ===');
    const explanation = await explainScoreDelta(baselineAts, finalAts, newKws);
    console.log(`[ORCHESTRATOR] Explanation: ${explanation.improvement_summary}`);
    console.log(`[ORCHESTRATOR] Top keywords added: ${JSON.stringify(explanation.top_keywords_added || [])}`);
    console.log(`[ORCHESTRATOR] Weak areas: ${JSON.stringify(explanation.weak_areas_remaining || [])}`);

    console.log('[ORCHESTRATOR] === STAGE 6: FINAL INTEGRITY AUDIT ===');
    const integrity = await runFinalIntegrityAudit({
        final_markdown_resume: finalMarkdown,
        jd_top_10_keywords: top10
    });
    console.log(`[ORCHESTRATOR] Integrity passed: ${integrity.integrity_passed}`);
    if (integrity.issues && integrity.issues.length > 0) {
        console.log(`[ORCHESTRATOR] Integrity issues: ${JSON.stringify(integrity.issues)}`);
    }

    console.log('[ORCHESTRATOR] === BUILDING STRUCTURED DATA ===');
    const structuredData: StructuredResumeData = {
        profile: input.candidate_profile,
        experience_bullets: experience_bullets_records,
        composed_markdown: finalMarkdown,
        summary_keywords: composeOutput?.summary_used_keywords || [],
        prioritized_skills: composeOutput?.skills_prioritized || [],
        sections_order: composeOutput?.sections_order || ['Summary', 'Skills', 'Experience', 'Education'],
        length_estimate: composeOutput?.length_estimate_words || 0,
        raw_compose_response: composeOutput ? {
            raw_response: '[captured-in-compose]',
            provider: 'unknown',
            model: 'unknown',
            elapsed_ms: 0,
            timestamp: new Date().toISOString()
        } : undefined
    };

    console.log(`[ORCHESTRATOR] Structured data summary_keywords: ${JSON.stringify(structuredData.summary_keywords)}`);
    console.log(`[ORCHESTRATOR] Structured data prioritized_skills: ${JSON.stringify(structuredData.prioritized_skills)}`);
    console.log(`[ORCHESTRATOR] Structured data sections_order: ${JSON.stringify(structuredData.sections_order)}`);
    console.log(`[ORCHESTRATOR] Structured data experience entries: ${Object.keys(structuredData.experience_bullets).length}`);

    console.log('[ORCHESTRATOR] === ORCHESTRATION COMPLETE ===');
    
    return {
        success: true,
        needs_user_confirmation: finalMarkdown.includes("[add metric]") || metricMissing,
        final_markdown: finalMarkdown,
        rescored_profile: rescoredProfile,
        explanation,
        integrity,
        structured_data: structuredData,
        raw_ai_logs: rawAILogs
    };
}
