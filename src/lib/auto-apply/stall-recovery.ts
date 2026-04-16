// src/lib/auto-apply/stall-recovery.ts
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── Generic retry utility ──────────────────────────────────────────────────

/**
 * Wrap an async function with exponential-backoff retry (300 → 600 → 1200 ms).
 * Used by smart-dropdown and auto-suggest paths for multi-step interactions.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  label: string,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts) {
        const delayMs = 300 * Math.pow(2, attempt - 1); // 300, 600, 1200 …
        console.warn(`[withRetry] "${label}" attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms`);
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

// ── Duck-typed interface — works with Stagehand v3 Page and Playwright Page ─
interface PageLike {
  waitForTimeout(ms: number): Promise<void>;
  evaluate<R = unknown>(fn: string | (() => R)): Promise<R>;
}

export interface StallRecoveryResult {
  recovered: boolean;
  reason:    string;
}

/**
 * Attempt to recover when the agent is stuck on a page.
 * Runs up to 3 recovery strategies before giving up.
 *
 * @param page    - Stagehand/Playwright page
 * @param attempt - Current attempt number (1-based)
 */
function stallWaitMs(): { jsRender: number; afterScroll: number } {
  if (process.env.AUTO_APPLY_FAST_STALL === 'false') {
    return { jsRender: 1500, afterScroll: 800 };
  }
  return { jsRender: 600, afterScroll: 350 };
}

export async function attemptStallRecovery(
  page: PageLike,
  attempt: number
): Promise<StallRecoveryResult> {
  if (attempt > 3) {
    return { recovered: false, reason: `Stall unresolved after ${attempt - 1} attempts` };
  }

  const { jsRender, afterScroll } = stallWaitMs();

  // Strategy 1: Wait for JS render — fields may still be hydrating
  await page.waitForTimeout(jsRender);
  const fieldCount = await page.evaluate<number>(
    () => document.querySelectorAll('input:not([type=hidden]), select, textarea').length
  );
  if (fieldCount > 0) {
    return { recovered: true, reason: 'Fields appeared after waiting for JS render' };
  }

  // Strategy 2: Scroll down — lazy-loaded fields may be off-screen
  await page.evaluate(() => window.scrollBy(0, window.innerHeight));
  await page.waitForTimeout(afterScroll);
  const fieldCountAfterScroll = await page.evaluate<number>(
    () => document.querySelectorAll('input:not([type=hidden]), select, textarea').length
  );
  if (fieldCountAfterScroll > 0) {
    return { recovered: true, reason: 'Fields appeared after scrolling' };
  }

  // Strategy 3: Detect validation error banners — re-fill required fields
  const errorText = await page.evaluate<string>(() => {
    const errorEls = Array.from(
      document.querySelectorAll('[class*="error"], [class*="required"], [aria-invalid="true"]')
    );
    return errorEls
      .map(el => el.textContent?.trim())
      .filter(Boolean)
      .slice(0, 5)
      .join('; ');
  });

  if (errorText) {
    return {
      recovered: true,
      reason: `Validation errors found — re-fill required: ${errorText}`,
    };
  }

  // Strategy 4: Fallback to Gemini 1.5 Vision analysis
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_A || process.env.LLM_API_KEY;
  if (geminiKey) {
    try {
      // Duck-type casting to Playwright Page to capture screenshots
      const pwPage = page as any;
      if (typeof pwPage.screenshot === 'function') {
        const screenshotBuffer = await pwPage.screenshot({ format: "png", fullPage: false });
        
        const genAI = new GoogleGenerativeAI(geminiKey);
        
        let targetModel = process.env.AUTO_APPLY_STAGEHAND_MODEL || process.env.AUTO_SPLY_STAGEHAND_MODEL || 'gemini-1.5-flash';
        if (targetModel.includes('google/')) targetModel = targetModel.replace('google/', '');
        if (!targetModel.includes('gemini')) targetModel = 'gemini-1.5-flash';

        const model = genAI.getGenerativeModel({ model: targetModel });

        const prompt = `This is a screenshot of an automated job application agent that is currently stalled. 
Please look closely at the image and tell me:
1. Is there a CAPTCHA blocking progress?
2. Are there any visible red error messages on the form?
3. Is a "Submit", "Next", or "Continue" button visible? If so, describe its location.`;

        const imagePart = {
          inlineData: {
            data: screenshotBuffer.toString("base64"),
            mimeType: "image/png"
          }
        };

        const result = await model.generateContent([prompt, imagePart]);
        const analysis = result.response.text().toLowerCase();

        if (analysis.includes("captcha")) {
          return { recovered: false, reason: "Stalled visually to a CAPTCHA. Need human intervention." };
        }
        if (analysis.includes("error")) {
           return { recovered: true, reason: `Visual validation errors found via Gemini Vision: ${analysis.substring(0, 50)}...` };
        }
      }
    } catch (e) {
      console.warn("[stall-recovery] Gemini Vision fallback failed:", e);
    }
  }

  return { recovered: false, reason: `No fields found after ${attempt} recovery strategies` };
}
