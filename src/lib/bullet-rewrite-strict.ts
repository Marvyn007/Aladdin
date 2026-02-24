import { routeAICall } from './ai-router';
// Using Gemini direct fetch for embeddings since AI router doesn't abstract it
import { config } from 'dotenv';
config({ path: '.env.local' });

export interface RewriteBulletInput {
    original_bullet: string;
    top_10_keywords_array: string[];
    concatenated_candidate_text: string;
    jd_raw_text: string;
}

export interface RewriteBulletOutput {
    original: string;
    rewritten: string;
    keywords_used: string[];
    needs_user_metric: boolean;
}

export interface StrictRewriteResult {
    success: boolean;
    failedTests: string[];
    output?: RewriteBulletOutput;
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

const SYSTEM_PROMPT = "You are a strict ATS optimization assistant.\nRewrite a single resume bullet while preserving all factual content.\nYou are forbidden from inventing numbers, tools, dates, responsibilities, or achievements.\nYou may only use words found in:\n- the original bullet\n- the candidate profile\n- the job description\n- the approved action verb list\nIf original bullet contains no number, append \"[add metric]\" at the end.\nMaximum 28 words.\nReturn ONLY JSON in required schema.";

function getWordTokens(text: string): string[] {
    if (!text) return [];
    return text.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 0);
}

function extractNumbers(text: string): string[] {
    if (typeof text !== 'string') return [];
    return text.match(/\d+(\.\d+)?/g) || [];
}

async function getEmbedding(text: string): Promise<number[]> {
    const key = process.env.GEMINI_API_KEY_A || process.env.GEMINI_API_KEY_B;
    if (!key) throw new Error("No Gemini API Key for Embeddings");

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=" + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: { parts: [{ text }] }
        })
    });

    if (!response.ok) {
        throw new Error("Failed embedding fetch: " + await response.text());
    }

    const data = await response.json();
    return data.embedding.values;
}

function cosineSimilarity(A: number[], B: number[]): number {
    let dotproduct = 0;
    let mA = 0;
    let mB = 0;
    for (let i = 0; i < A.length; i++) {
        dotproduct += (A[i] * B[i]);
        mA += (A[i] * A[i]);
        mB += (B[i] * B[i]);
    }
    mA = Math.sqrt(mA);
    mB = Math.sqrt(mB);
    return dotproduct / ((mA) * (mB));
}

