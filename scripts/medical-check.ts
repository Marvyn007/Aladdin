
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

function loadEnv() {
    try {
        const envPath = path.resolve(process.cwd(), '.env.local');
        if (fs.existsSync(envPath)) {
            const content = fs.readFileSync(envPath, 'utf-8');
            content.split('\n').forEach(line => {
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^['"]|['"]$/g, '');
                    if (!process.env[key]) process.env[key] = value;
                }
            });
            console.error('Loaded .env.local');
        }
    } catch (e) {
        console.error('Failed to load .env.local', e);
    }
}

loadEnv();

const TEST_PROMPT = "Reply with the word OK.";

async function testGemini(key: string | undefined, name: string) {
    const start = Date.now();
    // CHANGED: Use 1.5-flash
    const modelName = 'gemini-1.5-flash';
    try {
        if (!key) throw new Error('API Key missing');
        const client = new GoogleGenerativeAI(key);
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(TEST_PROMPT);
        const text = result.response.text();
        return {
            provider: name, status: 'WORKING', reason: 'Success',
            model: modelName, latency: Date.now() - start
        };
    } catch (e: any) {
        return {
            provider: name, status: 'FAILED', reason: e.message,
            model: modelName, latency: Date.now() - start, error_type: e.name
        };
    }
}

async function testOpenRouter(key: string | undefined) {
    const start = Date.now();
    // CHANGED: Use google/gemini-2.0-flash-exp (OR often has diff names) or google/gemini-pro-1.5
    // 'google/gemini-2.0-flash-001' might be wrong on OR.
    // Try reliable 'google/gemini-pro-1.5'
    const modelName = 'google/gemini-pro-1.5';
    try {
        if (!key) throw new Error('API Key missing');
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: modelName, messages: [{ role: 'user', content: TEST_PROMPT }] })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        const data = await res.json();
        return {
            provider: 'OpenRouter', status: 'WORKING', reason: 'Success',
            model: modelName, latency: Date.now() - start
        };
    } catch (e: any) {
        return {
            provider: 'OpenRouter', status: 'FAILED', reason: e.message,
            model: modelName, latency: Date.now() - start
        };
    }
}

async function testHuggingFace(key: string | undefined) {
    const start = Date.now();
    const modelName = process.env.HUGGINGFACE_MODEL || 'tiiuae/falcon-7b-instruct';
    try {
        if (!key) throw new Error('API Key missing');
        const res = await fetch(`https://api-inference.huggingface.co/models/${modelName}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ inputs: TEST_PROMPT, parameters: { max_new_tokens: 10 } })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return {
            provider: 'Hugging Face', status: 'WORKING', reason: 'Success',
            model: modelName, latency: Date.now() - start
        };
    } catch (e: any) {
        return {
            provider: 'Hugging Face', status: 'FAILED', reason: e.message,
            model: modelName, latency: Date.now() - start
        };
    }
}

async function testReplicate(key: string | undefined) {
    const start = Date.now();
    const modelName = process.env.REPLICATE_MODEL || 'meta/meta-llama-3-8b-instruct';
    try {
        if (!key) throw new Error('API Key missing');
        const [owner, name] = modelName.split('/');
        const res = await fetch(`https://api.replicate.com/v1/models/${owner}/${name}/predictions`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': 'wait=5' },
            body: JSON.stringify({ input: { prompt: TEST_PROMPT, max_new_tokens: 10 } })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
        return {
            provider: 'Replicate', status: 'WORKING', reason: 'Success',
            model: modelName, latency: Date.now() - start
        };
    } catch (e: any) {
        return {
            provider: 'Replicate', status: 'FAILED', reason: e.message,
            model: modelName, latency: Date.now() - start
        };
    }
}

async function run() {
    const results = [];
    results.push(await testGemini(process.env.GEMINI_API_KEY_A || process.env.GEMINI_API_KEY, 'Gemini A'));
    results.push(await testGemini(process.env.GEMINI_API_KEY_B, 'Gemini B'));
    results.push(await testOpenRouter(process.env.OPENROUTER_API_KEY));
    results.push(await testHuggingFace(process.env.HUGGINGFACE_API_KEY));
    results.push(await testReplicate(process.env.REPLICATE_API_TOKEN));

    console.log('--- DIAGNOSTIC SUMMARY ---');
    results.forEach(r => {
        console.log(`${r.provider}: ${r.status} (${r.reason.slice(0, 50)}...) HTTP:${r.status === 'WORKING' ? 200 : 'ERR'}`);
    });
    console.log('--- END SUMMARY ---');
}

run();
