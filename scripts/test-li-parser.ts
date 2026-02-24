import { config } from 'dotenv';
config({ path: '.env.local' });
import { parseLiStrictPipeline } from '../src/lib/gemini-li-strict';

const li1 = `Contact
mrvnchdhr@gmail.com
www.linkedin.com/in/marvin
chaudhary (LinkedIn)
Top Skills
Next.js
TA-Lib
Full-Stack Development
Languages
Gujarati (Native or Bilingual)
Hindi (Native or Bilingual)
English (Full Professional)
Certifications
CodePath Intermediate Web
Development (WEB102)
Marvin Chaudhary
CS Student @ SEMO
Cape Girardeau, Missouri, United States
Summary
I am a Software Engineering Intern with a passion for building
innovative solutions. I develop software using a range of
technologies including Next.js, React.js, Python, and C++. My
experience spans full-stack development and deep learning
research.
I excel at problem-solving and creating efficient code. I founded the
official hackathon and innovation club at Southeast Missouri State
University, HackLab. Through HackLab, I plan to teach cutting-edge
technologies and coordinate student teams for hackathons. I also
aim to build professional networks for student career advancement.
My current graduate research focuses on Deep Learning in Asset
Allocation in Portfolio Management.
Let's connect and explore how my skills can bring your next project
to life.
Experience
Hacklabs SEMO
President & Founder
September 2025 - Present (3 months)
Cape Girardeau, Missouri, United States- Founded HackLab the official hackathon and innovation club at Southeast
Missouri State University- Planning to teach cutting-edge technologies through workshops and hands
on projects to build real-world skills- Will coordinate student teams for regional and national hackathons- Aiming to establish professional networks to help students advance their
careers
Southeast Missouri State University
1 year 4 months
 Page 1 of 2
  
Undergraduate Researcher
January 2025 - Present (11 months)
Currently assisting with graduate research on Deep Learning in Asset
Allocation in Portfolio Management 
Resident Assistant
August 2024 - Present (1 year 4 months)
Southeast Missouri State University
Information Technology Lab Assistant
January 2023 - May 2024 (1 year 5 months)
Cape Girardeau, Missouri, United States
Education
Southeast Missouri State University
Bachelor's degree, Computer Science (September 2022 - May 2026)`;

const li2 = `Contact
alice.wonder@email.com
www.linkedin.com/in/alicewonder
Top Skills
React
TypeScript
Node.js
Alice Wonder
Senior Frontend Engineer | UI/UX Enthusiast
San Francisco, California, United States
Summary
Passionate frontend engineer with 5+ years of experience building scalable web applications. I love creating intuitive interfaces and solving complex UI challenges using React and TypeScript.
Experience
Tech Innovators Inc.
Senior Frontend Engineer
Mar 2021 - Present
San Francisco, California, United States- Architected the core component library used across multiple flagship products- Mentored junior engineers and conducted weekly code review sessions- Optimized bundle size by 30 percent resulting in faster page loads
Startup XYZ
Frontend Developer
Jan 2018 - Feb 2021
New York- Developed responsive landing pages using React and Tailwind CSS- Integrated third party payment gateways like Stripe and PayPal- Maintained legacy Angular applications during the migration phase
Education
University of California, Berkeley
Bachelor of Science, Computer Science (Aug 2014 - May 2018)`;

const li3 = `Contact
bob.builder@construction.com
Top Skills
Project Management
AutoCAD
Structural Analysis
Bob Builder
Construction Manager & Civil Engineer
Chicago, Illinois, United States
Experience
MegaBuild Corp
Project Manager
Jun 2019 - Present
Chicago, IL- Managed a budget of 50 million dollars for commercial high rise projects- Coordinated with subcontractors architects and city officials daily- Ensured strict compliance with OSHA safety regulations on all sites
City Planners LLC
Civil Engineer
May 2015 - May 2019
Chicago, IL- Designed storm water management systems for residential developments- Conducted structural integrity assessments for bridges and tunnels- Drafted blueprints and technical drawings using AutoCAD software
Education
Illinois Institute of Technology
Master of Engineering, Civil Engineering (Aug 2013 - May 2015)`;

