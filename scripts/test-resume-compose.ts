import { config } from 'dotenv';
config({ path: '.env.local' });
import { composeResumeStrictPipeline, ComposeResumeInput, StrictComposeResult } from '../src/lib/resume-compose-strict';

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
            location: "NYC"
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
const bullets1 = {
    "Tech Corp_Frontend Engineer": [
        "Led development of a new react component library.",
        "Improved typescript optimization for the monolithic frontend.",
        "Reduced bundle size by 30 percent."
    ]
};

const jdKeywords2 = ["python", "aws", "data", "pipeline", "sql", "spark"];
const jdRaw2 = "Data engineer for aws python pipeline. SQL and spark streaming.";

const profile2 = {
    basics: {
        full_name: "Jane Smith",
        email: "jane.smith@email.com",
        phone: "123-456-7890",
        location: "SF"
    },
    summary: "Data expert with 12 years creating data architectures.",
    skills: {
        technical: ["python", "sql", "aws", "spark", "hadoop", "airflow"]
    },
    experience: [
        {
            title: "Data Engineer",
            company: "DataWorks",
            start_date: "Jun 2015",
            end_date: "Present",
            location: "SF"
        },
        {
            title: "Analyst",
            company: "Consulting LLC",
            start_date: "Jan 2010",
            end_date: "May 2015",
            location: "SF"
        }
    ],
    education: [
        {
            institution: "Tech Institute",
            degree: "MS Data Science",
        }
    ]
};
const bullets2 = {
    "DataWorks_Data Engineer": [
        "Architected an aws data pipeline using python.",
        "Processed 1TB of data daily using spark and sql.",
        "Increased pipeline reliability by 40%."
    ],
    "Consulting LLC_Analyst": [
        "Analyzed database metrics for 10 clients.",
        "Generated automated SQL reports."
    ]
};

const jdKeywords3 = ["marketing", "seo", "content", "strategy", "campaigns", "budget"];
const jdRaw3 = "Marketing Manager. Need seo, content strategy, campaigns and budget management.";

const profile3 = {
    basics: {
        name: "Alice Johnson",
        email: "alicej@marketing.com",
        phone: "555-1234",
        location: "Remote"
    },
    summary: "Creative marketing strategist with 8 years of experience.",
    skills: {
        technical: ["seo", "content creation", "google analytics", "hubspot", "budgeting"]
    },
    experience: [
        {
            title: "Marketing Manager",
            company: "Global Brands",
            start_date: "Mar 2018",
            end_date: "Present",
            location: "Remote"
        }
    ],
    education: [
        {
            institution: "Business School",
            degree: "BBA Marketing",
        }
    ]
};
const bullets3 = {
    "Global Brands_Marketing Manager": [
        "Designed and executed 5 national marketing campaigns.",
        "Managed a 500k budget for content strategy.",
        "Boosted seo traffic by 150 percent."
    ]
};

const testCases = [
    {
        cand: profile1,
        bulls: bullets1,
        jdKws: jdKeywords1,
        yoe: 5,
        jdRaw: jdRaw1
    },
    {
        cand: profile2,
        bulls: bullets2,
        jdKws: jdKeywords2,
        yoe: 12,
        jdRaw: jdRaw2
    },
    {
        cand: profile3,
        bulls: bullets3,
        jdKws: jdKeywords3,
        yoe: 8,
        jdRaw: jdRaw3
    }
];

async function run() {
    let allPassed = true;
    let printedOne = false;

    console.log("STARTING STRICT RESUME COMPOSER TESTS...\n");

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];

        const input: ComposeResumeInput = {
            candidate_json: tc.cand as any,
            job_json: { raw_text: tc.jdRaw, top_10_keywords: tc.jdKws },
            bullets: Object.values(tc.bulls).flat().map((b: string) => ({ original: b, rewritten: b, fallback_used: false })),
            meta: {
                years_experience: tc.yoe,
                jd_top_10_keywords: tc.jdKws
            }
        };

        const result = await composeResumeStrictPipeline(input);

        if (!printedOne) {
            console.log("================= FULL COMPOSER RESULT (Comb 1) =================");
            console.log("--- CANDIDATE PROFILE JSON INPUT ---");
            console.log(JSON.stringify(input.candidate_json, null, 2));
            console.log("\n--- COMPOSED OUTPUT (JSON) ---");
            console.log(JSON.stringify(result.output, null, 2));
            console.log("\n--- METADATA ---");
            console.log("Years Experience Computed To Limit:", tc.yoe);

            console.log("\n--- STRICT TEST RESULTS ---");
            if (result.success) {
                console.log("- TEST C-1 (Fact Integrity) PASSED");
                console.log("- TEST C-2 (No New Tokens) PASSED");
                console.log("- TEST C-3 (Keyword Prioritization) PASSED");
                console.log("- TEST C-4 (Length Rule) PASSED");
                console.log("- TEST C-5 (Section Presence) PASSED");
                console.log("- TEST C-6 (Skills Integrity) PASSED");
            } else {
                console.log("FAILED TESTS:");
                result.failedTests.forEach(t => console.log(t));
                allPassed = false;
            }
            console.log("=================================================================\n");
            printedOne = true;
        } else {
            if (result.success) {
                console.log(`Resume Comb ${i + 1} PASSED.`);
            } else {
                console.log(`Resume Comb ${i + 1} FAILED:`, result.failedTests);
                allPassed = false;
            }
        }
    }

    if (allPassed) {
        console.log("\n\nSUCCESS: ALL 3 RESUMES PASSED COMPOSER TESTS.");
    } else {
        console.log("\n\nFAILURE: SOME RESUMES FAILED.");
    }
}

run().catch(console.error);
