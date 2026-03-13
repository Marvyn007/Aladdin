/**
 * pipeline.ts
 * Main orchestrator for the Master Profile resume generation pipeline.
 */

import { parsePdfToDynamicResume, parseTextToDynamicResume } from "./parser";
import * as fs from "fs/promises";
import * as path from "path";
import { computeATSScore } from "./ats";
import { callLLM } from "./utils";
import {
  MASTER_PROFILE_SYSTEM_PROMPT,
  buildMasterProfileUserPrompt,
  FINAL_OPTIMIZATION_SYSTEM_PROMPT,
  buildFinalOptimizationUserPrompt
} from "./prompts";
import type {
  GenerateTailoredResumeParams,
  TailoredResumeOutput,
  MasterProfile,
  ParseResult
} from "./types";

export async function generateTailoredResume(
  params: GenerateTailoredResumeParams
): Promise<TailoredResumeOutput> {
  const { resumePdf, linkedinPdf, linkedinData, jobDescription } = params;
  console.log("[pipeline] Starting Master Profile Generation Pipeline...");
  const startTime = Date.now();

  const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

  // =========================================================================
  // STEP 1 & 2: Parse Original PDFs (Dynamic Sections)
  // =========================================================================
  console.log("[pipeline] STEP 1: Parsing Base Resume...");
  if (params.onProgress) {
    params.onProgress("stage", { stageId: "stage2_resume-parse", name: "Parsing resume PDF..." });
    params.onProgress("log", { stageId: "stage2_resume-parse", log: "Extracting text and structuring resume data..." });
  }

  const resumeBuffer = Buffer.isBuffer(resumePdf)
    ? resumePdf
    : Buffer.from(await (resumePdf as File).arrayBuffer());
  const resumeParseResult: ParseResult = await parsePdfToDynamicResume(resumeBuffer);

  if (params.onProgress) {
    params.onProgress("complete", { stageId: "stage2_resume-parse" });
  }

  const tempDir = path.join(process.cwd(), "temp");
  await fs.mkdir(tempDir, { recursive: true });
  await fs.writeFile(path.join(tempDir, "temp-resume.json"), JSON.stringify(resumeParseResult.structured, null, 2));

  let linkedinParseResult: ParseResult | undefined = undefined;
  if (linkedinPdf || linkedinData) {
    console.log("[pipeline] STEP 2: Parsing LinkedIn Data...");
    if (params.onProgress) {
      params.onProgress("stage", { stageId: "stage3_linkedin-parse", name: "Parsing LinkedIn profile..." });
      params.onProgress("log", { stageId: "stage3_linkedin-parse", log: "Extracting and structuring LinkedIn profile data..." });
    }

    if (linkedinPdf) {
      const linkedinBuffer = Buffer.isBuffer(linkedinPdf)
        ? linkedinPdf
        : Buffer.from(await (linkedinPdf as File).arrayBuffer());
      linkedinParseResult = await parsePdfToDynamicResume(linkedinBuffer);
    } else if (linkedinData) {
      linkedinParseResult = await parseTextToDynamicResume(linkedinData);
    }
    await fs.writeFile(path.join(tempDir, "temp-linkedin.json"), JSON.stringify(linkedinParseResult?.structured, null, 2));

    if (params.onProgress) {
      params.onProgress("complete", { stageId: "stage3_linkedin-parse" });
    }
  }

  // =========================================================================
  // STEP 3 & 4: Build MASTER PROFILE (TEMP RESUME)
  // =========================================================================
  console.log("[pipeline] STEP 3+4: Building Master Profile...");
  if (params.onProgress) {
    params.onProgress("stage", { stageId: "stage4_master-merge", name: "Merging and Rewriting Profiles..." });
    params.onProgress("log", { stageId: "stage4_master-merge", log: "Merging Base + LinkedIn into Master Profile..." });
  }

  const masterProfilePrompt = buildMasterProfileUserPrompt(
    resumeParseResult.structured,
    linkedinParseResult?.structured
  );

  const masterProfileResponse = await callLLM(
    [
      { role: "system", content: MASTER_PROFILE_SYSTEM_PROMPT },
      { role: "user", content: masterProfilePrompt }
    ],
    {
      model,
      jsonMode: true
    }
  );

  const masterProfile = JSON.parse(masterProfileResponse) as MasterProfile;
  const originalBulletCount = countBulletsInMasterProfile(masterProfile);
  console.log(`[pipeline] Master Profile created with ${originalBulletCount} total bullets.`);
  await fs.writeFile(path.join(tempDir, "temp-merged.json"), JSON.stringify(masterProfile, null, 2));

  // =========================================================================
  // STEP 5: Analyze Job Description 
  // =========================================================================
  console.log("[pipeline] STEP 5: Analyzing Job Description...");
  if (params.onProgress) {
    params.onProgress("stage", { stageId: "stage5_jd-parse", name: "Analyzing Job Description..." });
    params.onProgress("log", { stageId: "stage5_jd-parse", log: "Extracting ATS keywords from the Job Description..." });
  }

  // Combine all raw text for ATS analysis
  const combinedRawText = (resumeParseResult.rawText + " " + (linkedinParseResult?.rawText || "")).toLowerCase();
  
  let allMasterSkillsFlat: string[] = [];
  if (Array.isArray(masterProfile.skills)) {
    allMasterSkillsFlat = masterProfile.skills;
  } else if (masterProfile.skills && typeof masterProfile.skills === 'object') {
    allMasterSkillsFlat = Object.values(masterProfile.skills).flat();
  }
  
  const atsContext = {
    skills: allMasterSkillsFlat,
    experience: [], // Not strictly needed for ATS missing skills, rely on raw text
    bulletText: combinedRawText 
  };
  
  const atsResult = await computeATSScore(atsContext, jobDescription);
  console.log(`[pipeline] ATS analysis complete. Missing skills: ${atsResult.missing_keywords.length}`);

  if (params.onProgress) {
    params.onProgress("complete", { stageId: "stage5_jd-parse" });
  }

  // =========================================================================
  // STEP 6, 7, 8, 9: Resume Optimization (Full Rewrite)
  // =========================================================================
  console.log("[pipeline] STEP 6-9: Optimizing and Rewriting Bullets (ACTION + WHAT + HOW + RESULT)...");
  if (params.onProgress) {
    params.onProgress("stage", { stageId: "stage6_tailor", name: "Generating Tailored Resume..." });
    params.onProgress("log", { stageId: "stage6_tailor", log: "Running ATS Optimization Pass..." });
  }
  
  const optimizationPrompt = buildFinalOptimizationUserPrompt(
    masterProfile,
    jobDescription,
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
    {
      model,
      jsonMode: true
    }
  );

  const optimizedResume = JSON.parse(finalResponse) as Omit<TailoredResumeOutput, "missingSkills" | "ats">;

  // Validate no massive drop
  const finalBulletCount = countBulletsInOptimizedResume(optimizedResume);
  console.log(`[pipeline] Final Optimized Resume created with ${finalBulletCount} total bullets.`);
  if (finalBulletCount < originalBulletCount) {
    console.warn(`[pipeline] WARNING: The optimized resume has ${originalBulletCount - finalBulletCount} fewer bullets than the master profile. The LLM was instructed not to drop data.`);
  }

  if (params.onProgress) {
    params.onProgress("complete", { stageId: "stage6_tailor" });
  }

  // =========================================================================
  // STEP 10: Output JSON Format & Auto-categorize Skills
  // =========================================================================
  console.log("[pipeline] STEP 10: Packaging Final Output...");
  
  // Re-calculate missing skills post-optimization
  let finalSkillsFlat: string[] = [];
  if (Array.isArray(optimizedResume.skills)) {
    finalSkillsFlat = optimizedResume.skills;
  } else if (optimizedResume.skills && typeof optimizedResume.skills === 'object') {
    finalSkillsFlat = Object.values(optimizedResume.skills).flat();
  }
  const finalSkillsText = finalSkillsFlat.join(" ").toLowerCase();
  const missingSkillsFinal = atsResult.missing_keywords.filter(kw => !finalSkillsText.includes(kw.toLowerCase()));

  // Auto-add any remaining missing skills
  let autoAddedSkills: string[] = [];
  let mergedSkills = optimizedResume.skills;

  if (missingSkillsFinal.length > 0) {
      console.log(`[pipeline] Auto-adding ${missingSkillsFinal.length} missing skills to optimize ATS score...`);
      if (params.onProgress) {
        params.onProgress("stage", { stageId: "stage7_skills", name: "Optimizing ATS Skills..." });
        params.onProgress("log", { stageId: "stage7_skills", log: "Automatically injecting missing keywords into the Skills section..." });
      }

      const currentSkillsObj = (mergedSkills && !Array.isArray(mergedSkills)) ? mergedSkills : {};
      const catSystemPrompt = `
You are an expert ATS Resume categorizer. You will be given a JSON object of existing categorized skills and a list of new skills to add.
Your task is to smartly append the new skills into the MOST appropriate existing category in the JSON object.
If a new skill clearly belongs in a completely new category, you may create that new category.
Return ONLY valid JSON matching the schema Record<string, string[]>. Do not include markdown code block syntax. Ensure no existing skills are deleted.
      `.trim();
      const catUserPrompt = `
Existing Skills:
${JSON.stringify(currentSkillsObj, null, 2)}

New Skills to add:
${JSON.stringify(missingSkillsFinal, null, 2)}

Please return the newly merged JSON object.
      `.trim();

      try {
          const catResponse = await callLLM(
              [
                  { role: "system", content: catSystemPrompt },
                  { role: "user", content: catUserPrompt }
              ],
              { model, jsonMode: true }
          );
          const cleanJson = catResponse.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim();
          mergedSkills = JSON.parse(cleanJson);
          autoAddedSkills = [...missingSkillsFinal];
      } catch (e) {
          console.error("[pipeline] Failed to auto-categorize missing skills", e);
          // Fallback
          let targetCategory = "Additional Skills";
          if (currentSkillsObj && Object.keys(currentSkillsObj).length > 0) {
               targetCategory = Object.keys(currentSkillsObj)[0];
          }
          const fallbackSkills: Record<string, string[]> = { ...currentSkillsObj };
          if (!fallbackSkills[targetCategory]) fallbackSkills[targetCategory] = [];
          fallbackSkills[targetCategory].push(...missingSkillsFinal);
          mergedSkills = fallbackSkills;
          autoAddedSkills = [...missingSkillsFinal];
      }
      
      optimizedResume.skills = mergedSkills;

      if (params.onProgress) {
        params.onProgress("complete", { stageId: "stage7_skills" });
      }
  }

  const finalOutput: TailoredResumeOutput = {
    ...optimizedResume,
    skills: mergedSkills,
    missingSkills: [], // All missing skills have been explicitly auto-added
    autoAddedSkills: autoAddedSkills,
    ats: {
        ...atsResult,
        missing_keywords: []
    }
  };

  const duration = Date.now() - startTime;
  console.log(`[pipeline] Master Profile generation complete in ${duration}ms.`);

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
