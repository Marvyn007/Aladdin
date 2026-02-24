import { config } from 'dotenv';
config({ path: '.env.local' });
import { runFinalIntegrityAudit, IntegrityAuditInput } from '../src/lib/resume-integrity-strict';

const okResume = `
# John Doe
john@example.com | 123-456-7890 | NYC

## Summary
Experienced engineer with 5 years building scalable web applications. Strong focus on optimal architecture.

## Skills
react, typescript, optimization, scalable architecture

## Experience
### Frontend Engineer - Tech Corp
*Jan 2020 - Present* | NYC

- Led development of a new react component library.
- Improved typescript architecture significantly.
- Reduced bundle size by 30 percent.

## Education
### State University
BS Computer Science | *Aut 2016 - Spr 2020*
`;

const badResume = `
# John Doe
john@example.com | 123-456-7890 | NYC

## Summary
Experienced engineer with 5 years building scalable web applications. Strong focus on optimal architecture.

## Summary
Wait this is a duplicate summary!

## Skills
react, typescript, optimization, scalable architecture

## Experience
### Frontend Engineer - Tech Corp
*Jan 2020 - Present* | NYC

- Led development of a new react component library.
- Led development of a new react component library.
- Improved typescript architecture significantly using react react react react react react react.
- This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long sentence that exceeds thirty five words completely breaking formatting rules and looking extremely ugly to any human reader who comes across it.
- Broken bullet ### syntax here.

## Education
### State University
BS Computer Science | *Aut 2016 - Spr 2020*
`;

async function run() {
    console.log("STARTING STRICT STAGE 6 INTEGRITY AUDIT TESTS...\n");

    const inputOk: IntegrityAuditInput = {
        final_markdown_resume: okResume,
        jd_top_10_keywords: ["react", "typescript", "optimization", "component"]
    };

    console.log("RUN 1: Perfectly Formatted Resume");
    const res1 = await runFinalIntegrityAudit(inputOk);
    console.log("Integrity Passed:", res1.integrity_passed);
    console.log("Severity:", res1.severity);
    console.log("Issues:", res1.issues);
    console.log("\n----------------------------------------------------------\n");

    console.log("RUN 2: Malformed Resume (Duplicate Sections, Duplicate Bullets, Stuffing, Readability, Broken Formatting)");
    const inputBad: IntegrityAuditInput = {
        final_markdown_resume: badResume,
        jd_top_10_keywords: ["react", "typescript", "optimization", "component"]
    };

    const res2 = await runFinalIntegrityAudit(inputBad);
    console.log("Integrity Passed:", res2.integrity_passed);
    console.log("Severity:", res2.severity);
    console.log("Issues Logged:");
    res2.issues.forEach(i => console.log(" - " + i));
    console.log("\n----------------------------------------------------------\n");

}

run().catch(console.error);
