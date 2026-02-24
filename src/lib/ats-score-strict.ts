import { CandidateProfile } from './gemini-merge-strict';

export interface KeywordMatch {
    keyword: string;
    locations: string[];
}

export interface AtsScoreCategoryBreakdown {
    KeywordMatch: number;
    SectionCompleteness: number;
    FormattingSafety: number;
    ContentQuality: number;
    JobMatchRelevance: number;
}

export interface AtsScoreResult {
    ats_score: number;
    category_breakdown: AtsScoreCategoryBreakdown;
    keyword_matches: KeywordMatch[];
}

// Action verbs list for ContentQuality checking
const ACTION_VERBS = new Set([
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
]);

function getWordTokens(text: string): string[] {
    if (!text) return [];
    return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 0);
}

function hasNumber(text: string): boolean {
    return /\d/.test(text);
}

export function computeAtsScoreStrict(
    candidate: CandidateProfile,
    jdJson: any
): AtsScoreResult {

    const jdKeywords = Array.isArray(jdJson.top_25_keywords) ? jdJson.top_25_keywords : [];
    const jdRequiredSkills = Array.isArray(jdJson.required_skills) ? jdJson.required_skills : [];

    // --- 1. KeywordMatch (40 pts) ---
    // summary -> +1.5, skills -> +1.5, experience bullets -> +1.0
    // Max +2.0 per keyword.

    // Pre-process text spaces
    const summaryLower = (candidate.summary || "").toLowerCase();
    const skillsCombined = [
        ...(candidate.skills?.technical || []),
        ...(candidate.skills?.tools || []),
        ...(candidate.skills?.soft || [])
    ].join(' ').toLowerCase();

    const expBulletsLower = (candidate.experience || []).flatMap(e => e.bullets || []).join(' ').toLowerCase();

    const resumeFullRawForValid = [summaryLower, skillsCombined, expBulletsLower].join(' ');

    let rawKeywordPoints = 0;
    const keywordMatches: KeywordMatch[] = [];

    for (const kw of jdKeywords) {
        if (!kw || typeof kw !== 'string') continue;
        const kwLower = kw.toLowerCase();

        // Exact substring match
        const inSum = summaryLower.includes(kwLower);
        const inSki = skillsCombined.includes(kwLower);
        const inExp = expBulletsLower.includes(kwLower);

        let pts = 0;
        const locs: string[] = [];

        if (inSum) { pts += 1.5; locs.push("summary"); }
        if (inSki) { pts += 1.5; locs.push("skills"); }
        if (inExp) { pts += 1.0; locs.push("experience"); }

        if (pts > 2.0) pts = 2.0;

        if (locs.length > 0) {
            rawKeywordPoints += pts;
            // "Every keyword in keyword_matches must: Exist in JD top_25_keywords, Exist in resume text"
            // If it found a true match it will be in the combined raw text natively.
            keywordMatches.push({
                keyword: kw,
                locations: locs
            });
        }
    }

    // scaled = (raw_points / (25 * 2.0)) * 40 => raw_points / 50 * 40
    let scaledKeywordMatch = Math.floor((rawKeywordPoints / 50.0) * 40.0);
    // Cap at 40
    if (scaledKeywordMatch > 40) scaledKeywordMatch = 40;


    // --- 2. SectionCompleteness (20 pts) ---
    let completeness = 0;
    if (candidate.summary && candidate.summary.trim().length > 0) completeness += 5;
    if (candidate.experience && candidate.experience.length >= 1) completeness += 5;
    if (candidate.education && candidate.education.length >= 1) completeness += 5;

    const totalSkills = (candidate.skills?.technical?.length || 0) +
        (candidate.skills?.tools?.length || 0) +
        (candidate.skills?.soft?.length || 0);
    if (totalSkills >= 5) completeness += 5;

    // Contact penalty
    const contact = candidate.basics || {};
    if (!contact.email || (!contact.phone && !contact.linkedin_url)) {
        // Just checking email or phone per rules "If contact missing email OR phone -> subtract 10"
        // Be strict to rules: "If contact missing email OR phone -> subtract 10"
        if (!contact.email || !contact.phone) {
            completeness -= 10;
        }
    }

    if (completeness < 0) completeness = 0;
    if (completeness > 20) completeness = 20;


    // --- 3. FormattingSafety (15 pts) ---
    let formatting = 15;
    let hasFatBullet = false;
    let hasDuplicateBullets = false;
    let hasEmptyRequired = false; // experience, education 

    const seenBullets = new Set<string>();

    if (!candidate.experience || candidate.experience.length === 0) hasEmptyRequired = true;
    if (!candidate.education || candidate.education.length === 0) hasEmptyRequired = true;

    for (const exp of (candidate.experience || [])) {
        for (const b of (exp.bullets || [])) {
            if (typeof b !== 'string') continue;
            const wc = b.trim().split(/\s+/).filter(w => w.length > 0).length;
            if (wc > 40) hasFatBullet = true;

            const normalized = b.toLowerCase().replace(/\s+/g, '');
            if (seenBullets.has(normalized)) hasDuplicateBullets = true;
            seenBullets.add(normalized);
        }
    }

    if (hasFatBullet) formatting -= 5;
    if (hasEmptyRequired) formatting -= 5;
    if (hasDuplicateBullets) formatting -= 5;

    if (formatting < 0) formatting = 0;
    if (formatting > 15) formatting = 15;


    // --- 4. ContentQuality (15 pts) ---
    // +1 per experience bullet starting with an action verb AND containing a number. Max 15.
    let contentPts = 0;
    for (const exp of (candidate.experience || [])) {
        for (const b of (exp.bullets || [])) {
            if (typeof b !== 'string') continue;
            const words = getWordTokens(b);
            if (words.length > 0) {
                const firstWord = words[0];
                if (ACTION_VERBS.has(firstWord) && hasNumber(b)) {
                    contentPts += 1;
                }
            }
        }
    }
    if (contentPts > 15) contentPts = 15;


    // --- 5. JobMatchRelevance (10 pts) ---
    // overlap_ratio = (# JD required_skills present in resume skills) / (total required_skills)
    let jobMatch = 0;
    if (jdRequiredSkills.length > 0) {
        let matchCount = 0;
        for (const reqSkill of jdRequiredSkills) {
            if (typeof reqSkill !== 'string') continue;
            const reqLow = reqSkill.toLowerCase();
            // Check in any skills array
            const isMatch = (candidate.skills?.technical || []).some((s: string) => s.toLowerCase() === reqLow) ||
                (candidate.skills?.tools || []).some((s: string) => s.toLowerCase() === reqLow) ||
                (candidate.skills?.soft || []).some((s: string) => s.toLowerCase() === reqLow);
            if (isMatch) matchCount++;
        }

        const overlapRatio = matchCount / jdRequiredSkills.length;
        jobMatch = Math.floor(overlapRatio * 10);
    } else {
        // "TEST S-4: If JD required_skills empty -> JobMatchRelevance must be 0."
        jobMatch = 0;
    }

    if (jobMatch > 10) jobMatch = 10;
    if (jobMatch < 0) jobMatch = 0;


    const total = scaledKeywordMatch + completeness + formatting + contentPts + jobMatch;

    return {
        ats_score: total,
        category_breakdown: {
            KeywordMatch: scaledKeywordMatch,
            SectionCompleteness: completeness,
            FormattingSafety: formatting,
            ContentQuality: contentPts,
            JobMatchRelevance: jobMatch
        },
        keyword_matches: keywordMatches
    };
}
