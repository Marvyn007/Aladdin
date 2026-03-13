/**
 * generate-tailored-resume-stream/route.ts
 *
 * SSE endpoint that streams resume generation progress to the client.
 * Calls the new RAG-based pipeline: generateTailoredResume()
 *
 * Events emitted:
 *   stage    { stageId, name }           — stage started
 *   log      { stageId, log }            — optional log within a stage
 *   complete { stageId }                 — stage finished
 *   done     { status, final_resume_json, missingSkills } — pipeline complete
 *   error    { message }                 — any failure
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@clerk/nextjs/server";
import { getDefaultResume, getAllLinkedInProfiles } from "@/lib/db";
import { generateTailoredResume } from "@/lib/resume-generation/pipeline";
import { getS3Client } from "@/lib/s3";

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
        // ── Auth ───────────────────────────────────────────────────
        const { userId } = await auth();
        if (!userId) {
          sendEvent("error", { message: "Unauthorized" });
          controller.close();
          return;
        }

        // ── Parse request body ─────────────────────────────────────
        const body = await req.json();
        const { jobDescription, linkedinData, linkedinProfileUrl } = body;

        if (!jobDescription || jobDescription.trim().length < 20) {
          sendEvent("error", {
            message: "Job description is required (min 20 characters).",
          });
          controller.close();
          return;
        }

        // ── Stage 1: Load resume from S3 ───────────────────────────
        sendEvent("stage", {
          stageId: "stage1_resume-load",
          name: "Downloading resume PDF...",
        });

        const resume = await getDefaultResume(userId);
        if (!resume?.s3_key) {
          sendEvent("error", {
            message: "No default resume found. Please upload your resume first.",
          });
          controller.close();
          return;
        }

        let resumeBuffer: Buffer;
        try {
          const s3 = getS3Client();
          if (!s3) throw new Error("S3 client not configured.");
          const getCmd = new GetObjectCommand({
            Bucket:
              process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || "",
            Key: resume.s3_key,
          });
          const s3Response = await s3.send(getCmd);
          if (!s3Response.Body) throw new Error("Empty body from S3.");
          const byteArray = await s3Response.Body.transformToByteArray();
          resumeBuffer = Buffer.from(byteArray);
        } catch (e: any) {
          sendEvent("error", {
            message: "Failed to download resume from storage.",
          });
          controller.close();
          return;
        }

        sendEvent("complete", { stageId: "stage1_resume-load" });

        // ── Stage 1.5: Load LinkedIn from S3 (Optional) ────────────
        let linkedinPdfBuffer: Buffer | undefined = undefined;
        try {
          const profiles = await getAllLinkedInProfiles(userId);
          const latestProfile = profiles && profiles.length > 0 ? profiles[0] : null;
          if (latestProfile && latestProfile.s3_key) {
            const s3 = getS3Client();
            if (s3) {
              const getCmd = new GetObjectCommand({
                Bucket: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || "",
                Key: latestProfile.s3_key,
              });
              const s3Response = await s3.send(getCmd);
              if (s3Response.Body) {
                const byteArray = await s3Response.Body.transformToByteArray();
                linkedinPdfBuffer = Buffer.from(byteArray);
                console.log("[route] Successfully retrieved LinkedIn PDF from S3.");
              }
            }
          }
        } catch (e: any) {
          console.warn("[route] Non-fatal error loading LinkedIn Profile from S3:", e);
        }

        // ── Stage 2 to 5: Run AI Pipeline ───────────────────────────
        // The pipeline will emit "stage", "log", and "complete" events natively as it executes.
        try {
          const result = await generateTailoredResume({
            resumePdf: resumeBuffer,
            linkedinPdf: linkedinPdfBuffer,
            jobDescription,
            linkedinData,
            onProgress: (event, data) => sendEvent(event, data),
          });

          // ── Stage 6: Done ──────────────────────────────────────────
          sendEvent("stage", {
            stageId: "stage6_export",
            name: "Finalizing resume...",
          });
          sendEvent("complete", { stageId: "stage6_export" });

          let finalSkills = result.skills || {};
          if (Array.isArray(finalSkills)) {
            finalSkills = { 'Skills': finalSkills };
          }
          
          const payloadResume = {
            ...result,
            skills: finalSkills
          };

          sendEvent("done", {
            status: "success",
            final_resume_json: payloadResume,
            missingSkills: result.missingSkills,
            // ATS scoring from two-pass pipeline
            ats: result.ats || null,
            pdfUrl: null,
          });
        } catch (pipelineError: any) {
          console.error("[generate-tailored-resume-stream] Pipeline error:", pipelineError);
          sendEvent("error", {
            message: pipelineError.message || "Resume generation failed.",
          });
        }
      } catch (error: any) {
        console.error("[generate-tailored-resume-stream] Request error:", error);
        sendEvent("error", {
          message: error.message || "Internal server error.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return stream;
}

export async function POST(req: Request) {
  const stream = createSSEStream(req);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
