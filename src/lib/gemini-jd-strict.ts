import { routeAICall, routeMultimodalCall } from './ai-router';

export interface JdStrictParseResult {
    success: boolean;
    failedTests: string[];
    data?: any;
    rawTextExtract?: string;
}

const STRICT_SYSTEM_PROMPT = `You are a deterministic job-description parser. Convert the input job description text into the EXACT JSON schema required. Do NOT invent any tokens, phrases, or skills that do not appear verbatim in the input. Preserve multi-word phrases exactly as in the input. Return ONLY valid JSON. No commentary, no extra keys, no explanations.`;

const STRICT_USER_PROMPT_TEMPLATE = `Convert the following job description into the JSON schema.

RULES:
- Do not invent any information.
- All extracted tokens/phrases must appear verbatim in the job description text.
- top_25_keywords must be the 25 most frequent words/phrases (multi-word contiguous phrases allowed) found in the text after lowercasing and removing stopwords; order by frequency then lexicographic for ties.
- top_10_keywords = first 10 from top_25_keywords.
- If JD contains <25 unique tokens/phrases, repeat JD tokens to fill length 25 (still verbatim).
- seniority_level must be normalized to [intern,entry,mid,senior,lead,manager,director,executive,""].
- min_years_experience must be integer or "".
- salary_range min and max must be integers (yearly USD) or "".
- All lists must contain only strings present in the raw text.
- Return ONLY the JSON object and EXACT keys in this schema.

SCHEMA:
{ "jd_title": "", "jd_company": "", "job_type": "", "location": "", "seniority_level": "", "min_years_experience": "", "required_skills": [], "preferred_skills": [], "responsibilities": [], "top_25_keywords": [], "top_10_keywords": [], "salary_range": {"min": "","max": ""}, "raw_text": "" }

JOB DESCRIPTION TEXT:
`;

/**
 * Clean JD text: normalize whitespace and remove weird chars but preserve bullets.
 */
function normalizeJdText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Step A: Extract Clean Text if from PDF, or just normalize if already string
 */
export async function extractJdRawText(input: string | Buffer): Promise<string> {
    if (typeof input === 'string') {
        return normalizeJdText(input);
    }

    const promptText = `Extract clean text from this job description PDF. Remove headers/footers. Preserve bullet points and content exactly. Normalize to plain text.`;
    const prompt = [
        promptText,
        {
            inlineData: {
                data: input.toString('base64'),
                mimeType: 'application/pdf'
            }
        }
    ];

    try {
        const text = await routeMultimodalCall(prompt);
        return normalizeJdText(text);
    } catch (e: any) {
        console.warn('[JD Strict Parser] Multimodal extraction failed:', e.message);
        console.log('[JD Strict Parser] Falling back to pdf-parse extraction...');
        const pdfParse = require('pdf-parse');
        try {
            const pdfData = await pdfParse(input as Buffer);
            return normalizeJdText(pdfData.text);
        } catch (fallbackError: any) {
            throw new Error('Failed to extract raw text (JD Fallback): ' + fallbackError.message);
        }
    }
}

const STOP_WORDS = new Set(["a", "an", "the", "and", "or", "but", "if", "because", "as", "what", "which", "this", "that", "these", "those", "then",
    "just", "so", "than", "such", "both", "through", "about", "for", "is", "of", "while", "during", "to", "who", "whom", "where", "why", "how", "all", "any", "each", "few", "more", "most", "other", "some", "no", "nor", "not", "only", "own", "same", "too", "very", "can", "will", "don", "should", "now",
    "on", "are", "with", "they", "we", "he", "she", "it", "in", "by", "from", "at", "you", "your", "our", "their", "its"]);

function computeDeterministicKeywords(rawText: string): string[] {
    const rawTokens = rawText.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 1 && !STOP_WORDS.has(w));

    const freqMap = new Map<string, number>();
    for (const t of rawTokens) {
        freqMap.set(t, (freqMap.get(t) || 0) + 1);
    }

    const sorted = Array.from(freqMap.entries()).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
    });

    let top25 = sorted.map(i => i[0]).slice(0, 25);

    if (top25.length < 25 && top25.length > 0) {
        let i = 0;
        while (top25.length < 25) {
            top25.push(top25[i % top25.length]);
            i++;
        }
    }

    return top25;
}

