import { routeAICall, routeMultimodalCall } from './ai-router';
import { parse as dateParse, isValid, compareDesc } from 'date-fns';

export interface LiStrictParseResult {
    success: boolean;
    failedTests: string[];
    data?: any;
    rawTextExtract?: string;
}

const STRICT_SYSTEM_PROMPT = `You are a deterministic LinkedIn profile parser. Convert the provided LinkedIn profile text into the EXACT JSON schema required. Do NOT invent any facts, numbers, or endorsements. Preserve phrasing exactly. Dates must be MMM YYYY or empty. Endorsements and recommendation counts must be numbers as strings or empty. Return ONLY valid JSON. No commentary.`;

const STRICT_USER_PROMPT_TEMPLATE = `Convert the following LinkedIn export text into the required JSON schema.

RULES:
- Do not invent facts.
- Preserve multi-word skills exactly.
- Dates -> MMM YYYY format; if not extractable, return "".
- Endorsements -> digits only as string or "".
- is_current true iff end date is "Present" or explicit "Present" in text.
- Return ONLY the JSON object and exact keys.

SCHEMA:
{
  "profile": {
    "full_name": "",
    "headline": "",
    "location": "",
    "industry": "",
    "contact": {"email": "", "phone": "", "linkedin_url": ""}
  },
  "summary": "",
  "skills": [
    {"skill": "", "endorsements": ""} 
  ],
  "positions": [
    {
      "title": "",
      "company": "",
      "location": "",
      "start_date": "",
      "end_date": "",
      "is_current": false,
      "bullets": []
    }
  ],
  "education": [
    {"institution": "", "degree": "", "field": "", "start_date": "", "end_date": ""}
  ],
  "certifications": [
    {"name": "", "issuer": "", "date": ""}
  ],
  "recommendations": {"received": "", "given": ""},
  "raw_text": ""
}

LINKEDIN TEXT:
`;

/**
 * Clean LI text: normalize whitespace.
 */
function normalizeLiText(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

/**
 * Step A: Extract Clean Text if from PDF, or just normalize if already string
 */
export async function extractLiRawText(input: string | Buffer): Promise<string> {
    if (typeof input === 'string') {
        return normalizeLiText(input);
    }
    const promptText = `Extract clean text from this LinkedIn profile PDF. Preserve headings, bullets, dates, and structure. Normalize to plain text.`;
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
        return normalizeLiText(text);
    } catch (e: any) {
        console.warn('[LI Strict Parser] Multimodal extraction failed:', e.message);
        console.log('[LI Strict Parser] Falling back to pdf-parse extraction...');
        const pdfParse = require('pdf-parse');
        try {
            const pdfData = await pdfParse(input as Buffer);
            return normalizeLiText(pdfData.text);
        } catch (fallbackError: any) {
            throw new Error('Failed to extract raw text (LI Fallback): ' + fallbackError.message);
        }
    }
}

async function convertLiToJson(rawText: string): Promise<string> {
    const fullPrompt = `${STRICT_SYSTEM_PROMPT}\n\n${STRICT_USER_PROMPT_TEMPLATE}${rawText}`;
    try {
        return await routeAICall(fullPrompt);
    } catch (e: any) {
        throw new Error('Failed AI JSON Gen: ' + e.message);
    }
}

