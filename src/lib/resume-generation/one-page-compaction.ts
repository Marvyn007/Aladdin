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

/** Hard cap bullets per entry so one-page JSON is visibly shorter when the model hedges. */
function capBulletsPerEntry(
  sections: TailoredResumeOutput["sections"],
  maxPerEntry: number
): TailoredResumeOutput["sections"] {
  return (sections || []).map((sec) => ({
    ...sec,
    entries: (sec.entries || []).map((ent) => ({
      ...ent,
      bullets: (ent.bullets || []).slice(0, maxPerEntry),
    })),
  }));
}

function countBullets(sections: TailoredResumeOutput["sections"]): number {
  let n = 0;
  for (const sec of sections || []) {
    for (const ent of sec.entries || []) {
      n += (ent.bullets || []).length;
    }
  }
  return n;
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

  const inputBullets = countBullets(full.sections);

  const system = `You are an expert resume editor. You receive a tailored resume (JSON) and a job description.

Goal: produce a ONE-PAGE version: visibly shorter than the input — the hiring manager must see FEWER bullets and a tighter summary.

Rules (strict):
1) Preserve every employer, role title, institution, degree, and date range exactly as in the input (same strings).
2) **Bullet budget:** Each entry must end with at most **3** bullets (prefer **2**). Merge overlapping bullets so the reader keeps the same facts with less text. If an entry has more than 3 bullets in the input, you MUST output at most 3.
3) Shorten the summary to at most **2 short sentences** (max **320** characters).
4) Trim skills: keep only the most job-relevant terms; cap each skills category at **8** items. Do not add skills that were not present.
5) Prefer merge/compress over deletion. Do not invent metrics, tools, or employers.
6) Never drop the only remaining mention of a critical job-description requirement that appears in the input resume (you may merge it into another bullet instead).

Return ONLY valid JSON with this shape:
{"basics":{...},"summary":"...","sections":[...],"skills":{...}}
Use the same section/entry/bullet schema as the input (sections[].name, sections[].entries[] with title, subtitle, location, startDate, endDate, bullets string[], optional bulletSuggestions, jdAnchors).

The input currently has about ${inputBullets} bullets total — your output must have **meaningfully fewer** bullet lines unless the input already has ≤12 bullets.`;

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

    let sections = capBulletsPerEntry(parsed.sections, 3);
    let skills = shrinkSkillsTable((parsed.skills ?? full.skills) as Record<string, string[]>, 8);

    // If the model barely reduced bullets, enforce a harder cap
    if (countBullets(sections) > Math.max(12, Math.floor(inputBullets * 0.72))) {
      sections = capBulletsPerEntry(sections, 2);
    }

    return {
      ...full,
      basics: parsed.basics,
      summary: parsed.summary ?? full.summary,
      sections,
      skills,
    };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw e;
    console.error("[one-page-compaction] LLM compaction failed, using fallback:", e);
    const fb = deepCloneOutput(full);
    fb.sections = capBulletsPerEntry(fb.sections, 3);
    fb.skills = shrinkSkillsTable(fb.skills as Record<string, string[]>, 8);
    if (fb.summary && fb.summary.length > 360) {
      fb.summary = `${fb.summary.slice(0, 320).trim()}…`;
    }
    return fb;
  }
}
