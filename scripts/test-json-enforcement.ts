import { config } from 'dotenv';
config({ path: '.env.local' });
import { rewriteBulletWithFallback, RewriteBulletInput } from '../src/lib/bullet-rewrite-strict';
import * as fs from 'fs';
import * as path from 'path';

const testInput: RewriteBulletInput = {
    original_bullet: "Developed a web app using javascript and html.",
    top_10_keywords_array: ["react", "typescript", "frontend", "optimization", "component"],
    concatenated_candidate_text: "I am a UI developer. I know javascript, html, css.",
    jd_raw_text: "We need a frontend developer skilled in react and typescript.",
    reqId: "malformed-test-123",
    bulletIndex: 99
};

async function testMalformedJsonHandling() {
    console.log("=== TEST: Malformed JSON handling ===\n");
    
    const result = await rewriteBulletWithFallback(testInput);
    
    console.log("Result:", JSON.stringify(result, null, 2));
    
    const persistedPath = `/tmp/resume_tasks/${testInput.reqId}/bullet_${testInput.bulletIndex}.json`;
    const rawPath = `/tmp/resume_tasks/${testInput.reqId}/raw_bullet_llm.txt`;
    
    console.log("\nBullet JSON exists:", fs.existsSync(persistedPath));
    console.log("Raw output file exists:", fs.existsSync(rawPath));
    
    if (fs.existsSync(persistedPath)) {
        const persisted = JSON.parse(fs.readFileSync(persistedPath, 'utf-8'));
        console.log("Persisted metadata:", JSON.stringify(persisted.metadata, null, 2));
    }
    
    if (fs.existsSync(rawPath)) {
        console.log("\nRaw file content (first 500 chars):");
        console.log(fs.readFileSync(rawPath, 'utf-8').substring(0, 500));
    }
    
    console.log("\n--- TEST COMPLETE ---");
}

async function run() {
    try {
        await testMalformedJsonHandling();
    } catch (e) {
        console.error("Test error:", e);
    }
}

run();
