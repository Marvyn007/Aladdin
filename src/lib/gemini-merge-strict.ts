import { parse as dateParse, isValid, areIntervalsOverlapping } from 'date-fns';

export interface CandidateProfile {
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
    certifications: any[];
    community?: any[];
}

export interface MergeStrictResult {
    success: boolean;
    failedTests: string[];
    candidate_profile?: CandidateProfile;
}

/**
 * Normalizes text to tokens for hallucination and verbatim checks
 */
function getTokens(text: string): Set<string> {
    const clean = text.toLowerCase().replace(/[^a-z0-9]/g, ' ');
    return new Set(clean.split(/\s+/).filter(w => w.length > 0));
}

/**
 * Checks if query appears verbatim in text
 */
function isVerbatim(query: string, text: string): boolean {
    return text.toLowerCase().includes(query.toLowerCase());
}

/**
 * Safely parses "MMM YYYY" or "Present" to a Date object for range comparison
 */
function parseDateForOverlap(d: string, isEnd: boolean): Date {
    if (!d || d.toLowerCase() === 'present' || d.toLowerCase() === 'current') {
        return isEnd ? new Date(2100, 0, 1) : new Date(1900, 0, 1);
    }
    const p = dateParse(d, 'MMM yyyy', new Date());
    if (isValid(p)) return p;
    // Fallback attempt for arbitrary string
    const fallback = new Date(d);
    if (isValid(fallback)) return fallback;
    return isEnd ? new Date(2100, 0, 1) : new Date(1900, 0, 1);
}

/**
 * Stage 4.1: Deterministic Merge Engine
 */
