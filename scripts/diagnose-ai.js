/**
 * Diagnostic Script for AI Providers (CommonJS)
 * Run with: node scripts/diagnose-ai.js
 */

const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 1. Load Environment Variables from .env.local
function loadEnv() {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env.local not found!');
        process.exit(1);
    }
    const content = fs.readFileSync(envPath, 'utf-8');
    const env = {};
    content.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let value = match[2].trim();
            if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
            env[key] = value;
        }
    });
    return env;
}

const env = loadEnv();
const GEMINI_A = env.GEMINI_API_KEY_A || env.GEMINI_API_KEY;
const GEMINI_B = env.GEMINI_API_KEY_B;
const OPENROUTER = env.OPENROUTER_API_KEY;

console.log('--- ENV CHECK ---');
console.log(`GEMINI_A: ${GEMINI_A ? 'Present' : 'MISSING'}`);
console.log(`GEMINI_B: ${GEMINI_B ? 'Present' : 'MISSING'}`);
console.log(`OPENROUTER: ${OPENROUTER ? 'Present' : 'MISSING'}`);
console.log('-----------------\n');

async function testGemini(name, key, modelName) {
    console.log(`Testing ${name} with model ${modelName}...`);
    if (!key) {
        console.log(`❌ ${name} Skipped (No Key)`);
        return;
    }

    try {
        const client = new GoogleGenerativeAI(key);
        const model = client.getGenerativeModel({ model: modelName });
        const start = Date.now();
        const result = await model.generateContent('Ping. Reply with "Pong".');
        const response = await result.response;
        const text = response.text();
        const duration = Date.now() - start;
        console.log(`✅ ${name} Success (${duration}ms): ${text.trim()}`);
    } catch (error) {
        console.error(`❌ ${name} Failed: ${error.message}`);
        if (error.response) {
            console.error('   Status:', error.response.status);
        }
    }
}

async function testOpenRouter(key) {
    console.log('Testing OpenRouter...');
    if (!key) {
        console.log('❌ OpenRouter Skipped (No Key)');
        return;
    }

    try {
        const start = Date.now();
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://jobhuntvibe.com',
                'X-Title': 'Job Hunt Vibe Diagnostic',
            },
            body: JSON.stringify({
                model: 'google/gemini-flash-1.5',
                messages: [{ role: 'user', content: 'Ping. Reply with "Pong".' }],
            }),
        });

        const duration = Date.now() - start;

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data = await res.json();
        const output = data.choices?.[0]?.message?.content || 'No content';
        console.log(`✅ OpenRouter Success (${duration}ms): ${output.trim()}`);
    } catch (error) {
        console.error(`❌ OpenRouter Failed: ${error.message}`);
    }
}

async function listGeminiModels(name, key) {
    console.log(`Listing models for ${name}...`);
    if (!key) return;
    try {
        const _client = new GoogleGenerativeAI(key);
        // Access via API URL directly if SDK doesn't expose listModels easily in this version or use valid heuristic
        // The Node SDK has listModels on GoogleGenerativeAI? No, usually on a manager.
        // Actually, looking at docs, typically: 
        // const genAI = new GoogleGenerativeAI(API_KEY);
        // BUT listModels might not be on the client instance directly in all versions.
        // Checking typical usage: usually via REST if SDK is limited.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const models = data.models?.map(m => m.name.replace('models/', '')) || [];
        console.log(`✅ ${name} Models:`, models.filter(m => m.includes('gemini')).join(', '));
        return models;
    } catch (e) {
        console.error(`❌ ${name} List Failed:`, e.message);
    }
}

async function listOpenRouterModels(key) {
    console.log('Listing OpenRouter models...');
    if (!key) return;
    try {
        const res = await fetch('https://openrouter.ai/api/v1/models', {
            headers: { 'Authorization': `Bearer ${key}` }
        });
        if (!res.ok) throw new Error(res.statusText);
        const data = await res.json();
        const models = data.data?.map(m => m.id) || [];
        const geminiModels = models.filter(m => m.includes('gemini'));
        console.log('✅ OpenRouter Gemini Models:', geminiModels.slice(0, 5).join(', ')); // Show first 5
        return geminiModels;
    } catch (e) {
        console.error('❌ OpenRouter List Failed:', e.message);
    }
}

async function run() {
    // List available models first to debug 404s
    await listGeminiModels('Gemini A', GEMINI_A);
    // await listGeminiModels('Gemini B', GEMINI_B); // Skip B to save time/space
    await listOpenRouterModels(OPENROUTER);

    console.log('\n--- SMOKE TESTS ---');

    // Test Gemini 2.0 Flash Exp (Current Config)
    // await testGemini('Gemini A (2.0-exp)', GEMINI_A, 'gemini-2.0-flash-exp');

    // Test Gemini 1.5 Flash - Try variants if found
    // We will assume standard names for now
    await testGemini('Gemini A (1.5-flash)', GEMINI_A, 'gemini-1.5-flash');
    await testGemini('Gemini A (1.5-flash-001)', GEMINI_A, 'gemini-1.5-flash-001');

    // Test OpenRouter with a known reliable model (e.g. auto) or one found above
    // We'll trust the 404 msg
}

run().catch(console.error);