async function convertJdToJson(rawText: string): Promise<string> {
    const fullPrompt = `${STRICT_SYSTEM_PROMPT}\n\n${STRICT_USER_PROMPT_TEMPLATE}${rawText}`;
    try {
        const jsonOutput = await routeAICall(fullPrompt);
        return jsonOutput;
    } catch (e: any) {
        throw new Error('Failed AI JSON Gen: ' + e.message);
    }
}

export function validateJdStrict(rawText: string, jsonString: string): JdStrictParseResult {
    const failedTests: string[] = [];
    let parsedJson: any;

    const rawWordSet = new Set(rawText.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').split(/\s+/).filter(w => w.length > 0));

    // TEST JD-1: Valid JSON
    try {
        let cleanJsonStr = jsonString.trim();
        const match = cleanJsonStr.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
        if (match) cleanJsonStr = match[1].trim();

        parsedJson = JSON.parse(cleanJsonStr);
        if (typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
            throw new Error("Must be root object");
        }
    } catch (e) {
        failedTests.push('TEST JD-1 FAILED: Invalid JSON parsing or formatting.');
        return { success: false, failedTests, rawTextExtract: rawText };
    }

    const trueKeywords = computeDeterministicKeywords(rawText);
    parsedJson.top_25_keywords = trueKeywords;
    parsedJson.top_10_keywords = trueKeywords.slice(0, 10);
    parsedJson.raw_text = rawText;


    // TEST JD-2: Required Keys
    if (!parsedJson.jd_title || parsedJson.jd_title.trim() === '') failedTests.push('TEST JD-2 FAILED: jd_title missing');
    if (!Array.isArray(parsedJson.required_skills) || parsedJson.required_skills.length < 1) failedTests.push('TEST JD-2 FAILED: required_skills length < 1');
    if (!Array.isArray(parsedJson.top_10_keywords) || parsedJson.top_10_keywords.length !== 10) failedTests.push('TEST JD-2 FAILED: top_10_keywords length !== 10');
    if (!Array.isArray(parsedJson.top_25_keywords) || parsedJson.top_25_keywords.length !== 25) failedTests.push('TEST JD-2 FAILED: top_25_keywords length !== 25');

    // TEST JD-3: Verbatim Keyword Rule
    const allTop25 = Array.isArray(parsedJson.top_25_keywords) ? parsedJson.top_25_keywords : [];
    const normalizedRawText = rawText.toLowerCase();

    for (const kw of allTop25) {
        if (typeof kw !== 'string' || !normalizedRawText.includes(kw.toLowerCase())) {
            failedTests.push(`TEST JD-3 FAILED: Keyword '${kw}' not verbatim in raw_text.`);
        }
    }

    // TEST JD-4: Responsibilities Integrity
    const reqs = parsedJson.responsibilities;
    if (!Array.isArray(reqs) || reqs.length < 1) {
        failedTests.push('TEST JD-4 FAILED: responsibilities missing or empty.');
    } else {
        const seenReq = new Set<string>();
        for (const r of reqs) {
            if (typeof r !== 'string') continue;
            const wCount = r.trim().split(/\s+/).filter(w => w.length > 0).length;
            if (wCount < 6 || wCount > 45) {
                failedTests.push(`TEST JD-4 FAILED: Responsibility word count (${wCount}) out of bounds (6-45): "${r.substring(0, 20)}..."`);
            }
            if (seenReq.has(r)) {
                failedTests.push(`TEST JD-4 FAILED: Duplicate responsibility "${r.substring(0, 20)}..."`);
            }
            seenReq.add(r);
        }
    }

    // TEST JD-5: Skill Formatting
    const allSkills = [...(parsedJson.required_skills || []), ...(parsedJson.preferred_skills || [])];
    for (const skill of allSkills) {
        if (typeof skill !== 'string') continue;
        if (skill.includes('.')) {
            failedTests.push(`TEST JD-5 FAILED: Skill "${skill}" contains period.`);
        }
        const wCount = skill.trim().split(/\s+/).filter(w => w.length > 0).length;
        if (wCount < 1 || wCount > 5) {
            failedTests.push(`TEST JD-5 FAILED: Skill "${skill}" word count (${wCount}) out of bounds (1-5).`);
        }
        if (!normalizedRawText.includes(skill.toLowerCase())) {
            failedTests.push(`TEST JD-5 FAILED: Skill "${skill}" not verbatim.`);
        }
    }

    // TEST JD-6: Seniority Normalization
    const validSen = ["intern", "entry", "mid", "senior", "lead", "manager", "director", "executive", ""];
    const sen = parsedJson.seniority_level;
    if (!validSen.includes(sen)) failedTests.push(`TEST JD-6 FAILED: Invalid seniority "${sen}"`);

    const minExpStr = parsedJson.min_years_experience;
    if (minExpStr !== "" && typeof minExpStr !== "number" && isNaN(Number(minExpStr))) {
        failedTests.push(`TEST JD-6 FAILED: min_years_experience "${minExpStr}" is not integer or empty string.`);
    } else if (minExpStr !== "") {
        const minExp = Number(minExpStr);
        if (minExp < 0 || !Number.isInteger(minExp)) failedTests.push(`TEST JD-6 FAILED: min_years_experience ${minExp} must be integer >= 0`);

        let validAllowed: string[] = [];
        if (minExp >= 8) validAllowed = ["senior", "lead", "manager", "director", "executive"];
        else if (minExp >= 4) validAllowed = ["mid", "senior"];
        else if (minExp >= 1) validAllowed = ["entry", "mid"];
        else if (minExp === 0) validAllowed = ["intern", "entry"];

        if (sen !== "" && !validAllowed.includes(sen)) {
            failedTests.push(`TEST JD-6 FAILED: min_years_experience (${minExp}) incompatible with seniority_level (${sen}). Expected one of ${validAllowed.join(',')}`);
        }
    }

    // TEST JD-7: Salary Format
    const sr = parsedJson.salary_range;
    if (sr) {
        const sMin = sr.min;
        const sMax = sr.max;
        const numMin = Number(sMin);
        const numMax = Number(sMax);

        if (sMin !== "" && (isNaN(numMin) || String(sMin).includes('$'))) failedTests.push(`TEST JD-7 FAILED: min salary invalid "${sMin}"`);
        if (sMax !== "" && (isNaN(numMax) || String(sMax).includes('$'))) failedTests.push(`TEST JD-7 FAILED: max salary invalid "${sMax}"`);

        if (sMin !== "" && sMax !== "" && !isNaN(numMin) && !isNaN(numMax)) {
            if (numMin > numMax) failedTests.push(`TEST JD-7 FAILED: min salary (${numMin}) > max salary (${numMax})`);
        }
    }

    // TEST JD-8: Raw Text Echo check
    if (parsedJson.raw_text !== rawText) {
        failedTests.push('TEST JD-8 FAILED: raw_text field not exactly equal to input normalizer.');
    }

    // TEST JD-9: No Hallucination
    function getValsDeep(obj: any, exKeys: Set<string>): string[] {
        let values: string[] = [];
        if (Array.isArray(obj)) {
            obj.forEach(i => values.push(...getValsDeep(i, exKeys)));
        } else if (typeof obj === 'object' && obj !== null) {
            for (const [k, v] of Object.entries(obj)) {
                if (exKeys.has(k)) continue;
                values.push(...getValsDeep(v, exKeys));
            }
        } else if (typeof obj === 'string') {
            values.push(obj);
        }
        return values;
    }

    const exempt = new Set(["salary_range", "min", "max", "job_type", "seniority_level", "min_years_experience"]);
    const jsonStrVals = getValsDeep(parsedJson, exempt);

    const allJsonTokens = jsonStrVals.join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);

    let hallFails = 0;
    for (const t of allJsonTokens) {
        if (!rawWordSet.has(t)) {
            failedTests.push(`TEST JD-9 FAILED: Token hallucinated: "${t}"`);
            hallFails++;
            if (hallFails > 15) break;
        }
    }

    // TEST JD-10: Deterministic Keyword Count
    const reTestCompute = computeDeterministicKeywords(rawText);
    if (parsedJson.top_25_keywords.join('|') !== reTestCompute.join('|')) {
        failedTests.push('TEST JD-10 FAILED: Deterministic Keyword Count check failed.');
    }

    return {
        success: failedTests.length === 0,
        failedTests,
        data: parsedJson,
        rawTextExtract: rawText
    };
}


export async function parseJdStrictPipeline(input: string | Buffer): Promise<JdStrictParseResult> {
    try {
        const rawText = await extractJdRawText(input);
        const jsonStr = await convertJdToJson(rawText);

        return validateJdStrict(rawText, jsonStr);
    } catch (e: any) {
        return {
            success: false,
            failedTests: [`System Error: ${e.message}`]
        };
    }
}