export function mergeProfilesStrict(
    resumeJson: any,
    jdJson: any,
    linkedinJson: any | null
): MergeStrictResult {
    const failedTests: string[] = [];

    // Create base from resume
    const candidate: CandidateProfile = {
        basics: resumeJson.contact || resumeJson.basics || {},
        summary: resumeJson.summary || "",
        skills: {
            technical: Array.isArray(resumeJson.skills?.technical) ? [...resumeJson.skills.technical] : [],
            tools: Array.isArray(resumeJson.skills?.tools) ? [...resumeJson.skills.tools] : [],
            soft: Array.isArray(resumeJson.skills?.soft) ? [...resumeJson.skills.soft] : []
        },
        experience: Array.isArray(resumeJson.experience) ? JSON.parse(JSON.stringify(resumeJson.experience)) : [],
        education: Array.isArray(resumeJson.education) ? JSON.parse(JSON.stringify(resumeJson.education)) : [],
        projects: Array.isArray(resumeJson.projects) ? JSON.parse(JSON.stringify(resumeJson.projects)) : [],
        certifications: Array.isArray(resumeJson.certifications) ? JSON.parse(JSON.stringify(resumeJson.certifications)) : []
    };

    // Original copies for M-1 tests
    const origExperience = JSON.parse(JSON.stringify(candidate.experience));

    // Flat sets for quick checks
    const resSkillSet = new Set([
        ...candidate.skills.technical.map((s: string) => s.toLowerCase()),
        ...candidate.skills.tools.map((s: string) => s.toLowerCase()),
        ...candidate.skills.soft.map((s: string) => s.toLowerCase()),
    ]);

    const resCertSet = new Set(candidate.certifications.map((c: any) => (c.name || '').toLowerCase()));

    const jdTop25 = Array.isArray(jdJson.top_25_keywords) ? new Set(jdJson.top_25_keywords.map((k: string) => k.toLowerCase())) : new Set();

    const jdRawText = jdJson.raw_text || "";
    const liRawText = linkedinJson?.raw_text || "";
    const resRawText = resumeJson?.raw_text || ""; // May or may not exist depending on strict parser output, but we will use JSON values + raw if present

    // Ensure we have raw text tokens for hallucination check
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

    const resumeTokens = new Set([
        ...getTokens(resRawText),
        ...getTokens(extractJsonTokens(resumeJson).join(' '))
    ]);
    const liTokens = getTokens(liRawText);

    // M2: Skill Enrichment
    const addedSkills: string[] = [];
    if (linkedinJson && Array.isArray(linkedinJson.skills)) {
        for (const liSkillObj of linkedinJson.skills) {
            const skillAttr = liSkillObj.skill;
            if (typeof skillAttr !== 'string') continue;

            const skLow = skillAttr.toLowerCase();

            // "Add LinkedIn skills ONLY IF: Skill not already present in resume skills, Skill appears in JD top_25_keywords, Skill appears verbatim in LinkedIn raw_text"
            if (!resSkillSet.has(skLow) && jdTop25.has(skLow) && isVerbatim(skillAttr, liRawText)) {
                candidate.skills.technical.push(skillAttr);
                resSkillSet.add(skLow);
                addedSkills.push(skillAttr);
            }
        }
    }

    // M4: Certification Enrichment
    if (linkedinJson && Array.isArray(linkedinJson.certifications)) {
        for (const liCert of linkedinJson.certifications) {
            if (!liCert.name) continue;
            const certNameLow = liCert.name.toLowerCase();

            // "Add certification from LinkedIn ONLY IF: Resume has no certification with same name, Certification appears verbatim in LinkedIn raw_text"
            if (!resCertSet.has(certNameLow) && isVerbatim(liCert.name, liRawText)) {
                candidate.certifications.push({ ...liCert });
                resCertSet.add(certNameLow);
            }
        }
    }

    // M3: Bullet Enrichment
    const addedBullets: string[] = [];
    if (linkedinJson && Array.isArray(linkedinJson.positions)) {
        for (const resExp of candidate.experience) {
            const resComp = (resExp.company || "").toLowerCase();

            // Find strictly matching LI position
            const liMatches = linkedinJson.positions.filter((p: any) => (p.company || "").toLowerCase() === resComp);

            for (const liMatch of liMatches) {
                // Check overlap
                const rStart = parseDateForOverlap(resExp.start_date, false);
                const rEnd = parseDateForOverlap(resExp.end_date, true);
                const lStart = parseDateForOverlap(liMatch.start_date, false);
                const lEnd = parseDateForOverlap(liMatch.end_date, true);

                try {
                    const overlaps = areIntervalsOverlapping(
                        { start: rStart, end: rEnd },
                        { start: lStart, end: lEnd }
                    );

                    if (overlaps && Array.isArray(liMatch.bullets)) {
                        const existingBullSets = new Set((resExp.bullets || []).map((b: string) => b.toLowerCase().replace(/\\s+/g, '')));

                        for (const lBull of liMatch.bullets) {
                            if (typeof lBull !== 'string') continue;
                            const normalized = lBull.toLowerCase().replace(/\\s+/g, '');

                            // "Bullet not duplicate of resume bullet"
                            if (!existingBullSets.has(normalized)) {
                                // "Bullet contains no numbers unless number appears in LinkedIn raw_text"
                                const numbersInBullet = lBull.match(/\\d+/g) || [];
                                let numbersValid = true;
                                for (const num of numbersInBullet) {
                                    if (!liRawText.includes(num)) {
                                        numbersValid = false;
                                        break;
                                    }
                                }

                                if (numbersValid) {
                                    if (!resExp.bullets) resExp.bullets = [];
                                    resExp.bullets.push(lBull);
                                    existingBullSets.add(normalized);
                                    addedBullets.push(lBull);
                                }
                            }
                        }
                    }
                } catch (e) { /* Invalid date bounds ignore */ }
            }
        }
    }

    // RUN 5 STRICT TESTS

    // TEST M-1: Resume Integrity
    // Every resume experience entry must remain unchanged in: title, company, start_date, end_date.
    for (let i = 0; i < origExperience.length; i++) {
        const o = origExperience[i];
        const n = candidate.experience[i];
        if (!n) {
            failedTests.push(`TEST M-1 FAILED: Entry ${i} missing from candidate profile.`);
            break;
        }
        if (o.title !== n.title || o.company !== n.company || o.start_date !== n.start_date || o.end_date !== n.end_date) {
            failedTests.push(`TEST M-1 FAILED: Resume core properties modified for entry ${i}.`);
        }
    }

    // TEST M-2: No New Positions
    if (origExperience.length !== candidate.experience.length) {
        failedTests.push(`TEST M-2 FAILED: Merged experience length (${candidate.experience.length}) != original (${origExperience.length}).`);
    }

    // TEST M-3: Skill Legitimacy
    const liSkillList = linkedinJson ? (linkedinJson.skills || []).map((s: any) => (s.skill || "").toLowerCase()) : [];
    const liSkillSetForM3 = new Set(liSkillList);
    for (const askill of addedSkills) {
        const askillLow = askill.toLowerCase();
        if (!liSkillSetForM3.has(askillLow) || !jdTop25.has(askillLow)) {
            failedTests.push(`TEST M-3 FAILED: Added skill "${askill}" invalid. Must be in LI skills and JD top 25.`);
        }
    }

    // TEST M-4: Bullet Integrity
    for (const abullet of addedBullets) {
        if (!isVerbatim(abullet, liRawText)) {
            failedTests.push(`TEST M-4 FAILED: Added bullet not verbatim in LI raw_text.`);
        }
        const wc = abullet.trim().split(/\s+/).filter(w => w.length > 0).length;
        if (wc < 6 || wc > 50) {
            failedTests.push(`TEST M-4 FAILED: Added bullet word count (${wc}) out of bounds (6-50).`);
        }
    }

    // TEST M-5: No Hallucination
    const mergedTokens = getTokens(extractJsonTokens(candidate).join(' '));
    let hallFails = 0;
    for (const mt of mergedTokens) {
        if (!resumeTokens.has(mt) && !liTokens.has(mt)) {
            // Check if it's "true", "false", or boolean natively ignored, or purely numbers if allowed. We will restrict strict.
            // Allowed exceptions might include keys but getTokens on extractJsonTokens only extracts values.
            // If the token is fully absent from both raw texts -> fail.
            if (mt !== 'true' && mt !== 'false' && mt !== 'present') {
                failedTests.push(`TEST M-5 FAILED: Token hallucinated in merge: "${mt}"`);
                hallFails++;
                if (hallFails > 15) break;
            }
        }
    }

    return {
        success: failedTests.length === 0,
        failedTests,
        candidate_profile: candidate
    };
}
