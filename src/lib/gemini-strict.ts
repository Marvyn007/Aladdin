import { routeAICall, routeMultimodalCall } from './ai-router';
import { differenceInMonths, isValid, parse } from 'date-fns';

export interface StrictParseResult {
    success: boolean;
    failedTests: string[];
    data?: any;
    rawTextExtract?: string;
}

const STRICT_SYSTEM_PROMPT = `You are a deterministic resume parser.
You must convert resume raw text into strict JSON using the provided schema.
You are forbidden from inventing any information not present in the raw text.
If information is missing, return empty string or empty array.
Return ONLY valid JSON. No commentary.`;

const STRICT_USER_PROMPT_TEMPLATE = `Convert the following resume text into the strict JSON schema.

Rules:
- Do not invent.
- Do not summarize.
- Preserve bullet wording exactly as written.
- Dates must be converted to MMM YYYY format.
- If format unclear, leave empty string.
- Return JSON only.

SCHEMA:
{
  "basics": {
    "full_name": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedin": "",
    "portfolio": ""
  },
  "summary": "",
  "skills": {
    "technical": [],
    "tools": [],
    "soft": []
  },
  "experience": [
    {
      "title": "",
      "company": "",
      "location": "",
      "start_date": "",
      "end_date": "",
      "bullets": []
    }
  ],
  "education": [
    {
      "institution": "",
      "degree": "",
      "field": "",
      "start_date": "",
      "end_date": ""
    }
  ],
  "projects": [
    {
      "name": "",
      "bullets": []
    }
  ],
  "certifications": []
}

RESUME TEXT:
`;

/**
 * Step A: Extract Clean Text From PDF (OCR fallback handled natively via Gemini)
 */
async function extractRawTextFromPdf(fileBuffer: Buffer): Promise<string> {
    const promptText = `Extract clean text from this resume PDF.
Requirements:
1. Extract ALL text accurately (using OCR if it is a scanned image).
2. Remove any header/footer repetition (like page numbers or repeating names on every page).
3. Normalize excessive whitespace to single spaces or simple line breaks.
4. Preserve the exact order of bullet points.
5. Preserve clear section boundaries.
DO NOT summarize or change any words. Just return the cleaned plaintext.`;

    const prompt = [
        promptText,
        {
            inlineData: {
                data: fileBuffer.toString('base64'),
                mimeType: 'application/pdf'
            }
        }
    ];

    try {
        console.log('[Strict Parser] Extracting text natively via Gemini Multimodal...');
        const text = await routeMultimodalCall(prompt);
        return text;
    } catch (e: any) {
        console.warn('[Strict Parser] Multimodal extraction failed:', e.message);
        console.log('[Strict Parser] Falling back to pdf-parse extraction...');
        const pdfParse = require('pdf-parse');
        try {
            const pdfData = await pdfParse(fileBuffer);
            const rawText = pdfData.text;
            if (!rawText || rawText.trim().length < 50) {
                throw new Error('Fallback PDF text extraction returned too little content');
            }
            return rawText;
        } catch (fallbackError: any) {
            throw new Error('Failed to extract raw text (Step A Fallback): ' + fallbackError.message);
        }
    }
}

/**
 * Step B: Convert to Strict JSON
 */
async function convertToJson(rawText: string): Promise<string> {
    const fullPrompt = `${STRICT_SYSTEM_PROMPT}\n\n${STRICT_USER_PROMPT_TEMPLATE}${rawText}`;
    try {
        console.log('[Strict Parser] Converting raw text to JSON schema...');
        const jsonOutput = await routeAICall(fullPrompt);
        return jsonOutput;
    } catch (e: any) {
        throw new Error('Failed AI JSON Generation (Step B): ' + e.message);
    }
}

/**
 * Extract word array ignoring punctuation
 */
function toWordSet(text: string): Set<string> {
    const normalized = text.toLowerCase().replace(/[^\w\s]/gi, '');
    return new Set(normalized.split(/\s+/).filter(w => w.length > 0));
}

