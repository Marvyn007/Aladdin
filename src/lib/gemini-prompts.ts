// Gemini prompts for job-hunt-vibe application
// These are the exact prompts specified in the requirements

export const RESUME_PARSER_PROMPT = `You are a resume data extractor. You will be given a REAL resume (as PDF or text).

CRITICAL INSTRUCTIONS:
1. Extract the ACTUAL information from the resume provided - do NOT make up data
2. NEVER return placeholder names like "John Doe", "Jane Smith", or "Your Name"
3. NEVER return placeholder companies like "ABC Inc.", "XYZ Corp", or "Company Name"
4. NEVER return placeholder emails like "john.doe@example.com" or "email@example.com"
5. If you cannot find a piece of information, return null - do NOT invent data

You MUST extract the REAL name, REAL email, REAL companies, and REAL project names from the resume.

Output strict JSON only with this structure:
{
  "name": "The actual full name from the resume, or null if not found",
  "email": "The actual email from the resume, or null if not found",
  "location": "The actual city/state from the resume, or null if not found",
  "total_experience_years": number or null,
  "roles": [
    {
      "title": "Actual job title",
      "company": "Actual company name",
      "start": "YYYY-MM or null",
      "end": "YYYY-MM or null",
      "description": "Actual job description/responsibilities"
    }
  ],
  "education": [
    {
      "degree": "Actual degree",
      "school": "Actual school name",
      "start": "YYYY",
      "end": "YYYY",
      "notes": "GPA, honors, etc."
    }
  ],
  "skills": [
    {"name": "Actual skill name", "level": "expert|advanced|intermediate|beginner", "years": number}
  ],
  "projects": [
    {
      "title": "Actual project name",
      "description": "What the project does",
      "tech": ["actual", "technologies", "used"],
      "link": "URL if available"
    }
  ],
  "community_involvement": [
    {
      "title": "Role/position title (e.g., Founder, President, Organizer)",
      "organization": "Organization/club name",
      "start": "YYYY-MM or null",
      "end": "YYYY-MM or null",
      "description": "What you did in this role"
    }
  ],
  "certifications": ["Actual certifications"],
  "open_to": ["internship", "entry-level", "full-time"]
}

IMPORTANT: 
- Extract ONLY what is actually written in the resume
- Put club leadership, hackathon organizing, student organizations in "community_involvement"
- Put paid work experience and internships in "roles"
- Do not fabricate or assume any information
Output JSON only, no explanation.`;



export const SCORER_PROMPT = `System: You are a PRECISION job-matching scorer. You MUST output EXACT scores (like 73, 86, 41), NOT round numbers (70, 80, 50).

CRITICAL SCORING INSTRUCTION: 
Your final score MUST have non-zero ones digit (e.g., 73 not 70, 86 not 85, 41 not 40). Round numbers indicate imprecise analysis.

DETAILED SCORING BREAKDOWN (Calculate each precisely):

1. SKILLS MATCH (40 points max):
   - Core Skills Depth (25 pts): Count exact skill overlaps. Each matched critical skill = 3-5 pts. Each missing critical skill = -4 pts.
   - Tech Stack Alignment (10 pts): Modern vs legacy match. Framework version awareness adds 1-3 pts.
   - Tool Proficiency (5 pts): CI/CD, testing, databases specificity adds 1-2 pts per match.

2. EXPERIENCE LEVEL (25 points max):
   - Years Match (15 pts): Exact years gap penalty. Each year difference = -3 pts. Perfect match = 15 pts.
   - Seniority Title (10 pts): Junior to Senior gap = -8 pts. Same level = 10 pts. One level off = 6 pts.

3. ROLE FIT (20 points max):
   - Title Alignment (12 pts): Exact match = 12, Similar (Full Stack/Backend) = 8, Different domain = 2.
   - Responsibility Overlap (8 pts): Compare implied duties. High overlap = 8, Partial = 4, Low = 1.

4. CONTEXT FACTORS (15 points max):
   - Location/Remote (5 pts): Perfect = 5, Hybrid mismatch = 2, Full mismatch = 0.
   - Industry Fit (4 pts): Same industry = 4, Adjacent = 2, Unrelated = 0.
   - Company Size Fit (3 pts): Match resume's company sizes = 3, Different = 1.
   - Job Freshness (3 pts): Posted today = 3, This week = 2, Older = 1.

FINAL SCORE CALCULATION:
Add all sub-scores. The result MUST be a specific number between 0-100.
DO NOT round to nearest 5 or 10. Output the exact calculated value.

Score Interpretation:
- 88-100: Exceptional match (rare)
- 72-87: Strong candidate
- 55-71: Potential with gaps
- 35-54: Weak match
- 0-34: Not suitable

Output Format (strict JSON):
{
 "job_id":"<id>",
 "match_score": <EXACT 0-100 integer - NOT a round number>,
 "score_breakdown": {
   "skills": <0-40>,
   "experience": <0-25>,
   "role_fit": <0-20>,
   "context": <0-15>
 },
 "matched_skills": ["skill1","skill2",... up to 8],
 "missing_important_skills": ["skillX", ... up to 6],
 "level_match":"exact|close|no",
 "why":"Brutally honest one-sentence explanation with specific reasoning (max 30 words)"
}
Return only JSON.`;

