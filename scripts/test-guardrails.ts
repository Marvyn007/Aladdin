import { config } from 'dotenv';
config({ path: '.env.local' });
import { validateComposeOutput, ComposeResumeInput, ComposeResumeOutput } from '../src/lib/resume-compose-strict';

const testCases = [
    {
        name: "Test 1: Valid input - should pass",
        input: {
            candidate_json: {
                basics: { name: "John", email: "john@test.com" },
                summary: "Experienced dev",
                skills: { technical: ["js", "ts"], tools: [], soft: [] },
                experience: [{ title: "Dev", company: "Acme", bullets: [] }],
                education: [{ institution: "MIT", degree: "BS" }],
                projects: [],
                certifications: [],
                community: []
            },
            job_json: {},
            bullets: [],
            meta: { years_experience: 5 }
        },
        output: {
            basics: { name: "John", email: "john@test.com" },
            summary: "Experienced dev",
            skills: { technical: ["js", "ts"], tools: [], soft: [] },
            experience: [{ title: "Dev", company: "Acme", bullets: [] }],
            education: [{ institution: "MIT", degree: "BS" }],
            projects: [],
            community: []
        },
        expectPass: true
    },
    {
        name: "Test 2: Empty experience - should fail",
        input: {
            candidate_json: {
                basics: { name: "John", email: "john@test.com" },
                summary: "Experienced dev",
                skills: { technical: ["js"], tools: [], soft: [] },
                experience: [{ title: "Dev", company: "Acme", bullets: [] }],
                education: [{ institution: "MIT", degree: "BS" }],
                projects: [],
                certifications: [],
                community: []
            },
            job_json: {},
            bullets: [],
            meta: { years_experience: 5 }
        },
        output: {
            basics: { name: "John", email: "john@test.com" },
            summary: "Experienced dev",
            skills: { technical: ["js"], tools: [], soft: [] },
            experience: [],
            education: [{ institution: "MIT", degree: "BS" }],
            projects: [],
            community: []
        },
        expectPass: false
    },
    {
        name: "Test 3: Missing education - should fail",
        input: {
            candidate_json: {
                basics: { name: "John", email: "john@test.com" },
                summary: "Experienced dev",
                skills: { technical: ["js"], tools: [], soft: [] },
                experience: [{ title: "Dev", company: "Acme", bullets: [] }],
                education: [{ institution: "MIT", degree: "BS" }],
                projects: [],
                certifications: [],
                community: []
            },
            job_json: {},
            bullets: [],
            meta: { years_experience: 5 }
        },
        output: {
            basics: { name: "John", email: "john@test.com" },
            summary: "Experienced dev",
            skills: { technical: ["js"], tools: [], soft: [] },
            experience: [{ title: "Dev", company: "Acme", bullets: [] }],
            education: [],
            projects: [],
            community: []
        },
        expectPass: false
    },
    {
        name: "Test 4: Skills reduced by >50% - should fail",
        input: {
            candidate_json: {
                basics: { name: "John", email: "john@test.com" },
                summary: "Experienced dev",
                skills: { technical: ["js", "ts", "react", "node", "python", "java"], tools: [], soft: [] },
                experience: [{ title: "Dev", company: "Acme", bullets: [] }],
                education: [{ institution: "MIT", degree: "BS" }],
                projects: [],
                certifications: [],
                community: []
            },
            job_json: {},
            bullets: [],
            meta: { years_experience: 5 }
        },
        output: {
            basics: { name: "John", email: "john@test.com" },
            summary: "Experienced dev",
            skills: { technical: ["js"], tools: [], soft: [] },
            experience: [{ title: "Dev", company: "Acme", bullets: [] }],
            education: [{ institution: "MIT", degree: "BS" }],
            projects: [],
            community: []
        },
        expectPass: false
    },
    {
        name: "Test 5: Community merged into experience - should fail",
        input: {
            candidate_json: {
                basics: { name: "John", email: "john@test.com" },
                summary: "Experienced dev",
                skills: { technical: ["js"], tools: [], soft: [] },
                experience: [{ title: "Dev", company: "Acme", bullets: [] }],
                education: [{ institution: "MIT", degree: "BS" }],
                projects: [],
                certifications: [],
                community: [{ organization: "Red Cross", role: "Volunteer", description: "Community service" }]
            },
            job_json: {},
            bullets: [],
            meta: { years_experience: 5 }
        },
        output: {
            basics: { name: "John", email: "john@test.com" },
            summary: "Experienced dev",
            skills: { technical: ["js"], tools: [], soft: [] },
            experience: [{ title: "Volunteer", company: "Red Cross - Community service", bullets: ["Community service"] }],
            education: [{ institution: "MIT", degree: "BS" }],
            projects: [],
            community: []
        },
        expectPass: false
    }
];

async function runTests() {
    console.log("=== GUARDRAIL TESTS ===\n");
    
    let passed = 0;
    let failed = 0;
    
    for (const tc of testCases) {
        console.log(`Running: ${tc.name}`);
        const result = await validateComposeOutput(tc.input as any, tc.output as any);
        const testPassed = tc.expectPass ? result.success : !result.success;
        
        if (testPassed) {
            console.log(`  ✅ PASSED`);
            passed++;
        } else {
            console.log(`  ❌ FAILED`);
            console.log(`  Expected: ${tc.expectPass ? 'pass' : 'fail'}`);
            console.log(`  Got: ${result.success ? 'pass' : 'fail'}`);
            console.log(`  Errors: ${result.failedTests.join(', ')}`);
            failed++;
        }
        console.log("");
    }
    
    console.log(`=== RESULTS: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
