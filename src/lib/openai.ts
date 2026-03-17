import { callLLM } from "./resume-generation/utils";
import { parsePdfToDynamicResume } from "./resume-generation/parser";

/**
 * Wraps the existing resume parser to maintain compatibility with the previous Gemini interface
 * if needed, though it now uses pdf-parse + GPT-4o-mini under the hood.
 */
export async function parseResumeFromPdf(pdfBuffer: Buffer) {
    const result = await parsePdfToDynamicResume(pdfBuffer);
    return mapToLegacyResume(result.structured);
}

/**
 * Maps the new DynamicParsedResume structure back to the legacy ParsedResume schema
 * to maintain compatibility with existing components and database lookups.
 */
function mapToLegacyResume(dynamic: any) {
    return {
        name: dynamic.basics?.name || null,
        email: dynamic.basics?.email || null,
        location: dynamic.basics?.location || null,
        total_experience_years: null,
        roles: (dynamic.sections?.find((s: any) => s.name.toLowerCase().includes('experience') || s.name.toLowerCase().includes('employment'))?.entries || []).map((e: any) => ({
            title: e.title,
            company: e.subtitle,
            start: e.startDate,
            end: e.endDate,
            description: (e.bullets || []).join('\n')
        })),
        education: (dynamic.sections?.find((s: any) => s.name.toLowerCase().includes('education'))?.entries || []).map((e: any) => ({
            degree: e.title,
            school: e.subtitle,
            start: e.startDate || '',
            end: e.endDate || '',
            notes: (e.bullets || []).join('\n')
        })),
        skills: (dynamic.skills || []).map((s: string) => ({
            name: s,
            level: 'intermediate',
            years: null
        })),
        projects: (dynamic.sections?.find((s: any) => s.name.toLowerCase().includes('project'))?.entries || []).map((e: any) => ({
            title: e.title,
            description: (e.bullets || []).join('\n'),
            tech: [],
            link: ''
        })),
        certifications: dynamic.sections?.find((s: any) => s.name.toLowerCase().includes('certif'))?.entries.map((e: any) => e.title) || [],
        open_to: [],
        contact: {
            email: dynamic.basics?.email,
            phone: dynamic.basics?.phone,
            location: dynamic.basics?.location,
            linkedin: dynamic.basics?.linkedin
        }
    };
}

/**
 * Generates a cover letter using OpenAI gpt-4o-mini.
 * 
 * @param masterProfile - The merged Master Profile (from resume + LinkedIn)
 * @param job - Job object containing title, company, companyAddress, recipientName
 * @param jobDescription - Raw job description text
 */
export async function generateCoverLetter(
    masterProfile: any,
    job: any,
    jobDescription?: string
) {
    const today = new Date().toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
    });

    const companyAddress = job.companyAddress || null;
    const recipientName = job.recipientName || null;
    const company = job.company || 'the company';
    const jobTitle = job.title || 'the position';

    // Extract contact info from masterProfile.basics
    const contactInfo = {
        email: masterProfile.basics?.email || null,
        phone: masterProfile.basics?.phone || null,
        website: masterProfile.basics?.website || null,
        linkedin: masterProfile.basics?.linkedin || null
    };

    const systemPrompt = `You are an expert career coach and professional writer specializing in high-conversion cover letters.
Your goal is to write a compelling, tailored cover letter that connects a candidate's specific achievements to the requirements of a job.

CRITICAL RULES:
1. CUSTOMIZATION: Mention the company name ("${company}") and the role ("${jobTitle}") explicitly.
2. TONE: Professional, confident, and enthusiastic. Not overly flowery or subservient.
3. STRUCTURE: 
   - Header with date, recipient info, and company address (use provided data if available)
   - Your contact info (email, phone, LinkedIn, website if provided)
   - Salutation (Dear Hiring Manager or specific name if provided)
   - Opening: Hook the reader by mentioning why you're excited about this specific role/company.
   - Body Paragraphs: Focus on 2-3 specific "impact stories" from the master profile that prove you can solve the problems described in the JD.
   - Closing: Call to action (interview request) and professional sign-off with your name and primary email.
4. LENGTH: Keep it under 400 words. One page length.
5. NO HALLUCINATION: Only use facts, skills, and metrics present in the provided master profile. Do NOT invent specific projects or numbers. If information is not provided, say "information not provided" for that specific field only in the header.
6. FORMATTING: Return PLAIN TEXT. Use double newlines for paragraphs.

HEADER HANDLING:
- If header fields (date, company address, recipient name) are provided in the input, use them verbatim in the cover letter header.
- If those fields are not provided, use "Hiring Manager" and the company name ("${company}") as recipient; do NOT invent address details.
- Include your contact information (email, phone, LinkedIn, website) in the header if provided.

If no job description is provided, write a high-quality general cover letter for the role based on the master profile.`;

    const userPrompt = `
TODAY: ${today}

MASTER PROFILE:
${JSON.stringify(masterProfile, null, 2)}

CONTACT INFO:
${JSON.stringify(contactInfo)}

JOB:
title: ${jobTitle}
company: ${company}
companyAddress: ${companyAddress || 'Not provided'}
recipientName: ${recipientName || 'Not provided'}

JOB DESCRIPTION:
${jobDescription || 'Not provided'}

Write a tailored cover letter using the provided data. Use the provided date, recipient, and company address in the header if available. Do not invent achievements or metrics not present in the profile. Return PLAIN TEXT under 400 words.`;

    const text = await callLLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
    ], {
        model: "gpt-4o-mini",
        temperature: 0.7
    });

    return {
        text,
        provider: "openai"
    };
}

