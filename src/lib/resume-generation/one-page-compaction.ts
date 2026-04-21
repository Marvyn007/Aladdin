import type { TailoredResumeOutput, DynamicSection, DynamicParsedResume } from './types';
import { assertNotAborted, callLLM, safeJsonParse } from './utils';
import { measureResumeHeightPx, A4_HEIGHT_PX } from './measure-height';
import { renderResumeHtml } from '../resume-templates';
import { toEditorFormat } from './toEditorFormat';
import { applyOnePageDesignFromFull } from '../tailored-resume-bundle';

export function scoreSectionRelevance(section: DynamicSection): number {
  let totalBullets = 0;
  let anchoredBullets = 0;
  for (const entry of section.entries) {
    totalBullets += entry.bullets.length;
    anchoredBullets += (entry.jdAnchors ?? []).filter((a) => a.length > 0).length;
  }
  return totalBullets === 0 ? 0 : anchoredBullets / totalBullets;
}

export function microTrimSections(sections: DynamicSection[], lineBudget: number): DynamicSection[] {
  const working: DynamicSection[] = JSON.parse(JSON.stringify(sections));
  let removed = 0;

  while (removed < lineBudget) {
    type Candidate = { sectionScore: number; bulletLen: number; si: number; ei: number; bi: number };
    const candidates: Candidate[] = [];

    for (let si = 0; si < working.length; si++) {
      const score = scoreSectionRelevance(working[si]);
      for (let ei = 0; ei < working[si].entries.length; ei++) {
        const entry = working[si].entries[ei];
        for (let bi = 0; bi < entry.bullets.length; bi++) {
          const anchors = entry.jdAnchors?.[bi] ?? [];
          if (anchors.length === 0) {
            candidates.push({ sectionScore: score, bulletLen: entry.bullets[bi].length, si, ei, bi });
          }
        }
      }
    }

    if (candidates.length === 0) break;

    // Lowest relevance first; break ties by longest bullet first
    candidates.sort((a, b) => a.sectionScore - b.sectionScore || b.bulletLen - a.bulletLen);
    const { si, ei, bi } = candidates[0];

    working[si].entries[ei].bullets.splice(bi, 1);
    if (working[si].entries[ei].jdAnchors) {
      working[si].entries[ei].jdAnchors!.splice(bi, 1);
    }
    removed++;
  }

  return working;
}

function renderForMeasurement(output: TailoredResumeOutput, applyOnePage: boolean): string {
  const editorData = toEditorFormat(output as unknown as DynamicParsedResume);
  if (applyOnePage) {
    const design = applyOnePageDesignFromFull(editorData.design);
    return renderResumeHtml({ ...editorData, design });
  }
  return renderResumeHtml(editorData);
}

export async function compactTailoredResumeToOnePage(
  full: TailoredResumeOutput,
  jobDescription: string,
  abortSignal?: AbortSignal
): Promise<TailoredResumeOutput | null> {
  assertNotAborted(abortSignal);

  // Phase 0: measure full resume — return null if it already fits
  const fullHeight = await measureResumeHeightPx(renderForMeasurement(full, false));
  if (fullHeight === null || fullHeight <= A4_HEIGHT_PX) {
    return null;
  }

  assertNotAborted(abortSignal);

  // Phase 1: clone + design overrides (deterministic, no measurement)
  const onePage: TailoredResumeOutput = JSON.parse(JSON.stringify(full));

  // Phase 2: measure with one-page design — return early if it fits
  const height2 = await measureResumeHeightPx(renderForMeasurement(onePage, true));
  if (height2 !== null && height2 <= A4_HEIGHT_PX) {
    return onePage;
  }

  assertNotAborted(abortSignal);

  // Phase 3: score sections and compute line budget from remaining overflow
  const overflowPx = (height2 ?? fullHeight) - A4_HEIGHT_PX;
  const lineBudget = Math.ceil(overflowPx / 20);

  const lowRelevanceSections = onePage.sections.filter((s) => scoreSectionRelevance(s) < 0.5);

  // Phase 4: targeted LLM reduction on low-relevance sections
  let llmSucceeded = false;
  if (lowRelevanceSections.length > 0) {
    try {
      const model = process.env.LLM_MODEL || 'openai/gpt-4o-mini';
      const raw = await callLLM(
        [
          {
            role: 'system',
            content: `You are a resume editor. Reduce total content by approximately ${lineBudget} lines.
Rules:
1. Preserve every employer, role title, institution, degree, and date exactly.
2. Never remove or shorten a bullet with non-empty jdAnchors.
3. For entries with 3+ bullets and no anchored bullets: reduce to 2 bullets.
4. For entries with 2 bullets and no anchored bullets: reduce to 1 bullet only if the budget requires it.
5. Prefer merging two bullets into one condensed bullet over deleting entirely.
6. Shorten bullet text by removing filler phrases, not facts or metrics.
7. Return ONLY the modified sections array. Same schema as input.`,
          },
          { role: 'user', content: JSON.stringify(lowRelevanceSections) },
        ],
        { model, jsonMode: true, abortSignal, temperature: 0.15, max_tokens: 8000 }
      );

      const parsed = safeJsonParse<DynamicSection[]>(raw);
      if (Array.isArray(parsed)) {
        const sectionMap = new Map(parsed.map((s) => [s.name, s]));
        onePage.sections = onePage.sections.map((s) => sectionMap.get(s.name) ?? s);
        llmSucceeded = true;
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') throw e;
      console.error('[one-page-compaction] LLM call failed:', e);
    }
  }

  // If LLM did not help, apply deterministic micro-trim
  if (!llmSucceeded) {
    onePage.sections = microTrimSections(onePage.sections, lineBudget);
  }

  assertNotAborted(abortSignal);

  // Phase 5: final measurement — ship best-effort regardless of result
  await measureResumeHeightPx(renderForMeasurement(onePage, true));

  return onePage;
}