export async function validateBulletRewriteStrict(
    input: RewriteBulletInput,
    outputStr: string
): Promise<StrictRewriteResult> {
    const failedTests: string[] = [];
    let parsed: RewriteBulletOutput;

    // Try parsing
    try {
        let cleanStr = outputStr.trim();
        const match = cleanStr.match(/`{3}(?:json)?\s*([\s\S]*?)\s*`{3}/);
        if (match) cleanStr = match[1].trim();
        parsed = JSON.parse(cleanStr);
    } catch (e) {
        return { success: false, failedTests: ["JSON Parse Error"] };
    }

    // Force original field to equal input
    parsed.original = input.original_bullet;
    if (typeof parsed.rewritten !== "string") parsed.rewritten = "";
    if (!Array.isArray(parsed.keywords_used)) parsed.keywords_used = [];

    // R-1 No Hallucinated Numbers
    const origNumbers = extractNumbers(parsed.original);
    const rewNumbers = extractNumbers(parsed.rewritten);
    for (const num of rewNumbers) {
        if (!origNumbers.includes(num)) {
            failedTests.push("TEST R-1 FAILED: Hallucinated number \"" + num + "\"");
        }
    }

    // R-2 Keyword Legitimacy
    const jdKwsLower = input.top_10_keywords_array.map(k => k.toLowerCase());
    const rewLower = parsed.rewritten.toLowerCase();
    for (const kw of parsed.keywords_used) {
        if (!jdKwsLower.includes(kw.toLowerCase())) {
            failedTests.push("TEST R-2 FAILED: Keyword \"" + kw + "\" not in JD top 10.");
        }
        if (!rewLower.includes(kw.toLowerCase())) {
            failedTests.push("TEST R-2 FAILED: Keyword \"" + kw + "\" not verbatim in rewritten bullet.");
        }
    }

    // R-3 Token Boundary
    const allowSet = new Set([
        ...getWordTokens(parsed.original),
        ...getWordTokens(input.concatenated_candidate_text),
        ...getWordTokens(input.jd_raw_text),
        ...ACTION_VERBS,
        "add", "metric" // For \[add metric\]
    ]);

    const rewTokens = getWordTokens(parsed.rewritten);
    for (const token of rewTokens) {
        if (!allowSet.has(token) && !Number.isNaN(Number(token))) {
            // Numbers are checked rigidly in R-1
            if (token !== 's') { // Ignore possessives/plurals trivially appended incorrectly by standard tokenizers sometimes, though we could just enforce rigidly.
                // Let's be fully rigid:
                if (!allowSet.has(token)) {
                    // Allow purely numeric tokens if they pass R-1.
                    if (!/^\d+(\.\d+)?$/.test(token)) {
                        failedTests.push("TEST R-3 FAILED: Hallucinated token \"" + token + "\" outside boundaries.");
                    }
                }
            }
        }
    }

    // R-4 Length Constraint
    const wc = parsed.rewritten.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wc > 28) {
        failedTests.push("TEST R-4 FAILED: Word count (" + wc + ") exceeds 28.");
    }

    // R-5 Meaning Drift Check (Embeddings)
    try {
        const embOrig = await getEmbedding(parsed.original);
        const embRew = await getEmbedding(parsed.rewritten);
        const sim = cosineSimilarity(embOrig, embRew);
        if (sim < 0.85) {
            failedTests.push("TEST R-5 FAILED: Meaning drift too high. Cosine similarity = " + sim.toFixed(3) + " < 0.85");
        }
    } catch (e: any) {
        failedTests.push("TEST R-5 ERROR: Failed to compute embeddings - " + e.message);
    }

    // R-6 Metric Flag Rule
    const hasNumOrig = origNumbers.length > 0;
    if (!hasNumOrig) {
        if (!parsed.rewritten.includes("[add metric]")) {
            failedTests.push("TEST R-6 FAILED: Rewritten must contain \"[add metric]\" when original lacks numbers.");
        }
        if (parsed.needs_user_metric !== true) {
            failedTests.push("TEST R-6 FAILED: needs_user_metric must be true when original lacks numbers.");
        }
    } else {
        if (parsed.needs_user_metric !== false) {
            failedTests.push("TEST R-6 FAILED: needs_user_metric must be false when original contains numbers.");
        }
    }

    return {
        success: failedTests.length === 0,
        failedTests,
        output: parsed
    };
}


export async function rewriteBulletStrictPipeline(
    input: RewriteBulletInput
): Promise<StrictRewriteResult> {

    const userPrompt = "Original bullet:\n\"" + input.original_bullet + "\"\n\nTop JD Keywords:\n" + JSON.stringify(input.top_10_keywords_array) + "\n\nApproved Action Verbs:\n" + JSON.stringify(ACTION_VERBS) + "\n\nCandidate Profile Text (for allowed vocabulary boundary):\n" + input.concatenated_candidate_text + "\n\nJob Description Raw Text:\n" + input.jd_raw_text;

    const fullPrompt = SYSTEM_PROMPT + "\n\n" + userPrompt;

    let aiResultStr = "";
    try {
        aiResultStr = await routeAICall(fullPrompt);
    } catch (e: any) {
        return { success: false, failedTests: ["AI Call failed: " + e.message] };
    }

    // Try Validation 1
    const val1 = await validateBulletRewriteStrict(input, aiResultStr);
    if (val1.success) return val1;

    // Failed -> Retry Once
    let aiResultStr2 = "";
    try {
        aiResultStr2 = await routeAICall(fullPrompt + "\n\nPREVIOUS FAILURE REASONS:\n" + val1.failedTests.join("\n") + "\nDO NOT REPEAT THESE MISTAKES.");
    } catch (e: any) {
        return { success: false, failedTests: val1.failedTests.concat(["Retry AI Call failed: " + e.message]) };
    }

    const val2 = await validateBulletRewriteStrict(input, aiResultStr2);
    if (val2.success) return val2;

    // Completely failed
    return {
        success: false,
        failedTests: ["ATTEMPT 1 FAILS:", ...val1.failedTests, "ATTEMPT 2 FAILS:", ...val2.failedTests],
    };
}
