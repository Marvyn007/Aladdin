// src/lib/auto-apply/dom-interaction.ts
//
// DOM-level browser interaction utilities for the auto-apply agent.
// All functions use Playwright page.evaluate() and page.locator().
// Zero LLM calls — this is a TypeScript port of the Chrome extension's
// formFiller.js listbox/sniff/click logic, run via remote Playwright.

// ── Internal page type (Playwright subset we need) ──────────────────────────

type PageLike = {
  evaluate: <T = unknown>(fn: (arg: unknown) => T, arg?: unknown) => Promise<T>;
  locator: (selector: string) => {
    first: () => { click: (options?: { timeout?: number }) => Promise<void> };
    count: () => Promise<number>;
  };
  waitForTimeout: (ms: number) => Promise<void>;
};

// ── 1. domSniffDropdownOptions ───────────────────────────────────────────────

/**
 * After a custom dropdown has been opened (trigger already clicked), scan the
 * DOM for the visible listbox/options container and return all option texts.
 *
 * Multi-strategy container search (same order as Chrome extension):
 *   A. trigger's aria-controls / aria-owns → getElementById
 *   B. document.querySelector('[role="listbox"]')  — catches React portals
 *   C. Common class-pattern scan (React Select, MUI, Greenhouse, Lever, Ashby)
 *
 * @param page  Playwright page object (cast from Stagehand activePage())
 * @param triggerSelector  Optional CSS selector for the trigger element.
 *   When provided, used to resolve aria-controls/aria-owns.
 * @returns Deduplicated, non-empty option text strings. Returns [] on failure.
 */
export async function domSniffDropdownOptions(
  page: unknown,
  triggerSelector?: string,
): Promise<string[]> {
  const pw = page as PageLike;
  try {
    const options = await pw.evaluate(
      (arg: unknown) => {
        const { triggerSel } = arg as { triggerSel?: string };
        const findListbox = (): Element | null => {
          // Strategy A: aria-controls / aria-owns on the trigger
          if (triggerSel) {
            try {
              const trigger = document.querySelector(triggerSel);
              const refId =
                trigger?.getAttribute('aria-controls') ||
                trigger?.getAttribute('aria-owns') ||
                '';
              if (refId) {
                const byId = document.getElementById(refId);
                if (byId) return byId;
              }
            } catch { /* invalid selector */ }
          }
          // Strategy B: any [role="listbox"] in document
          const byRole = document.querySelector('[role="listbox"]');
          if (byRole) return byRole;
          // Strategy C: class patterns (React Select, MUI, Greenhouse, Lever, Ashby)
          const patterns = [
            '[class*="select__menu-list"]',
            '[class*="select__menu"]',
            '[class*="selectMenu"]',
            '[class*="Select-menu"]',
            '[class*="dropdown-menu"]:not([class*="nav"])',
            '[class*="options-list"]',
            '[class*="option-list"]',
            '[class*="combobox-dropdown"]',
            '[class*="listbox"]',
          ];
          for (const p of patterns) {
            try {
              const el = document.querySelector(p);
              if (el) {
                const s = window.getComputedStyle(el);
                if (s.display !== 'none' && s.visibility !== 'hidden') return el;
              }
            } catch { /* invalid selector */ }
          }
          return null;
        };

        const listbox = findListbox();
        if (!listbox) return [];

        const readText = (el: Element): string => {
          const aria = el.getAttribute('aria-label');
          if (aria?.trim()) return aria.trim();
          return (el as HTMLElement).innerText?.trim() ?? el.textContent?.trim() ?? '';
        };

        const seen = new Set<string>();
        const result: string[] = [];
        const items = listbox.querySelectorAll(
          '[role="option"], li[role="option"], li, [class*="option"], [class*="item"]',
        );
        for (const item of Array.from(items)) {
          const text = readText(item);
          if (text && !seen.has(text)) {
            seen.add(text);
            result.push(text);
          }
        }
        return result;
      },
      { triggerSel: triggerSelector } as unknown,
    );
    return Array.isArray(options) ? (options as string[]) : [];
  } catch {
    return [];
  }
}

// ── 2. domClickDropdownOption ────────────────────────────────────────────────

/**
 * Click a dropdown option by its visible text.
 * Tries three strategies in order:
 *   1. Playwright [role="option"]:has-text()  (most reliable)
 *   2. Playwright [class*="option"]:has-text()
 *   3. page.evaluate() DOM walk + el.click()
 *
 * Fires input/change/blur events after click so React/Vue/Angular commit
 * the selection.
 *
 * @param page        Playwright page
 * @param optionText  Visible text of the option to click
 * @returns true if click succeeded, false if no matching element found
 */
