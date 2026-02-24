import { config } from 'dotenv';
config({ path: '.env.local' });
import { parseJdStrictPipeline } from '../src/lib/gemini-jd-strict';

const jd1 = `Job Description
About the Company
Gemini is a global crypto and Web3 platform founded by Cameron and Tyler Winklevoss in 2014, offering a wide range of simple, reliable, and secure crypto products and services to individuals and institutions in over 70 countries. Our mission is to unlock the next era of financial, creative, and personal freedom by providing trusted access to the decentralized future. We envision a world where crypto reshapes the global financial system, internet, and money to create greater choice, independence, and opportunity for all — bridging traditional finance with the emerging cryptoeconomy in a way that is more open, fair, and secure. As a publicly traded company, Gemini is poised to accelerate this vision with greater scale, reach, and impact.

The Department: Engineering
Gemini is regulated and licensed like a bank, but it’s run like a tech startup, and engineering is the core of the company. There’s a wide range of tough problems to solve at Gemini – from properly securing hundreds of millions of dollars worth of customer funds, to developing innovative new blockchain products, to finding new techniques to combat fraud, to shaving microseconds off our API response times, and everything in between.

All of Gemini’s engineers are able to work across the software platform, not just on their own specialization or subteam. We value a thoughtful, collaborative software development process, coupled with a pragmatic approach to problem solving and delivering software.

The Role: Software Engineering Intern
As a member of our software engineering team, you’ll architect and solve complex problems that will directly influence the direction of the digital asset space. There’s a wide range of problems to solve at Gemini – from properly securing millions of dollars worth of customer funds, to developing innovative new blockchain products, to shaving microseconds off our API response times. We have a strong culture of code reviews, and a focus on security, with the end goal of writing and shipping high-quality code by getting things right the first time. We want to continue building the best product we can as we scale and grow our business. If you get excited about solving technical challenges that directly impact our customers, clients, and the rest of the Gemini team, we’d love to hear from you. There are opportunities for frontend and/or backend work depending on your interests and strengths.

This will be a 12-week summer internship program with 3 days a week in person at our New York City, NY office.

Responsibilities:
Drive the development of new products and features on the Gemini platform, taking ownership of meaningful projects within small, fast-moving teams.
Collaborate closely with senior engineers who will challenge you to raise the bar on design, testing, and scalability while providing mentorship and guidance.
Contribute technical ideas and solutions during planning and design discussions, influencing the direction of key initiatives.
Review and critique code with a focus on correctness, performance, and security - while learning best practices from experienced engineers.
Enhance the reliability, performance, and maintainability of Gemini’s systems through thoughtful refactoring and continuous improvement projects.
Take part in supporting production systems by helping diagnose and resolve alerts or bugs, gaining hands-on experience with real-world operations at scale.
Qualifications:
Currently pursuing a degree in Computer Science, Computer Engineering, or a related field (Bachelor’s, Associate’s, or Master’s).
Passionate about blockchain, digital assets, and the Web3 industry - a genuine drive to make an impact in this space is essential.
Solid understanding of core software engineering and coding concepts, with curiosity to go deeper and learn quickly.
Self-motivated and proactive - you take initiative, ask smart questions, and push projects forward without waiting to be told what to do.

Strong communication skills: able to clearly articulate ideas, provide updates, and collaborate effectively in a team setting.
Open to feedback and committed to growth - willing to challenge yourself, learn from experience, and raise the bar with every project.
Pay Rate : The hourly pay rate for this role is $50/hour in the State of New York, the State of California and the State of Washington. When determining a candidate’s compensation, we consider a number of factors including skillset, experience, job scope, and current market data.

In the United States, we offer a hybrid work approach at our hub offices, balancing the benefits of in-person collaboration with the flexibility of remote work. Expectations may vary by location and role, so candidates are encouraged to connect with their recruiter to learn more about the specific policy for the role. Employees who do not live near one of our hubs are part of our remote workforce.

At Gemini, we strive to build diverse teams that reflect the people we want to empower through our products, and we are committed to equal employment opportunity regardless of race, color, ancestry, religion, sex, national origin, sexual orientation, age, citizenship, marital status, disability, gender identity, or Veteran status. Equal Opportunity is the Law, and Gemini is proud to be an equal opportunity workplace. If you have a specific need that requires accommodation, please let a member of the People Team know.`;

const jd2 = `Senior Frontend Engineer - React
Company: Vercel
Location: Remote (US)
Overview
We are looking for a Senior Frontend Engineer to build the future of the web.
Responsibilities:
- Build performant, accessible React components using NextJS.
- Work closely with design and product teams to deliver beautiful interfaces.
- Write strict TypeScript code and ensure 100% test coverage with Jest.
- Mentor junior developers and lead frontend architecture discussions.
- Debug complex hydration errors and memory leaks in production.

Qualifications:
- 5+ years of software engineering experience.
- Deep expertise in React, TypeScript, and modern CSS (Tailwind).
- Professional experience with NextJS and server-side rendering.
- Ability to work autonomously in a fully remote environment.
- Excellent written communication skills.

Salary: $150000 - $180000 per year.
`;

const jd3 = `Software Engineer, Backend (Mid-level)
Spotify
New York, NY -> Hybrid
Role
You will join the discovery team to build scalable services in Java and Python.

Responsibilities:
- Design and implement gRPC microservices handling millions of requests per second.
- Optimize database queries across Cassandra and PostgreSQL.
- Collaborate with data scientists to productize machine learning models.
- Participate in on-call rotations to maintain high availability.

Requirements:
- 3+ years of experience in backend development.
- Strong proficiency in Java or C++.
- Experience with distributed systems and microservices architectures.
- Knowledge of Kubernetes and Docker.
- Passion for music and audio.
`;

