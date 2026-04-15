# Apply Pilot — Dropdown & Radio Group Selection Fix

**Date:** 2026-04-15  
**Status:** Approved  
**Scope:** Browserbase auto-apply agent (Apply Pilot)

---

## Problem

The auto-apply agent successfully opens custom dropdowns but fails to select any option. The field is then skipped. Root cause: `fillSmartDropdown` uses `sh.extract()` (LLM-based page reading) to discover visible dropdown options after clicking the trigger. On Greenhouse (and any ATS that renders options in a React portal/overlay), `sh.extract()` either returns empty or fails because the portal renders outside the DOM scope the LLM reads. The agent then calls `sh.act("Click the option X")` — another LLM inference — which is unreliable for portal-rendered elements.

The Chrome extension solved this with direct `document.querySelector('[role="listbox"]')` DOM access. In the Browserbase session we have a Playwright `page` object that supports `page.evaluate()` — which runs JS inside the remote browser and achieves the same result.

Radio/checkbox groups have the same problem: they fall through to generic `sh.act()` with no structured option list.

---

## Solution Overview

**DOM-first interaction**: port the extension's proven `sniffComboboxOptions` / `fillSelect` / `findListbox` logic into a TypeScript module that runs via Playwright `page.evaluate()` and `page.locator()`. LLM is used only to *choose* from a known concrete list — never to *extract* options or *click* elements.

**Gemini Vision**: demoted to tertiary fallback (only when DOM sniff returns zero options AND `sh.extract()` also fails). Already wired in `preflight-audit.ts`; same pattern used here.

**Employer-friendly defaults**: expand `matchFieldToProfile()` and `inferAnswerFromContext()` with more patterns so the agent answers more questions from profile data (free, deterministic) instead of falling to LLM.

---

## Architecture

### New file: `src/lib/auto-apply/dom-interaction.ts`

