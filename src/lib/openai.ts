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