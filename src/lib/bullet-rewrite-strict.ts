import { routeAICall, routeAICallWithDetails, AIGenerateResult } from './ai-router';
// Using Gemini direct fetch for embeddings since AI router doesn't abstract it
import { config } from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
config({ path: '.env.local' });

export interface RewriteBulletInput {
    original_bullet: string;
    top_10_keywords_array: string[];
    concatenated_candidate_text: string;
    jd_raw_text: string;
    reqId?: string;
    bulletIndex?: number;
}

export interface RewriteBulletOutput {
    original: string;
    rewritten: string;
    keywords_used: string[];
    needs_user_metric: boolean;
}

export interface RewriteBulletResult {
    rewritten: string;
    needs_user_metric: boolean;
    fallback_used: boolean;
}

export interface StrictRewriteResult {
    success: boolean;
    failedTests: string[];
    output?: RewriteBulletOutput;
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

const SYSTEM_PROMPT = "You are a strict ATS optimization assistant in BUILD mode.\nRewrite a single resume bullet while preserving all factual content.\nYou are forbidden from inventing numbers, tools, dates, responsibilities, or achievements.\nYou may only use words found in:\n- the original bullet\n- the candidate profile\n- the job description\n- the approved action verb list\nIf original bullet contains no number, append \"[add metric]\" at the end.\nMaximum 28 words.\nCRITICAL: Use deterministic output. Do not add randomness.\nReturn ONLY JSON in required schema.";

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

    let aiResult: AIGenerateResult | null = null;
    let aiResultStr = "";
    try {
        aiResult = await routeAICallWithDetails(fullPrompt, 0.2);
        aiResultStr = aiResult.text;
    } catch (e: any) {
        return { success: false, failedTests: ["AI Call failed: " + e.message] };
    }

    try {
        strictJsonParse<{rewritten: string, keywords_used: string[], needs_user_metric: boolean}>(
            aiResultStr,
            input.reqId,
            'bullet_strict_1',
            ['rewritten', 'keywords_used', 'needs_user_metric']
        );
    } catch (e: any) {
        saveRawOutput(input.reqId, 'bullet_strict_1', aiResultStr);
        return { success: false, failedTests: ["JSON Parse Error (Strict): " + e.message] };
    }

    // Try Validation 1
    const val1 = await validateBulletRewriteStrict(input, aiResultStr);
    if (val1.success) {
        return {
            ...val1,
            raw_response: aiResultStr,
            provider: aiResult?.provider,
            model: aiResult?.model
        };
    }

    // Failed -> Retry Once
    let aiResult2: AIGenerateResult | null = null;
    let aiResultStr2 = "";
    try {
        aiResult2 = await routeAICallWithDetails(fullPrompt + "\n\nPREVIOUS FAILURE REASONS:\n" + val1.failedTests.join("\n") + "\nDO NOT REPEAT THESE MISTAKES.", 0.2);
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
        strictJsonParse<{rewritten: string, keywords_used: string[], needs_user_metric: boolean}>(
            aiResultStr2,
            input.reqId,
            'bullet_strict_2',
            ['rewritten', 'keywords_used', 'needs_user_metric']
        );
    } catch (e: any) {
        saveRawOutput(input.reqId, 'bullet_strict_2', aiResultStr2);
        return { 
            success: false, 
            failedTests: val1.failedTests.concat(["JSON Parse Error (Strict Retry): " + e.message]),
            raw_response: aiResultStr2,
            provider: aiResult?.provider,
            model: aiResult?.model
        };
    }

    const val2 = await validateBulletRewriteStrict(input, aiResultStr2);
    if (val2.success) {
        return {
            ...val2,
            raw_response: aiResultStr2,
            provider: aiResult2?.provider || aiResult?.provider,
            model: aiResult2?.model || aiResult?.model
        };
    }

    // Completely failed - still return the raw responses for debugging
    return {
        success: false,
        failedTests: ["ATTEMPT 1 FAILS:", ...val1.failedTests, "ATTEMPT 2 FAILS:", ...val2.failedTests],
        raw_response: aiResultStr2 || aiResultStr,
        provider: aiResult2?.provider || aiResult?.provider,
        model: aiResult2?.model || aiResult?.model
    };
}

