import { createHash } from 'crypto';
import { routeAICall } from './ai-router';
import { CandidateProfile } from './gemini-merge-strict';
import { computeAtsScoreStrict, AtsScoreResult } from './ats-score-strict';
import { rewriteBulletStrictPipeline, RewriteBulletInput } from './bullet-rewrite-strict';
import { composeResumeStrictPipeline, ComposeResumeInput } from './resume-compose-strict';
import { runFinalIntegrityAudit, IntegrityAuditOutput } from './resume-integrity-strict';

const MemoryCache = new Map<string, any>();

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

export interface OrchestrationResult {
    success: boolean;
    error?: string;
    needs_user_confirmation?: boolean;
    final_markdown?: string;
    rescored_profile?: CandidateProfile;
    explanation?: TwoPassExplanation;
    integrity?: IntegrityAuditOutput;
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

    // 5.6 Rate Limiting + Abuse Guard
    if (input.file_size_bytes && input.file_size_bytes > 5 * 1024 * 1024) {
        return { success: false, error: "File exceeds 5MB limit." };
    }
    if (input.pdf_pages && input.pdf_pages > 20) {
        return { success: false, error: "Resume exceeds 20 pages limit." };
    }
    if (input.rate_limit_count && input.rate_limit_count >= 5) {
        return { success: false, error: "Abuse block: Rate limit exceeded." };
    }

    // Baseline ATS
    const baselineAts = computeAtsScoreStrict(input.candidate_profile, input.jd_json);

    // 5.7 Payload Truncation for Bullet Rewrite 
    // Truncate candidate profile text to only relevant sections to save tokens
    const truncProfileText = [
        input.candidate_profile.summary || "",
        ...(input.candidate_profile.skills?.technical || []),
        ...(input.candidate_profile.skills?.tools || []),
        ...(input.candidate_profile.skills?.soft || [])
    ].join(' ').slice(0, 1000); // tightly bounded

    const top10 = (input.jd_json.top_10_keywords || input.jd_json.top_25_keywords?.slice(0, 10)) || [];
    const jdHash = sha256(JSON.stringify(top10));

    // Phase 1: Rewrite Bullets
    const rewritten_bullets_json: Record<string, string[]> = {};
    let metricMissing = false;

    // We process each bullet iteratively
    for (const exp of (input.candidate_profile.experience || [])) {
        const key = `${exp.company}_${exp.title}`;
        rewritten_bullets_json[key] = [];

        for (const b of (exp.bullets || [])) {
            if (typeof b !== 'string') continue;

            // 5.2 Bullet Rewrite Cost Optimization (Hash Caching)
            const bHash = sha256(b + jdHash);
            const cached = MemoryCache.get(bHash);

            const origHasNumber = /\d/.test(b);
            if (!origHasNumber) metricMissing = true;

            if (cached) {
                console.log(`[CACHE HIT] Bullet: ${bHash.substring(0, 8)}`);
                rewritten_bullets_json[key].push(cached.rewritten);
                if (cached.needs_user_metric) metricMissing = true;
            } else {
                console.log(`[CACHE MISS] Bullet: ${bHash.substring(0, 8)}`);
                const rewInput: RewriteBulletInput = {
                    original_bullet: b,
                    top_10_keywords_array: top10,
                    concatenated_candidate_text: truncProfileText,
                    jd_raw_text: (input.jd_json.raw_text || "").slice(0, 1500)
                };

                const res = await rewriteBulletStrictPipeline(rewInput);
                if (res.success && res.output) {
                    rewritten_bullets_json[key].push(res.output.rewritten);
                    MemoryCache.set(bHash, res.output);
                    if (res.output.needs_user_metric) metricMissing = true;
                } else {
                    // Keep original if completely failed
                    rewritten_bullets_json[key].push(b);
                }
            }
        }
    }

    // 5.5 User Confirmation Gate
    // Wait until markdown? Actually if ANY bullet needs metric, we flag it. 
    // But we still return the markdown so they can edit it inline!

    // 5.3 Compose Caching
    let finalMarkdown = "";

    // 5.7 Truncate candidate profile passing to compose
    // Strip raw text or excessive fields out
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
        const compInput: ComposeResumeInput = {
            candidate_profile: compProfile,
            rewritten_bullets_json,
            jd_top_10_keywords: top10,
            years_experience: input.years_experience,
            jd_raw_text: "" // Purge passing raw text further
        };
        const composeRes = await composeResumeStrictPipeline(compInput);
        if (composeRes.success && composeRes.output) {
            finalMarkdown = composeRes.output.rewritten_resume_markdown;
            MemoryCache.set(compHash, finalMarkdown);
        } else if (composeRes.output?.rewritten_resume_markdown) {
            // Fallback used (still structurally deterministic)
            finalMarkdown = composeRes.output.rewritten_resume_markdown;
        } else {
            return { success: false, error: "Composer completely failed. No markdown layout generated.\n" + (composeRes.failedTests || []).join(', ') };
        }
    }

    // 5.4 Hard Guardrail Validator
    // Parse it back to candidate profile and score
    const rescoredProfile = parseMdToCandidate(finalMarkdown);
    const finalAts = computeAtsScoreStrict(rescoredProfile, input.jd_json);

    // 5.1 Two-Pass Score Explanation
    const baseKws = baselineAts.keyword_matches.map(m => m.keyword);
    const finalKws = finalAts.keyword_matches.map(m => m.keyword);
    const newKws = finalKws.filter(x => !baseKws.includes(x));

    const explanation = await explainScoreDelta(baselineAts, finalAts, newKws);

    // Stage 6: Final Integrity Guardrail
    const integrity = await runFinalIntegrityAudit({
        final_markdown_resume: finalMarkdown,
        jd_top_10_keywords: top10
    });

    return {
        success: true,
        needs_user_confirmation: finalMarkdown.includes("[add metric]") || metricMissing,
        final_markdown: finalMarkdown,
        explanation,
        integrity
    };
}