function parseDateStrict(dateStr: string) {
    if (!dateStr || dateStr.trim().toLowerCase() === 'present') return { isValid: true, date: new Date() }; // 'Present' is edge case, but checking MMM YYYY rule means 'Present' should ideally be handled. We'll allow 'Present'.
    let parsed = parse(dateStr, 'MMM yyyy', new Date());
    return { isValid: isValid(parsed), date: parsed };
}

/**
 * Step C: 7 Strict Validation Tests
 */
function validateStrict(rawText: string, jsonString: string): StrictParseResult {
    const failedTests: string[] = [];
    let parsedJson: any;

    const rawWordSet = toWordSet(rawText);

    // ==========================================
    // TEST 1 — Valid JSON Only
    // ==========================================
    try {
        let cleanJsonStr = jsonString.trim();
        // Remove markdown wrappers if any leaked
        const match = cleanJsonStr.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
        if (match) cleanJsonStr = match[1].trim();

        // Must parse directly
        parsedJson = JSON.parse(cleanJsonStr);
    } catch (e) {
        failedTests.push('TEST 1 FAILED: Output must be valid JSON, no trailing commas, no formatting text.');
        return { success: false, failedTests, rawTextExtract: rawText };
    }

    // ==========================================
    // TEST 2 — Required Keys Exist
    // ==========================================
    const bName = parsedJson.basics?.full_name?.trim() || '';
    const exp = parsedJson.experience || [];
    const edu = parsedJson.education || [];

    if (!bName) failedTests.push('TEST 2 FAILED: basics.full_name is missing or empty.');
    if (!Array.isArray(exp) || exp.length < 1) failedTests.push('TEST 2 FAILED: experience must contain >= 1 item.');
    if (!Array.isArray(edu) || edu.length < 1) failedTests.push('TEST 2 FAILED: education must contain >= 1 item.');

    // ==========================================
    // TEST 3 — Bullet Integrity
    // ==========================================
    let bulletFailed = false;
    for (const job of exp) {
        const bullets = job.bullets || [];
        if (!Array.isArray(bullets) || bullets.length < 1) {
            failedTests.push(`TEST 3 FAILED: Job "${job.company}" missing bullets (length >= 1 required).`);
            bulletFailed = true;
            continue;
        }

        const seenBullets = new Set();
        for (const bullet of bullets) {
            if (typeof bullet !== 'string') continue;
            const words = bullet.trim().split(/\s+/).filter(w => w.length > 0);

            if (words.length < 8) {
                failedTests.push(`TEST 3 FAILED: Bullet "${bullet.substring(0, 20)}..." is < 8 words.`);
                bulletFailed = true;
            }
            if (words.length > 40) {
                failedTests.push(`TEST 3 FAILED: Bullet "${bullet.substring(0, 20)}..." is > 40 words.`);
                bulletFailed = true;
            }
            if (seenBullets.has(bullet)) {
                failedTests.push(`TEST 3 FAILED: Duplicate bullet found "${bullet.substring(0, 20)}...".`);
                bulletFailed = true;
            }
            seenBullets.add(bullet);
        }
    }

    // ==========================================
    // TEST 4 — Date Standardization
    // ==========================================
    const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}$/;
    let dateFailed = false;

    for (const job of exp) {
        if (job.start_date && !dateRegex.test(job.start_date)) {
            failedTests.push(`TEST 4 FAILED: Date "${job.start_date}" is not in MMM YYYY format.`);
            dateFailed = true;
        }
        if (job.end_date && job.end_date.toLowerCase() !== 'present' && !dateRegex.test(job.end_date)) {
            failedTests.push(`TEST 4 FAILED: Date "${job.end_date}" is not in MMM YYYY format.`);
            dateFailed = true;
        }
    }
    for (const ed of edu) {
        if (ed.start_date && !dateRegex.test(ed.start_date)) {
            failedTests.push(`TEST 4 FAILED: Date "${ed.start_date}" is not in MMM YYYY format.`);
            dateFailed = true;
        }
        if (ed.end_date && ed.end_date.toLowerCase() !== 'present' && !dateRegex.test(ed.end_date)) {
            failedTests.push(`TEST 4 FAILED: Date "${ed.end_date}" is not in MMM YYYY format.`);
            dateFailed = true;
        }
    }

    // ==========================================
    // TEST 5 — No Hallucination Rule
    // ==========================================
    // Strip JSON keys from the check by stringifying only the values
    function getValuesDeep(obj: any): string[] {
        let values: string[] = [];
        if (Array.isArray(obj)) {
            obj.forEach(i => values.push(...getValuesDeep(i)));
        } else if (typeof obj === 'object' && obj !== null) {
            for (const v of Object.values(obj)) {
                values.push(...getValuesDeep(v));
            }
        } else if (typeof obj === 'string') {
            values.push(obj);
        }
        return values;
    }

    const allStringVals = getValuesDeep(parsedJson);
    const setOfJsonWords = toWordSet(allStringVals.join(' '));

    // Valid formats that might not be exact match in OCR
    // e.g., 'present' is commonly inferred. We'll exempt "present".
    setOfJsonWords.delete('present');

    let hallucenationFailed = false;
    for (const word of Array.from(setOfJsonWords)) {
        // Exempt common month names as they are generated by formatting requirements (MMM YYYY)
        const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        if (months.includes(word)) continue;
        // Exempt years (numbers)
        if (!isNaN(Number(word))) continue;

        if (!rawWordSet.has(word)) {
            failedTests.push(`TEST 5 FAILED: Hallucinated word found: "${word}". Word does not exist in raw PDF text.`);
            hallucenationFailed = true;
            // Break early to avoid massive spam
            if (failedTests.length > 20) break;
        }
    }

    // ==========================================
    // TEST 6 — Section Containment
    // ==========================================
    const summary = parsedJson.summary || '';
    if (summary) {
        const summaryWords = summary.trim().split(/\s+/).filter((w: string) => w.length > 0);
        if (summaryWords.length > 120) {
            failedTests.push(`TEST 6 FAILED: Summary is > 120 words (${summaryWords.length}).`);
        }
    }

    ["technical", "tools", "soft"].forEach(cat => {
        const skillArray = parsedJson.skills?.[cat] || [];
        for (const skill of skillArray) {
            if (typeof skill !== 'string') continue;
            if (skill.includes('.')) {
                failedTests.push(`TEST 6 FAILED: Skill "${skill}" contains a period (sentences forbidden).`);
            }
            const words = skill.trim().split(/\s+/).filter((w: string) => w.length > 0);
            if (words.length > 3) {
                failedTests.push(`TEST 6 FAILED: Skill "${skill}" is > 3 words.`);
            }
        }
    });

    // ==========================================
    // TEST 7 — No Overlapping Roles
    // ==========================================
    // If two experience entries overlap in dates AND have identical company names
    let overlapFailed = false;
    if (exp.length > 1) {
        for (let i = 0; i < exp.length; i++) {
            for (let j = i + 1; j < exp.length; j++) {
                if (exp[i].company.toLowerCase() === exp[j].company.toLowerCase()) {
                    const start1 = parseDateStrict(exp[i].start_date).date;
                    const end1 = parseDateStrict(exp[i].end_date).date;
                    const start2 = parseDateStrict(exp[j].start_date).date;
                    const end2 = parseDateStrict(exp[j].end_date).date;

                    // Standard date overlap check: start1 <= end2 AND start2 <= end1
                    if (start1 <= end2 && start2 <= end1) {
                        failedTests.push(`TEST 7 FAILED: Overlapping roles at identical company "${exp[i].company}".`);
                        overlapFailed = true;
                        break; // fail once per match is enough
                    }
                }
            }
            if (overlapFailed) break;
        }
    }

    return {
        success: failedTests.length === 0,
        failedTests,
        data: parsedJson,
        rawTextExtract: rawText
    };
}


export async function parseResumeFromPdfStrict(fileBuffer: Buffer): Promise<StrictParseResult> {
    try {
        const rawText = await extractRawTextFromPdf(fileBuffer);
        const jsonStr = await convertToJson(rawText);

        const result = validateStrict(rawText, jsonStr);
        return result;
    } catch (e: any) {
        return {
            success: false,
            failedTests: [`System Error: ${e.message}`]
        };
    }
}
