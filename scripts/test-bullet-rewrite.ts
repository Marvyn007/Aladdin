import { config } from 'dotenv';
config({ path: '.env.local' });
import { rewriteBulletStrictPipeline, RewriteBulletInput } from '../src/lib/bullet-rewrite-strict';

const jdKeywords1 = ["react", "typescript", "frontend", "optimization", "component"];
const jdText1 = "We need a frontend developer skilled in react and typescript. Focus on optimization and reusable component architecture.";

const profileText1 = "I am a UI developer. I know javascript, html, css. I worked on web applications and performance. Worked on a team of 4 people.";
const bullets1 = [
    "Developed a web app using javascript and html.",
    "Improved page load time for users.",
    "Collaborated with 4 people to deliver features.",
    "Fixed UI bugs and added new buttons.",
    "Wrote unit tests for the application."
];

const jdKeywords2 = ["python", "data", "pipeline", "aws", "architecture"];
const jdText2 = "Looking for data engineer. Must know python, aws, and pipeline architecture.";

const profileText2 = "Data nerd. Python expert. I build backend stuff. Handled 3 databases. Used SQL.";
const bullets2 = [
    "Created an ETL process using python.",
    "Managed 3 relational databases in production.",
    "Optimized queries for faster execution.",
    "Mentored junior engineers on best practices.",
    "Designed schema for new microservice."
];

const jdKeywords3 = ["seo", "marketing", "content", "strategy", "campaigns"];
const jdText3 = "Marketing manager for seo and content strategy. Experience with creating marketing campaigns.";

const profileText3 = "Creative marketer. I wrote blogs and posted on social media. Managed a budget of 10000 dollars. Increased followers by 20 percent.";
const bullets3 = [
    "Wrote daily blog posts for the website.",
    "Managed a marketing budget of 10000 dollars.",
    "Grew social media followers by 20 percent.",
    "Conducted market research for new product launch.",
    "Worked with designers to create ad banners."
];

const testCases = [
    { jdKw: jdKeywords1, jdRaw: jdText1, profText: profileText1, bullets: bullets1 },
    { jdKw: jdKeywords2, jdRaw: jdText2, profText: profileText2, bullets: bullets2 },
    { jdKw: jdKeywords3, jdRaw: jdText3, profText: profileText3, bullets: bullets3 }
];

async function run() {
    let bulletCounter = 0;
    let fullOutputPrinted = false;

    console.log("STARTING STRICT BULLET REWRITE TESTS...");

    for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        for (const b of tc.bullets) {
            bulletCounter++;
            const input: RewriteBulletInput = {
                original_bullet: b,
                top_10_keywords_array: tc.jdKw,
                concatenated_candidate_text: tc.profText,
                jd_raw_text: tc.jdRaw
            };

            const result = await rewriteBulletStrictPipeline(input);

            if (!fullOutputPrinted) {
                console.log("\n================= FULL BULLET TEST OUTPUT =================");
                console.log("--- ORIGINAL BULLET ---");
                console.log(b);
                console.log("--- REWRITTEN JSON OUTPUT ---");
                console.log(JSON.stringify(result.output, null, 2));
                console.log("--- STRICT VALIDATION RESULTS ---");
                if (result.success) {
                    console.log("ALL 6 TESTS PASSED.");
                } else {
                    console.log("FAILED TESTS:");
                    result.failedTests.forEach(t => console.log(t));
                }
                console.log("===========================================================\n");
                fullOutputPrinted = true;
            } else {
                if (result.success) {
                    console.log("Bullet " + bulletCounter + " PASSED.");
                } else {
                    console.log("Bullet " + bulletCounter + " FAILED:", result.failedTests);
                }
            }
        }
    }
}

run().catch(console.error);
