/**
 * pipeline.ts
 * Main orchestrator for the Master Profile resume generation pipeline.
 */

import { parsePdfToDynamicResume, parseTextToDynamicResume } from "./parser";
import * as fs from "fs/promises";
import * as path from "path";
import { computeATSScore } from "./ats";
import { assertNotAborted, callLLM } from "./utils";
import {
  MASTER_PROFILE_SYSTEM_PROMPT,
  buildMasterProfileUserPrompt,
  FINAL_OPTIMIZATION_SYSTEM_PROMPT,
  buildFinalOptimizationUserPrompt
} from "./prompts";
import { scanJobDescription } from "./honeypot";
import type {
  GenerateTailoredResumeParams,
  TailoredResumeOutput,
  HoneypotReport,
  MasterProfile,
  ParseResult
} from "./types";

export async function generateTailoredResume(
  params: GenerateTailoredResumeParams
): Promise<TailoredResumeOutput> {
  const { resumePdf, linkedinPdf, linkedinData, jobDescription, abortSignal } = params;
  let honeypotReport: HoneypotReport | undefined;
  console.log("[pipeline] Starting Optimized Master Profile Generation Pipeline...");
  const startTime = Date.now();

  const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

  // =========================================================================
  // BATCH 1: Parallel Parsers + Honeypot Scan
  // =========================================================================
  console.log("[pipeline] BATCH 1: Parallel Parsing + JD Scan...");
  if (params.onProgress) {
    params.onProgress("stage", { stageId: "stage2_resume-parse", name: "Parsing inputs and JD..." });
  }

  const resumeBufferPromise = Buffer.isBuffer(resumePdf)
    ? Promise.resolve(resumePdf)
    : (resumePdf as File).arrayBuffer().then(ab => Buffer.from(ab));

  const [resumeBuffer, honeypotPromise] = await Promise.all([
    resumeBufferPromise,
    scanJobDescription(jobDescription, { allowedTokens: params.allowedTokens, abortSignal })
      .catch(e => {
        if (e instanceof Error && e.name === "AbortError") throw e;
        console.warn("[pipeline] Honeypot scan failed (non-fatal):", e);
        return { detected: false, confidence: 0, reasons: [], flaggedTokens: [], sanitizedJd: jobDescription };
    })
  ]);

  const [resumeParseResult, linkedinParseResult] = await Promise.all([
    parsePdfToDynamicResume(resumeBuffer, abortSignal),
    (async () => {
      if (!linkedinPdf && !linkedinData) return undefined;
      if (linkedinPdf) {
        const linkedinBuffer = Buffer.isBuffer(linkedinPdf)
          ? linkedinPdf
          : Buffer.from(await (linkedinPdf as File).arrayBuffer());
        return parsePdfToDynamicResume(linkedinBuffer, abortSignal);
      }
      return parseTextToDynamicResume(linkedinData as string, abortSignal);
    })()
  ]);

  honeypotReport = await honeypotPromise;
  const safeJobDescription = honeypotReport.sanitizedJd || jobDescription;

  if (params.onProgress) {
    params.onProgress("honeypot", honeypotReport);
    params.onProgress("complete", { stageId: "stage2_resume-parse" });
    params.onProgress("complete", { stageId: "stage3_linkedin-parse" });
  }

  // =========================================================================
  // BATCH 2: Parallel Master Merge + ATS Score
  // =========================================================================
  assertNotAborted(abortSignal);
  console.log("[pipeline] BATCH 2: Master Merge + ATS Scoring...");
  if (params.onProgress) {
    params.onProgress("stage", { stageId: "stage4_master-merge", name: "Synthesizing Profiles..." });
  }

  // ATS context needs parsed resume raw text
  const combinedRawText = (resumeParseResult.rawText + " " + (linkedinParseResult?.rawText || "")).toLowerCase();
  
  const [masterProfileResponse, atsResult] = await Promise.all([
    callLLM(
      [
        { role: "system", content: MASTER_PROFILE_SYSTEM_PROMPT },
        { role: "user", content: buildMasterProfileUserPrompt(resumeParseResult.structured, linkedinParseResult?.structured) }
      ],
      { model, jsonMode: true, abortSignal }
    ),
    computeATSScore({
      skills: [], // We'll compute flat skills from raw text in computeATSScore logic
      experience: [],
      bulletText: combinedRawText
    }, safeJobDescription, abortSignal)
  ]);

  const masterProfile = JSON.parse(masterProfileResponse) as MasterProfile;
  
  if (params.onProgress) {
    params.onProgress("complete", { stageId: "stage4_master-merge" });
    params.onProgress("complete", { stageId: "stage5_jd-parse" });
  }

  // =========================================================================
  // FINAL PASS: Optimized Rewrite (Includes Action categorization)
  // =========================================================================
  assertNotAborted(abortSignal);
  console.log("[pipeline] FINAL PASS: Optimizing and Rewriting Bullets...");
  if (params.onProgress) {
    params.onProgress("stage", { stageId: "stage6_tailor", name: "Final Tailoring..." });
  }
  
  const optimizationPrompt = buildFinalOptimizationUserPrompt(
    masterProfile,
    safeJobDescription,
    {
      required_skills: atsResult.missing_keywords,
      matched_skills: atsResult.matched_keywords
    }
  );

  const finalResponse = await callLLM(
    [
      { role: "system", content: FINAL_OPTIMIZATION_SYSTEM_PROMPT },
      { role: "user", content: optimizationPrompt }
    ],
    { model, jsonMode: true, abortSignal }
  );

  const optimizedResume = JSON.parse(finalResponse) as Omit<TailoredResumeOutput, "missingSkills" | "ats">;

  // Re-calculate missing skills post-optimization for final report (though categorization handled it)
  let finalSkillsFlat: string[] = [];
  if (Array.isArray(optimizedResume.skills)) {
    finalSkillsFlat = optimizedResume.skills;
  } else if (optimizedResume.skills && typeof optimizedResume.skills === 'object') {
    finalSkillsFlat = Object.values(optimizedResume.skills).flat();
  }
  const finalSkillsText = finalSkillsFlat.join(" ").toLowerCase();
  const missingSkillsFinal = atsResult.missing_keywords.filter(kw => !finalSkillsText.includes(kw.toLowerCase()));

  const finalOutput: TailoredResumeOutput = {
    ...optimizedResume,
    missingSkills: missingSkillsFinal,
    autoAddedSkills: [], // In this version, LLM handles it during rewrite
    ats: atsResult,
    honeypot: honeypotReport,
  };

  const duration = Date.now() - startTime;
  console.log(`[pipeline] Optimized pipeline complete in ${duration}ms.`);

  if (params.onProgress) {
    params.onProgress("complete", { stageId: "stage6_tailor" });
  }

  return finalOutput;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countBulletsInMasterProfile(profile: MasterProfile): number {
  let count = 0;
  if (!profile.sections) return count;
  for (const section of profile.sections) {
    for (const entry of section.entries || []) {
      count += (entry.bullets || []).length;
    }
  }
  return count;
}

function countBulletsInOptimizedResume(resume: any): number {
  let count = 0;
  if (!resume.sections) return count;
  for (const section of resume.sections) {
    for (const entry of section.entries || []) {
      count += (entry.bullets || []).length;
    }
  }
  return count;
}
