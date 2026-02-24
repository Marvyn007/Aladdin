import { config } from 'dotenv';
config({ path: '.env.local' });
import { orchestrateResumePipeline, OrchestrationInput } from '../src/lib/resume-orchestrator-strict';

const jdKeywords1 = ["react", "typescript", "frontend", "optimization", "component"];
const jdRaw1 = "Frontend engineer needed. React, typescript, optimization, scalable architecture, component design.";

const profile1 = {
    basics: {
        name: "John Doe",
        email: "john@example.com",
        phone: "555-0100",
        location: "NYC"
    },
    summary: "Senior Frontend Engineer with 5 years of experience building applications.",
    skills: {
        technical: ["react", "javascript", "typescript", "html", "css", "jest"]
    },
    experience: [
        {
            title: "Frontend Engineer",
            company: "Tech Corp",
            start_date: "Jan 2020",
            end_date: "Present",
            location: "NYC",
            bullets: [
                "Led development of a new react component library.",
                "Improved typescript optimization for the monolithic frontend.",
                "Reduced bundle size by 30 percent."
            ]
        }
    ],
    education: [
        {
            institution: "State University",
            degree: "BS Computer Science",
            start_date: "Aut 2016",
            end_date: "Spr 2020"
        }
    ]
};

// A profile with no numbers to trigger [add metric] fallback
const profileNoMetrics = {
    ...JSON.parse(JSON.stringify(profile1)),
    experience: [
        {
            title: "Frontend Engineer",
            company: "Tech Corp",
            start_date: "Jan 2020",
            end_date: "Present",
            location: "NYC",
            bullets: [
                "Led development of a new react component library.",
                "Improved typescript optimization for the monolithic frontend.",
                "Reduced bundle size."
            ]
        }
    ]
};

async function run() {
    console.log("STARTING STRICT STAGE 5 ORCHESTRATION TESTS...\n");

    const input1: OrchestrationInput = {
        userId: "user_123",
        candidate_profile: profile1 as any,
        jd_json: { top_10_keywords: jdKeywords1, raw_text: jdRaw1 },
        years_experience: 5,
        file_size_bytes: 1024,
        pdf_pages: 1,
        rate_limit_count: 1
    };

    console.log("RUN 1: Initial Generation (Cold Cache)");
    const start1 = Date.now();
    const res1 = await orchestrateResumePipeline(input1);
    const end1 = Date.now();

    console.log(`Success: ${res1.success}`);
    console.log(`Time Taken: ${end1 - start1}ms`);
    console.log(`Needs User Confirmation: ${res1.needs_user_confirmation}`);
    console.log(`Explanation Output:`);
    console.log(JSON.stringify(res1.explanation, null, 2));

    console.log("\n----------------------------------------------------------\n");

    console.log("RUN 2: Same Input Generation (Warm Cache Check)");
    const start2 = Date.now();
    const res2 = await orchestrateResumePipeline(input1);
    const end2 = Date.now();

    console.log(`Success: ${res2.success}`);
    console.log(`Time Taken: ${end2 - start2}ms (Should be dramatically faster!)`);
    console.log(`Needs User Confirmation: ${res2.needs_user_confirmation}`);
    if ((end2 - start2) > (end1 - start1) / 2) {
        console.warn("WARNING: Caching may not have engaged properly!");
    } else {
        console.log("CACHING SUCCESSFULLY ENGAGED.");
    }

    console.log("\n----------------------------------------------------------\n");

    console.log("RUN 3: No-Metrics Profile (Confirmation Gate Check)");
    const input3: OrchestrationInput = {
        ...input1,
        candidate_profile: profileNoMetrics as any
    };

    const res3 = await orchestrateResumePipeline(input3);
    console.log(`Needs User Confirmation: ${res3.needs_user_confirmation} (Should be TRUE)`);
    if (!res3.needs_user_confirmation) {
        console.error("FAILED TEST 5.5: Confirmation Gate did not flag missing metrics.");
    } else {
        console.log("TEST 5.5 PASSED: Guardrail successfully triggered for missing metrics.");
    }

    console.log("\n----------------------------------------------------------\n");

    console.log("RUN 4: Rate Limit Guard Check");
    const input4: OrchestrationInput = {
        ...input1,
        rate_limit_count: 10 // exceeds limit 5
    };

    const res4 = await orchestrateResumePipeline(input4);
    console.log(`Success expected false: `, res4.success === false);
    console.log(`Abuse Guard Error: ${res4.error}`);
    if (res4.success) {
        console.error("FAILED TEST 5.6: Rate limiter bypassed.");
    } else {
        console.log("TEST 5.6 PASSED: Rate limiter safely intercepted the request.");
    }

    console.log("\n\nORCHESTRATOR PIPELINE TESTS COMPLETED.");
}

run().catch(console.error);