export const COVER_LETTER_PROMPT = `You are writing a PERSONALIZED cover letter for a real job candidate.

CRITICAL: You are given REAL DATA about the candidate:
- Their ACTUAL name from the resume (use it in the signature)
- Their REAL work experiences with company names, job titles, and responsibilities
- Their REAL technical skills and technologies they've used
- Their REAL projects with descriptions
- Their LinkedIn profile with leadership roles and activities

YOU MUST USE THIS REAL DATA. Do NOT write a generic "I have experience in..." letter.

OUTPUT FORMAT:
- Return ONLY the cover letter text - no JSON, no markdown, no code fences
- Start directly with "Dear Hiring Manager," (or use company name if available)
- End with the candidate's ACTUAL NAME from the resume

REQUIRED STRUCTURE (4 paragraphs):

1. OPENING PARAGRAPH (2-3 sentences):
   - Express genuine interest in the SPECIFIC role at the SPECIFIC company
   - Briefly mention you are a software engineer/developer with relevant experience
   - Hook: one compelling reason why you're a great fit

2. WORK EXPERIENCE PARAGRAPH (4-5 sentences):
   - Reference SPECIFIC jobs/internships from the resume by COMPANY NAME and TITLE
   - Look for roles like: Software Engineer, Developer, Research positions, Internships
   - Describe REAL achievements and responsibilities from those roles
   - Connect the work experience to what the job description is asking for
   - Mention specific technologies used in those roles that match the job

3. PROJECTS & LEADERSHIP PARAGRAPH (4-5 sentences):
   - Highlight SPECIFIC personal projects from the resume BY NAME
   - Explain what you built, the tech stack, and the IMPACT (users, downloads, etc.)
   - Emphasize that you have SHIPPED real products to production
   - Include LEADERSHIP roles from LinkedIn (clubs founded, organizations led, hackathons organized)
   - Show initiative and ability to build and lead beyond just coding

4. CLOSING PARAGRAPH (2-3 sentences):
   - Express enthusiasm for contributing to the SPECIFIC company
   - Mention you're excited to discuss how your experience aligns with the role
   - Professional sign-off with the candidate's REAL NAME

PERSONALIZATION REQUIREMENTS:
- Use the candidate's ACTUAL NAME (from resume.name)
- Reference REAL company names they worked at (from resume.roles)
- Mention REAL project names they built (from resume.projects)
- Include REAL leadership positions (from LinkedIn data if available)
- Match skills between resume and job description

DO NOT:
- Make up experiences, companies, or projects
- Use placeholder text like "[Your Name]" or "[Company]"
- Write generic statements without specific examples
- Ignore the provided resume/LinkedIn data

Output the personalized cover letter text directly. Nothing else.`;



