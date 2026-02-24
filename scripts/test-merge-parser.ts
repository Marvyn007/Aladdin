import { mergeProfilesStrict } from '../src/lib/gemini-merge-strict';

const res1 = {
    raw_text: "Software Engineer at Google. Jan 2020 to Present. Built a cool app.",
    summary: "A great engineer.",
    skills: { technical: ["java", "python"], tools: [], soft: [] },
    experience: [
        {
            title: "Software Engineer",
            company: "Google",
            start_date: "Jan 2020",
            end_date: "Present",
            bullets: ["Built a cool app."]
        }
    ],
    education: [],
    projects: [],
    certifications: []
};
const jd1 = {
    raw_text: "Looking for react developer. Top skills react, javascript, java.",
    top_25_keywords: ["react", "javascript", "java"]
};
const li1 = {
    raw_text: "Software Engineer at Google. Jan 2020 Present. I used react and javascript. I am AWS Certified.",
    skills: [
        { skill: "React", endorsements: "1" },
        { skill: "JavaScript", endorsements: "2" }
    ],
    positions: [
        {
            title: "Software Engineer",
            company: "Google",
            start_date: "Jan 2020",
            end_date: "Present",
            bullets: ["I used react and javascript."]
        }
    ],
    certifications: [
        { name: "AWS Certified" }
    ]
};

const res2 = {
    raw_text: "Data Scientist at Meta. Feb 2019 to Dec 2022. Worked on ML.",
    summary: "Data person.",
    skills: { technical: ["python", "sql"], tools: [], soft: [] },
    experience: [
        {
            title: "Data Scientist",
            company: "Meta",
            start_date: "Feb 2019",
            end_date: "Dec 2022",
            bullets: ["Worked on ML."]
        }
    ],
    education: [], projects: [], certifications: []
};
const jd2 = {
    raw_text: "We want spark and hadoop.",
    top_25_keywords: ["spark", "hadoop", "sql"]
};
const li2 = {
    raw_text: "Data Scientist Meta Feb 2019 Dec 2022. Handled spark and hadoop pipelines.",
    skills: [
        { skill: "Spark", endorsements: "" },
        { skill: "Hadoop", endorsements: "5" }
    ],
    positions: [
        {
            title: "Data Scientist",
            company: "Meta",
            start_date: "Feb 2019",
            end_date: "Dec 2022",
            bullets: ["Handled spark and hadoop pipelines."]
        }
    ],
    certifications: []
};

const res3 = {
    raw_text: "Frontend Dev at Startup. Mar 2021 to Present. Made UI.",
    summary: "UI person.",
    skills: { technical: ["html", "css"], tools: [], soft: [] },
    experience: [
        {
            title: "Frontend Dev",
            company: "Startup",
            start_date: "Mar 2021",
            end_date: "Present",
            bullets: ["Made UI."]
        }
    ],
    education: [], projects: [], certifications: []
};
const jd3 = {
    raw_text: "Need vue and figma.",
    top_25_keywords: ["vue", "figma", "css"]
};
const li3 = {
    raw_text: "Frontend Dev Startup Mar 2021 Present. Designed in Figma and built with Vue.",
    skills: [
        { skill: "Vue", endorsements: "10" },
        { skill: "Figma", endorsements: "4" }
    ],
    positions: [
        {
            title: "Frontend Dev",
            company: "Startup",
            start_date: "Mar 2021",
            end_date: "Present",
            bullets: ["Designed in Figma and built with Vue."]
        }
    ],
    certifications: []
};

const res4 = {
    raw_text: "Backend Eng at Amazon. 2018 to 2020. AWS stuff.",
    summary: "Backend.",
    skills: { technical: ["node"], tools: ["aws"], soft: [] },
    experience: [
        {
            title: "Backend Eng",
            company: "Amazon",
            start_date: "Jan 2018",
            end_date: "Dec 2020",
            bullets: ["AWS stuff."]
        }
    ],
    education: [], projects: [], certifications: []
};
const jd4 = {
    raw_text: "Serverless lambda terraform.",
    top_25_keywords: ["serverless", "lambda", "terraform"]
};
const li4 = {
    raw_text: "Backend Eng Amazon Jan 2018 Dec 2020. Built serverless lambda apps with terraform.",
    skills: [
        { skill: "Serverless", endorsements: "" },
        { skill: "Terraform", endorsements: "2" }
    ],
    positions: [
        {
            title: "Backend Eng",
            company: "Amazon",
            start_date: "Jan 2018",
            end_date: "Dec 2020",
            bullets: ["Built serverless lambda apps with terraform."]
        }
    ],
    certifications: []
};

const res5 = {
    raw_text: "Manager at Apple. 2021-2023. Managed team.",
    summary: "Leader.",
    skills: { technical: [], tools: ["jira"], soft: ["leadership"] },
    experience: [
        {
            title: "Manager",
            company: "Apple",
            start_date: "Jan 2021",
            end_date: "Dec 2023",
            bullets: ["Managed team."]
        }
    ],
    education: [], projects: [], certifications: []
};
const jd5 = {
    raw_text: "Agile scrum.",
    top_25_keywords: ["agile", "scrum", "leadership"]
};
const li5 = {
    raw_text: "Manager Apple Jan 2021 Dec 2023. Led agile scrum planning.",
    skills: [
        { skill: "Agile", endorsements: "12" },
        { skill: "Scrum", endorsements: "8" }
    ],
    positions: [
        {
            title: "Manager",
            company: "Apple",
            start_date: "Jan 2021",
            end_date: "Dec 2023",
            bullets: ["Led agile scrum planning."]
        }
    ],
    certifications: []
};

const combos = [
    { r: res1, j: jd1, l: li1 },
    { r: res2, j: jd2, l: li2 },
    { r: res3, j: jd3, l: li3 },
    { r: res4, j: jd4, l: li4 },
    { r: res5, j: jd5, l: li5 },
];

function run() {
    let allPassed = true;
    for (let i = 0; i < combos.length; i++) {
        console.log(`\n================= MERGE RUN ${i + 1} =================`);
        const { r, j, l } = combos[i];

        // Output parts
        console.log("-> Resume JSON (original):", JSON.stringify(r.experience, null, 2));
        console.log("-> LinkedIn JSON:", JSON.stringify(l.positions, null, 2));
        console.log("-> JD top_25_keywords:", j.top_25_keywords);

        const result = mergeProfilesStrict(r, j, l);

        console.log("-> Merged candidate_profile JSON:", JSON.stringify(result.candidate_profile, null, 2));

        if (result.success) {
            console.log("\nPassed tests list:");
            console.log("- TEST M-1 (Resume Integrity)");
            console.log("- TEST M-2 (No New Positions)");
            console.log("- TEST M-3 (Skill Legitimacy)");
            console.log("- TEST M-4 (Bullet Integrity)");
            console.log("- TEST M-5 (No Hallucination)");
            console.log("\nFailed tests list (if any): None");
        } else {
            console.log("\nFailed tests list:");
            result.failedTests.forEach(t => console.log(t));
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log("\n\nSUCCESS: ALL 5 COMBOS PASSED ALL STRICT TESTS.");
    } else {
        console.log("\n\nFAILURE: SOME TESTS FAILED.");
    }
}

run();
