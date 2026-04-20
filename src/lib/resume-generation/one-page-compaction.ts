/**
 * Hidden post-tailoring step: produce a denser resume JSON aimed at a single A4 page.
 * No SSE progress — invoked from generate-tailored-resume-stream after the main pipeline.
 */

import type { TailoredResumeOutput } from "./types";
import { assertNotAborted, callLLM, safeJsonParse } from "./utils";

function deepCloneOutput(src: TailoredResumeOutput): TailoredResumeOutput {
  return JSON.parse(JSON.stringify(src)) as TailoredResumeOutput;
}

function shrinkSkillsTable(skills: Record<string, string[]>, maxPerCategory: number): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, arr] of Object.entries(skills || {})) {
    out[k] = (arr || []).slice(0, maxPerCategory);
  }
  return out;
}

/**
 * LLM compresses content; on failure falls back to clone + light deterministic trims.
 * Copies ATS / honeypot / missingSkills / autoAddedSkills from `full`.
 */
export async function compactTailoredResumeToOnePage(
  full: TailoredResumeOutput,
  jobDescription: string,
  abortSignal?: AbortSignal
): Promise<TailoredResumeOutput> {
  assertNotAborted(abortSignal);
  const model = process.env.LLM_MODEL || "openai/gpt-4o-mini";

  const slimInput = {
    basics: full.basics,
    summary: full.summary,
    sections: full.sections,
    skills: full.skills,
  };

  const system = `You are an expert resume editor. You receive a tailored resume (JSON) and a job description.

Goal: produce a ONE-PAGE-FRIENDLY version of the same resume.

Rules (strict):
1) Preserve every employer, role title, institution, degree, and date range exactly as in the input (same strings).
2) Merge bullets within the same entry when they convey overlapping information — fewer bullets, same facts. Do not invent metrics, tools, or employers.
3) Shorten the summary to at most 2 sentences (max 360 characters) while keeping the strongest JD-aligned claims.
4) Trim skills: keep only the most job-relevant terms; cap each skills category at 10 items. Do not add skills that were not present.
5) Remove or shorten bullets ONLY as a last resort — prefer merge/compress. Anything removed must be low value for THIS job or redundant with another bullet.
6) Never drop the only bullet that establishes a required qualification from the job description when that qualification appears in the input resume.

Return ONLY valid JSON with this shape:
{"basics":{...},"summary":"...","sections":[...],"skills":{...}}
Use the same section/entry/bullet schema as the input (sections[].name, sections[].entries[] with title, subtitle, location, startDate, endDate, bullets string[], optional bulletSuggestions, jdAnchors).`;

  const user = `Job description:\n${jobDescription.slice(0, 14000)}\n\nResume JSON:\n${JSON.stringify(slimInput).slice(0, 120000)}`;

  try {
    const raw = await callLLM(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { model, jsonMode: true, abortSignal, temperature: 0.15, max_tokens: 8000 }
    );

    const parsed = safeJsonParse<{
      basics?: TailoredResumeOutput["basics"];
      summary?: string;
      sections?: TailoredResumeOutput["sections"];
      skills?: Record<string, string[]>;
    }>(raw);

    if (!parsed?.basics || !Array.isArray(parsed.sections)) {
      throw new Error("[one-page-compaction] Parsed JSON missing basics or sections.");
    }

    return {
      ...full,
      basics: parsed.basics,
      summary: parsed.summary ?? full.summary,
      sections: parsed.sections,
      skills: parsed.skills ?? full.skills,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    console.error("[one-page-compaction] LLM compaction failed, using fallback:", e);
    const fb = deepCloneOutput(full);
    fb.skills = shrinkSkillsTable(fb.skills as Record<string, string[]>, 10);
    if (fb.summary && fb.summary.length > 420) {
      fb.summary = `${fb.summary.slice(0, 400).trim()}…`;
    }
    return fb;
  }
}