/**
 * Scores a job against a user's resume and LinkedIn profile using GPT-4o-mini.
 */
export async function scoreJob(resume: any, linkedin: any, job: any) {
    const systemPrompt = `You are an expert recruiter. Your task is to score how well a candidate's profile matches a job description.
Return a JSON object with:
1. "match_score": A number from 0 to 100.
2. "why": A brief (1-2 sentence) explanation of the score.

Candidate Profile (Resume):
${JSON.stringify(resume, null, 2)}

Candidate Profile (LinkedIn):
${linkedin ? JSON.stringify(linkedin, null, 2) : 'No LinkedIn profile provided.'}

Job Title: ${job.title}
Job Company: ${job.company}
Job Description:
${job.job_description_plain || job.normalized_text || ''}
`;

    const response = await callLLM([
        { role: "system", content: "You extract score data into JSON. Return ONLY JSON." },
        { role: "user", content: systemPrompt }
    ], {
        model: "gpt-4o-mini",
        temperature: 0.1,
        jsonMode: true
    });

    try {
        const parsed = JSON.parse(response);
        return {
            match_score: parsed.match_score || 0,
            why: parsed.why || "No explanation provided."
        };
    } catch (e) {
        console.error("[OpenAI] Failed to parse scoreJob response:", e);
        return { match_score: 0, why: "Failed to parse scoring response." };
    }
}

/**
 * Verifies the authenticity of a job by comparing provided data with ground truth scrape.
 */
export async function verifyJobAuthenticity(groundTruthDescription: string, providedData: { title: string, company: string, description: string }) {
    const systemPrompt = `You are a cybersecurity and recruitment fraud expert. Compare the provided job data with the ground truth scraped from the source URL.
Check for:
1. Mismatches in Title or Company.
2. Significant discrepancies in the job description that might indicate a scam or misrepresentation.

Ground Truth Description:
${groundTruthDescription}

User Provided Data:
Title: ${providedData.title}
Company: ${providedData.company}
Description:
${providedData.description}

Return a JSON object with:
1. "isAuthentic": boolean
2. "reasoning": A brief explanation of your finding.
`;

    const response = await callLLM([
        { role: "system", content: "You verify job data integrity. Return ONLY JSON." },
        { role: "user", content: systemPrompt }
    ], {
        model: "gpt-4o-mini",
        temperature: 0.1,
        jsonMode: true
    });

    try {
        const parsed = JSON.parse(response);
        return {
            isAuthentic: !!parsed.isAuthentic,
            reasoning: parsed.reasoning || "No reasoning provided."
        };
    } catch (e) {
        console.error("[OpenAI] Failed to parse verifyJobAuthenticity response:", e);
        return { isAuthentic: false, reasoning: "Failed to parse verification response." };
    }
}

/**
 * Processes a batch of jobs and decides which ones should be deleted based on strict criteria.
 * Used for automated cleanup of spam or irrelevant listings.
 */
export async function batchFilterJobs(jobs: any[]) {
    if (!jobs || jobs.length === 0) {
        return { deleteIds: [], reasons: {} };
    }

    const systemPrompt = `You are a job quality auditor. Your task is to identify jobs that should be deleted from a high-quality job board.
Criteria for deletion:
1. SPAM: Obvious promotional content, "make money from home" scams, or non-job content.
2. IRRELEVANT: Jobs that are clearly not for Software Engineering, Product, Design, or Data roles.
3. INCOMPLETE: Description is strictly "view full description" or similar placeholder and cannot be scored.

Return a JSON object with:
1. "deleteIds": An array of job IDs that should be deleted.
2. "reasons": A map of job ID to a short reason for deletion.

Job Data to Analyze:
${jobs.map(j => `ID: ${j.id} | Title: ${j.title} | Company: ${j.company} | Description: ${(j.job_description_plain || j.normalized_text || '').substring(0, 500)}...`).join('\n---\n')}
`;

    const response = await callLLM([
        { role: "system", content: "You audit job quality. Return ONLY JSON." },
        { role: "user", content: systemPrompt }
    ], {
        model: "gpt-4o-mini",
        temperature: 0.1,
        jsonMode: true
    });

    try {
        const parsed = JSON.parse(response);
        return {
            deleteIds: parsed.deleteIds || [],
            reasons: parsed.reasons || {}
        };
    } catch (e) {
        console.error("[OpenAI] Failed to parse batchFilterJobs response:", e);
        return { deleteIds: [], reasons: {} };
    }
}