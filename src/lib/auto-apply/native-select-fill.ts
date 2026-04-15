// src/lib/auto-apply/native-select-fill.ts
//
// Handles native <select> elements where matchFieldToProfile() returns null.
// Strategy: DOM extraction → fuzzy match → LLM pick → selectOption().
// This avoids the unreliable sh.act() path for <select> elements entirely.

import type { Stagehand } from '@browserbasehq/stagehand';
import type { Action } from '@browserbasehq/stagehand';
import type { ProfileContext } from '@/lib/auto-apply/match-field';
import { fuzzyMatchOption } from '@/lib/auto-apply/smart-dropdown';

// ── Playwright-compatible types ─────────────────────────────────────────────

type LocatorLike = {
  waitFor: (options: { state: string; timeout: number }) => Promise<void>;
  evaluate: <R>(fn: (el: unknown) => R) => Promise<R>;
  selectOption: (
    values: { label?: string; value?: string } | string
  ) => Promise<unknown>;
};

type PageLike = {
  locator: (s: string) => { first: () => LocatorLike };
  waitForTimeout: (ms: number) => Promise<void>;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function toLocatorSelector(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('xpath=')) return s;
  if (s.startsWith('//') || s.startsWith('/html') || s.startsWith('('))
    return `xpath=${s}`;
  return s;
}

interface SelectOptionEntry {
  /** The visible text of the <option> */
  label: string;
  /** The value attribute of the <option> */
  value: string;
}

/**
 * Extract all <option> children from a native <select> via DOM evaluation.
 * This is instant and costs zero LLM tokens.
 */
async function extractNativeSelectOptions(
  locator: LocatorLike
): Promise<SelectOptionEntry[]> {
  return locator.evaluate((el: unknown) => {
    const select = el as HTMLSelectElement;
    return Array.from(select.options)
      .filter((opt) => opt.value && opt.value !== '' && !opt.disabled)
      .map((opt) => ({
        label: opt.textContent?.trim() ?? '',
        value: opt.value,
      }));
  });
}

/**
 * Build a "best guess" answer from the profile context for a given question label.
 * This covers common ATS patterns that aren't in matchFieldToProfile (because
 * they're application-specific questions rather than personal info).
 */
export function inferAnswerFromContext(
  label: string,
  profileContext: ProfileContext
): string | null {
  const text = label.toLowerCase();
  const ctx = profileContext.userContext;

  // Sponsorship / immigration
  if (/sponsor|immigration|visa/i.test(text)) {
    return (ctx['aa_sponsorship_needed'] as string) ?? 'No';
  }

  // Work authorization / legally authorized
  if (/authorized|right to work|eligible to work|legally/i.test(text)) {
    return (ctx['aa_authorized_us'] as string) ?? 'Yes';
  }

  // Currently enrolled / university / student / returning to program
  if (/enrolled|university|student|program.*return|return.*program/i.test(text)) {
    return 'Yes';
  }

  // Confirmed plans / relocation / willing to be in <location>
  if (/confirmed plan|plans to be|willing to be|relocat/i.test(text)) {
    return (ctx['aa_willing_relocate'] as string) ?? 'Yes';
  }

  // How did you hear / referred by
  if (/how did you hear|hear about|referred|referral|source/i.test(text)) {
    return 'Job Board';
  }

  // Gender
  if (/gender/i.test(text)) {
    return (ctx['aa_gender'] as string) ?? null;
  }

  // Veteran
  if (/veteran/i.test(text)) {
    return (ctx['aa_veteran_status'] as string) ?? null;
  }

  // Disability
  if (/disability/i.test(text)) {
    return (ctx['aa_disability'] as string) ?? null;
  }

  // Ethnicity / race
  if (/ethnicity|race/i.test(text) && !/hispanic/i.test(text)) {
    return (ctx['aa_ethnicity'] as string) ?? null;
  }

  // Hispanic / Latino
  if (/hispanic|latino/i.test(text)) {
    return (ctx['aa_hispanic'] as string) ?? null;
  }

  // Employment type preference
  if (/full.?time|part.?time|employment.*type|work.*type/i.test(text)) {
    return 'Full-time';
  }

  // Contract vs permanent
  if (/contract.*or.*perm|perm.*or.*contract|employment.*prefer/i.test(text)) {
    return 'Full-time permanent';
  }

  // Overtime availability
  if (/overtime/i.test(text)) {
    return 'Yes';
  }

  // Commute willingness (but not location/city fields)
  if (/commute/i.test(text) && !/location|city/i.test(text)) {
    return 'Yes';
  }

  return null;
}

