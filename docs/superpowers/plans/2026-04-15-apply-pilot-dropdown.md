# Apply Pilot — Dropdown & Radio Group Selection Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreliable `sh.extract()` + `sh.act()` dropdown-selection path with DOM-first Playwright evaluation (porting the Chrome extension's proven listbox/option-click logic), add radio/checkbox group handling, and expand employer-friendly defaults so the Apply Pilot agent reliably selects dropdown options on Greenhouse (and other modern ATS platforms).

**Architecture:** A new `dom-interaction.ts` module exposes four pure Playwright utilities (`domSniffDropdownOptions`, `domClickDropdownOption`, `domSniffRadioGroup`, `domClickRadioOption`) that run `page.evaluate()` inside the remote Browserbase session — zero LLM calls for DOM reading or clicking. `fillSmartDropdown` is refactored to use these utilities as the primary path, keeping `sh.extract()` and Gemini Vision as fallbacks. A new `fillRadioOrCheckboxGroup` function handles radio/checkbox groups the same way. Five existing files are updated to wire everything together.

**Tech Stack:** TypeScript, Playwright (page.evaluate / page.locator), Stagehand v3 (Browserbase), Zod, Google Generative AI SDK (Gemini Vision, already wired), Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/auto-apply/dom-interaction.ts` | **Create** | DOM-level browser utilities — sniff dropdown options, click options, sniff radio groups, click radio inputs |
| `src/lib/auto-apply/__tests__/dom-interaction.test.ts` | **Create** | Unit tests for all four DOM utilities using mocked Playwright page |
| `src/lib/auto-apply/smart-dropdown.ts` | **Modify** | Use `domSniffDropdownOptions` + `domClickDropdownOption` as primary path; demote `sh.extract()` to fallback |
| `src/lib/auto-apply/deterministic-fill.ts` | **Modify** | Expand `isCustomDropdownElement()` to catch aria-expanded/aria-autocomplete; return `'radio-group'` for radio/checkbox |
| `src/lib/auto-apply/execute-session.ts` | **Modify** | Add `'radio-group'` branch calling `fillRadioOrCheckboxGroup`; add that function |
| `src/lib/auto-apply/match-field.ts` | **Modify** | Add employer-friendly defaults for 7 new field patterns |
| `src/lib/auto-apply/native-select-fill.ts` | **Modify** | Export `inferAnswerFromContext`; add full-time/contract/overtime defaults |
| `src/lib/auto-apply/__tests__/match-field.test.ts` | **Create** | Unit tests for all new `matchFieldToProfile` patterns |

---

## Task 1: Create `dom-interaction.ts`

**Files:**
- Create: `src/lib/auto-apply/dom-interaction.ts`

- [ ] **Step 1: Create the file**

```typescript
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
      ({ triggerSel }: { triggerSel?: string }) => {
        const findListbox = (): Element | null => {
          // Strategy A: aria-controls / aria-owns on the trigger
          if (triggerSel) {
            const trigger = document.querySelector(triggerSel);
            const refId =
              trigger?.getAttribute('aria-controls') ||
              trigger?.getAttribute('aria-owns') ||
              '';
            if (refId) {
              const byId = document.getElementById(refId);
              if (byId) return byId;
            }
          }
          // Strategy B: any [role="listbox"] in document
          const byRole = document.querySelector('[role="listbox"]');
          if (byRole) return byRole;
          // Strategy C: class patterns
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
      ({ text }: { text: string }) => {
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

// ── 3. domSniffRadioGroup ────────────────────────────────────────────────────

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
      ({ containerSel, type }: { containerSel: string; type: string }) => {
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

// ── 4. domClickRadioOption ───────────────────────────────────────────────────

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
```

- [ ] **Step 2: Verify it type-checks**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx tsc --noEmit 2>&1 | grep -i "dom-interaction"
```

Expected: no errors for this file (ignore pre-existing errors in other files).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git add src/lib/auto-apply/dom-interaction.ts && git commit -m "feat(auto-apply): add dom-interaction utility module — DOM-first dropdown/radio selection"
```

---

## Task 2: Unit tests for `dom-interaction.ts`

**Files:**
- Create: `src/lib/auto-apply/__tests__/dom-interaction.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/lib/auto-apply/__tests__/dom-interaction.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  domSniffDropdownOptions,
  domClickDropdownOption,
  domSniffRadioGroup,
  domClickRadioOption,
} from '../dom-interaction';

// ── Helpers to build mock Playwright page objects ───────────────────────────

function makePage(overrides: Partial<{
  evaluateResult: unknown;
  locatorCount: number;
  locatorClickFails: boolean;
}> = {}) {
  const { evaluateResult = [], locatorCount = 1, locatorClickFails = false } = overrides;

  const clickMock = locatorClickFails
    ? vi.fn().mockRejectedValue(new Error('click failed'))
    : vi.fn().mockResolvedValue(undefined);

  return {
    evaluate: vi.fn().mockResolvedValue(evaluateResult),
    locator: vi.fn().mockReturnValue({
      first: vi.fn().mockReturnValue({ click: clickMock }),
      count: vi.fn().mockResolvedValue(locatorCount),
    }),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
  };
}

// ── domSniffDropdownOptions ──────────────────────────────────────────────────

describe('domSniffDropdownOptions', () => {
  it('returns options returned by page.evaluate', async () => {
    const page = makePage({ evaluateResult: ['Yes', 'No', 'Prefer not to say'] });
    const result = await domSniffDropdownOptions(page);
    expect(result).toEqual(['Yes', 'No', 'Prefer not to say']);
  });

  it('returns [] when page.evaluate returns empty array', async () => {
    const page = makePage({ evaluateResult: [] });
    const result = await domSniffDropdownOptions(page);
    expect(result).toEqual([]);
  });

  it('returns [] when page.evaluate throws', async () => {
    const page = {
      evaluate: vi.fn().mockRejectedValue(new Error('evaluate failed')),
      locator: vi.fn(),
      waitForTimeout: vi.fn(),
    };
    const result = await domSniffDropdownOptions(page);
    expect(result).toEqual([]);
  });

  it('passes triggerSelector to evaluate', async () => {
    const page = makePage({ evaluateResult: ['Option A'] });
    await domSniffDropdownOptions(page, '#my-trigger');
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ triggerSel: '#my-trigger' }),
    );
  });
});

