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
 *   done     { status, final_resume_json, final_resume_json_one_page?, missingSkills } — pipeline complete
 *   error    { message }                 — any failure
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { auth } from "@clerk/nextjs/server";
import { getDefaultResume, getAllLinkedInProfiles } from "@/lib/db";
import { generateTailoredResume } from "@/lib/resume-generation/pipeline";
import { compactTailoredResumeToOnePage } from "@/lib/resume-generation/one-page-compaction";
import { getS3Client } from "@/lib/s3";
import { toPlainText } from "@/lib/plain-text";
import { checkUsage, incrementUsage } from "@/lib/subscription/check-usage";

export const maxDuration = 120;

/* eslint-disable @typescript-eslint/no-explicit-any */

function createSSEStream(req: Request, userId: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const abortSignal = req.signal;

      const sendEvent = (event: string, data: any) => {
        if (abortSignal.aborted) return;
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          /* client disconnected or stream closed */
        }
      };

      try {

        // ── Parse request body ─────────────────────────────────────
        const body = await req.json();
        const { jobDescription, linkedinData, linkedinProfileUrl, allowedTokens } = body;
        const plainJobDescription = toPlainText(jobDescription);

        if (!plainJobDescription || plainJobDescription.trim().length < 20) {
          sendEvent("error", {
            message: "Job description is required (min 20 characters).",
          });
          controller.close();
          return;
        }

        if (abortSignal.aborted) return;

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
          const s3Response = await s3.send(getCmd, { abortSignal });
          if (!s3Response.Body) throw new Error("Empty body from S3.");
          const byteArray = await s3Response.Body.transformToByteArray();
          resumeBuffer = Buffer.from(byteArray);
        } catch (e: any) {
          if (e?.name === "AbortError" || abortSignal.aborted) return;
          console.error("[generate-tailored-resume-stream] S3 resume fetch error:", e);
          sendEvent("error", {
            message: "Failed to download resume from storage.",
          });
          controller.close();
          return;
        }

        if (abortSignal.aborted) return;

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
              const s3Response = await s3.send(getCmd, { abortSignal });
              if (s3Response.Body) {
                const byteArray = await s3Response.Body.transformToByteArray();
                linkedinPdfBuffer = Buffer.from(byteArray);
                console.log("[route] Successfully retrieved LinkedIn PDF from S3.");
              }
            }
          }
        } catch (e: any) {
          if (e?.name === "AbortError" || abortSignal.aborted) return;
          console.warn("[route] Non-fatal error loading LinkedIn Profile from S3:", e);
        }

        if (abortSignal.aborted) return;

        // ── Stage 2 to 5: Run AI Pipeline ───────────────────────────
        // The pipeline will emit "stage", "log", and "complete" events natively as it executes.
        try {
          const result = await generateTailoredResume({
            resumePdf: resumeBuffer,
            linkedinPdf: linkedinPdfBuffer,
            jobDescription: plainJobDescription,
            linkedinData,
            allowedTokens: Array.isArray(allowedTokens) ? allowedTokens : undefined,
            onProgress: (event, data) => sendEvent(event, data),
            abortSignal,
          });

          // ── Stage 7: Done ──────────────────────────────────────────
          sendEvent("stage", {
            stageId: "stage7_export",
            name: "Finalizing resume...",
          });
          sendEvent("complete", { stageId: "stage7_export" });

          let finalSkills = result.skills || {};
          if (Array.isArray(finalSkills)) {
            finalSkills = { 'Skills': finalSkills };
          }
          
          const payloadResume = {
            ...result,
            skills: finalSkills
          };

          // Hidden one-page variant (no extra SSE stages — runs before `done`)
          // Returns null when the full resume already fits on one page → toggle hidden
          // Hard 90s timeout so `done` always fires even if Puppeteer hangs.
          let finalResumeJsonOnePage: typeof payloadResume | null = null;
          try {
            const compactionTimeout = new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), 90_000)
            );
            const onePageOut = await Promise.race([
              compactTailoredResumeToOnePage(
                { ...result, skills: finalSkills },
                plainJobDescription,
                abortSignal
              ),
              compactionTimeout,
            ]);
            if (onePageOut !== null) {
              let oneSkills = onePageOut.skills || {};
              if (Array.isArray(oneSkills)) {
                oneSkills = { Skills: oneSkills };
              }
              finalResumeJsonOnePage = {
                ...onePageOut,
                skills: oneSkills,
              };
            }
          } catch (onePageErr: any) {
            if (onePageErr?.name === "AbortError" || abortSignal.aborted) {
              throw onePageErr;
            }
            console.error("[generate-tailored-resume-stream] One-page compaction failed:", onePageErr);
          }

          await incrementUsage(userId, 'resumesGenerated');
          sendEvent("done", {
            status: "success",
            final_resume_json: payloadResume,
            final_resume_json_one_page: finalResumeJsonOnePage,
            missingSkills: result.missingSkills,
            ats: result.ats || null,
            honeypot: result.honeypot || null,
            pdfUrl: null,
          });
        } catch (pipelineError: any) {
          if (pipelineError?.name === "AbortError" || abortSignal.aborted) {
            console.log("[generate-tailored-resume-stream] Generation aborted (client cancelled).");
            return;
          }
          console.error("[generate-tailored-resume-stream] Pipeline error:", pipelineError);
          sendEvent("error", {
            message: pipelineError.message || "Resume generation failed.",
          });
        }
      } catch (error: any) {
        if (error?.name === "AbortError") return;
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
  const { userId } = await auth();
  if (!userId) return new Response('Unauthorized', { status: 401 });

  const usageGuard = await checkUsage(userId, 'resumesGenerated');
  if (!usageGuard.allowed) {
    return Response.json(
      { error: usageGuard.reason, feature: 'resumesGenerated', resetDate: usageGuard.resetDate },
      { status: 403 }
    );
  }

  const stream = createSSEStream(req, userId);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
