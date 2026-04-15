import type { Action } from '@browserbasehq/stagehand';
import type { ProfileContext } from '@/lib/auto-apply/match-field';
import { matchFieldToProfile } from '@/lib/auto-apply/match-field';

const FAST_FILL_TIMEOUT_MS = 5000;

/** Playwright locator string for Stagehand / understudy xpath output */
function toLocatorSelector(raw: string): string {
  const s = raw.trim();
  if (s.startsWith('xpath=')) return s;
  if (s.startsWith('//') || s.startsWith('/html') || s.startsWith('(')) return `xpath=${s}`;
  return s;
}

/**
 * Fill a field without calling Stagehand/LLM when we have a profile value and a stable selector.
 * Cuts latency sharply on typical forms vs one act() per field.
 */
type LocatorLike = {
  waitFor: (options: { state: string; timeout: number }) => Promise<void>;
  evaluate: <R>(fn: (el: unknown) => R) => Promise<R>;
  fill: (value: string) => Promise<void>;
  selectOption: (values: { label?: string; value?: string } | string) => Promise<unknown>;
};

export async function tryFastFillObservation(
  page: unknown,
  obs: Action,
  profileContext: ProfileContext,
): Promise<boolean> {
  const label = obs.description ?? obs.method ?? '';
  const rawSel = obs.selector?.trim();
  if (!rawSel) return false;

  const profileVal = matchFieldToProfile({ label, name: rawSel }, profileContext);
  if (profileVal === null) return false;

  const pw = page as { locator: (s: string) => { first: () => LocatorLike } };
  const locator = pw.locator(toLocatorSelector(rawSel)).first();

  try {
    await locator.waitFor({ state: 'visible', timeout: FAST_FILL_TIMEOUT_MS });
    const inputKind = await locator.evaluate((el: unknown) => {
      const node = el as { tagName?: string; type?: string };
      const tag = (node.tagName ?? '').toLowerCase();
      if (tag === 'select') return 'select';
      if (tag === 'textarea') return 'textarea';
      if (tag === 'input') return node.type || 'text';
      return tag;
    });

    if (inputKind === 'radio' || inputKind === 'checkbox') {
      return false;
    }

    if (inputKind === 'select') {
      try {
        await locator.selectOption({ label: profileVal });
      } catch {
        try {
          await locator.selectOption({ value: profileVal });
        } catch {
          await locator.selectOption({ label: profileVal });
        }
      }
      return true;
    }

    await locator.fill(profileVal);
    return true;
  } catch {
    return false;
  }
}