Pure Playwright utility — no Stagehand, no LLM API calls. All functions accept a `page: unknown` (cast internally to Playwright's `PageLike`).

#### `domSniffDropdownOptions(page, triggerSelector?)`

Runs `page.evaluate()` with a self-contained function that:

1. Finds the open listbox container using (in priority order):
   - `aria-controls` / `aria-owns` on the trigger element → `document.getElementById(id)`
   - `document.querySelector('[role="listbox"]')` — catches any portal in the page
   - Class-pattern scan (same list as extension): `select__menu-list`, `select__menu`, `selectMenu`, `Select-menu`, `dropdown-menu` (not nav), `options-list`, `option-list`, `combobox-dropdown`, `listbox`
   - Filters for visibility: `display !== 'none'` and `visibility !== 'hidden'`
2. Queries inside the container: `[role="option"], li[role="option"], li, [class*="option"], [class*="item"]`
3. Extracts readable text from each (handles nested spans, strips whitespace)
4. Returns `string[]` — deduplicated, non-empty

Returns empty array (never throws) so callers can check and fallback.

#### `domClickDropdownOption(page, optionText)`

Clicks a visible dropdown option by text using (in priority order):

1. `page.locator('[role="option"]:has-text("X")')` — Playwright built-in, most reliable
2. `page.locator('[class*="option"]:has-text("X")')`
3. `page.evaluate()` — walks the DOM, finds element by `innerText.includes(text)`, calls `.click()`
4. After click: fires `input` + `change` + `blur` events on the document (Greenhouse React needs these to commit the selection)

Returns `true` if click succeeded, `false` if no matching element found.

#### `domSniffRadioGroup(page, groupContainerSelector)`

Runs `page.evaluate()` to:

1. Scoped to the container identified by `groupContainerSelector` (required — prevents matching unrelated radio buttons elsewhere on the page)
2. Find all `input[type="radio"]` (or `checkbox`) within that container
3. For each: extract associated label text via `label[for=id]`, `closest('label')`, or `aria-label`
4. Returns `{ text: string; selector: string }[]` where `selector` is a unique `#id` or `[name][value]` attribute path to the input

The container selector comes from the Stagehand observation's `selector` field, which points to the radio group wrapper.

#### `domClickRadioOption(page, inputSelector)`

Clicks a radio/checkbox input by selector:

1. `page.locator(selector).click()`
2. Fires `change` event via `page.evaluate()`

---

### Modified: `src/lib/auto-apply/smart-dropdown.ts`

**Updated `fillSmartDropdown` execution order:**

```
1. [existing]  Click trigger via sh.act("Click the X dropdown")
2. [existing]  Wait 600ms for DOM to settle
3. [NEW]       domSniffDropdownOptions(page, obs.selector) → options[]
4. [fallback]  If options empty: sh.extract() → options[] (existing, demoted)
5. [fallback]  If still empty: Gemini Vision screenshot → comma-separated labels
6. [existing]  matchFieldToProfile() → profileVal
7. [existing]  fuzzyMatchOption(profileVal, options) → chosenOption
8. [fallback]  If no fuzzy match: sh.extract() with concrete option list → LLM pick
               Prompt enriched with: "choose the option most likely to advance the
               candidate; avoid disqualifying answers"
9. [NEW]       domClickDropdownOption(page, chosenOption) — replaces sh.act("Click X")
10.[existing]  Wrapped in withRetry (3 attempts)
```

LLM is only used in steps 4 (option extraction fallback), 5 (vision fallback), and 8 (choice from known list). Never for clicking.

---

### Modified: `src/lib/auto-apply/native-select-fill.ts`

Minor: no structural change. The existing `extractNativeSelectOptions` + `locator.selectOption()` path is already correct for native `<select>`. Only change: expand the `inferAnswerFromContext()` defaults (see below).

---

### Modified: `src/lib/auto-apply/deterministic-fill.ts`

**Expand `isCustomDropdownElement()`** to detect more Greenhouse patterns:

Add detection for:
- `aria-expanded` attribute present (any value) — indicates a togglable combobox
- `aria-autocomplete` attribute present
- `data-dropdown`, `data-select`, `data-combobox` data attributes
- Tag is `<div>` or `<button>` and `aria-haspopup` is anything non-null

**Add radio/checkbox routing:**

Currently `tryFastFillObservation()` returns `false` for `type === 'radio' || type === 'checkbox'`. Change to return `'radio-group'` so execute-session can route to the new handler.

---

### Modified: `src/lib/auto-apply/execute-session.ts`

**Add radio/checkbox group branch** in the fill cascade (between `custom-dropdown` and LLM fallback):

```typescript
} else if (fastResult === 'radio-group') {
  try {
    const handled = await fillRadioOrCheckboxGroup(sh, page, obs, profileContext);
    filled = handled;
  } catch (err) {
    console.warn(`[radio-group] Failed for "${label}":`, err);
  }
}
```

**`fillRadioOrCheckboxGroup(sh, page, obs, profileContext)`** (new function, same file or separate module):

```
1. matchFieldToProfile(label) → profileVal
2. inferAnswerFromContext(label, profileContext) → inferred
3. domSniffRadioGroup(page) → { text, selector }[]
4. fuzzyMatchOption(profileVal ?? inferred, optionTexts) → chosenText
5. If match: domClickRadioOption(page, chosenSelector) → done
6. If no match: sh.extract() with concrete option list → LLM pick → domClickRadioOption
```

---

### Modified: `src/lib/auto-apply/match-field.ts`

**New patterns added to `matchFieldToProfile()`:**

| Pattern | Default |
|---------|---------|
| `"us person" / "us national"` | `'Yes'` |
| `"overtime" / "willing to work overtime"` | `'Yes'` |
| `"currently employed"` | `aa_current_company ? 'Yes' : null` |
| `"commute" / "able to commute"` | `'Yes'` |
| `"non-compete" / "non-solicitation"` | `'Yes'` (willing to sign) |
| `"felony" / "criminal conviction" / "been convicted"` | `'No'` |
| `"over 18" / "at least 18" / "18 years of age"` | `'Yes'` (already exists but expand pattern) |
| `"open to contract" / "contract work"` | `'Yes'` |
| `"part time" / "full time preference"` | `aa_employment_type ?? 'Full-time'` |

**Expand `inferAnswerFromContext()` in `native-select-fill.ts`:**

Same patterns, applied to the select-field inference path. Also add:
- `"industry" / "sector"` → infer from resume summary job titles via `aa_current_title`
- `"highest education" / "degree"` → from resume parsed JSON education field if available

---

## Data Flow

```
observe() returns field observation
        │
        ▼
tryFastFillObservation()
  ├─ native <select>     → fillNativeSelect() [DOM extract + locator.selectOption()]
  ├─ custom dropdown     → fillSmartDropdown() [DOM sniff + domClick]
  ├─ radio/checkbox      → fillRadioOrCheckboxGroup() [DOM sniff + domClick]
  └─ text/textarea       → locator.fill() directly
        │
        ▼ (if filled=false)
Generic sh.act() LLM fallback [last resort only]
        │
        ▼
runPreFlightAudit() [existing — catches anything missed]
  └─ Gemini Vision scan if DOM extraction found nothing
```

---

## Key Invariants

1. **DOM operations never throw** — `domSniffDropdownOptions` and `domClickDropdownOption` always return (empty array / false) on failure. Throwing is reserved for the `withRetry` wrapper.
2. **LLM picks from a concrete list** — when the LLM fallback runs, it always receives the full option list extracted from the DOM. It never invents options.
3. **Profile data always wins** — `matchFieldToProfile()` result takes priority over LLM picks. The LLM is only called when `profileVal` is null AND fuzzy match fails.
4. **Employer-friendly defaults** — for any question not in the profile, the default strategy is the option most likely to advance the candidate (Yes to relocation, travel, overtime, background check; No to criminal history, visa sponsorship unless user set otherwise).
5. **No regression to existing LLM path** — the new DOM functions are additions; the existing `sh.extract()` and `sh.act()` paths remain as fallbacks, not removed.

---

## Files Changed

| File | Change type |
|------|------------|
| `src/lib/auto-apply/dom-interaction.ts` | New |
| `src/lib/auto-apply/smart-dropdown.ts` | Modify — use DOM sniff + DOM click |
| `src/lib/auto-apply/deterministic-fill.ts` | Modify — expand detection, add radio routing |
| `src/lib/auto-apply/execute-session.ts` | Modify — add radio/checkbox group branch |
| `src/lib/auto-apply/match-field.ts` | Modify — add employer-friendly defaults |
| `src/lib/auto-apply/native-select-fill.ts` | Modify — expand inferAnswerFromContext |

---

## Out of Scope

- File upload fields (handled separately, works correctly)
- Auto-suggest / location autocomplete fields (existing path works, not changed)
- Workday-specific ATS customization (handle in a follow-up if needed after Greenhouse is solid)
- UI changes to the Apply Pilot settings modal