export async function domClickDropdownOption(
  page: unknown,
  optionText: string,
): Promise<boolean> {
  const pw = page as PageLike;
  const escaped = optionText.replace(/"/g, '\\"');

  // Strategy 1: [role="option"]:has-text()
  try {
    const loc = pw.locator(`[role="option"]:has-text("${escaped}")`);
    if ((await loc.count()) > 0) {
      await loc.first().click({ timeout: 5000 });
      await _fireEvents(pw);
      return true;
    }
  } catch { /* next strategy */ }

  // Strategy 2: [class*="option"]:has-text()
  try {
    const loc = pw.locator(`[class*="option"]:has-text("${escaped}")`);
    if ((await loc.count()) > 0) {
      await loc.first().click({ timeout: 5000 });
      await _fireEvents(pw);
      return true;
    }
  } catch { /* next strategy */ }

  // Strategy 3: DOM walk via evaluate
  try {
    const clicked = await pw.evaluate(
      (arg: unknown) => {
        const { text } = arg as { text: string };
        const norm = text.trim().toLowerCase();
        const candidates = Array.from(
          document.querySelectorAll('[role="option"], li, [class*="option"], [class*="item"]'),
        );
        for (const el of candidates) {
          const elText = ((el as HTMLElement).innerText ?? el.textContent ?? '')
            .trim()
            .toLowerCase();
          if (elText === norm || elText.includes(norm) || norm.includes(elText)) {
            (el as HTMLElement).click();
            return true;
          }
        }
        return false;
      },
      { text: optionText } as unknown,
    );
    if (clicked) {
      await _fireEvents(pw);
      return true;
    }
  } catch { /* fall through */ }

  return false;
}

async function _fireEvents(pw: PageLike): Promise<void> {
  try {
    await pw.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active) {
        active.dispatchEvent(new Event('input', { bubbles: true }));
        active.dispatchEvent(new Event('change', { bubbles: true }));
        active.dispatchEvent(new Event('blur', { bubbles: true }));
      }
    }, undefined);
  } catch { /* ignore */ }
}

// ── 3. domCheckCustomDropdownFilled ─────────────────────────────────────────

/**
 * Check whether a custom (non-<select>) dropdown already has a non-placeholder value selected.
 * Looks at the trigger element's text/aria-valuenow/data-value and returns true if it looks filled.
 *
 * @param page             Playwright page
 * @param triggerSelector  CSS/XPath selector for the dropdown trigger element
 * @returns true if a real selection is already made, false otherwise
 */