// ── Main handler ────────────────────────────────────────────────────────────

/**
 * Fill a native <select> element that has no profile match.
 *
 * Strategy:
 * 1. Extract all <option> labels from the DOM (free, instant).
 * 2. Infer a contextual answer from the profile (free, instant).
 * 3. Fuzzy-match against the option list (free, instant).
 * 4. If no match, ask the LLM to pick from the concrete list (one act() call).
 * 5. Set via selectOption() — Playwright's reliable API.
 *
 * Returns true if handled, false if unable.
 */
export async function fillNativeSelect(
  sh: Stagehand,
  page: unknown,
  obs: Action,
  profileContext: ProfileContext,
  jobDescription: string
): Promise<boolean> {
  const label = obs.description ?? obs.method ?? '';
  const rawSel = obs.selector?.trim();
  if (!rawSel) return false;

  const pw = page as PageLike;
  const locator = pw.locator(toLocatorSelector(rawSel)).first();

  try {
    await locator.waitFor({ state: 'visible', timeout: 5000 });

    // Step 1: Extract options from the DOM
    const options = await extractNativeSelectOptions(locator);
    if (options.length === 0) return false;

    const optionLabels = options.map((o) => o.label).filter((l) => l.length > 0);
    if (optionLabels.length === 0) return false;

    // Step 2: Infer best answer from profile context
    const inferredAnswer = inferAnswerFromContext(label, profileContext);

    // Step 3: Try fuzzy match
    let chosenLabel: string | null = null;
    if (inferredAnswer) {
      chosenLabel = fuzzyMatchOption(inferredAnswer, optionLabels);
    }

    // Step 4: LLM fallback — ask it to pick from the concrete option list
    if (!chosenLabel) {
      const optionsList = optionLabels
        .map((o, i) => `${i + 1}. ${o}`)
        .join('\n');

      const promptParts = [
        `The dropdown "${label}" has these options:\n${optionsList}`,
      ];
      if (inferredAnswer) {
        promptParts.push(
          `The user's preferred answer for this question is: "${inferredAnswer}"`
        );
      }
      promptParts.push(
        `Resume: ${profileContext.resumeSummary.slice(0, 1500)}`
      );
      if (jobDescription) {
        promptParts.push(
          `Job description: ${jobDescription.slice(0, 1000)}`
        );
      }
      promptParts.push(
        'Based on the context above, which single option is the best match? Respond with ONLY the exact option text, nothing else.'
      );

      // Use extract to get the LLM's choice as structured data
      try {
        const { z } = await import('zod');
        const ChoiceSchema = z.object({
          chosenOption: z.string().describe('The exact text of the best option from the list'),
        });
        const result = await sh.extract(
          promptParts.join('\n\n'),
          ChoiceSchema,
          { timeout: 15_000 }
        );
        if (result.chosenOption) {
          // Verify the LLM's choice is actually in our list (fuzzy)
          chosenLabel = fuzzyMatchOption(result.chosenOption, optionLabels);
          if (!chosenLabel) {
            // Exact match fallback
            chosenLabel = optionLabels.find(
              (o) => o.toLowerCase() === result.chosenOption.toLowerCase()
            ) ?? optionLabels[0]; // Last resort: pick the first non-placeholder option
          }
        }
      } catch {
        // If extract fails, use act() as absolute last resort for the select
        try {
          await sh.act(
            `Select the most appropriate option from the "${label}" dropdown based on this context: ${profileContext.resumeSummary.slice(0, 1000)}`,
            { timeout: 15_000 }
          );
          return true;
        } catch {
          return false;
        }
      }
    }

    // Step 5: Set via selectOption() — the reliable Playwright API
    if (chosenLabel) {
      try {
        await locator.selectOption({ label: chosenLabel });
        return true;
      } catch {
        // Try by value if label select fails
        const matchedOpt = options.find(
          (o) => o.label.toLowerCase() === chosenLabel!.toLowerCase()
        );
        if (matchedOpt) {
          try {
            await locator.selectOption({ value: matchedOpt.value });
            return true;
          } catch {
            // Fall through
          }
        }
      }
    }

    return false;
  } catch {
    return false;
  }
}
