// src/lib/auto-apply/smart-dropdown.ts
//
// Click → DOM-sniff → FuzzyMatch → Select workflow for custom (non-<select>) dropdowns.
// Primary: Playwright DOM evaluation (page.evaluate + page.locator) — zero LLM cost.
// Fallback 1: sh.extract() (Stagehand LLM extraction).
// Fallback 2: Gemini 1.5 Flash Vision screenshot.
// LLM is only used to CHOOSE from a known concrete list, never to extract or click.

import type { Stagehand } from '@browserbasehq/stagehand';
import type { Action } from '@browserbasehq/stagehand';
import type { ProfileContext } from '@/lib/auto-apply/match-field';
import { matchFieldToProfile } from '@/lib/auto-apply/match-field';
import { withRetry } from '@/lib/auto-apply/stall-recovery';
import { domSniffDropdownOptions, domClickDropdownOption } from '@/lib/auto-apply/dom-interaction';
import { z } from 'zod';

// ── Fuzzy / synonym matching ────────────────────────────────────────────────

const SYNONYM_MAP: Record<string, string[]> = {
  male:                      ['man', 'm'],
  female:                    ['woman', 'f'],
  'prefer not to say':       ['decline to self-identify', 'decline', 'prefer not to answer', 'prefer not to disclose'],
  yes:                       ['true', 'y', 'affirmative'],
  no:                        ['false', 'n'],
  'not a veteran':           ['i am not a protected veteran', 'non-veteran', 'no'],
  'protected veteran':       ['i am a protected veteran', 'veteran', 'yes'],
  'united states':           ['us', 'usa', 'u.s.', 'u.s.a.', 'united states of america'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Try to match `profileVal` to one of the visible `options`.
 * 1. Exact match (case-insensitive)
 * 2. Substring inclusion
 * 3. Synonym map
 * Returns the original option string (not normalized) or null.
 */
export function fuzzyMatchOption(profileVal: string, options: string[]): string | null {
  const normProfile = normalize(profileVal);

  // 1. Exact match
  for (const opt of options) {
    if (normalize(opt) === normProfile) return opt;
  }

  // 2. Substring: profile includes option or option includes profile
  for (const opt of options) {
    const normOpt = normalize(opt);
    if (normOpt.includes(normProfile) || normProfile.includes(normOpt)) return opt;
  }

  // 3. Synonym expansion
  const synonyms = SYNONYM_MAP[normProfile] ?? [];
  for (const syn of synonyms) {
    const normSyn = normalize(syn);
    for (const opt of options) {
      if (normalize(opt) === normSyn || normalize(opt).includes(normSyn)) return opt;
    }
  }

  // 4. Reverse synonym: option text is a key whose synonyms include profileVal
  for (const opt of options) {
    const normOpt = normalize(opt);
    const reverseKeys = Object.entries(SYNONYM_MAP)
      .filter(([, syns]) => syns.some(s => normalize(s) === normProfile || normalize(s).includes(normProfile)))
      .map(([k]) => normalize(k));
    if (reverseKeys.includes(normOpt)) return opt;
  }

  return null;
}

// ── Zod schemas (LLM fallback only) ────────────────────────────────────────

const DropdownOptionsSchema = z.object({
  options: z.array(z.string()).describe('All visible text labels in the dropdown/menu'),
});

const ChoiceSchema = z.object({
  chosenOption: z.string().describe('The exact text of the best option from the list'),
});

// ── Main handler ────────────────────────────────────────────────────────────

/**
 * Open a custom dropdown, extract its options via DOM first (fastest),
 * fuzzy-match or LLM-select the best one, then click it via Playwright locator.
 * Wrapped in withRetry for resilience.
 *
 * Fallback order for option discovery:
 *   1. DOM evaluation via page.evaluate() — instant, zero LLM cost
 *   2. sh.extract() Stagehand LLM extraction
 *   3. Gemini 1.5 Flash Vision screenshot
 *
 * Fallback order for clicking:
 *   1. domClickDropdownOption() — Playwright locator strategies
 *   2. sh.act("Click X") — LLM-guided click
 */
export async function fillSmartDropdown(
  sh: Stagehand,
  page: unknown,
  obs: Action,
  profileContext: ProfileContext,
  jobDescription: string,
): Promise<void> {
  const label = obs.description ?? obs.method ?? '';
  const profileVal: string | null = matchFieldToProfile(
    { label, name: obs.selector ?? '' },
    profileContext,
  );

  await withRetry(async () => {
    // ── Step 1: Open the dropdown — Playwright DOM click (zero LLM cost) ───
    const p = page as {
      waitForTimeout: (ms: number) => Promise<void>;
      locator: (s: string) => { first: () => { click: (opts?: { timeout?: number }) => Promise<void> } };
    };

    let opened = false;
    const rawSel = obs.selector?.trim();
    if (rawSel) {
      try {
        const sel = rawSel.startsWith('//') || rawSel.startsWith('/html') || rawSel.startsWith('(')
          ? `xpath=${rawSel}` : rawSel;
        await p.locator(sel).first().click({ timeout: 5_000 });
        opened = true;
      } catch { /* fall through to sh.act */ }
    }
    if (!opened) {
      // LLM fallback only when DOM click failed (selector missing or stale)
      await sh.act(`Click the "${label}" dropdown or selector to open its list of options`, {
        timeout: 15_000,
      });
    }

    await p.waitForTimeout(300);

    // ── Step 2: DOM-first option sniff (primary — no LLM cost) ─────────────
    let options = await domSniffDropdownOptions(page, obs.selector);

    // ── Step 3: sh.extract() fallback (if DOM sniff found nothing) ──────────
    if (options.length === 0) {
      try {
        const extracted = await sh.extract(
          `List ALL visible dropdown menu options / items for the "${label}" field. Return every single option text you can see.`,
          DropdownOptionsSchema,
        );
        options = extracted.options.filter((o: string) => o.trim().length > 0);
      } catch { /* continue to Gemini fallback */ }
    }

    // ── Step 4: Gemini Vision fallback (last resort option discovery) ────────
    if (options.length === 0) {
      const geminiKey =
        process.env.GEMINI_API_KEY ||
        process.env.GEMINI_API_KEY_A ||
        process.env.LLM_API_KEY;
      if (geminiKey) {
        try {
          const pwPage = page as any;
          if (typeof pwPage.screenshot === 'function') {
            const buf = await pwPage.screenshot({ format: 'png', fullPage: false });
            const { GoogleGenerativeAI } = await import('@google/generative-ai');
            const model = new GoogleGenerativeAI(geminiKey).getGenerativeModel({
              model: 'gemini-1.5-flash',
            });
            const result = await model.generateContent([
              `This is a screenshot of a job application form with an open dropdown for the field "${label}". List ALL visible dropdown option texts, comma-separated. If you cannot see any options, reply exactly "NONE".`,
              { inlineData: { data: buf.toString('base64'), mimeType: 'image/png' } },
            ]);
            const text = result.response.text();
            if (!text.includes('NONE')) {
              options = text.split(',').map((s: string) => s.trim()).filter(Boolean);
            }
          }
        } catch (e) {
          console.warn('[smart-dropdown] Gemini Vision fallback failed:', e);
        }
      }
    }

    if (options.length === 0) {
      throw new Error(`No dropdown options found for "${label}" — retrying`);
    }

    // ── Step 5: Find best match ─────────────────────────────────────────────
    let chosenOption: string | null = null;
    if (profileVal) {
      chosenOption = fuzzyMatchOption(profileVal, options);
    }

    // ── Step 6: LLM picks from concrete list (if no profile/fuzzy match) ────
    if (!chosenOption) {
      const optionsList = options.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n');
      const prompt = [
        `The dropdown "${label}" has these options:\n${optionsList}`,
        profileVal ? `The user's profile value for this field is: "${profileVal}"` : '',
        jobDescription ? `Job description: "${jobDescription.slice(0, 2000)}"` : '',
        `Resume context: ${profileContext.resumeSummary.slice(0, 1500)}`,
        `You are completing a job application. Choose the option most likely to advance the candidate to the next stage. Avoid options that disqualify them (criminal history, requires visa sponsorship, unwilling to relocate/travel, etc.). Reply with ONLY the exact option text, nothing else.`,
      ].filter(Boolean).join('\n\n');

      try {
        const result = await sh.extract(prompt, ChoiceSchema, { timeout: 15_000 });
        if (result.chosenOption) {
          chosenOption =
            fuzzyMatchOption(result.chosenOption, options) ??
            options.find(o => o.toLowerCase() === result.chosenOption.toLowerCase()) ??
            result.chosenOption;
        }
      } catch {
        // Absolute last resort: sh.act with full context
        await sh.act(prompt, { timeout: 20_000 });
        return;
      }
    }

    if (!chosenOption) {
      throw new Error(`Could not determine best option for "${label}"`);
    }

    // ── Step 7: DOM click (replaces sh.act("Click X")) ──────────────────────
    const clicked = await domClickDropdownOption(page, chosenOption);
    if (!clicked) {
      // sh.act fallback if DOM click finds no matching element
      await sh.act(`Click the option "${chosenOption}" in the dropdown`, { timeout: 10_000 });
    }

  }, 3, `smart-dropdown:${label}`);
}
