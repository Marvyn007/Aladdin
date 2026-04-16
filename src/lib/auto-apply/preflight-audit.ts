// src/lib/auto-apply/preflight-audit.ts
//
// Pre-flight audit: before clicking "Next", use a Zod schema to extract the
// current state of every visible form field, diff it against our profile, and
// re-fill anything that's missing. Falls back to observe() only if extract fails.
// Retries up to MAX_AUDIT_RETRIES per field before escalating to human review.

import type { Stagehand } from '@browserbasehq/stagehand';
import type { Action } from '@browserbasehq/stagehand';
import type { ProfileContext } from '@/lib/auto-apply/match-field';
import { tryFastFillObservation } from '@/lib/auto-apply/deterministic-fill';
import { fillSmartDropdown } from '@/lib/auto-apply/smart-dropdown';
import { z } from 'zod';

const MAX_AUDIT_RETRIES = 2;

// ── Types ───────────────────────────────────────────────────────────────────

export interface FilledFieldEntry {
  label:    string;
  selector: string;
  index:    number;
}

export interface PreFlightResult {
  /** True if every required field is filled and no validation errors remain */
  allClear:         boolean;
  /** Fields the audit successfully re-filled */
  retriedFields:    string[];
  /** Fields that couldn't be filled after MAX_AUDIT_RETRIES attempts */
  unresolvedFields: string[];
  /** Raw validation error messages found on the page */
  errors:           string[];
}

// ── Zod schema for structured page extraction ───────────────────────────────

/**
 * Defines what a "correctly filled page" looks like.
 * sh.extract() returns this structure, and we diff each field against our
 * expectations to find exactly which ones failed.
 */
const PageFieldStateSchema = z.object({
  fields: z.array(z.object({
    label:       z.string().describe('The visible label text of the form field'),
    value:       z.string().describe('The current value/selection in the field (empty string if blank)'),
    isRequired:  z.boolean().describe('Whether this field is marked as required'),
    isEmpty:     z.boolean().describe('Whether the field is currently empty or has no selection'),
    hasError:    z.boolean().describe('Whether the field is showing a validation error (red text, red border, etc.)'),
    errorText:   z.string().optional().describe('The validation error message text, if any'),
  })).describe('All visible form fields on the current page'),
});

type PageFieldState = z.infer<typeof PageFieldStateSchema>;

// ── Main audit function ─────────────────────────────────────────────────────

