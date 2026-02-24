import { computeAtsScoreStrict } from '../src/lib/ats-score-strict';
import { CandidateProfile } from '../src/lib/gemini-merge-strict';

const resBase: CandidateProfile = {
    basics: { email: "test@test.com", phone: "123" },
    summary: "A great engineer.",
    skills: { technical: ["java", "python", "mysql", "react", "node"], tools: ["aws"], soft: ["agile"] },
    experience: [
        {
            title: "Software Engineer",
            company: "Google",
            start_date: "Jan 2020",
            end_date: "Present",
            bullets: ["Built scalable backend systems", "Optimized 5 processes using java"]
        }
    ],
    education: [{ institution: "MIT", degree: "BS" }],
    projects: [],
    certifications: []
};

// 5 combos
const combos = [
    {
        // C1: good match
        j: { top_25_keywords: ["java", "python", "aws", "react", "scalable", "backend"], required_skills: ["java", "python", "aws"] },
        r: JSON.parse(JSON.stringify(resBase))
    },
    {
        // C2: empty required skills -> jobMatch = 0
        j: { top_25_keywords: ["go", "rust", "c++"], required_skills: [] },
        r: JSON.parse(JSON.stringify(resBase))
    },
    {
        // C3: formatting fails (fat bullet, duplicate)
        j: { top_25_keywords: ["java"], required_skills: ["java"] },
        r: {
            ...JSON.parse(JSON.stringify(resBase)),
            experience: [
                {
                    bullets: [
                        "Built things.",
                        "Built things.",
                        "This is an extremely long bullet that definitely goes absolutely way over the forty word limit by just rambling on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on."
                    ]
                }
            ]
        }
    },
    {
        // C4: missing email/phone penalty, no edu
        j: { top_25_keywords: ["python"], required_skills: ["python"] },
        r: {
            ...JSON.parse(JSON.stringify(resBase)),
            basics: { linkedin_url: "url" }, // no email/phone
            education: []
        }
    },
    {
        // C5: content quality zeroes out (no action verbs, no numbers)
        j: { top_25_keywords: ["node"], required_skills: ["node"] },
        r: {
            ...JSON.parse(JSON.stringify(resBase)),
            experience: [{ bullets: ["stuff happened here without numbers", "my team did work"] }]
        }
    }
];

function isDeepEqual(obj1: any, obj2: any): boolean {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}

function run() {
    let allPassed = true;

    for (let i = 0; i < combos.length; i++) {
        console.log(`\n================= ATS SCORING RUN ${i + 1} =================`);
        const { r, j } = combos[i];

        const failedTests: string[] = [];

        // Output parts
        console.log("-> Candidate Profile:", JSON.stringify({ summary: r.summary, exp_bullets: r.experience?.flatMap((e: any) => e.bullets) }));
        console.log("-> JD top_25 & required:", j);

        const result = computeAtsScoreStrict(r, j);
        console.log("-> Final Score Result:\n", JSON.stringify(result, null, 2));

        // TEST S-1: Determinism
        const run2 = computeAtsScoreStrict(JSON.parse(JSON.stringify(r)), JSON.parse(JSON.stringify(j)));
        if (!isDeepEqual(result, run2)) {
            failedTests.push(`TEST S-1 FAILED: Score not strictly deterministic. Double run yielded different results.`);
        }

        // TEST S-2: Keyword Validation
        const resText = [
            (r.summary || ""),
            [
                ...(r.skills?.technical || []),
                ...(r.skills?.tools || []),
                ...(r.skills?.soft || [])
            ].join(' '),
            (r.experience || []).flatMap((e: any) => e.bullets || []).join(' ')
        ].join(' ').toLowerCase();

        for (const m of result.keyword_matches) {
            if (!j.top_25_keywords.includes(m.keyword)) {
                failedTests.push(`TEST S-2 FAILED: Matched keyword "${m.keyword}" not in JD top_25_keywords.`);
            }
            if (!resText.includes(m.keyword.toLowerCase())) {
                failedTests.push(`TEST S-2 FAILED: Matched keyword "${m.keyword}" not verbatim in Candidate Profile.`);
            }
        }

        // TEST S-3: Score Bounds
        const b = result.category_breakdown;
        let boundsError = false;
        if (b.KeywordMatch < 0 || b.KeywordMatch > 40) boundsError = true;
        if (b.SectionCompleteness < 0 || b.SectionCompleteness > 20) boundsError = true;
        if (b.FormattingSafety < 0 || b.FormattingSafety > 15) boundsError = true;
        if (b.ContentQuality < 0 || b.ContentQuality > 15) boundsError = true;
        if (b.JobMatchRelevance < 0 || b.JobMatchRelevance > 10) boundsError = true;

        const sum = b.KeywordMatch + b.SectionCompleteness + b.FormattingSafety + b.ContentQuality + b.JobMatchRelevance;
        if (sum !== result.ats_score) boundsError = true;
        if (result.ats_score > 100) boundsError = true;

        if (boundsError) {
            failedTests.push(`TEST S-3 FAILED: Score boundary violation or sum mismatch. Breakdown: ${JSON.stringify(b)}, Total: ${result.ats_score}`);
        }

        // TEST S-4: Required Skills Influence
        if ((j.required_skills || []).length === 0) {
            if (b.JobMatchRelevance !== 0) {
                failedTests.push(`TEST S-4 FAILED: JD required skills is empty, but JobMatchRelevance is ${b.JobMatchRelevance}`);
            }
        }

        // TEST S-5: Monotonicity
        // Inject 5 JD keywords into summary that weren't necessarily there
        const injectKeywords = ["monotonicity", "test", "keyword", "injection", "engine"];
        const jCopy = JSON.parse(JSON.stringify(j));
        const rCopy = JSON.parse(JSON.stringify(r));
        jCopy.top_25_keywords.push(...injectKeywords);
        rCopy.summary = (rCopy.summary || "") + " " + injectKeywords.join(" ");

        const injectedRun = computeAtsScoreStrict(rCopy, jCopy);
        if (injectedRun.category_breakdown.KeywordMatch <= result.category_breakdown.KeywordMatch) {
            failedTests.push(`TEST S-5 FAILED: KeywordMatch did not strictly increase after injecting 5 matching keywords. Initial: ${result.category_breakdown.KeywordMatch}, Injected: ${injectedRun.category_breakdown.KeywordMatch}`);
        }

        if (failedTests.length === 0) {
            console.log("\nPassed tests list:");
            console.log("- TEST S-1 (Determinism)");
            console.log("- TEST S-2 (Keyword Validation)");
            console.log("- TEST S-3 (Score Bounds)");
            console.log("- TEST S-4 (Required Skills Influence)");
            console.log("- TEST S-5 (Monotonicity)");
            console.log("\nFailed tests list (if any): None");
        } else {
            console.log("\nFailed tests list:");
            failedTests.forEach(t => console.log(t));
            allPassed = false;
        }

    }

    if (allPassed) {
        console.log("\n\nSUCCESS: ALL 5 ATS SCORE COMBOS PASSED ALL STRICT TESTS.");
    } else {
        console.log("\n\nFAILURE: SOME TESTS FAILED.");
    }
}

run();