export async function domCheckCustomDropdownFilled(
  page: unknown,
  triggerSelector: string,
): Promise<boolean> {
  const pw = page as PageLike;
  try {
    return await pw.evaluate(
      (arg: unknown) => {
        const { sel } = arg as { sel: string };
        let el: Element | null = null;
        // XPath selectors can't be used with querySelector
        const isXPath = sel.startsWith('//') || sel.startsWith('/html') || sel.startsWith('(');
        if (isXPath) {
          const r = document.evaluate(sel, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          el = r.singleNodeValue as Element | null;
        } else {
          try { el = document.querySelector(sel); } catch { /* invalid selector */ }
        }
        if (!el) return false;

        // aria-valuenow or data-value attributes indicate a selected value
        const ariaValue = el.getAttribute('aria-valuenow') ?? el.getAttribute('data-value') ?? '';
        if (ariaValue.trim()) return true;

        // The displayed text — if it's non-empty and not a placeholder phrase, it's filled
        const displayText = ((el as HTMLElement).innerText ?? el.textContent ?? '').trim();
        if (!displayText) return false;

        const PLACEHOLDER_PATTERNS = /^(select|choose|pick|--|-–|please select|type to search|search)/i;
        return !PLACEHOLDER_PATTERNS.test(displayText);
      },
      { sel: triggerSelector } as unknown,
    );
  } catch {
    return false;
  }
}

// ── 4. domCheckRadioGroupFilled ──────────────────────────────────────────────

/**
 * Check whether any radio or checkbox input within a container is already checked.
 *
 * @param page                    Playwright page
 * @param groupContainerSelector  CSS selector for the group wrapper (or 'body' for whole page)
 * @returns true if at least one input[type=radio] or input[type=checkbox] is checked
 */
export async function domCheckRadioGroupFilled(
  page: unknown,
  groupContainerSelector: string,
): Promise<boolean> {
  const pw = page as PageLike;
  try {
    return await pw.evaluate(
      (arg: unknown) => {
        const { containerSel } = arg as { containerSel: string };
        const isXPath =
          containerSel.startsWith('//') ||
          containerSel.startsWith('/html') ||
          containerSel.startsWith('(');
        let root: ParentNode = document;
        if (!isXPath) {
          try {
            const el = document.querySelector(containerSel);
            if (el) root = el;
          } catch { /* use document */ }
        }
        const inputs = Array.from(
          root.querySelectorAll('input[type="radio"], input[type="checkbox"]'),
        ) as HTMLInputElement[];
        return inputs.some(inp => inp.checked);
      },
      { containerSel: groupContainerSelector } as unknown,
    );
  } catch {
    return false;
  }
}

// ── 5. domSniffRadioGroup ────────────────────────────────────────────────────

export interface RadioOption {
  text: string;
  /** CSS selector for this specific input (e.g. "#input-id" or "input[name][value]") */
  inputSelector: string;
}

/**
 * Scan a radio/checkbox group container for all option labels and selectors.
 * Scoped to the container to prevent matching unrelated inputs elsewhere on
 * the page.
 *
 * @param page                    Playwright page
 * @param groupContainerSelector  CSS selector of the group wrapper
 * @param inputType               'radio' or 'checkbox' (default: 'radio')
 * @returns RadioOption[] — returns [] on failure, never throws
 */
export async function domSniffRadioGroup(
  page: unknown,
  groupContainerSelector: string,
  inputType: 'radio' | 'checkbox' = 'radio',
): Promise<RadioOption[]> {
  const pw = page as PageLike;
  try {
    return (await pw.evaluate(
      (arg: unknown) => {
        const { containerSel, type } = arg as { containerSel: string; type: string };
        // XPath selectors can't be used with querySelector — fall back to document
        const isXPath =
          containerSel.trim().startsWith('//') ||
          containerSel.trim().startsWith('/html') ||
          containerSel.trim().startsWith('(');
        let root: ParentNode = document;
        if (!isXPath) {
          try {
            const el = document.querySelector(containerSel);
            if (el) root = el;
          } catch { /* invalid selector — use document */ }
        }

        const inputs = Array.from(
          root.querySelectorAll(`input[type="${type}"]`),
        ) as HTMLInputElement[];

        return inputs
          .filter((inp) => inp.isConnected)
          .map((inp) => {
            let text = '';
            if (inp.id) {
              const lbl = document.querySelector(`label[for="${CSS.escape(inp.id)}"]`);
              text = lbl?.textContent?.trim() ?? '';
            }
            if (!text) {
              const closest = inp.closest('label');
              if (closest) {
                text = (closest.textContent ?? '').replace(inp.value, '').trim();
              }
            }
            if (!text) text = inp.getAttribute('aria-label')?.trim() ?? '';
            if (!text) text = inp.value?.trim() ?? '';

            const inputSelector = inp.id
              ? `#${CSS.escape(inp.id)}`
              : inp.name && inp.value
                ? `input[name="${inp.name}"][value="${inp.value}"]`
                : '';

            return { text, inputSelector };
          })
          .filter((o) => o.text.length > 0 && o.inputSelector.length > 0);
      },
      { containerSel: groupContainerSelector, type: inputType } as unknown,
    )) as RadioOption[];
  } catch {
    return [];
  }
}

// ── 6. domClickRadioOption ───────────────────────────────────────────────────

/**
 * Click a radio or checkbox input by CSS selector, then fire a change event.
 *
 * @param page           Playwright page
 * @param inputSelector  CSS selector for the specific input (from domSniffRadioGroup)
 * @returns true if click succeeded, false otherwise
 */
export async function domClickRadioOption(
  page: unknown,
  inputSelector: string,
): Promise<boolean> {
  const pw = page as PageLike;
  try {
    await pw.locator(inputSelector).first().click({ timeout: 5000 });
    await pw.evaluate(
      (sel: unknown) => {
        const el = document.querySelector(sel as string) as HTMLInputElement | null;
        if (el) el.dispatchEvent(new Event('change', { bubbles: true }));
      },
      inputSelector as unknown,
    );
    return true;
  } catch {
    return false;
  }
}