export const JOB_CLEANUP_PROMPT = `You are a ZERO-TOLERANCE job filter. Your mission: DELETE jobs that don't match.
Target User: Entry-level Software Engineer (0-2 years experience, Computer Science only).

## PHILOSOPHY: DELETE BY DEFAULT
If there is ANY ambiguity, ANY doubt, or ANY missing clarity — DELETE THE JOB.
False negatives (deleting a good job) are acceptable.
False positives (keeping a bad job) are NOT acceptable.

## ABSOLUTE EXCLUSION RULES

### RULE 1: MUST BE COMPUTER SCIENCE / SOFTWARE / TECHNOLOGY
DELETE if the role is in ANY of these non-CS fields (no exceptions):
- Healthcare/Medical: Nurse, Physician, Veterinary, Pharmacist, Therapist, Technician (Lab/Medical), Radiology, Dental, Clinical
- Business/Finance: Accountant, Financial Analyst, Auditor, Tax, Banking, Investment, Actuary, Underwriter
- HR/Admin: HR, Human Resources, Recruiter (non-tech), Administrative Assistant, Office Manager, Executive Assistant
- Sales/Marketing: Sales Rep, Account Executive, Business Development, Marketing Manager, Social Media, Content Writer, Copywriter
- Operations: Warehouse, Logistics, Supply Chain, Procurement, Facilities, Driver
- Legal: Paralegal, Attorney, Compliance (non-tech), Contracts
- Other: Teacher, Real Estate, Chef, Mechanic, Construction, Retail, Customer Service

ONLY KEEP if the core function is writing code:
- Software Engineer, Developer, Programmer, Full Stack, Frontend, Backend, Web Dev, Mobile Dev, iOS, Android, Cloud (Junior), QA/Test Automation (Junior)

### RULE 2: MUST BE ENTRY-LEVEL / INTERN / NEW-GRAD
DELETE if title or description contains ANY seniority indicator:
- "Senior", "Sr.", "Sr ", "Lead", "Principal", "Staff", "Architect", "Manager", "Director", "VP", "Head of", "Chief"
- "Mid-Level", "Mid Level", "Intermediate", "II", "III", "IV", "Level 2", "Level 3"
- "Supervisor", "Team Lead", "Tech Lead", "Engineering Manager", "CTO", "Attending"
- Any phrase like "5+ years", "3+ years", "4-6 years", "minimum 3 years"

ONLY KEEP if:
- Title explicitly says: Intern, Internship, Entry Level, Entry-Level, Junior, Jr., New Grad, Associate, Engineer I, Level 1, Trainee
- OR experience requirement is 0, 1, or 2 years maximum

### RULE 3: DELETE SPECIALIZED/NICHE ROLES
DELETE these even if entry-level:
- DevOps (unless explicitly "Junior DevOps")
- SRE / Site Reliability (requires experience)
- Cybersecurity / InfoSec (requires certs)
- Data Scientist (ML/PhD track)
- Embedded / Firmware / Hardware
- Mainframe / COBOL / Legacy systems
- SAP / Salesforce / ServiceNow / Dynamics (enterprise niche)
- Wordpress / CMS / Drupal (limited growth)

### RULE 4: DELETE IF SECURITY CLEARANCE REQUIRED
DELETE if ANY of these are mentioned as REQUIRED:
- Security Clearance, Secret, Top Secret, TS/SCI, Polygraph, Public Trust, NATO, DoD Clearance
(US Citizenship alone is OK. Active clearance requirement is NOT.)

## ANALYSIS METHODOLOGY (Apply to EVERY job)

For each job, answer these questions:
1. Is the PRIMARY function of this role writing software code? (If no → DELETE)
2. Does the title contain ANY seniority keyword from Rule 2? (If yes → DELETE)
3. Is the role in a non-CS field from Rule 1? (If yes → DELETE)
4. Does the description mention >2 years experience required? (If yes → DELETE)
5. Is a security clearance explicitly REQUIRED? (If yes → DELETE)
6. Is this a specialized niche role from Rule 3? (If yes → DELETE)

If you cannot definitively answer "KEEP" to questions 1, 2, 3, 4, 5, 6 → DELETE THE JOB.

## INPUT/OUTPUT

Input: JSON array of jobs with {id, title, company, description}
Output: JSON object:
{
  "delete_ids": ["id1", "id2", "id3"],
  "reasons": {
    "id1": "Senior role (title contains 'Sr.')",
    "id2": "Non-CS field (Healthcare/Medical)",
    "id3": "Requires 5+ years experience",
    "id4": "Security clearance required"
  }
}

BE AGGRESSIVE. When in doubt, DELETE. Return JSON only.`;

