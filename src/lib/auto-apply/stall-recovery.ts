// src/lib/auto-apply/stall-recovery.ts
// Duck-typed interface — works with Stagehand v3 Page and Playwright Page
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

  return { recovered: false, reason: `No fields found after ${attempt} recovery strategies` };
}