// ── domClickDropdownOption ───────────────────────────────────────────────────

describe('domClickDropdownOption', () => {
  it('clicks via [role="option"]:has-text() when count > 0', async () => {
    const page = makePage({ locatorCount: 1 });
    const result = await domClickDropdownOption(page, 'Yes');
    expect(result).toBe(true);
    expect(page.locator).toHaveBeenCalledWith('[role="option"]:has-text("Yes")');
  });

  it('tries class-based locator when role-based has count=0', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(false),
      locator: vi.fn()
        .mockReturnValueOnce({ first: vi.fn(), count: vi.fn().mockResolvedValue(0) }) // role fails
        .mockReturnValueOnce({
          first: vi.fn().mockReturnValue({ click: vi.fn().mockResolvedValue(undefined) }),
          count: vi.fn().mockResolvedValue(1), // class succeeds
        }),
      waitForTimeout: vi.fn(),
    };
    const result = await domClickDropdownOption(page, 'No');
    expect(result).toBe(true);
    expect(page.locator).toHaveBeenNthCalledWith(2, '[class*="option"]:has-text("No")');
  });

  it('uses DOM walk fallback and returns true when evaluate returns true', async () => {
    const page = {
      evaluate: vi.fn()
        .mockResolvedValueOnce(undefined)   // _fireEvents from strategy 3 never reached here
        .mockResolvedValueOnce(true),       // DOM walk click returns true
      locator: vi.fn().mockReturnValue({ first: vi.fn(), count: vi.fn().mockResolvedValue(0) }),
      waitForTimeout: vi.fn(),
    };
    // Both locator strategies return count=0 so we reach strategy 3
    const page2 = {
      evaluate: vi.fn().mockResolvedValue(true), // DOM walk
      locator: vi.fn().mockReturnValue({ first: vi.fn(), count: vi.fn().mockResolvedValue(0) }),
      waitForTimeout: vi.fn(),
    };
    const result = await domClickDropdownOption(page2, 'Maybe');
    expect(result).toBe(true);
  });

  it('returns false when all strategies fail', async () => {
    const page = {
      evaluate: vi.fn().mockResolvedValue(false),
      locator: vi.fn().mockReturnValue({ first: vi.fn(), count: vi.fn().mockResolvedValue(0) }),
      waitForTimeout: vi.fn(),
    };
    const result = await domClickDropdownOption(page, 'Unknown option');
    expect(result).toBe(false);
  });
});