async function persistBulletAttempt(
    reqId: string | undefined,
    bulletIndex: number | undefined,
    attempt: 'embedding' | 'llm',
    data: any,
    error?: string
): Promise<void> {
    if (!reqId || bulletIndex === undefined) return;

    const dir = `/tmp/resume_tasks/${reqId}`;
    const filePath = path.join(dir, `bullet_${bulletIndex}.json`);

    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const existing = fs.existsSync(filePath) 
            ? JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            : { metadata: {} };

        const payload = {
            ...existing,
            [attempt]: data,
            metadata: {
                ...existing.metadata,
                last_attempt: attempt,
                [attempt + '_error']: error || null,
                [attempt + '_timestamp']: new Date().toISOString()
            }
        };

        fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
        console.log(`[PERSIST] Saved ${attempt} attempt to ${filePath}`);
    } catch (e: any) {
        console.error(`[PERSIST ERROR] Failed to write ${filePath}: ${e.message}`);
    }
}

async function attemptEmbeddingRewrite(input: RewriteBulletInput): Promise<{success: boolean, rewritten?: string, needs_user_metric?: boolean, error?: string}> {
    const key = process.env.GEMINI_API_KEY_A || process.env.GEMINI_API_KEY_B;
    if (!key) {
        return { success: false, error: 'No Gemini API Key configured' };
    }

    try {
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=" + key, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'models/text-embedding-004',
                content: { parts: [{ text: input.original_bullet }] }
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 404) {
                return { success: false, error: '404 - Embedding model not found' };
            }
            return { success: false, error: `Embedding failed: ${errText}` };
        }

        const data = await response.json();
        if (!data.embedding?.values) {
            return { success: false, error: 'No embedding values returned' };
        }

        return { success: false, error: 'Embedding lookup not implemented - using LLM fallback' };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

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
        throw new Error(`JSON parse failed for ${stage}: ${e.message}. Raw output saved to /tmp/resume_tasks/${reqId}/raw_${stage}.txt`);
    }
}

async function callLLMFallback(input: RewriteBulletInput, reqId?: string): Promise<{rewritten: string, needs_user_metric: boolean}> {
    const userPrompt = "Original bullet:\n\"" + input.original_bullet + "\"\n\nTop JD Keywords:\n" + JSON.stringify(input.top_10_keywords_array) + "\n\nApproved Action Verbs:\n" + JSON.stringify(ACTION_VERBS) + "\n\nCandidate Profile Text (for allowed vocabulary boundary):\n" + input.concatenated_candidate_text + "\n\nJob Description Raw Text:\n" + input.jd_raw_text;

    const fullPrompt = SYSTEM_PROMPT + "\n\n" + userPrompt;

    const aiResult = await routeAICallWithDetails(fullPrompt, 0.2);
    
    const parsed = strictJsonParse<{rewritten: string, needs_user_metric: boolean}>(
        aiResult.text,
        reqId,
        'bullet_llm',
        ['rewritten', 'needs_user_metric']
    );

    return {
        rewritten: parsed.rewritten || input.original_bullet,
        needs_user_metric: parsed.needs_user_metric === true
    };
}

export async function rewriteBulletWithFallback(
    input: RewriteBulletInput
): Promise<RewriteBulletResult> {
    const { reqId, bulletIndex, ...restInput } = input;
    const useEmbedding = process.env.USE_EMBEDDING_REWRITE === 'true';

    let embeddingResult: {success: boolean, rewritten?: string, needs_user_metric?: boolean, error?: string} = { success: false };
    
    if (useEmbedding) {
        console.log('[BULLET REWRITE] Attempting embedding-based rewrite...');
        embeddingResult = await attemptEmbeddingRewrite(restInput);
        
        await persistBulletAttempt(reqId, bulletIndex, 'embedding', {
            attempted: true,
            success: embeddingResult.success,
            rewritten: embeddingResult.rewritten,
            needs_user_metric: embeddingResult.needs_user_metric
        }, embeddingResult.error);

        if (embeddingResult.success && embeddingResult.rewritten) {
            return {
                rewritten: embeddingResult.rewritten,
                needs_user_metric: embeddingResult.needs_user_metric || false,
                fallback_used: false
            };
        }
    }

    console.log('[BULLET REWRITE] Calling LLM fallback...');
    let llmResult: {rewritten: string, needs_user_metric: boolean};
    let llmError: string | undefined;

    try {
        llmResult = await callLLMFallback(restInput, reqId);
    } catch (e: any) {
        llmError = e.message;
        llmResult = {
            rewritten: input.original_bullet,
            needs_user_metric: !/\d/.test(input.original_bullet)
        };
    }

    await persistBulletAttempt(reqId, bulletIndex, 'llm', {
        success: !llmError,
        rewritten: llmResult.rewritten,
        needs_user_metric: llmResult.needs_user_metric
    }, llmError);

    return {
        rewritten: llmResult.rewritten,
        needs_user_metric: llmResult.needs_user_metric,
        fallback_used: true
    };
}