export async function runPreFlightAudit(
  sh: Stagehand,
  page: unknown,
  filledFields: FilledFieldEntry[],
  profileContext: ProfileContext,
  jobDescription: string,
): Promise<PreFlightResult> {
  const retriedFields:    string[] = [];
  const unresolvedFields: string[] = [];
  const errors:           string[] = [];

  // ── Step 1: Zod-based structured extraction ─────────────────────────────
  // Use sh.extract() with a Zod schema to get the exact state of every field.
  // This tells us precisely which fields are empty/errored — no guessing.
  let pageState: PageFieldState | null = null;
  try {
    pageState = await sh.extract(
      'Extract the current state of ALL visible form fields on this page. For each field, report its label, current value, whether it is required, whether it is empty, and whether it has a validation error.',
      PageFieldStateSchema,
      { timeout: 15_000 },
    );
  } catch {
    // extract() can fail on complex pages — we'll fall back to observe()
  }

  // ── Step 2: Identify problem fields from the extraction ─────────────────
  const filledLabels = new Set(filledFields.map(f => f.label.toLowerCase()));
  let problemFields: Array<{ label: string }> = [];

  if (pageState?.fields) {
    // Collect validation errors
    for (const field of pageState.fields) {
      if (field.hasError && field.errorText) {
        errors.push(`${field.label}: ${field.errorText}`);
      }
    }

    // Find fields that are required + empty but NOT in our filled memory
    // (if they're in our memory, they were filled — the extraction may lag)
    problemFields = pageState.fields
      .filter(f => (f.isEmpty || f.hasError) && f.isRequired)
      .filter(f => !filledLabels.has(f.label.toLowerCase()));
  }

  // ── Step 3: Fallback to observe() if extract didn't work ────────────────
  if (!pageState) {
    let emptyFields: Action[];
    try {
      emptyFields = await sh.observe(
        'Find all required form fields that are still empty, unfilled, or showing validation error messages. Only list fields that need attention.',
        { timeout: 15_000 },
      );
    } catch {
      emptyFields = [];
    }

    problemFields = emptyFields
      .map(obs => ({ label: obs.description ?? obs.method ?? '' }))
      .filter(f => !filledLabels.has(f.label.toLowerCase()));
  }

  // ── Step 3.5: Fallback to Gemini 1.5 Vision if DOM parsing failed or found nothing ──
  if (problemFields.length === 0) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_A || process.env.LLM_API_KEY;
    if (geminiKey) {
      try {
        const pwPage = page as any;
        if (typeof pwPage.screenshot === 'function') {
          const screenshotBuffer = await pwPage.screenshot({ format: "png", fullPage: false });
          
          const { GoogleGenerativeAI } = await import("@google/generative-ai");
          const genAI = new GoogleGenerativeAI(geminiKey);
          
          let targetModel = process.env.AUTO_APPLY_STAGEHAND_MODEL || process.env.AUTO_SPLY_STAGEHAND_MODEL || 'gemini-1.5-flash';
          if (targetModel.includes('google/')) targetModel = targetModel.replace('google/', '');
          if (!targetModel.includes('gemini')) targetModel = 'gemini-1.5-flash';

          const model = genAI.getGenerativeModel({ model: targetModel });

          const prompt = `This is a screenshot of a job application form. 
Please look closely and list the exact names/labels of ANY required inputs that are visibly empty or showing red validation error text.
If everything looks correctly filled or there are no visible issues, reply exactly with "NONE". Otherwise, return ONLY a comma-separated list of the labels.`;

          const imagePart = {
            inlineData: {
              data: screenshotBuffer.toString("base64"),
              mimeType: "image/png"
            }
          };

          const result = await model.generateContent([prompt, imagePart]);
          const analysis = result.response.text();
          
          if (!analysis.includes("NONE")) {
            const visionLabels = analysis.split(',').map(s => s.trim()).filter(Boolean);
            problemFields = visionLabels
              .map(label => ({ label }))
              .filter(f => !filledLabels.has(f.label.toLowerCase()));
          }
        }
      } catch (e) {
        console.warn("[preflight-audit] Gemini Vision fallback failed:", e);
      }
    }
  }

  // ── Step 4: Try to fill each problem field (max 2 retries) ──────────────
  for (const field of problemFields) {
    const { label } = field;
    if (!label) continue;

    let filled = false;

    // Construct a synthetic observation for the fill cascade
    const syntheticObs: Action = {
      description: label,
      selector:    undefined,
      method:      undefined,
    } as unknown as Action;

    for (let attempt = 1; attempt <= MAX_AUDIT_RETRIES; attempt++) {
      try {
        // Try fast-fill first
        const fastResult = await tryFastFillObservation(page, syntheticObs, profileContext);
        if (fastResult === true) {
          filled = true;
          break;
        }
        if (fastResult === 'custom-dropdown') {
          await fillSmartDropdown(sh, page, syntheticObs, profileContext, jobDescription);
          filled = true;
          break;
        }

        // LLM fallback — tell the agent exactly what to fix
        await sh.act(
          `The "${label}" field is empty or showing an error. Fill it with an appropriate value. Resume: ${profileContext.resumeSummary.slice(0, 1000)}`,
          { timeout: 20_000 },
        );
        filled = true;
        break;
      } catch {
        if (attempt === MAX_AUDIT_RETRIES) break;
        const p = page as { waitForTimeout: (ms: number) => Promise<void> };
        await p.waitForTimeout(400);
      }
    }

    if (filled) {
      retriedFields.push(label);
    } else {
      unresolvedFields.push(label);
    }
  }

  // ── Step 5: Final error check via DOM ───────────────────────────────────
  // Even after re-fills, check for any remaining red error text
  try {
    const p = page as { evaluate: <R>(fn: () => R) => Promise<R> };
    const errorText = await p.evaluate(() => {
      const errorEls = Array.from(
        document.querySelectorAll(
          '[class*="error"], [class*="invalid"], [aria-invalid="true"], [class*="required"][class*="message"]'
        ),
      );
      return errorEls
        .map(el => el.textContent?.trim())
        .filter((t): t is string => Boolean(t) && t.length > 3)
        .slice(0, 8);
    });
    for (const e of errorText) {
      if (!errors.includes(e)) errors.push(e);
    }
  } catch {
    // page.evaluate can fail if page navigated
  }

  return {
    allClear: unresolvedFields.length === 0 && errors.length === 0,
    retriedFields,
    unresolvedFields,
    errors,
  };
}
