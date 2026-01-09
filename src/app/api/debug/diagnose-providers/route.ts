
import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow 1 minute for all tests

interface DiagnosticResult {
    provider: string;
    status: 'WORKING' | 'FAILED';
    reason: string | null;
    http_status?: number;
    model_used?: string;
    latency_ms?: number;
    raw_error_type?: string;
}

const TEST_PROMPT = "Reply with the word OK.";

async function testGemini(key: string, name: string): Promise<DiagnosticResult> {
    const start = Date.now();
    const modelName = 'gemini-2.0-flash'; // Hardcoded for diagnostic to verify standard
    try {
        if (!key) throw new Error('API Key missing');
        const client = new GoogleGenerativeAI(key);
        const model = client.getGenerativeModel({ model: modelName });

        const result = await model.generateContent(TEST_PROMPT);
        const response = await result.response;
        const text = response.text();

        return {
            provider: name,
            status: 'WORKING',
            reason: `Success. Response: "${text.slice(0, 20)}..."`,
            http_status: 200,
            model_used: modelName,
            latency_ms: Date.now() - start
        };
    } catch (error: any) {
        return {
            provider: name,
            status: 'FAILED',
            reason: error.message,
            http_status: error.status || error.response?.status,
            model_used: modelName,
            latency_ms: Date.now() - start,
            raw_error_type: error.name
        };
    }
}

async function testOpenRouter(key: string): Promise<DiagnosticResult> {
    const start = Date.now();
    const modelName = 'google/gemini-2.0-flash-001'; // Try specific OR model ID
    try {
        if (!key) throw new Error('API Key missing');

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://usealaddin.com',
                'X-Title': 'Aladdin Vibe Check',
            },
            body: JSON.stringify({
                model: modelName,
                messages: [{ role: 'user', content: TEST_PROMPT }],
            })
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();
        return {
            provider: 'OpenRouter',
            status: 'WORKING',
            reason: `Success. Response: "${data.choices?.[0]?.message?.content?.slice(0, 20)}..."`,
            http_status: res.status,
            model_used: modelName,
            latency_ms: Date.now() - start
        };
    } catch (error: any) {
        return {
            provider: 'OpenRouter',
            status: 'FAILED',
            reason: error.message,
            http_status: error.status,
            model_used: modelName,
            latency_ms: Date.now() - start,
            raw_error_type: error.name
        };
    }
}

async function testHuggingFace(key: string): Promise<DiagnosticResult> {
    const start = Date.now();
    const modelName = process.env.HUGGINGFACE_MODEL || 'HuggingFaceH4/zephyr-7b-beta';
    try {
        if (!key) throw new Error('API Key missing');

        const res = await fetch(`https://api-inference.huggingface.co/models/${modelName}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: TEST_PROMPT,
                parameters: { max_new_tokens: 10, return_full_text: false }
            })
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();
        const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;

        return {
            provider: 'Hugging Face',
            status: 'WORKING',
            reason: `Success. Response: "${typeof text === 'string' ? text.slice(0, 20) : JSON.stringify(data).slice(0, 20)}..."`,
            http_status: res.status,
            model_used: modelName,
            latency_ms: Date.now() - start
        };
    } catch (error: any) {
        return {
            provider: 'Hugging Face',
            status: 'FAILED',
            reason: error.message,
            http_status: error.status,
            model_used: modelName,
            latency_ms: Date.now() - start,
            raw_error_type: error.name
        };
    }
}

async function testReplicate(key: string): Promise<DiagnosticResult> {
    const start = Date.now();
    const modelName = process.env.REPLICATE_MODEL || 'meta/meta-llama-3-8b-instruct';
    try {
        if (!key) throw new Error('API Key missing');

        // Use predictions endpoint which works across most models
        // But need correct version or owner/name
        // Assume modelName is "owner/name"
        const [owner, name] = modelName.split('/');

        const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}/predictions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'wait=5' // Wait 5s
            },
            body: JSON.stringify({
                input: {
                    prompt: TEST_PROMPT,
                    max_new_tokens: 10
                }
            })
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`HTTP ${res.status}: ${txt}`);
        }

        const data = await res.json();
        // If 'Prefer: wait' worked, we might get output directly
        // Or status 'succeeded'

        if (data.status === 'succeeded') {
            return {
                provider: 'Replicate',
                status: 'WORKING',
                reason: `Success. Output: "${data.output?.join('').slice(0, 20)}..."`,
                http_status: res.status,
                model_used: modelName,
                latency_ms: Date.now() - start
            };
        }

        return {
            provider: 'Replicate',
            status: 'WORKING', // Technically API worked, just timed out waiting for result
            reason: `API OK, but prediction pending (status: ${data.status}). ID: ${data.id}`,
            http_status: res.status,
            model_used: modelName,
            latency_ms: Date.now() - start
        };

    } catch (error: any) {
        return {
            provider: 'Replicate',
            status: 'FAILED',
            reason: error.message,
            http_status: error.status,
            model_used: modelName,
            latency_ms: Date.now() - start,
            raw_error_type: error.name
        };
    }
}

export async function GET() {
    const results: DiagnosticResult[] = [];

    // A) Gemini A
    const keyA = process.env.GEMINI_API_KEY_A || process.env.GEMINI_API_KEY;
    results.push(await testGemini(keyA!, 'Gemini A'));

    // B) Gemini B
    results.push(await testGemini(process.env.GEMINI_API_KEY_B!, 'Gemini B'));

    // C) OpenRouter
    results.push(await testOpenRouter(process.env.OPENROUTER_API_KEY!));

    // D) Hugging Face
    results.push(await testHuggingFace(process.env.HUGGINGFACE_API_KEY!));

    // E) Replicate
    results.push(await testReplicate(process.env.REPLICATE_API_TOKEN!));

    return NextResponse.json({
        timestamp: new Date().toISOString(),
        results
    }, { status: 200 });
}
