/**
 * generate-cover-letter-stream/route.ts
 *
 * SSE endpoint that streams cover letter generation progress to the client.
 *
 * Events emitted:
 *   stage    { stageId, name }           — stage started
 *   log      { stageId, log }            — optional log within a stage
 *   complete { stageId }                 — stage finished
 *   done     { status, coverLetter, masterProfile } — pipeline complete
 *   error    { message }                 — any failure
 */

import { auth } from "@clerk/nextjs/server";
import { getJobById, getDefaultResume, getResumeById, updateResume, getLinkedInProfile } from "@/lib/db";
import { parseResumeFromPdf } from "@/lib/openai";
import { callLLM } from "@/lib/resume-generation/utils";
import { MASTER_PROFILE_SYSTEM_PROMPT, buildMasterProfileUserPrompt } from "@/lib/resume-generation/prompts";
import type { MasterProfile } from "@/lib/resume-generation/types";
import { insertCoverLetter } from "@/lib/db";

/* eslint-disable @typescript-eslint/no-explicit-any */

function createSSEStream(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: any) => {
        const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(message));
      };

      try {
        const { userId } = await auth();
        if (!userId) {
          sendEvent("error", { message: "Unauthorized" });
          controller.close();
          return;
        }

        const body = await req.json();
        const { job_id, job_description } = body;

        if (!job_id) {
          sendEvent("error", { message: "Job ID is required" });
          controller.close();
          return;
        }

        // Stage 1: Load Job
        sendEvent("stage", {
          stageId: "stage1_load-job",
          name: "Loading job details...",
        });

        const job = await getJobById(userId, job_id);
        if (!job) {
          sendEvent("error", { message: "Job not found" });
          controller.close();
          return;
        }

        sendEvent("complete", { stageId: "stage1_load-job" });

        // Stage 2: Load Resume
        sendEvent("stage", {
          stageId: "stage2_load-resume",
          name: "Loading your resume...",
        });

        const defaultResume = await getDefaultResume(userId);
        if (!defaultResume) {
          sendEvent("error", { message: "No default resume found" });
          controller.close();
          return;
        }

        const resumeData = await getResumeById(userId, defaultResume.id);
        if (!resumeData) {
          sendEvent("error", { message: "Resume not found" });
          controller.close();
          return;
        }

        sendEvent("complete", { stageId: "stage2_load-resume" });

        // Stage 3: Parse Resume (if needed)
        let parsedResume = resumeData.resume.parsed_json;

        const needsReparsing = !parsedResume ||
          !parsedResume.name ||
          parsedResume.name === 'John Doe' ||
          parsedResume.name === 'Name' ||
          parsedResume.name === '[Your Name]' ||
          (parsedResume.roles?.length === 0 && parsedResume.projects?.length === 0);

        if (needsReparsing && resumeData.file_data) {
          sendEvent("stage", {
            stageId: "stage3_parse-resume",
            name: "Analyzing your resume...",
          });

          parsedResume = await parseResumeFromPdf(resumeData.file_data);
          if (!parsedResume) {
            sendEvent("error", { message: "Failed to parse resume" });
            controller.close();
            return;
          }

          await updateResume(userId, resumeData.resume.id, { parsed_json: parsedResume });
          sendEvent("complete", { stageId: "stage3_parse-resume" });
        } else if (parsedResume) {
          sendEvent("stage", {
            stageId: "stage3_parse-resume",
            name: "Reading resume data...",
          });
          sendEvent("complete", { stageId: "stage3_parse-resume" });
        }

        // Stage 4: Load LinkedIn
        sendEvent("stage", {
          stageId: "stage4_load-linkedin",
          name: "Checking for LinkedIn profile...",
        });

        const linkedInProfile = await getLinkedInProfile(userId);
        const hasLinkedIn = !!linkedInProfile?.parsed_json;

        if (hasLinkedIn) {
          sendEvent("log", {
            stageId: "stage4_load-linkedin",
            log: "LinkedIn profile found - will merge with resume",
          });
        }

        sendEvent("complete", { stageId: "stage4_load-linkedin" });

        // Stage 5: Build Master Profile
        sendEvent("stage", {
          stageId: "stage5_master-profile",
          name: hasLinkedIn ? "Merging resume & LinkedIn into master profile..." : "Building master profile from resume...",
        });

        const masterProfilePrompt = buildMasterProfileUserPrompt(
          parsedResume,
          linkedInProfile?.parsed_json || undefined
        );

        const masterProfileResponse = await callLLM(
          [
            { role: "system", content: MASTER_PROFILE_SYSTEM_PROMPT },
            { role: "user", content: masterProfilePrompt }
          ],
          {
            model: process.env.LLM_MODEL || 'openai/gpt-4o-mini',
            jsonMode: true
          }
        );

        const masterProfile = JSON.parse(masterProfileResponse) as MasterProfile;

        sendEvent("complete", { stageId: "stage5_master-profile" });

        // Stage 6: Generate Cover Letter
        sendEvent("stage", {
          stageId: "stage6_generate-coverletter",
          name: "Writing your personalized cover letter...",
        });

        const today = new Date().toLocaleDateString('en-US', { 
          month: 'long', 
          day: 'numeric', 
          year: 'numeric' 
        });

        const companyAddress = job.companyAddress || null;
        const recipientName = job.recipientName || null;
        const company = job.company || 'the company';
        const jobTitle = job.title || 'the position';

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
${job_description || 'Not provided'}

Write a tailored cover letter using the provided data. Use the provided date, recipient, and company address in the header if available. Do not invent achievements or metrics not present in the profile. Return PLAIN TEXT under 400 words.`;

        const coverLetterText = await callLLM([
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ], {
          model: "gpt-4o-mini",
          temperature: 0.7
        });

        sendEvent("complete", { stageId: "stage6_generate-coverletter" });

        // Stage 7: Save to database
        sendEvent("stage", {
          stageId: "stage7_save",
          name: "Saving cover letter...",
        });

        const contentHtml = `
      <div style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.6; max-width: 700px; color: #000;">
        ${coverLetterText.split('\n\n').map(p => `<p style="margin-bottom: 1em;">${p.replace(/\n/g, '<br>')}</p>`).join('')}
      </div>
    `;

        const coverLetter = await insertCoverLetter(
          userId,
          job_id,
          resumeData.resume.id,
          contentHtml,
          coverLetterText,
          'generated'
        );

        sendEvent("complete", { stageId: "stage7_save" });

        // Done
        sendEvent("done", {
          status: "success",
          coverLetter: {
            id: coverLetter.id,
            content_html: contentHtml,
            content_text: coverLetterText,
          },
          masterProfile: masterProfile
        });

        controller.close();

      } catch (error: any) {
        console.error("[SSE] Cover letter generation error:", error);
        sendEvent("error", { message: error.message || "Generation failed" });
        controller.close();
      }
    }
  });

  return stream;
}

export async function POST(req: Request) {
  const stream = createSSEStream(req);
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}