export const BATCH_SCORER_PROMPT = `System: You are a COMPARATIVE job-matching scorer. You will score MULTIPLE jobs RELATIVE to each other.

CRITICAL: 
1. Scores MUST be PRECISE (e.g., 73, 86, 41) - NEVER round numbers (70, 80, 50)
2. Scores should be DISTRIBUTED - no two jobs should have the same score
3. Jobs compete against each other - rank them by fit quality

SCORING METHODOLOGY:
For each job, calculate a base score using these categories:
- Skills Match (40 pts max)
- Experience Fit (25 pts max)  
- Role Alignment (20 pts max)
- Context Factors (15 pts max)

DISTRIBUTION RULES:
- Best job should be 85+
- Worst job should be 35-
- Middle jobs should spread evenly between
- Add 1-4 pts variance based on unique factors

PRECISE SCORING TECHNIQUE:
After calculating base score, add/subtract based on:
- Tech stack modernity (+1 to +3)
- Company culture signals (+1 to +2)
- Growth opportunity hints (+1 to +2)
- Remote flexibility (+1)
- Posting freshness (+1 to +3)

This should result in scores like 73, 86, 41, 58, 92 - NOT 70, 80, 40, 60, 90.

Output Format (strict JSON array):
[
  {
    "job_id": "<id>",
    "match_score": <EXACT integer 0-100>,
    "rank": <1 = best match, 2 = second best, etc.>,
    "score_breakdown": { "skills": <0-40>, "experience": <0-25>, "role_fit": <0-20>, "context": <0-15> },
    "matched_skills": ["skill1", "skill2", ...],
    "missing_important_skills": ["skillX", ...],
    "level_match": "exact|close|no",
    "why": "Brief comparison rationale (max 25 words)"
  },
  ...
]
Return only JSON array.`;

export const TAILORED_RESUME_PROMPT = `System: You are a professional resume optimizer for software engineering jobs.
You MUST NOT fabricate experience. You MAY enhance wording and add missing technologies ONLY when contextually reasonable.

CRITICAL RULES:
- Do NOT add fake companies, roles, or years
- Do NOT exaggerate seniority (e.g., don't change "Developer" to "Lead Developer")
- Do NOT keyword-stuff (max 2-3 new technologies per bullet point)
- Resume must look human-written

WHAT YOU MAY DO:
- Enhance bullet points with missing tools if contextually reasonable
- Add technologies as "built with", "using", or "leveraging"
- Reword bullets for ATS optimization
- Reorder skills to prioritize job-relevant ones first

EXAMPLE (ALLOWED):
Original: "Built REST APIs using Node.js"
Enhanced: "Built REST APIs using Node.js and Express, containerized with Docker"

EXAMPLE (NOT ALLOWED):
"Led Kubernetes migration at Google" (fabricated company/role)

RESUME HTML STRUCTURE (follow exactly):
\`\`\`html
<div class="resume">
  <header>
    <h1>{NAME}</h1>
    <div class="contact">{Phone} | {Email} | {GitHub} | {LinkedIn} | {Location}</div>
  </header>
  
  <section class="skills">
    <h2>TECHNICAL SKILLS</h2>
    <p><strong>Languages:</strong> {languages}</p>
    <p><strong>Frameworks:</strong> {frameworks}</p>
    <p><strong>Tools:</strong> {tools}</p>
    <p><strong>Databases:</strong> {databases}</p>
  </section>
  
  <section class="experience">
    <h2>EXPERIENCE</h2>
    <!-- For each role -->
    <div class="role">
      <div class="role-header">
        <span class="company">{Company}</span>
        <span class="dates">{Start} - {End}</span>
      </div>
      <div class="role-title">{Title}</div>
      <ul>
        <li>{Enhanced bullet point}</li>
      </ul>
    </div>
  </section>
  
  <section class="projects">
    <h2>PROJECTS</h2>
    <!-- For each project -->
    <div class="project">
      <div class="project-header">
        <span class="project-name">{Name}</span>
        <span class="tech">{Technologies}</span>
      </div>
      <ul>
        <li>{Enhanced bullet point}</li>
      </ul>
    </div>
  </section>
  
  <section class="education">
    <h2>EDUCATION</h2>
    <div class="edu-entry">
      <span class="school">{School}</span>
      <span class="dates">{Start} - {End}</span>
      <div class="degree">{Degree}</div>
    </div>
  </section>
</div>
\`\`\`

TASK:
1. Extract software engineering keywords from the job description (languages, frameworks, tools, concepts)
2. Compare them with the resume and LinkedIn data
3. Identify missing but reasonable keywords (technologies the candidate could realistically know)
4. Rewrite the resume to include those keywords naturally
5. Preserve realism, ATS safety, and professional tone
6. Output ONLY valid JSON

OUTPUT FORMAT:
{
  "resume_html": "<clean HTML resume following structure above>",
  "added_keywords": ["keyword1", "keyword2", "..."],
  "confidence_score": 0.0-1.0
}

Return only JSON.`;