export function validateLiStrict(rawText: string, jsonString: string): LiStrictParseResult {
    const failedTests: string[] = [];
    let parsedJson: any;

    const rawWordSet = new Set(rawText.toLowerCase().replace(/[^a-z0-9\s]/gi, ' ').split(/\s+/).filter(w => w.length > 0));

    // TEST LI-1: Valid JSON
    try {
        let cleanJsonStr = jsonString.trim();
        const match = cleanJsonStr.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
        if (match) cleanJsonStr = match[1].trim();

        parsedJson = JSON.parse(cleanJsonStr);
        if (typeof parsedJson !== 'object' || Array.isArray(parsedJson)) {
            throw new Error("Must be root object");
        }
    } catch (e) {
        failedTests.push('TEST LI-1 FAILED: Invalid JSON parsing or formatting.');
        return { success: false, failedTests, rawTextExtract: rawText };
    }

    // Always force raw_text to equal exactly the normalized block
    parsedJson.raw_text = rawText;

    // TEST LI-2: Required Keys
    if (!parsedJson.profile || !parsedJson.profile.full_name || parsedJson.profile.full_name.trim() === '') {
        failedTests.push('TEST LI-2 FAILED: profile.full_name missing');
    }

    // check positions length
    const positions = parsedJson.positions || [];
    if (!Array.isArray(positions)) {
        failedTests.push('TEST LI-2 FAILED: positions must be an array');
    } else {
        if (positions.length === 0) {
            if (rawText.toLowerCase().includes('experience')) {
                failedTests.push('TEST LI-2 FAILED: positions empty but raw_text contains "Experience"');
            }
        }
    }

    // TEST LI-3: Date Format
    const dateRegex = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s\d{4}$/;

    const checkDate = (d: any, isEnd: boolean, isCurrent: boolean) => {
        if (d === undefined || d === null) return;
        if (d !== "") {
            if (!dateRegex.test(d)) {
                failedTests.push(`TEST LI-3 FAILED: Invalid date format: "${d}"`);
            }
        } else {
            if (isEnd && !isCurrent) {
                // Not strictly banned by prompt, but typically "" means parsed issue if not present
                // the prompt says "Dates must be MMM YYYY or empty", so empty string is valid
            }
        }
    };

    for (const pos of positions) {
        checkDate(pos.start_date, false, pos.is_current === true);
        checkDate(pos.end_date, true, pos.is_current === true);
        if (pos.is_current !== true && pos.is_current !== false && pos.is_current !== undefined) {
            failedTests.push(`TEST LI-3 FAILED: is_current must be boolean`);
        }
    }

    for (const ed of (parsedJson.education || [])) {
        checkDate(ed.start_date, false, false);
        checkDate(ed.end_date, true, false);
    }

    // TEST LI-4: Skills Integrity
    const skills = parsedJson.skills || [];
    for (const sk of skills) {
        const skillStr = sk.skill;
        if (typeof skillStr !== 'string') continue;
        if (skillStr) {
            // Must be verbatim
            if (!rawText.toLowerCase().includes(skillStr.toLowerCase())) {
                failedTests.push(`TEST LI-4 FAILED: Skill "${skillStr}" not verbatim in raw_text.`);
            }
            // Length
            const words = skillStr.trim().split(/\s+/).filter(w => w.length > 0);
            if (words.length > 5) {
                failedTests.push(`TEST LI-4 FAILED: Skill "${skillStr}" exceeds 5 words.`);
            }
        }

        const endo = sk.endorsements;
        if (endo !== "" && endo !== undefined) {
            if (typeof endo !== 'string' || !/^\d+$/.test(endo)) {
                failedTests.push(`TEST LI-4 FAILED: Endorsements must be digits only string or empty: "${endo}"`);
            }
        }
    }

    // TEST LI-5: Positions Bullets
    const seenBullets = new Set<string>();
    for (const pos of positions) {
        const bullets = pos.bullets || [];
        if (!Array.isArray(bullets) || bullets.length < 1) {
            failedTests.push(`TEST LI-5 FAILED: Position "${pos.title}" has no bullets.`);
        } else {
            for (const b of bullets) {
                if (typeof b !== 'string') continue;
                const wordCount = b.trim().split(/\s+/).filter(w => w.length > 0).length;
                if (wordCount < 6 || wordCount > 50) {
                    failedTests.push(`TEST LI-5 FAILED: Bullet word count (${wordCount}) out of bounds (6-50): "${b.substring(0, 20)}..."`);
                }
                if (seenBullets.has(b)) {
                    failedTests.push(`TEST LI-5 FAILED: Duplicate bullet detected: "${b.substring(0, 20)}..."`);
                }
                seenBullets.add(b);
            }
        }
    }

    // TEST LI-6: No Hallucination
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

    // Exclude boolean fields (is_current) natively, and raw_text
    const exempt = new Set(["raw_text", "is_current"]);
    const jsonStrVals = getValsDeep(parsedJson, exempt);

    const allJsonTokens = jsonStrVals.join(' ').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 0);

    let hallFails = 0;
    for (const t of allJsonTokens) {
        if (!rawWordSet.has(t) && t !== 'true' && t !== 'false') { // Prompt allows "true" and "false"
            failedTests.push(`TEST LI-6 FAILED: Token hallucinated: "${t}"`);
            hallFails++;
            if (hallFails > 15) break;
        }
    }

    // TEST LI-7: Order & Chronology
    if (positions.length > 1) {
        // Must be newest first. 'Present' is newest.
        const parseD = (dStr: string, isCurr: boolean) => {
            if (isCurr) return new Date(2100, 0, 1); // super far future for 'Present'
            if (!dStr || dStr === "") return new Date(1900, 0, 1); // fallback
            const parsed = dateParse(dStr, 'MMM yyyy', new Date());
            return isValid(parsed) ? parsed : new Date(1900, 0, 1);
        };

        let hasOrderWarning = false;
        if (positions[0].is_current !== true) {
            // Check if any *other* is current
            for (let i = 1; i < positions.length; i++) {
                if (positions[i].is_current === true) {
                    failedTests.push(`TEST LI-7 FAILED: is_current=true position is not first.`);
                    hasOrderWarning = true;
                    break;
                }
            }
        }

        if (!hasOrderWarning) {
            for (let i = 0; i < positions.length - 1; i++) {
                const d1 = parseD(positions[i].start_date, positions[i].is_current);
                const d2 = parseD(positions[i + 1].start_date, positions[i + 1].is_current);
                if (compareDesc(d1, d2) > 0) { // d1 is BEFORE d2
                    failedTests.push(`TEST LI-7 FAILED: Positions not sorted reverse-chronological (newest first).`);
                    break;
                }
            }
        }
    }

    // TEST LI-8: Contact Normalization
    const contact = parsedJson.profile?.contact;
    if (contact) {
        if (contact.email && contact.email !== "") {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            if (!emailRegex.test(contact.email)) {
                failedTests.push(`TEST LI-8 FAILED: Email invalid format "${contact.email}"`);
            }
        }
        if (contact.phone && contact.phone !== "") {
            const ph = contact.phone.replace(/\\s+/g, '');
            const phoneRegex = /^\\+?\\d{7,15}$/;
            if (!phoneRegex.test(ph)) {
                failedTests.push(`TEST LI-8 FAILED: Phone invalid format "${contact.phone}"`);
            }
        }
    }

    // TEST LI-9: Recommendations Counts
    const rec = parsedJson.recommendations;
    if (rec) {
        if (rec.received !== "" && (!/^\d+$/.test(rec.received) || typeof rec.received !== 'string')) {
            failedTests.push(`TEST LI-9 FAILED: Recommendations received must be string digit or "". Found: "${rec.received}"`);
        }
        if (rec.given !== "" && (!/^\d+$/.test(rec.given) || typeof rec.given !== 'string')) {
            failedTests.push(`TEST LI-9 FAILED: Recommendations given must be string digit or "". Found: "${rec.given}"`);
        }
    }

    // TEST LI-10: Raw Text Echo check
    if (parsedJson.raw_text !== rawText) {
        failedTests.push('TEST LI-10 FAILED: raw_text field not exactly equal to input normalizer.');
    }

    return {
        success: failedTests.length === 0,
        failedTests,
        data: parsedJson,
        rawTextExtract: rawText
    };
}


export async function parseLiStrictPipeline(input: string | Buffer): Promise<LiStrictParseResult> {
    try {
        const rawText = await extractLiRawText(input);

        // Handle empty request completely natively without model invocation.
        if (rawText.trim() === '') {
            return {
                success: true,
                failedTests: [],
                data: {
                    "profile": {
                        "full_name": "",
                        "headline": "",
                        "location": "",
                        "industry": "",
                        "contact": { "email": "", "phone": "", "linkedin_url": "" }
                    },
                    "summary": "",
                    "skills": [],
                    "positions": [],
                    "education": [],
                    "certifications": [],
                    "recommendations": { "received": "", "given": "" },
                    "raw_text": ""
                },
                rawTextExtract: ""
            };
        }

        const jsonStr = await convertLiToJson(rawText);

        return validateLiStrict(rawText, jsonStr);
    } catch (e: any) {
        return {
            success: false,
            failedTests: [`System Error: ${e.message}`]
        };
    }
}
