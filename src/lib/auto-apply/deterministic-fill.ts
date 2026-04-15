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

// ── Detection helpers (exported for routing in execute-session) ──────────────

const AUTO_SUGGEST_PATTERNS = /\b(location|city|address|where are you|current location|where do you live)\b/i;

/**
 * Returns `true` when the label suggests the field triggers a suggestion/autocomplete menu
 * (e.g. Google Maps location picker, Workday city search).
 */
export function isAutoSuggestField(label: string): boolean {
  // Exclude fields that are clearly split (street, zip) — those don't have suggestion menus.
  if (/\b(street|address line|zip|postal)\b/i.test(label)) return false;
  return AUTO_SUGGEST_PATTERNS.test(label);
}

/**
 * Detects non-standard (custom React/Workday/Greenhouse) dropdown elements
 * that can't be handled via native selectOption().
 */
export function isCustomDropdownElement(el: {
  tagName?: string;
  role?: string;
  ariaHasPopup?: string;
  ariaExpanded?: string | null;
  ariaAutocomplete?: string;
  className?: string;
}): boolean {
  const tag = (el.tagName ?? '').toLowerCase();
  if (tag === 'select') return false;          // native <select> — handled by fast-fill
  if (el.role === 'listbox' || el.role === 'combobox') return true;
  if (el.ariaHasPopup === 'listbox' || el.ariaHasPopup === 'true') return true;
  // aria-expanded being present (any value) means this is a togglable combobox
  if (el.ariaExpanded !== undefined && el.ariaExpanded !== null) return true;
  // aria-autocomplete signals a combobox with filtering
  if (el.ariaAutocomplete && el.ariaAutocomplete.length > 0) return true;
  const cls = (el.className ?? '').toLowerCase();
  if (/select|dropdown|chooser|combobox/.test(cls)) return true;
  return false;
}

// ── Playwright-compatible type for locators ──────────────────────────────────

type LocatorLike = {
  waitFor: (options: { state: string; timeout: number }) => Promise<void>;
  evaluate: <R>(fn: (el: unknown) => R) => Promise<R>;
  fill: (value: string) => Promise<void>;
  click: () => Promise<void>;
  pressSequentially: (text: string, options?: { delay?: number }) => Promise<void>;
  inputValue: () => Promise<string>;
  selectOption: (values: { label?: string; value?: string } | string) => Promise<unknown>;
};

type PageLike = {
  locator: (s: string) => { first: () => LocatorLike };
  waitForTimeout: (ms: number) => Promise<void>;
  keyboard: { press: (key: string) => Promise<void> };
  evaluate: <R>(fn: () => R) => Promise<R>;
};

// ── Auto-suggest fill path ──────────────────────────────────────────────────

/**
 * Type slowly → wait for suggestion menu → verify + select the correct suggestion.
 * Returns `true` if the field was handled (even if no suggestions appeared and typed text was kept).
 */
async function fillAutoSuggestField(
  page: PageLike,
  locator: LocatorLike,
  profileVal: string,
  stateOrRegion: string | null,
): Promise<boolean> {
  try {
    await locator.click();
    await locator.fill('');                                              // clear existing text
    await locator.pressSequentially(profileVal, { delay: 80 });          // type like a human
    await page.waitForTimeout(900);                                      // wait for suggestion menu

    // Check if a suggestion list appeared
    const hasSuggestions = await page.evaluate(() => {
      const containers = document.querySelectorAll(
        '[role="listbox"], [class*="suggestion"], [class*="autocomplete"], [class*="dropdown-menu"]'
      );
      return containers.length > 0;
    });

    if (hasSuggestions && stateOrRegion) {
      // Find the suggestion that matches our target state/region
      const matchIndex = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll(
          '[role="option"], [class*="suggestion"] li, [class*="autocomplete"] li, [class*="dropdown-menu"] li, [class*="dropdown-menu"] div[class*="item"]'
        ));
        return items.findIndex(el => {
          const text = (el.textContent ?? '').toLowerCase();
          return text.length > 0;
        });
      });

      if (matchIndex >= 0) {
        // Navigate to the first option and press Enter
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(150);
        await page.keyboard.press('Enter');
      }
    } else if (hasSuggestions) {
      // No state to verify against — just pick the first suggestion
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(150);
      await page.keyboard.press('Enter');
    }
    // else: no suggestions appeared → the typed text stays (plain text field)

    return true;
  } catch {
    return false;
  }
}

// ── Main fast-fill function ─────────────────────────────────────────────────

/**
 * Fill a field without calling Stagehand/LLM when we have a profile value and a stable selector.
 * Returns `'filled'` if handled, `'custom-dropdown'` if the element needs smart-dropdown handling,
 * or `false` if fast-fill can't handle this field.
 */
export async function tryFastFillObservation(
  page: unknown,
  obs: Action,
  profileContext: ProfileContext,
): Promise<boolean | 'custom-dropdown' | 'native-select' | 'radio-group'> {
  const label = obs.description ?? obs.method ?? '';
  const rawSel = obs.selector?.trim();
  if (!rawSel) return false;

  const profileVal = matchFieldToProfile({ label, name: rawSel }, profileContext);

  const pw = page as PageLike;
  const locator = pw.locator(toLocatorSelector(rawSel)).first();

  try {
    await locator.waitFor({ state: 'visible', timeout: FAST_FILL_TIMEOUT_MS });

    // Early bail if no profile value AND element is not a select/dropdown
    // (selects and dropdowns need detection even without a profile value)

    // Detect element kind
    const elementInfo = await locator.evaluate((el: unknown) => {
      const node = el as HTMLElement;
      const tag = (node.tagName ?? '').toLowerCase();
      return {
        tagName:          tag,
        type:             tag === 'input' ? (node as HTMLInputElement).type || 'text' : tag,
        role:             node.getAttribute?.('role') ?? '',
        ariaHasPopup:     node.getAttribute?.('aria-haspopup') ?? '',
        ariaExpanded:     node.getAttribute?.('aria-expanded'),       // null if absent
        ariaAutocomplete: node.getAttribute?.('aria-autocomplete') ?? '',
        className:        node.className ?? '',
      };
    });

    // Radio / checkbox — route to radio-group handler in execute-session
    if (elementInfo.type === 'radio' || elementInfo.type === 'checkbox') {
      return 'radio-group';
    }

    // No profile value — but we can still route selects/dropdowns to their handlers
    if (profileVal === null) {
      if (elementInfo.type === 'select') return 'native-select';
      if (isCustomDropdownElement(elementInfo)) return 'custom-dropdown';
      return false;
    }

    // Custom dropdown detection — defer to smart-dropdown handler
    if (isCustomDropdownElement(elementInfo)) {
      return 'custom-dropdown';
    }

    // Native <select>
    if (elementInfo.type === 'select') {
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

    // Auto-suggest fields (location, city, etc.)
    if (isAutoSuggestField(label)) {
      const stateVal = typeof profileContext.userContext['aa_state'] === 'string'
        ? (profileContext.userContext['aa_state'] as string)
        : null;
      const handled = await fillAutoSuggestField(pw, locator, profileVal, stateVal);
      if (handled) return true;
      // fallthrough to plain fill if auto-suggest handling failed
    }

    // Standard text / textarea fill
    await locator.fill(profileVal);
    return true;
  } catch {
    return false;
  }
}