const li4 = `Contact
charlie.data@analytics.net
Top Skills
Python
SQL
Machine Learning
Charlie Data
Data Scientist | Turning data into actionable insights
Boston, Massachusetts, United States
Summary
Data Scientist with a strong background in statistical modeling and machine learning. Experienced in extracting insights from large datasets to drive business decisions.
Experience
Data Insights Co
Data Scientist
Sep 2020 - Present
Boston, MA- Developed predictive models for customer churn resulting in a 15 percent reduction- Designed and implemented A/B tests to optimize website conversion rates- Created interactive dashboards using Tableau for executive stakeholders
Fintech Analytics
Junior Data Analyst
Jul 2018 - Aug 2020
New York, NY- Cleaned and preprocessed large financial datasets using Python and pandas- Wrote complex SQL queries to extract ad hoc reports for the finance team- Automated daily reporting tasks using Python scripts and cron jobs
Education
Massachusetts Institute of Technology
Master of Science, Data Science (Sep 2016 - Jun 2018)`;

const li5 = `Contact
diana.marketing@brand.io
Top Skills
Digital Marketing
SEO
Content Strategy
Diana Marketer
Director of Marketing | Brand Strategist
Austin, Texas, United States
Experience
Global Brands
Director of Marketing
Jan 2022 - Present
Austin, TX- Led a team of 20 marketing professionals across SEO content and design- Managed a global marketing budget exceeding 5 million dollars annually- Launched a successful rebranding campaign increasing brand awareness by 40 percent
Creative Agency
Marketing Manager
Mar 2017 - Dec 2021
San Francisco, CA- Developed content strategies for B2B tech clients driving lead generation- Optimized SEO for client websites resulting in a 50 percent increase in organic traffic- Managed social media campaigns across LinkedIn Twitter and Facebook
Education
University of Texas at Austin
Bachelor of Business Administration, Marketing (Aug 2012 - May 2016)`;

const li6 = `Contact
evan.sales@enterprise.com
Top Skills
B2B Sales
Negotiation
CRM
Evan Sales
Enterprise Account Executive
Seattle, Washington, United States
Summary
Results driven sales professional with a track record of exceeding quotas in the enterprise software space. Skilled in building relationships and closing complex deals.
Experience
Cloud Solutions Inc
Enterprise Account Executive
Feb 2020 - Present
Seattle, WA- Consistently exceeded annual sales quota by 120 percent for three consecutive years- Closed a landmark deal worth 2 million dollars with a Fortune 500 company- Managed the full sales cycle from prospecting to contract negotiation
Software Solutions
Account Executive
Jun 2016 - Jan 2020
Portland, OR- Prospected and generated leads in the mid market software segment- Conducted product demonstrations and presentations customized for client needs- Negotiated contracts and finalizing pricing agreements with procurement teams
Education
University of Washington
Bachelor of Arts, Economics (Sep 2012 - Jun 2016)`;

const li7 = `Contact
fiona.design@creative.net
Top Skills
UI/UX Design
Figma
Adobe Creative Suite
Fiona Designer
Product Designer | Creating user centric experiences
Denver, Colorado, United States
Experience
Design Studio
Lead Product Designer
Apr 2021 - Present
Denver, CO- Led the end to end design process for a new mobile banking application- Conducted user research and usability testing to validate design decisions- Created comprehensive design systems in Figma for seamless developer handoff
Tech Startup
UX Designer
Aug 2018 - Mar 2021
Boulder, CO- Designed wireframes prototypes and high fidelity mockups for web apps- Collaborated with product managers to define feature requirements and user flows- Improved onboarding completion rates by 25 percent through UI redesigns
Education
Rhode Island School of Design
Bachelor of Fine Arts, Graphic Design (Sep 2014 - May 2018)`;

