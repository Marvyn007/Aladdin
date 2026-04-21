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
  buildFinalOptimizationUserPrompt,
  SKILLS_CATEGORIZATION_SYSTEM_PROMPT,
  buildSkillsCategorizationUserPrompt,
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

  // ── Stage 7: Auto-inject Missing Keywords (with Guaranteed Fallback) ─────────────────────────
  assertNotAborted(abortSignal);
  let finalTailoredResume = optimizedResume as TailoredResumeOutput;
  let autoAddedSkills: string[] = [];

  // 1. Ensure skills is an object
  if (!finalTailoredResume.skills || Array.isArray(finalTailoredResume.skills)) {
    const existing = Array.isArray(finalTailoredResume.skills) ? finalTailoredResume.skills : [];
    finalTailoredResume.skills = { "Skills": existing };
  }

  // 2. Identify what's STILL missing after the rewrite
  const getResumeText = (r: any) => [
    r.summary,
    ...r.sections.flatMap((s: any) => s.entries.flatMap((e: any) => e.bullets)),
    ...Object.values(r.skills).flat()
  ].join(" ").toLowerCase();

  const missingKeywordsBeforeInjection = atsResult.missing_keywords.filter(
    kw => !getResumeText(finalTailoredResume).includes(kw.toLowerCase())
  );

  if (missingKeywordsBeforeInjection.length > 0) {
    console.log(`[pipeline] Injecting ${missingKeywordsBeforeInjection.length} missing keywords...`);
    if (params.onProgress) {
      params.onProgress("stage", { stageId: "stage6_tailor", name: "Injecting Missing Keywords..." });
    }

    let injectionSuccess = false;
    try {
      const categorizationResponse = await callLLM(
        [
          { role: "system", content: SKILLS_CATEGORIZATION_SYSTEM_PROMPT },
          { role: "user", content: buildSkillsCategorizationUserPrompt(finalTailoredResume.skills, missingKeywordsBeforeInjection) }
        ],
        { model, jsonMode: true, abortSignal }
      );
      
      const updatedSkills = JSON.parse(categorizationResponse) as Record<string, string[]>;
      if (updatedSkills && typeof updatedSkills === 'object') {
        finalTailoredResume.skills = updatedSkills;
        injectionSuccess = true;
      }
    } catch (e) {
      console.error("[pipeline] LLM Skill injection failed, falling back to manual:", e);
    }

    // 3. Guaranteed Manual Fallback: Ensure everything is in there
    const postLlmText = getResumeText(finalTailoredResume);
    const stillMissing = missingKeywordsBeforeInjection.filter(kw => !postLlmText.includes(kw.toLowerCase()));
    
    if (stillMissing.length > 0) {
      console.log(`[pipeline] Manual fallback for ${stillMissing.length} skills.`);
      const targetCategory = Object.keys(finalTailoredResume.skills).find(k => k.toLowerCase().includes('skill')) || "Keywords";
      if (!finalTailoredResume.skills[targetCategory]) finalTailoredResume.skills[targetCategory] = [];
      finalTailoredResume.skills[targetCategory] = [...new Set([...finalTailoredResume.skills[targetCategory], ...stillMissing])];
    }

    autoAddedSkills = missingKeywordsBeforeInjection;
  }

  // ── Stage 8: Recalculate Final ATS Score ───────────────────────────
  // We want the score to be 100% accurate to the FINAL content
  const finalFinalResumeText = [
    finalTailoredResume.summary,
    ...finalTailoredResume.sections.flatMap(s => s.entries.flatMap(e => e.bullets)),
    ...Object.values(finalTailoredResume.skills).flat()
  ].join(" ").toLowerCase();

  const matchedFinal: string[] = [];
  const missingFinal: string[] = [];
  const allJdKeywords = [...atsResult.matched_keywords, ...atsResult.missing_keywords];

  for (const kw of allJdKeywords) {
    if (finalFinalResumeText.includes(kw.toLowerCase())) {
      matchedFinal.push(kw);
    } else {
      missingFinal.push(kw);
    }
  }

  const finalKeywordCoverage = allJdKeywords.length > 0 
    ? Math.round((matchedFinal.length / allJdKeywords.length) * 100)
    : 100;

  const finalAtsResult: any = {
    ...atsResult,
    keyword_coverage: finalKeywordCoverage,
    matched_keywords: [...new Set(matchedFinal)],
    missing_keywords: [...new Set(missingFinal)],
    // Recalculate skills match if we have the breakdown, else approximate
    skills_match: Math.max(atsResult.skills_match, finalKeywordCoverage)
  };

  const finalOutput: TailoredResumeOutput = {
    ...finalTailoredResume,
    missingSkills: missingFinal,
    autoAddedSkills: autoAddedSkills,
    ats: finalAtsResult,
    honeypot: honeypotReport,
  };

  const duration = Date.now() - startTime;
  console.log(`[pipeline] Optimized pipeline (with injection) complete in ${duration}ms.`);

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
