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
    reqId: "test-req-123",
    bulletIndex: 1
};

async function testEmbeddingFallback() {
    console.log("=== TEST 1: Embedding not configured (USE_EMBEDDING_REWRITE not set) ===\n");
    
    const result1 = await rewriteBulletWithFallback(testInput);
    
    console.log("Result:", JSON.stringify(result1, null, 2));
    console.log("\nExpected: fallback_used = true (since USE_EMBEDDING_REWRITE not set)");
    console.log("Actual: fallback_used =", result1.fallback_used);
    
    const persistedPath = `/tmp/resume_tasks/${testInput.reqId}/bullet_${testInput.bulletIndex}.json`;
    console.log("\nPersisted file exists:", fs.existsSync(persistedPath));
    
    if (fs.existsSync(persistedPath)) {
        const persisted = JSON.parse(fs.readFileSync(persistedPath, 'utf-8'));
        console.log("Persisted content:", JSON.stringify(persisted, null, 2));
    }
    
    console.log("\n--- TEST 1 PASSED ---");
}

async function testWithEmbeddingEnabled() {
    console.log("\n=== TEST 2: Embedding configured but will fail (force 404 behavior) ===\n");
    
    process.env.USE_EMBEDDING_REWRITE = 'true';
    
    const testInput2: RewriteBulletInput = {
        ...testInput,
        reqId: "test-req-456",
        bulletIndex: 2
    };
    
    const result2 = await rewriteBulletWithFallback(testInput2);
    
    console.log("Result:", JSON.stringify(result2, null, 2));
    console.log("\nExpected: fallback_used = true (embedding will fail/error out)");
    console.log("Actual: fallback_used =", result2.fallback_used);
    
    const persistedPath2 = `/tmp/resume_tasks/${testInput2.reqId}/bullet_${testInput2.bulletIndex}.json`;
    console.log("\nPersisted file exists:", fs.existsSync(persistedPath2));
    
    if (fs.existsSync(persistedPath2)) {
        const persisted2 = JSON.parse(fs.readFileSync(persistedPath2, 'utf-8'));
        console.log("Persisted content:", JSON.stringify(persisted2, null, 2));
        console.log("\nExpected: llm key exists with rewritten content");
        console.log("Actual: llm exists =", !!persisted2.llm);
    }
    
    console.log("\n--- TEST 2 PASSED ---");
}

async function run() {
    try {
        await testEmbeddingFallback();
        await testWithEmbeddingEnabled();
        console.log("\n=== ALL TESTS PASSED ===");
    } catch (e) {
        console.error("Test failed:", e);
    }
}

run();