const jd4 = `Lead DevOps Engineer
Airbnb
San Francisco, CA
About the role:
We need a Lead DevOps Engineer to oversee our global infrastructure and lead a team of 4 engineers.

Responsibilities:
- Manage AWS infrastructure using Terraform and Ansible.
- Design CI/CD pipelines in Jenkins and GitHub Actions.
- Ensure strict security compliance across all environments.
- Reduce cloud costs by optimizing resource utilization.
- Lead incident response for critical outages.

Required Skills: AWS, Terraform, Kubernetes, Python, Bash, CI/CD, Leadership
Experience: 8+ years.
`;

const jd5 = `Junior Data Analyst
Stripe
Dublin, Ireland
Job summary
We are looking for a Junior Data Analyst to help us make sense of payments data.

Responsibilities:
- Write complex SQL queries to extract data from Snowflake.
- Build interactive dashboards in Tableau for executives.
- Clean and normalize datasets using Python (Pandas).
- Present findings to non-technical stakeholders weekly.

Requirements:
- 1+ year of data analysis experience or equivalent internships.
- Strong SQL skills.
- Basic understanding of Python.
- Excellent attention to detail.
`;

const jd6 = `Machine Learning Engineer II
Netflix
Los Gatos, CA
The role:
Improve our recommendation algorithms.

Responsibilities:
- Train and deploy deep learning models using PyTorch.
- Build scalable data pipelines in Apache Spark.
- A/B test algorithmic changes against production traffic.
- Publish research papers at top-tier ML conferences.

Requirements:
- Master's degree in Computer Science or related field.
- 4 years of industry ML experience.
- Strong programming skills in Python and Scala.
- Deep knowledge of recommender systems.
`;

const jd7 = `Mid-level Full Stack Developer (Contract)
Acme Corp
Remote

We need a full stack developer for a 6-month contract to rewrite our legacy PHP app to NodeJS and React.

Responsibilities:
- Migrate PHP loops to NodeJS Express controllers.
- Build a new React frontend communicating with GraphQL.
- Ensure feature parity with the legacy application.
- Write documentation for the new API.

Skills: NodeJS, React, GraphQL, PHP, PostgreSQL
Experience: 3-5 years.
`;

const jd8 = `Director of Engineering
Slack
Chicago, IL

Responsibilities:
- Manage multiple engineering teams across different product areas.
- Set technical vision and strategy for the Slack enterprise communication platform.
- Partner with product managers and cross-functional leaders to ensure alignment on roadmaps.
- Hire, retain, and scale a diverse engineering organization.
- Ensure the reliability and scalability of the core messaging infrastructure.

Requirements:
- 10+ years of software engineering experience.
- 5+ years of engineering management experience, managing managers.
- Proven track record of shipping large-scale enterprise SaaS products.
- Deep understanding of distributed systems and high-availability architectures.
`;

const jd9 = `Entry Level Software Engineer
Roblox
San Mateo, CA

Responsibilities:
- Develop new amazing gameplay features using the Luau engine.
- Benchmark and optimize code to run efficiently on mobile devices.
- Collaborate with artists and designers to implement UI components.
- Fix bugs and resolve technical debt in the core engine.

Requirements:
- BS in Computer Science.
- Proficient in Data Structures
- Passion for gaming and user-generated content platforms.
- 0-2 years of experience.
`;

const jd10 = `Mid-level Data Engineer, Data Platform
Uber
Seattle, WA

Responsibilities:
- Design, build, and maintain large-scale batch and real-time data pipelines.
- Implement data quality checks and monitoring systems using Airflow.
- Optimize Spark jobs for performance and cost efficiency.
- Work closely with data scientists to understand data requirements.

Requirements:
- 4+ years of experience in data engineering.
- Proficiency in Java, Scala, or Python.
- Deep expertise in big data technologies: Spark, Hadoop, Hive, Presto.
- Experience with stream processing frameworks like Kafka or Flink.
`;


const jds = [jd1, jd2, jd3, jd4, jd5, jd6, jd7, jd8, jd9, jd10];

async function run() {
    let allPassed = true;
    for (let i = 0; i < jds.length; i++) {
        console.log(`\n================= JD ${i + 1} =================`);
        const result = await parseJdStrictPipeline(jds[i]);

        console.log("Raw JD text (pasted):\n", result.rawTextExtract);
        console.log("\nParsed JSON (raw):\n", JSON.stringify(result.data, null, 2));

        if (result.success) {
            console.log("\nPassed tests list:");
            console.log("- TEST JD-1 (Valid JSON)");
            console.log("- TEST JD-2 (Required Keys)");
            console.log("- TEST JD-3 (Verbatim Keyword Rule)");
            console.log("- TEST JD-4 (Responsibilities Integrity)");
            console.log("- TEST JD-5 (Skill Formatting)");
            console.log("- TEST JD-6 (Seniority Normalization)");
            console.log("- TEST JD-7 (Salary Format)");
            console.log("- TEST JD-8 (Raw Text Echo)");
            console.log("- TEST JD-9 (No Hallucination)");
            console.log("- TEST JD-10 (Deterministic Keyword Count)");
            console.log("\nFailed tests list (if any): None");
        } else {
            console.log("\nFailed tests list:");
            result.failedTests.forEach(t => console.log(t));
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log("\n\nSUCCESS: ALL 10 JDs PASSED ALL STRICT TESTS.");
    } else {
        console.log("\n\nFAILURE: SOME TESTS FAILED.");
    }
}

run();