const li8 = `Contact
george.hr@people.org
Top Skills
Talent Acquisition
Employee Relations
HR Strategy
George HR
VP of Human Resources | People & Culture Leader
Atlanta, Georgia, United States
Summary
Human Resources executive dedicated to fostering inclusive cultures and building high performing teams. Expertise in talent acquisition employee relations and organizational development.
Experience
Global Corp
VP of Human Resources
Nov 2019 - Present
Atlanta, GA- Developed and implemented a comprehensive diversity and inclusion strategy globally- Reduced employee turnover by 15 percent through targeted retention programs- Modernized the performance review process shifting to continuous feedback
Tech Enterprise
HR Director
May 2014 - Oct 2019
Atlanta, GA- Managed a team of 10 HR professionals supporting a workforce of 1000 employees- Led the talent acquisition strategy successfully growing the engineering team- Handled complex employee relations issues ensuring legal compliance continuously
Education
Georgia State University
Master of Business Administration (Aug 2010 - May 2012)`;

const li9 = `Contact
hannah.ops@logistics.co
Top Skills
Supply Chain Management
Logistics
Process Improvement
Hannah Operations
Operations Manager | Supply Chain Expert
Dallas, Texas, United States
Experience
Logistics Pro
Operations Manager
Jul 2020 - Present
Dallas, TX- Streamlined warehouse operations leading to a 20 percent increase in throughput- Negotiated shipping rates with major carriers saving 500k annually- Implemented a new inventory management system reducing stockouts significantly
Manufacturing Inc
Supply Chain Analyst
Sep 2016 - Jun 2020
Houston, TX- Analyzed supply chain data to identify bottlenecks and cost saving opportunities- Coordinated with suppliers to ensure timely delivery of raw materials constantly- Developed forecasting models to optimize inventory levels across multiple warehouses
Education
Texas A&M University
Bachelor of Science, Supply Chain Management (Aug 2012 - May 2016)`;

const li10 = `Contact
ian.security@cyber.net
Top Skills
Information Security
Penetration Testing
Network Security
Ian Security
Cybersecurity Analyst | Protecting digital assets
Miami, Florida, United States
Summary
Cybersecurity professional focused on protecting organizations from evolving threats. Experienced in penetration testing vulnerability assessments and security monitoring.
Experience
SecureNet
Security Analyst
Oct 2021 - Present
Miami, FL- Conducted regular vulnerability scans and penetration tests on enterprise networks- Monitored security alerting systems and responded to incidents in real time- Configured firewalls intrusion detection systems and endpoint protection software
Tech Defend
Junior Security Engineer
Feb 2019 - Sep 2021
Orlando, FL- Assisted in the implementation of a zero trust network architecture globally- Performed security audits on web applications and recommended remediation steps- Educated employees on cybersecurity best practices through monthly training sessions
Education
University of Central Florida
Bachelor of Science, Information Technology (Aug 2015 - Dec 2018)`;

const lis = [li1, li2, li3, li4, li5, li6, li7, li8, li9, li10];

async function run() {
    let allPassed = true;
    for (let i = 0; i < lis.length; i++) {
        console.log(`\n================= LI ${i + 1} =================`);
        const result = await parseLiStrictPipeline(lis[i]);

        console.log("Raw LI text (pasted):\n", result.rawTextExtract);
        console.log("\nParsed JSON (raw):\n", JSON.stringify(result.data, null, 2));

        if (result.success) {
            console.log("\nPassed tests list:");
            console.log("- TEST LI-1 (Valid JSON)");
            console.log("- TEST LI-2 (Required Keys)");
            console.log("- TEST LI-3 (Date Format)");
            console.log("- TEST LI-4 (Skills Integrity)");
            console.log("- TEST LI-5 (Positions Bullets)");
            console.log("- TEST LI-6 (No Hallucination)");
            console.log("- TEST LI-7 (Order & Chronology)");
            console.log("- TEST LI-8 (Contact Normalization)");
            console.log("- TEST LI-9 (Recommendations Counts)");
            console.log("- TEST LI-10 (Raw Text Echo)");
            console.log("\nFailed tests list (if any): None");
        } else {
            console.log("\nFailed tests list:");
            result.failedTests.forEach((t: string) => console.log(t));
            allPassed = false;
        }
    }

    if (allPassed) {
        console.log("\n\nSUCCESS: ALL 10 LIs PASSED ALL STRICT TESTS.");
    } else {
        console.log("\n\nFAILURE: SOME TESTS FAILED.");
    }
}

run();
