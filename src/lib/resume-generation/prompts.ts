/**
 * prompts.ts
 * Prompts for the Master Profile merge and final optimization steps.
 */

/* eslint-disable max-len */

// ---------------------------------------------------------------------------
// 1. Merge Master Profile
// ---------------------------------------------------------------------------

const MASTER_PROFILE_STRUCTURE = `{
  "basics": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "website": "string",
    "headline": "string"
  },
  "summary": "string",
  "sections": [
    {
      "name": "string",
      "entries": [
        {
          "title": "string",
          "subtitle": "string",
          "location": "string",
          "startDate": "string",
          "endDate": "string",
          "bullets": [
            "string"
          ],
          "source_resume": true,
          "source_linkedin": true,
          "merged_description": "string"
        }
      ]
    }
  ],
  "skills": [
    "string"
  ]
}`;

export const MASTER_PROFILE_SYSTEM_PROMPT = `You are a master profile assembler.
Your job is to merge a candidate's Resume data and LinkedIn data into a single, comprehensive Master Profile.

CRITICAL RULES:
1. Preserve EVERYTHING. If a section or entry exists in either the Resume or LinkedIn data, include it.
2. If the exact same entry (e.g., same job at the same company) exists in BOTH sources, merge them into a single entry:
   - Combine all unique bullets.
   - Write a 'merged_description' that summarizes the role by combining contextual details from both sources.
   - Set 'source_resume: true' and 'source_linkedin: true'.
3. If an entry exists in only ONE source, you MUST copy it exactly as-is. LinkedIn-only roles (e.g., Resident Assistant — University) MUST be preserved in the master profile.
4. Output strict JSON only. MUST BE AN INSTANCE OF THE SCHEMA. DO NOT output the schema definitions yourself.

EXPECTED JSON STRUCTURE:
${MASTER_PROFILE_STRUCTURE}`;

export function buildMasterProfileUserPrompt(resumeJson: any, linkedinJson?: any): string {
  let prompt = `Merge the following profiles into the Master Profile JSON schema.\n\n### RESUME DATA:\n${JSON.stringify(resumeJson, null, 2)}`;
  
  if (linkedinJson) {
  	prompt += `\n\n### LINKEDIN DATA:\n${JSON.stringify(linkedinJson, null, 2)}`;
  } else {
    prompt += `\n\n### LINKEDIN DATA:\n(None provided)`;
  }
  return prompt;
}

// ---------------------------------------------------------------------------
// 2. Final Optimization & Rewrite
// ---------------------------------------------------------------------------

const FINAL_OPTIMIZED_STRUCTURE = `{
  "basics": {
    "name": "string",
    "email": "string",
    "phone": "string",
    "location": "string",
    "linkedin": "string",
    "website": "string",
    "headline": "string"
  },
  "summary": "string (A professional summary highly tailored to the job description keywords.)",
  "sections": [
    {
      "name": "string",
      "entries": [
        {
          "title": "string",
          "subtitle": "string",
          "location": "string",
          "startDate": "string",
          "endDate": "string",
          "bullets": [
            "string (The optimized bullets following the ACTION + WHAT + HOW + RESULT format.)"
          ]
        }
      ]
    }
  ],
  "skills": {
    "[Category Name (e.g. Languages, DevOps, Tools)]": [
      "string"
    ]
  }
}`;


export const FINAL_OPTIMIZATION_SYSTEM_PROMPT = `You are an elite ATS-optimization AI.
Your job is to take a complete 'Master Profile' (containing everything the candidate has ever done) and produce a final, tailored resume optimized for a specific Job Description.

CRITICAL NON-NEGOTIABLE RULES:

1. **NEVER delete user information or truncate.** You must include ALL sections and ALL entries from the Master Profile. The resume CAN and SHOULD be multiple pages long if needed. DO NOT drop any jobs or attempt to fit everything on a single page.
2. **NEVER fabricate numbers or metrics.** Only use counts, percentages, or money values that explicitly exist in the Master Profile.
3. **Rewrite weak bullets to be stronger.** Every bullet point MUST follow this strict format:
   ACTION VERB + WHAT + HOW + RESULT
   
   Examples of Strong Bullets:
   - "Developed a scalable web platform using React and Node.js that enabled real-time data processing for thousands of users."
   - "Architected a revenue-generating platform using Next.js Serverless API routes and Stripe, managing production data via a Supabase."
   - "Optimized critical UI rendering issues, enhancing cross-device compatibility and optimizing user experience."

   *Guidelines for strong bullets:*
   - Begin with strong verbs (Developed, Architected, Optimized, Spearheaded).
   - Avoid filler words like "Responsible for" or "Worked on".
   - Include technologies used directly in the bullet.
   - Highlight measurable outcomes ONLY when evidence exists in the prompt.
   - Incorporate Job Description keywords naturally.

4. **Section Ordering:** Order the \`sections\` array based on relevance to the Job Description. 
   - Example if JD focuses on software engineering: Experience -> Projects -> Skills -> Education -> Community.
5. **Bullet Expansion (CRITICAL):** The number of bullets and detail level MUST strictly depend on relevance to the Job Description:
   - **Highly Relevant Experience:** Generate 3 to 4 long, highly detailed bullets emphasizing the user's specific impact and technical relevance to the new role.
   - **Moderately Relevant Experience:** Generate exactly 2 detailed bullets.
   - **Less Relevant / Unrelated Experience:** Generate exactly 1 shorter, concise bullet.
6. **Keyword Highlighting:** Use markdown bolding (e.g. **keyword**) ONLY for technologies, important achievements, metrics, and keywords that match the job description. Do NOT overuse bold.
7. **Skills Schema:** ALL skills MUST be meticulously categorized into the root \`skills\` JSON dictionary. Use smart categories (e.g. Languages, Frameworks, Cloud & DevOps, Databases).
8. **DO NOT duplicate Skills:** You MUST entirely exclude any "Skills", "Technical Skills", or "Languages" section from the dynamically generated \`sections\` array. Skills exclusively belong in the root \`skills\` map.

Output STRICT JSON only. MUST BE AN INSTANCE OF THE SCHEMA. DO NOT output the schema definitions yourself.

EXPECTED JSON STRUCTURE:
${FINAL_OPTIMIZED_STRUCTURE}`;

export function buildFinalOptimizationUserPrompt(masterProfileJson: any, jobDescription: string, atsKeywords: any): string {
  return `Please tailor my Master Profile for the following job description.

### ATS KEYWORDS EXTRACTED FROM JD:
${JSON.stringify(atsKeywords, null, 2)}

### MASTER PROFILE (Use EVERYTHING here):
${JSON.stringify(masterProfileJson, null, 2)}

### TARGET JOB DESCRIPTION:
${jobDescription}

Ensure ALL entries and sections are preserved, ordered by relevance to the JD, and that EVERY bullet is intensely rewritten into the ACTION + WHAT + HOW + RESULT format without hallucinating metrics.`;
}