// ── domSniffRadioGroup ───────────────────────────────────────────────────────

describe('domSniffRadioGroup', () => {
  it('returns radio options from page.evaluate', async () => {
    const mockOptions = [
      { text: 'Yes', inputSelector: '#radio-yes' },
      { text: 'No', inputSelector: '#radio-no' },
    ];
    const page = makePage({ evaluateResult: mockOptions });
    const result = await domSniffRadioGroup(page, '[role="group"]');
    expect(result).toEqual(mockOptions);
  });

  it('passes inputType to evaluate', async () => {
    const page = makePage({ evaluateResult: [] });
    await domSniffRadioGroup(page, '.container', 'checkbox');
    expect(page.evaluate).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ type: 'checkbox' }),
    );
  });

  it('returns [] when evaluate throws', async () => {
    const page = {
      evaluate: vi.fn().mockRejectedValue(new Error('boom')),
      locator: vi.fn(),
      waitForTimeout: vi.fn(),
    };
    const result = await domSniffRadioGroup(page, '.group');
    expect(result).toEqual([]);
  });
});

// ── domClickRadioOption ──────────────────────────────────────────────────────

describe('domClickRadioOption', () => {
  it('clicks the input and returns true on success', async () => {
    const page = makePage({ locatorCount: 1 });
    const result = await domClickRadioOption(page, '#radio-yes');
    expect(result).toBe(true);
    expect(page.locator).toHaveBeenCalledWith('#radio-yes');
  });

  it('returns false when click throws', async () => {
    const page = makePage({ locatorClickFails: true });
    const result = await domClickRadioOption(page, '#radio-yes');
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx vitest run src/lib/auto-apply/__tests__/dom-interaction.test.ts
```

Expected: All tests PASS (12 tests).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git add src/lib/auto-apply/__tests__/dom-interaction.test.ts && git commit -m "test(auto-apply): unit tests for dom-interaction utilities"
```

---

## Task 3: Expand `matchFieldToProfile` employer-friendly defaults

**Files:**
- Modify: `src/lib/auto-apply/match-field.ts` (section 9, around line 157)

- [ ] **Step 1: Write failing tests first**

Create `src/lib/auto-apply/__tests__/match-field.test.ts`:

```typescript
// src/lib/auto-apply/__tests__/match-field.test.ts
import { describe, it, expect } from 'vitest';
import { matchFieldToProfile } from '../match-field';
import type { ProfileContext } from '../match-field';

const emptyProfile: ProfileContext = {
  user: { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
  onboardingAnswers: [],
  userContext: {},
  resumeSummary: '',
};

const profileWithCompany: ProfileContext = {
  ...emptyProfile,
  userContext: { aa_current_company: 'Acme Corp' },
};

describe('matchFieldToProfile — new employer-friendly defaults', () => {
  it('returns Yes for "us person" question', () => {
    expect(matchFieldToProfile({ label: 'Are you a US person?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "us national"', () => {
    expect(matchFieldToProfile({ label: 'US National?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "willing to work overtime"', () => {
    expect(matchFieldToProfile({ label: 'Willing to work overtime?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "able to commute"', () => {
    expect(matchFieldToProfile({ label: 'Are you able to commute to our office?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "non-compete agreement"', () => {
    expect(matchFieldToProfile({ label: 'Are you willing to sign a non-compete agreement?' }, emptyProfile)).toBe('Yes');
  });

  it('returns No for "felony conviction"', () => {
    expect(matchFieldToProfile({ label: 'Have you been convicted of a felony?' }, emptyProfile)).toBe('No');
  });

  it('returns No for "criminal record"', () => {
    expect(matchFieldToProfile({ label: 'Do you have a criminal record?' }, emptyProfile)).toBe('No');
  });

  it('returns Yes for "open to contract work"', () => {
    expect(matchFieldToProfile({ label: 'Are you open to contract work?' }, emptyProfile)).toBe('Yes');
  });

  it('returns Yes for "currently employed" when profile has current company', () => {
    expect(matchFieldToProfile({ label: 'Are you currently employed?' }, profileWithCompany)).toBe('Yes');
  });

  it('returns null for "currently employed" when no current company in profile', () => {
    expect(matchFieldToProfile({ label: 'Are you currently employed?' }, emptyProfile)).toBeNull();
  });

  // Existing patterns — regression guard
  it('returns Yes for "willing to relocate" (existing)', () => {
    expect(matchFieldToProfile({ label: 'Are you willing to relocate?' }, emptyProfile)).toBe('Yes');
  });

  it('returns No for "require visa sponsorship" (existing)', () => {
    expect(matchFieldToProfile({ label: 'Do you require visa sponsorship?' }, emptyProfile)).toBe('No');
  });
});
```

- [ ] **Step 2: Run tests and confirm they FAIL**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx vitest run src/lib/auto-apply/__tests__/match-field.test.ts
```

Expected: new-pattern tests FAIL, regression tests PASS.

- [ ] **Step 3: Add the new patterns to `match-field.ts`**

In `src/lib/auto-apply/match-field.ts`, after the existing section 9 block (around line 163, after the `'acknowledge'` pattern), add:

```typescript
  // 10. Employer-friendly defaults — additional common ATS questions
  if (matches(text, ['us person', 'us national'])) return 'Yes';
  if (matches(text, ['willing to work overtime', 'overtime'])) return 'Yes';
  if (matches(text, ['able to commute', 'commute to', 'willing to commute'])) return 'Yes';
  if (matches(text, ['non-compete', 'non-solicitation', 'nda', 'confidentiality agreement'])) return 'Yes';
  if (matches(text, ['felony', 'criminal conviction', 'been convicted', 'criminal record'])) return 'No';
  if (matches(text, ['open to contract', 'contract work', 'contractor role'])) return 'Yes';
  if (matches(text, ['currently employed', 'are you currently employed', 'current employment status'])) {
    return getAA('aa_current_company', profile) ? 'Yes' : null;
  }
```

- [ ] **Step 4: Run tests and confirm they all PASS**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx vitest run src/lib/auto-apply/__tests__/match-field.test.ts
```

Expected: All 12 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git add src/lib/auto-apply/match-field.ts src/lib/auto-apply/__tests__/match-field.test.ts && git commit -m "feat(auto-apply): expand matchFieldToProfile with 7 employer-friendly defaults"
```

---

## Task 4: Expand `inferAnswerFromContext` and export it

**Files:**
- Modify: `src/lib/auto-apply/native-select-fill.ts`

- [ ] **Step 1: Add `export` to `inferAnswerFromContext` and add new patterns**

In `src/lib/auto-apply/native-select-fill.ts`, change line 67:

```typescript
// BEFORE:
function inferAnswerFromContext(

// AFTER:
export function inferAnswerFromContext(
```

Then, after the last `return null;` at the bottom of `inferAnswerFromContext` (before the closing `}`), add:

```typescript
  // Employment type
  if (/full.?time|part.?time|employment.*type|work.*type/i.test(text)) {
    return 'Full-time';
  }

  // Contract vs permanent preference
  if (/contract.*or.*perm|perm.*or.*contract|employment.*prefer/i.test(text)) {
    return 'Full-time permanent';
  }

  // Overtime availability
  if (/overtime/i.test(text)) {
    return 'Yes';
  }

  // Commute willingness
  if (/commute/i.test(text) && !/location|city/i.test(text)) {
    return 'Yes';
  }
```

- [ ] **Step 2: Verify type-check**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx tsc --noEmit 2>&1 | grep "native-select-fill"
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git add src/lib/auto-apply/native-select-fill.ts && git commit -m "feat(auto-apply): export inferAnswerFromContext; add full-time/overtime/commute defaults"
```

---

## Task 5: Expand `isCustomDropdownElement` and add radio routing in `deterministic-fill.ts`

**Files:**
- Modify: `src/lib/auto-apply/deterministic-fill.ts`

- [ ] **Step 1: Expand `isCustomDropdownElement` to catch aria-expanded and aria-autocomplete**

Replace the `isCustomDropdownElement` function (lines 33–46 in `deterministic-fill.ts`) with:

```typescript
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
  if (tag === 'select') return false;           // native <select> — handled by fast-fill
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
```

- [ ] **Step 2: Add `ariaExpanded` and `ariaAutocomplete` to the element info evaluate call**

In `tryFastFillObservation`, find the `elementInfo` evaluate block (around line 153) and replace the returned object:

```typescript
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
```

- [ ] **Step 3: Change radio/checkbox to return `'radio-group'` instead of `false`**

In `tryFastFillObservation`, find the radio/checkbox early-return (around line 166):

```typescript
    // BEFORE:
    // Radio / checkbox — can't fast-fill, defer to LLM
    if (elementInfo.type === 'radio' || elementInfo.type === 'checkbox') {
      return false;
    }

    // AFTER:
    // Radio / checkbox — route to radio-group handler in execute-session
    if (elementInfo.type === 'radio' || elementInfo.type === 'checkbox') {
      return 'radio-group';
    }
```

- [ ] **Step 4: Update the return type signature**

Find the function signature for `tryFastFillObservation` (around line 132):

```typescript
// BEFORE:
): Promise<boolean | 'custom-dropdown' | 'native-select'> {

// AFTER:
): Promise<boolean | 'custom-dropdown' | 'native-select' | 'radio-group'> {
```

- [ ] **Step 5: Verify type-check**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx tsc --noEmit 2>&1 | grep "deterministic-fill"
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git add src/lib/auto-apply/deterministic-fill.ts && git commit -m "feat(auto-apply): expand custom dropdown detection; route radio/checkbox to radio-group handler"
```

---

## Task 6: Refactor `fillSmartDropdown` to use DOM-first approach

**Files:**
- Modify: `src/lib/auto-apply/smart-dropdown.ts`

- [ ] **Step 1: Replace the file contents**

Replace the entire `src/lib/auto-apply/smart-dropdown.ts` with:

```typescript
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

// ── Dropdown extraction schema (fallback only) ──────────────────────────────

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
    // ── Step 1: Open the dropdown ───────────────────────────────────────────
    await sh.act(`Click the "${label}" dropdown or selector to open its list of options`, {
      timeout: 15_000,
    });

    const p = page as { waitForTimeout: (ms: number) => Promise<void> };
    await p.waitForTimeout(600);

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
      // sh.act fallback if DOM click fails (e.g. element not in expected selector)
      await sh.act(`Click the option "${chosenOption}" in the dropdown`, { timeout: 10_000 });
    }

  }, 3, `smart-dropdown:${label}`);
}
```

- [ ] **Step 2: Verify type-check**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx tsc --noEmit 2>&1 | grep "smart-dropdown"
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git add src/lib/auto-apply/smart-dropdown.ts && git commit -m "feat(auto-apply): refactor fillSmartDropdown — DOM-first sniff + Playwright click, demote LLM to fallback"
```

---

## Task 7: Add radio/checkbox group handling in `execute-session.ts`

**Files:**
- Modify: `src/lib/auto-apply/execute-session.ts`

- [ ] **Step 1: Add imports at the top of `execute-session.ts`**

After the existing import block (find the last `import` line near the top), add:

```typescript
import { domSniffRadioGroup, domClickRadioOption } from '@/lib/auto-apply/dom-interaction';
import { fuzzyMatchOption } from '@/lib/auto-apply/smart-dropdown';
import { inferAnswerFromContext } from '@/lib/auto-apply/native-select-fill';
import { z } from 'zod';
```

- [ ] **Step 2: Add `fillRadioOrCheckboxGroup` function**

Add this function before the `executeAutoApplySession` export (around line 16, after the `MAX_PAGES` constant):

```typescript
/**
 * Fill a radio or checkbox group using DOM-first sniffing.
 * Priority: profile match → inferred default → fuzzy → LLM pick → sh.act fallback.
 */
async function fillRadioOrCheckboxGroup(
  sh: Stagehand,
  page: unknown,
  obs: { description?: string; method?: string; selector?: string },
  profileContext: ProfileContext,
): Promise<boolean> {
  const label = obs.description ?? obs.method ?? '';
  const selector = obs.selector ?? '';

  const profileVal = matchFieldToProfile({ label, name: selector }, profileContext);
  const inferred = inferAnswerFromContext(label, profileContext);
  const answerHint = profileVal ?? inferred;

  // Sniff radio options from DOM
  const radioOptions = await domSniffRadioGroup(page, selector || 'body', 'radio');
  const checkboxOptions = radioOptions.length === 0
    ? await domSniffRadioGroup(page, selector || 'body', 'checkbox')
    : [];
  const allOptions = radioOptions.length > 0 ? radioOptions : checkboxOptions;
  const optionTexts = allOptions.map(o => o.text);

  if (optionTexts.length === 0) {
    // Can't find options — fall to sh.act with a hint
    const hint = answerHint ? `The answer should be "${answerHint}". ` : '';
    await sh.act(
      `${hint}Select the appropriate option for "${label}"`,
      { timeout: 15_000 },
    );
    return true;
  }

  // Fuzzy match
  let chosenText: string | null = null;
  if (answerHint) {
    chosenText = fuzzyMatchOption(answerHint, optionTexts);
  }

  // LLM pick from concrete list
  if (!chosenText) {
    const optionsList = optionTexts.map((o, i) => `${i + 1}. ${o}`).join('\n');
    const prompt = [
      `The question "${label}" has these options:\n${optionsList}`,
      `Resume context: ${profileContext.resumeSummary.slice(0, 1000)}`,
      `You are completing a job application. Choose the option most likely to advance the candidate to the next stage. Avoid options that would disqualify them. Reply with ONLY the exact option text.`,
    ].join('\n\n');

    try {
      const ChoiceSchema = z.object({
        chosenOption: z.string().describe('The exact text of the best option'),
      });
      const result = await sh.extract(prompt, ChoiceSchema, { timeout: 15_000 });
      if (result.chosenOption) {
        chosenText =
          fuzzyMatchOption(result.chosenOption, optionTexts) ??
          optionTexts.find(o => o.toLowerCase() === result.chosenOption.toLowerCase()) ??
          null;
      }
    } catch { /* fall to sh.act */ }
  }

  // DOM click the matched option
  if (chosenText) {
    const matched = allOptions.find(o => o.text === chosenText);
    if (matched?.inputSelector) {
      const clicked = await domClickRadioOption(page, matched.inputSelector);
      if (clicked) return true;
    }
  }

  // sh.act fallback
  const hint = answerHint ? `The answer should be "${answerHint}". ` : '';
  const optList = optionTexts.join(', ');
  await sh.act(
    `${hint}For the question "${label}", select the option that matches best from: ${optList}`,
    { timeout: 15_000 },
  );
  return true;
}
```

- [ ] **Step 3: Wire `'radio-group'` into the fill cascade**

In `execute-session.ts`, find the fill cascade section (around line 250–270 where `fastResult === 'native-select'` and `fastResult === 'custom-dropdown'` branches are). Add the radio-group branch immediately after the custom-dropdown branch:

```typescript
            } else if (fastResult === 'custom-dropdown') {
              // Smart dropdown: DOM sniff → fuzzy → LLM → click
              try {
                await fillSmartDropdown(sh, page, obs, profileContext, description);
                filled = true;
              } catch (err) {
                console.warn(`[smart-dropdown] Failed for "${label}":`, err);
              }
            } else if (fastResult === 'radio-group') {
              // Radio/checkbox group: DOM sniff → fuzzy → LLM → DOM click
              try {
                const handled = await fillRadioOrCheckboxGroup(sh, page, obs, profileContext);
                filled = handled;
              } catch (err) {
                console.warn(`[radio-group] Failed for "${label}":`, err);
              }
            }
```

- [ ] **Step 4: Verify type-check**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx tsc --noEmit 2>&1 | grep "execute-session"
```

Expected: no new errors.

- [ ] **Step 5: Full type-check (all files)**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx tsc --noEmit 2>&1 | head -40
```

Expected: no new errors introduced by this change (pre-existing errors are OK).

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git add src/lib/auto-apply/execute-session.ts && git commit -m "feat(auto-apply): add radio/checkbox group handler with DOM-first selection"
```

---

## Task 8: Run full test suite and verify no regressions

- [ ] **Step 1: Run all auto-apply related tests**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx vitest run src/lib/auto-apply/
```

Expected: All tests PASS. (dom-interaction: 12 tests, match-field: 12 tests)

- [ ] **Step 2: Run full test suite**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && npx vitest run 2>&1 | tail -20
```

Expected: All existing tests still pass. New tests for dom-interaction and match-field pass.

- [ ] **Step 3: Commit final state**

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git status
```

If there are any uncommitted changes, add and commit them:

```bash
cd "C:\Users\iamma\onedrive\desktop\aladdin" && git add -A && git commit -m "chore(auto-apply): verify all tests pass after dropdown fix"
```

---

## Self-Review Checklist

- [x] **dom-interaction.ts**: All 4 functions implemented with proper error handling (never throws, returns empty on failure)
- [x] **smart-dropdown.ts**: DOM sniff → sh.extract → Gemini Vision fallback order matches spec. LLM only picks from known list. domClickDropdownOption replaces sh.act("Click X")
- [x] **deterministic-fill.ts**: aria-expanded/aria-autocomplete added to detection. Radio routing returns 'radio-group'. Return type updated
- [x] **execute-session.ts**: 'radio-group' branch added. fillRadioOrCheckboxGroup handles both radio and checkbox (tries radio first, then checkbox). Imports all needed
- [x] **match-field.ts**: 7 new patterns added. Currently-employed pattern correctly returns null when no company in profile
- [x] **native-select-fill.ts**: inferAnswerFromContext exported. 4 new patterns added
- [x] **Tests**: dom-interaction has 12 unit tests. match-field has 12 unit tests (10 new + 2 regression)
- [x] **No placeholder text**: All steps have complete code
- [x] **Type consistency**: `fuzzyMatchOption` imported from smart-dropdown in execute-session (not redefined). `inferAnswerFromContext` exported from native-select-fill, imported in execute-session. `RadioOption` interface defined in dom-interaction, used by domSniffRadioGroup return type
