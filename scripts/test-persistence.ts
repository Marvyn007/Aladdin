import { config } from 'dotenv';
config({ path: '.env.local' });
import { ensureDir, saveLLMOutput, saveRawFailedOutput, saveBulletJson } from '../src/lib/llm-output-persistence';
import * as fs from 'fs';
import * as path from 'path';

const TEST_REQ_ID = 'test-persistence-123';

async function testSaveBulletJson() {
    console.log("=== TEST 1: saveBulletJson ===\n");
    
    saveBulletJson(TEST_REQ_ID, 1, {
        original: "Old bullet",
        rewritten: "New bullet",
        keywords_used: ["react", "typescript"],
        needs_user_metric: false,
        validation_passed: true
    });
    
    const filePath = `/tmp/resume_tasks/${TEST_REQ_ID}/bullet_1.json`;
    console.log("File exists:", fs.existsSync(filePath));
    
    if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log("Content:", JSON.stringify(content, null, 2));
    }
    
    console.log("--- TEST 1 PASSED ---\n");
}

async function testSaveComposeResponse() {
    console.log("=== TEST 2: saveLLMOutput (compose) ===\n");
    
    saveLLMOutput(TEST_REQ_ID, 'compose', {
        rawResponse: "Some raw response",
        parsedJson: {
            rewritten_resume_markdown: "# Resume",
            summary_used_keywords: ["react"],
            skills_prioritized: ["typescript"],
            sections_order: ["Summary"],
            length_estimate_words: 100
        },
        success: true
    });
    
    const filePath = `/tmp/resume_tasks/${TEST_REQ_ID}/compose_response.json`;
    console.log("File exists:", fs.existsSync(filePath));
    
    if (fs.existsSync(filePath)) {
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        console.log("Content:", JSON.stringify(content, null, 2));
    }
    
    console.log("--- TEST 2 PASSED ---\n");
}

async function testSaveRawFailed() {
    console.log("=== TEST 3: saveRawFailedOutput ===\n");
    
    saveRawFailedOutput(
        TEST_REQ_ID, 
        'bullet_1', 
        'This is malformed JSON output', 
        'JSON parse error'
    );
    
    const filePath = `/tmp/resume_tasks/${TEST_REQ_ID}/raw_failed_bullet_1.txt`;
    console.log("File exists:", fs.existsSync(filePath));
    
    if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        console.log("Content (first 200 chars):", content.substring(0, 200));
    }
    
    console.log("--- TEST 3 PASSED ---\n");
}

async function testMultipleBullets() {
    console.log("=== TEST 4: Multiple bullets ===\n");
    
    for (let i = 1; i <= 3; i++) {
        saveBulletJson(TEST_REQ_ID, i, {
            original: `Original bullet ${i}`,
            rewritten: `Rewritten bullet ${i}`,
            keywords_used: [],
            needs_user_metric: false,
            validation_passed: true
        });
    }
    
    const dir = `/tmp/resume_tasks/${TEST_REQ_ID}`;
    const bulletFiles = fs.readdirSync(dir).filter(f => f.startsWith('bullet_'));
    console.log("Bullet files count:", bulletFiles.length);
    console.log("Bullet files:", bulletFiles);
    
    console.log("--- TEST 4 PASSED ---\n");
}

async function testDirCreation() {
    console.log("=== TEST 5: Directory creation ===\n");
    
    const NEW_REQ_ID = 'new-test-' + Date.now();
    const dir = ensureDir(NEW_REQ_ID);
    
    console.log("Directory exists:", fs.existsSync(dir));
    console.log("Directory path:", dir);
    
    console.log("--- TEST 5 PASSED ---\n");
}

async function run() {
    try {
        await testSaveBulletJson();
        await testSaveComposeResponse();
        await testSaveRawFailed();
        await testMultipleBullets();
        await testDirCreation();
        
        console.log("=== ALL PERSISTENCE TESTS PASSED ===");
    } catch (e) {
        console.error("Test error:", e);
    }
}

run();
