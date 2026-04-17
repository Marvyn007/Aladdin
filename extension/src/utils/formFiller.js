import { matchHintToSelectOption, pickFallbackSelectOption, extractHintCandidates } from './selectMatch.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isBackground = () => document.visibilityState === 'hidden';

/**
 * Extract readable text from a dropdown option element.
 * Uses innerText (which respects visual layout) with a fallback to textContent
 * plus normalization that inserts spaces between concatenated words.
 * Handles custom dropdowns where child elements produce "UnitedStatesofAmerica"
 * instead of "United States of America".
 */
function readableOptionText(el) {
  // Prefer innerText — it respects CSS display and inserts whitespace between
  // block-level children, producing "United States" instead of "UnitedStates".
  let text = '';
  try { text = el.innerText?.trim() || ''; } catch { /* ignore */ }

  // Fallback to textContent if innerText is empty or unavailable
  if (!text) text = el.textContent?.trim() || '';

  // If the text still looks like concatenated words (camelCase / PascalCase),
  // insert spaces before uppercase letters that follow lowercase letters.
  // "UnitedStatesofAmerica" → "United Statesof America" — then normalize.
  // Also split on transitions like "States(" → "States ("
  text = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')     // camelCase → camel Case
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // USAToday → USA Today
    .replace(/(\w)([(\[])/g, '$1 $2')           // "States(" → "States ("
    .replace(/\s+/g, ' ')                        // collapse multiple spaces
    .trim();

  return text;
}

/**
 * Generates a randomized human-like delay and occasionally simulates a "missed" action.
 * @param {{ quick?: boolean }} [opts] — quick: shorter delay, no scroll miss (profile / paste fills)
 */
export async function applyHumanJitter(opts = {}) {
  // Skip all jitter when the tab is in the background — Chrome throttles
  // setTimeout to ~1 s anyway, so the delay would be counter-productive.
  if (isBackground()) return;

  if (opts.quick) {
    await sleep(2 + Math.floor(Math.random() * 10));
    return;
  }
  const jitter = Math.floor(Math.random() * 56 + 15);
  await sleep(jitter);

  if (Math.random() < 0.05) {
    window.scrollBy({ top: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 30 + 10), behavior: 'auto' });
    await sleep(Math.floor(Math.random() * 40) + 20);
  }
}

/**
 * @param {HTMLSelectElement} select
 * @returns {import('./selectMatch.js').SelectOption[]}
 */
export function getNativeSelectOptions(select) {
  if (!select || select.tagName !== 'SELECT') return [];
  return Array.from(select.options)
    .filter((o) => !o.disabled && !(o.value === '' && /^(select|choose|please|--)/i.test((o.text || '').trim())))
    .map((o) => ({ value: o.value, text: (o.text || o.value || '').trim() }))
    .filter((o) => o.text.length > 0);
}

/**
 * Fills a text input or textarea.
 * @param {HTMLElement} input
 * @param {string} value
 * @param {string} [status]
 * @param {{ instant?: boolean }} [opts] — instant: set value + events in one shot (profile / short answers)
 */
export async function fillTextInput(input, value, status = 'success', opts = {}) {
  if (!input || value === undefined || value === null) return false;
  const str = String(value);
  if (!str) return false;

  // Force instant mode when tab is backgrounded — char-by-char typing relies on
  // setTimeout delays that Chrome throttles to ~1 s in hidden tabs.
  const instant = !!opts.instant || isBackground();

  await applyHumanJitter({ quick: instant });

  input.focus();
  input.scrollIntoView({ behavior: 'auto', block: 'center' });
  await sleep(instant ? 4 : 25);

  const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;

  const setValue = (v) => {
    try {
      nativeSetter.call(input, v);
    } catch {
      input.value = v;
    }
  };

  if (instant) {
    setValue(str);
    try {
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste', data: str }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('blur', { bubbles: true }));
    } catch (e) {
      const errorMessage = e?.message ?? String(e);
      if (
        errorMessage.includes('Extension context invalidated') ||
        errorMessage.includes('Access to storage is not allowed from this context')
      ) {
        return false;
      }
      console.warn('Aladdin fillTextInput instant events:', e);
    }
    await sleep(6);
    if (input.value !== str) {
      setValue(str);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    highlightField(input, status);
    return true;
  }

  setValue('');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  let currentVal = '';
  for (const char of str) {
    currentVal += char;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
    setValue(currentVal);
    input.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
    // Skip typewriter delay when tab is backgrounded (Chrome throttles to ~1s minimum)
    if (!isBackground()) {
      await sleep(2 + Math.random() * 8);
    }
  }

  try {
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  } catch (e) {
    const errorMessage = e?.message ?? String(e);
    if (
      errorMessage.includes('Extension context invalidated') ||
      errorMessage.includes('Access to storage is not allowed from this context')
    ) {
      return false;
    }
    console.warn('Aladdin fillTextInput finalize:', e);
  }

  await sleep(15);
  if (input.value !== str) {
    setValue(str);
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (e) {
      console.warn('Verification event failed', e);
    }
  }

  highlightField(input, status);
  return true;
}

/**
 * Selects the best matching option in a <select> dropdown or custom combobox.
 * @param {string} value — free-form hint (profile value, LLM text, user paste)
 * @param {import('./selectMatch.js').SelectOption[] | null} [precomputedOptions] — from field scan (optional)
 */
export async function fillSelect(select, value, status = 'success', precomputedOptions = null, { noFallback = false } = {}) {
  if (!select || value === undefined || value === null) return false;
  const raw = String(value).trim();
  if (!raw) return false;

  await applyHumanJitter({ quick: true });

  // Case 1: Native <select>
  if (select.tagName === 'SELECT') {
    const structured =
      precomputedOptions?.length ? precomputedOptions : getNativeSelectOptions(select);
    let picked = matchHintToSelectOption(raw, structured);
    if (!picked && !noFallback) {
      // Only use fallback for non-critical fields — never for location/country/state
      // since guessing wrong (e.g. "Argentina") is worse than leaving blank.
      const isLocationField = /\b(country|location|nation|state|province|region)\b/i.test(
        select.name || select.id || select.getAttribute('aria-label') || ''
      );
      if (!isLocationField) {
        const fallback = pickFallbackSelectOption(structured);
        if (fallback) {
          picked = fallback;
          status = status === 'success' ? 'warning' : status;
        }
      }
    }
    if (picked) {
      select.value = picked.value;
      if (select.value !== picked.value && picked.text) {
        const byText = Array.from(select.options).find(
          (o) => o.text.trim() === picked.text.trim() || o.text.trim().includes(picked.text.trim())
        );
        if (byText) {
          select.selectedIndex = byText.index;
        }
      }
      select.dispatchEvent(new Event('change', { bubbles: true }));
      select.dispatchEvent(new Event('input', { bubbles: true }));
      highlightField(select, status);
      return true;
    }
  }

  // Case 2: Custom dropdown / combobox
  // Many ATSes render options outside the input node (portals).
  // STRICT BEHAVIOR: do not type into dropdown fields. Only open + click an option.
  const role = select.getAttribute?.('role') || '';
  const isCombo =
    role === 'combobox' ||
    select.getAttribute?.('aria-haspopup') === 'listbox' ||
    select.getAttribute?.('aria-haspopup') === 'true' ||
    select.getAttribute?.('aria-expanded') != null;

  if (isCombo) {
    try {
      select.focus?.();
      select.click?.();
    } catch {}

    // Attempt to open listbox without typing (ArrowDown / Space often works).
    try {
      select.dispatchEvent?.(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      select.dispatchEvent?.(new KeyboardEvent('keyup', { key: 'ArrowDown', bubbles: true }));
      select.dispatchEvent?.(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));
      select.dispatchEvent?.(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
    } catch {}
  }

  // Prefer a referenced listbox when possible.
  const controlsId = select.getAttribute?.('aria-controls') || select.getAttribute?.('aria-owns') || '';

  const findListbox = () => {
    // 1. By aria-controls / aria-owns (most reliable — directly referenced)
    if (controlsId) {
      const byId =
        document.getElementById(controlsId) ||
        document.querySelector(`[role="listbox"][id="${CSS.escape(controlsId)}"]`);
      if (byId) return byId;
    }

    // 2. Any [role="listbox"] in the DOM (catches React/Vue portals too)
    const byRole = document.querySelector('[role="listbox"]');
    if (byRole) return byRole;

    // 3. Common class-name patterns for popular select/dropdown libraries
    const classPatterns = [
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
    for (const pattern of classPatterns) {
      try {
        const el = document.querySelector(pattern);
        if (el) {
          const s = window.getComputedStyle(el);
          if (s.display !== 'none' && s.visibility !== 'hidden') return el;
        }
      } catch { /* invalid selector — skip */ }
    }

    return null;
  };

  // CRITICAL: only return options from a confirmed dropdown container.
  // Never fall back to document-wide <li> queries — that picks up nav menus
  // and other page elements, causing the retry loop to exit with wrong data.
  const collectOptions = () => {
    const listbox = findListbox();
    if (!listbox) return [];

    const possibleOptions = listbox.querySelectorAll(
      '[role="option"], li[role="option"], li, [class*="option"], [class*="item"]'
    );
    return Array.from(possibleOptions)
      .map((el) => {
        const text = readableOptionText(el);
        return { el, value: text, text };
      })
      .filter((o) => o.text);
  };

  // Give the dropdown time to render before the first check — most React/Vue
  // components schedule their DOM update on the next tick after the click event.
  await sleep(40);

  let structuredList = collectOptions();
  for (let i = 0; i < 8 && !structuredList.length; i++) {
    await sleep(80);
    structuredList = collectOptions();
  }

  if (structuredList.length) {
    const stripped = structuredList.map(({ value, text }) => ({ value, text }));
    let picked = matchHintToSelectOption(raw, stripped);
    if (!picked && !noFallback) {
      const isLocationField = /\b(country|location|nation|state|province|region)\b/i.test(
        select.name || select.id || select.getAttribute?.('aria-label') || ''
      );
      if (!isLocationField) {
        const fallback = pickFallbackSelectOption(stripped);
        if (fallback) {
          picked = fallback;
          status = status === 'success' ? 'warning' : status;
        }
      }
    }
    if (picked) {
      const row = structuredList.find((o) => o.text === picked.text);
      if (row?.el) {
        row.el.click();
        // Some combos need a change event on the input itself after option click.
        try {
          select.dispatchEvent?.(new Event('input', { bubbles: true }));
          select.dispatchEvent?.(new Event('change', { bubbles: true }));
          select.dispatchEvent?.(new Event('blur', { bubbles: true }));
        } catch {}
        highlightField(select, status);
        return true;
      }
    }
  }

  return false;
}

/**
 * Checks a radio button or checkbox whose label matches the given value.
 */
export async function fillRadioOrCheckbox(container, labelText, inputType, status = 'success') {
  await applyHumanJitter({ quick: true });
  const inputs = Array.from(container.querySelectorAll(`input[type="${inputType}"]`));
  const normalized = labelText.toLowerCase().trim();

  for (const input of inputs) {
    const label = getLabelForInput(input);
    const labelNorm = label?.toLowerCase() ?? '';
    if (labelNorm.includes(normalized) || normalized.includes(labelNorm)) {
      if (!input.checked) {
        if (Math.random() < 0.03) {
          try {
            input.parentElement?.click();
            await sleep(35 + Math.random() * 70);
          } catch (e) {}
        }
        input.click();
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      highlightField(input, status);
      return true;
    }
  }
  return false;
}

/**
 * Returns the group question label for a radio/checkbox input.
 * Looks for fieldset/legend, role="group" aria-labelledby, then walks up
 * the DOM finding the nearest preceding sibling text before the input group.
 *
 * @param {HTMLInputElement} radioEl
 * @returns {string}
 */
export function getRadioGroupLabel(radioEl) {
  // 1. <fieldset> > <legend> — most semantic
  const fieldset = radioEl.closest('fieldset');
  if (fieldset) {
    const legend = fieldset.querySelector('legend');
    if (legend) return legend.textContent.trim();
  }

  // 2. role="group" with aria-labelledby / aria-label
  const group = radioEl.closest('[role="group"]');
  if (group) {
    const id = group.getAttribute('aria-labelledby');
    if (id) {
      const el = document.getElementById(id);
      if (el) return el.textContent.trim();
    }
    const ariaLabel = group.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();
  }

  // 3. Walk up the DOM; at each level look for a preceding sibling whose
  //    text looks like a question (no radio/checkbox children, non-trivial length).
  let el = radioEl.parentElement;
  for (let depth = 0; depth < 10 && el; depth++) {
    let prev = el.previousElementSibling;
    while (prev) {
      if (!prev.querySelector('input[type="radio"], input[type="checkbox"]')) {
        const text = prev.textContent?.trim() ?? '';
        if (text.length > 4 && text.length < 300) return text;
      }
      prev = prev.previousElementSibling;
    }
    el = el.parentElement;
  }

  return '';
}

/**
 * Returns all radio/checkbox inputs that belong to the same group as `radioEl`,
 * paired with their visible label text.
 *
 * @param {HTMLInputElement} radioEl
 * @returns {Array<{ element: HTMLInputElement, text: string }>}
 */
export function getRadioGroupOptions(radioEl) {
  const type = radioEl.type; // 'radio' | 'checkbox'
  const name = radioEl.name;

  let inputs;
  if (name) {
    inputs = Array.from(
      document.querySelectorAll(`input[type="${type}"][name="${CSS.escape(name)}"]`)
    );
  } else {
    // No name — grab siblings in the nearest container
    const container = radioEl.closest('fieldset, [role="group"], .field, .form-group, li, div') ?? radioEl.parentElement;
    inputs = container ? Array.from(container.querySelectorAll(`input[type="${type}"]`)) : [radioEl];
  }

  return inputs
    .map(el => ({ element: el, text: getLabelForInput(el) || el.value || '' }))
    .filter(o => o.text.trim().length > 0);
}

/**
 * Clicks the radio/checkbox option whose label best matches `answerText`.
 * Matching strategy: exact → contains → word-overlap.
 *
 * @param {Array<{ element: HTMLInputElement, text: string }>} options
 * @param {string} answerText
 * @param {string} [status]
 * @returns {Promise<boolean>}
 */
export async function fillRadioGroupOption(options, answerText, status = 'success') {
  if (!options?.length || !answerText) return false;

  await applyHumanJitter({ quick: true });

  // Expand the answer into synonym candidates (e.g. "Male" → ["Male","Man","male","man"])
  // so that profile values always match form option labels even when wording differs.
  const candidates = extractHintCandidates(answerText).map(c => c.toLowerCase().trim());

  const norm = (s) => s.toLowerCase().replace(/[.,;:!?'"]/g, '').trim();

  // 1. Exact match (any candidate === option text)
  for (const { element, text } of options) {
    const optNorm = norm(text);
    if (candidates.some(c => c === optNorm)) {
      return _clickRadioOption(element, status);
    }
  }

  // 2. Contains match (either direction, any candidate)
  for (const { element, text } of options) {
    const optNorm = norm(text);
    if (candidates.some(c => optNorm.includes(c) || c.includes(optNorm))) {
      return _clickRadioOption(element, status);
    }
  }

  // 3. Scored word-overlap across all candidates — pick highest
  let bestScore = 0;
  let bestEl = null;

  for (const { element, text } of options) {
    const optWords = norm(text).split(/\W+/).filter(w => w.length > 1);
    for (const c of candidates) {
      const candWords = new Set(c.split(/\W+/).filter(w => w.length > 1));
      const overlap = optWords.filter(w => candWords.has(w)).length;
      if (overlap > bestScore) {
        bestScore = overlap;
        bestEl = element;
      }
    }
  }

  if (bestEl && bestScore > 0) {
    return _clickRadioOption(bestEl, status);
  }

  return false;
}

function _clickRadioOption(input, status = 'success') {
  if (!input) return false;
  try {
    input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!input.checked) {
      input.click();
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    highlightField(input, status);
    return true;
  } catch {
    return false;
  }
}

/**
 * Injects a PDF file into a file input using DataTransfer.
 */
export function fillFileInput(fileInput, base64Pdf, filename = 'resume.pdf') {
  try {
    if (!fileInput || fileInput.tagName !== 'INPUT' || fileInput.type !== 'file') return false;

    const bytes = Uint8Array.from(atob(base64Pdf), c => c.charCodeAt(0));
    const file = new File([bytes], filename, { type: 'application/pdf' });
    const dt = new DataTransfer();
    dt.items.add(file);
    // Some frameworks won't detect "same file" twice unless the value resets.
    try { fileInput.value = ''; } catch {}
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    highlightField(fileInput, true);
    return true;
  } catch (e) {
    console.error('File injection failed', e);
    return false;
  }
}

/**
 * Temporarily opens a custom combobox/dropdown, collects the visible option texts,
 * then closes the dropdown by pressing Escape. Use this to pre-scan options before
 * calling the AI so the AI can pick from the actual option list.
 *
 * @param {HTMLElement} element — the combobox trigger element
 * @returns {Promise<import('./selectMatch.js').SelectOption[]>}
 */
export async function sniffComboboxOptions(element) {
  if (!element) return [];

  // Open the dropdown
  try { element.focus?.(); } catch { /* ignore */ }
  try { element.click?.(); } catch { /* ignore */ }

  // Shared listbox-finder (mirrors the logic in fillSelect)
  const findListbox = () => {
    const controlsId = element.getAttribute?.('aria-controls') || element.getAttribute?.('aria-owns') || '';
    if (controlsId) {
      const byId = document.getElementById(controlsId);
      if (byId) return byId;
    }
    const byRole = document.querySelector('[role="listbox"]');
    if (byRole) return byRole;
    const classPatterns = [
      '[class*="select__menu-list"]', '[class*="select__menu"]',
      '[class*="selectMenu"]', '[class*="Select-menu"]',
      '[class*="dropdown-menu"]:not([class*="nav"])',
      '[class*="options-list"]', '[class*="option-list"]',
      '[class*="combobox-dropdown"]', '[class*="listbox"]',
    ];
    for (const pattern of classPatterns) {
      try {
        const el = document.querySelector(pattern);
        if (el) {
          const s = window.getComputedStyle(el);
          if (s.display !== 'none' && s.visibility !== 'hidden') return el;
        }
      } catch { /* invalid selector */ }
    }
    return null;
  };

  const collectOpts = () => {
    const listbox = findListbox();
    if (!listbox) return [];
    return Array.from(
      listbox.querySelectorAll('[role="option"], li[role="option"], li, [class*="option"], [class*="item"]')
    )
      .map((el) => {
        const text = readableOptionText(el);
        return { value: text, text };
      })
      .filter((o, i, arr) => o.text.length > 0 && arr.findIndex((x) => x.text === o.text) === i);
  };

  // In background mode the dropdown may not paint at all — do a quick check
  // with minimal waits rather than the full 6-retry × 120 ms loop.
  const bg = isBackground();
  await sleep(bg ? 0 : 100);
  let opts = collectOpts();
  const maxRetries = bg ? 2 : 6;
  const retryDelay = bg ? 0 : 120;
  for (let i = 0; i < maxRetries && !opts.length; i++) {
    await sleep(retryDelay);
    opts = collectOpts();
  }

  // Close the dropdown
  try {
    element.dispatchEvent?.(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    element.dispatchEvent?.(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }));
  } catch { /* ignore */ }

  return opts;
}

/**
 * After typing into a text input, check if an autocomplete/autosuggest dropdown
 * appeared and click the best matching suggestion.
 * @param {HTMLElement} input
 * @param {string} typedValue — what was typed
 * @returns {Promise<boolean>}
 */
export async function clickAutocompleteSuggestion(input, typedValue) {
  const hint = String(typedValue || '').trim();
  if (!hint) return false;

  // Re-fire an insertText input event so autocomplete frameworks that were fed
  // an instant/paste fill (insertFromPaste) can still trigger their suggestion
  // logic (e.g. Google Places Autocomplete, React-controlled location pickers).
  try {
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: hint.slice(-1),
      inputType: 'insertText',
    }));
  } catch { /* ignore — context may be gone */ }

  // Wait for suggestions to render. Skip the long wait when backgrounded —
  // suggestion dropdowns rarely paint in hidden tabs anyway.
  await sleep(isBackground() ? 0 : 350);

  const findSuggestions = () => {
    // 1) aria-controls / aria-owns on the input
    const controlsId = input.getAttribute?.('aria-controls') || input.getAttribute?.('aria-owns') || '';
    if (controlsId) {
      const listbox = document.getElementById(controlsId);
      if (listbox) {
        const opts = listbox.querySelectorAll('[role="option"], li');
        if (opts.length) return Array.from(opts);
      }
    }

    // 2) Sibling / ancestor listbox
    const parent = input.closest('.field, .form-group, [data-automation-id="formField"], div') || input.parentElement;
    if (parent) {
      const listbox = parent.querySelector('[role="listbox"]');
      if (listbox) {
        const opts = listbox.querySelectorAll('[role="option"], li');
        if (opts.length) return Array.from(opts);
      }
    }

    // 3) Global listbox that just appeared
    const globalListbox = document.querySelector('[role="listbox"]');
    if (globalListbox) {
      const opts = globalListbox.querySelectorAll('[role="option"], li');
      if (opts.length) return Array.from(opts);
    }

    // 4) Generic dropdown-like containers
    const candidates = document.querySelectorAll(
      '[role="option"], .pac-item, [class*="suggestion"], [class*="autocomplete"] li, [class*="dropdown"] li'
    );
    if (candidates.length) return Array.from(candidates);

    return [];
  };

  let suggestions = findSuggestions();
  // Retry a few times if nothing yet. Use fewer retries in background since
  // the dropdown likely won't appear in a hidden tab.
  const _bgMode = isBackground();
  const _maxSuggRetries = _bgMode ? 1 : 4;
  const _suggRetryDelay = _bgMode ? 0 : 200;
  for (let i = 0; i < _maxSuggRetries && !suggestions.length; i++) {
    await sleep(_suggRetryDelay);
    suggestions = findSuggestions();
  }

  if (!suggestions.length) return false;

  // Score each suggestion against the typed value and pick the best.
  const hintLower = hint.toLowerCase();
  let bestEl = null;
  let bestScore = 0;

  for (const el of suggestions) {
    const text = (el.textContent || '').trim().toLowerCase();
    if (!text) continue;

    let score = 0;
    if (text === hintLower) score = 1000;
    else if (text.includes(hintLower)) score = 800 + Math.min(hintLower.length, 80);
    else if (hintLower.includes(text)) score = 700 + Math.min(text.length, 80);
    else {
      // Token overlap
      const hTokens = new Set(hintLower.split(/\s+/).filter(w => w.length > 1));
      const oTokens = new Set(text.split(/\s+/).filter(w => w.length > 1));
      let inter = 0;
      for (const t of hTokens) if (oTokens.has(t)) inter++;
      const union = hTokens.size + oTokens.size - inter;
      score = union ? (inter / union) * 380 : 0;
    }

    if (score > bestScore) {
      bestScore = score;
      bestEl = el;
    }
  }

  // When any suggestions are present, click the best match (or the top one as fallback)
  // and then press Enter to confirm the selection. This is essential for location pickers
  // (Greenhouse city, Google Places, etc.) where the click may not fully register but
  // an Enter keystroke always confirms the highlighted/first suggestion.
  if (suggestions.length > 0) {
    const topEl = suggestions[0];
    const topText = (topEl.textContent || '').trim().toLowerCase();
    const hintWords = hint.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const topContainsHint =
      topText.includes(hint.toLowerCase()) ||
      (hintWords.length > 0 && hintWords.every((w) => topText.includes(w)));

    // Click the best scored suggestion when score is high enough
    if (bestEl && bestScore >= 150) {
      bestEl.click();
      await sleep(50);
    } else if (topContainsHint) {
      // Fallback: click the top suggestion when it clearly contains the hint
      topEl.click();
      await sleep(50);
    }

    // Always dispatch Enter after any suggestion interaction so location pickers
    // (which often require keyboard confirmation) receive the final confirmation.
    try {
      input.dispatchEvent?.(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter', bubbles: true }));
      input.dispatchEvent?.(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, code: 'Enter', bubbles: true }));
    } catch {}
    try {
      input.dispatchEvent?.(new Event('change', { bubbles: true }));
    } catch {}
    return true;
  }

  return false;
}

/**
 * Types a location value progressively, checking autocomplete suggestions at each
 * step and clicking the best match as soon as one appears. Designed for location
 * pickers (Google Places, Lever city, Greenhouse location, etc.) where pasting
 * the full value often fails to trigger the suggestion list.
 *
 * Strategy: type in increasing chunk sizes (3 → 6 → full), score suggestions
 * at each step, click the best one (score ≥ 150) as soon as it appears.
 *
 * @param {HTMLInputElement} input
 * @param {string} value — the desired location (e.g. "New York, NY")
 * @returns {Promise<boolean>}
 */
export async function fillLocationWithAutocomplete(input, value) {
  const str = String(value || '').trim();
  if (!str) return false;

  // In background mode the autocomplete dropdown cannot visually render, so
  // the progressive-typing strategy is pointless. Fall back to an instant fill
  // so the value is at least set (the user can confirm the dropdown on return).
  if (isBackground()) {
    return fillTextInput(input, str, 'success', { instant: true });
  }

  input.focus();
  input.scrollIntoView({ behavior: 'auto', block: 'center' });
  await sleep(80);

  const proto = HTMLInputElement.prototype;
  const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value').set;
  const setValue = (v) => { try { nativeSetter.call(input, v); } catch { input.value = v; } };

  // Clear the field first
  setValue('');
  try {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } catch { /* ignore */ }

  // Type character by character (same as fillTextInput non-instant path)
  // so that autocomplete frameworks (Google Places, Lever location) receive
  // real keydown→input→keyup sequences per character.
  const typeCharByChar = async (upToIndex) => {
    const currentVal = str.slice(0, upToIndex);
    // Only type the new characters (those not yet typed)
    const startFrom = input.value?.length ?? 0;
    for (let i = startFrom; i < upToIndex; i++) {
      const char = str[i];
      const partial = str.slice(0, i + 1);
      try {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: char, bubbles: true }));
        setValue(partial);
        input.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: char, bubbles: true }));
      } catch { /* ignore */ }
      if (!isBackground()) await sleep(40 + Math.random() * 30);
    }
    return currentVal;
  };

  const gatherSuggestions = () => {
    const controlsId = input.getAttribute?.('aria-controls') || input.getAttribute?.('aria-owns') || '';
    if (controlsId) {
      const lb = document.getElementById(controlsId);
      if (lb) { const opts = lb.querySelectorAll('[role="option"], li'); if (opts.length) return Array.from(opts); }
    }
    const parent = input.closest('.field, .form-group, [data-automation-id="formField"], div') || input.parentElement;
    if (parent) {
      const lb = parent.querySelector('[role="listbox"]');
      if (lb) { const opts = lb.querySelectorAll('[role="option"], li'); if (opts.length) return Array.from(opts); }
    }
    const globalLb = document.querySelector('[role="listbox"]');
    if (globalLb) { const opts = globalLb.querySelectorAll('[role="option"], li'); if (opts.length) return Array.from(opts); }
    const cands = document.querySelectorAll('[role="option"], .pac-item, [class*="suggestion"], [class*="autocomplete"] li, [class*="dropdown"] li');
    return Array.from(cands);
  };

  const scoreSugg = (text) => {
    const t = text.toLowerCase();
    const h = str.toLowerCase();
    if (t === h) return 1000;
    if (t.includes(h)) return 800 + Math.min(h.length, 80);
    if (h.includes(t)) return 700 + Math.min(t.length, 80);
    const hTok = new Set(h.split(/\W+/).filter(w => w.length > 1));
    const tTok = new Set(t.split(/\W+/).filter(w => w.length > 1));
    let inter = 0;
    for (const w of hTok) if (tTok.has(w)) inter++;
    const union = hTok.size + tTok.size - inter;
    return union ? (inter / union) * 380 : 0;
  };

  const tryClickBest = async () => {
    let suggs = gatherSuggestions();
    for (let i = 0; i < 3 && !suggs.length; i++) { await sleep(80); suggs = gatherSuggestions(); }
    if (!suggs.length) return false;

    let bestEl = null, bestScore = 0;
    for (const el of suggs) {
      const score = scoreSugg((el.textContent || '').trim());
      if (score > bestScore) { bestScore = score; bestEl = el; }
    }

    if (bestEl && bestScore >= 150) {
      try {
        bestEl.click();
        await sleep(80);
        // Confirm with Enter so location pickers register the selection
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, code: 'Enter', bubbles: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, code: 'Enter', bubbles: true }));
        await sleep(50);
        highlightField(input, 'success');
        return true;
      } catch { /* ignore */ }
    }
    return false;
  };

  // Type progressively at WORD BOUNDARIES so autocomplete APIs (Google Places,
  // Lever, Greenhouse) receive complete words and can return useful suggestions.
  // After each word is typed, wait for the suggestion list and pick the best match.
  const wordBreakpoints = [];
  for (let i = 0; i < str.length; i++) {
    // A word boundary is a space, comma, or the final character
    if (str[i] === ' ' || str[i] === ',' || i === str.length - 1) {
      wordBreakpoints.push(i + 1);
    }
  }
  // Deduplicate and ensure we always check the full string
  const breakpoints = [...new Set(wordBreakpoints)];
  if (!breakpoints.includes(str.length)) breakpoints.push(str.length);

  for (const bp of breakpoints) {
    await typeCharByChar(bp);
    await sleep(200 + Math.random() * 100); // wait for suggestions to render
    if (await tryClickBest()) return true;
  }

  // Final attempt with full value
  if ((input.value?.length ?? 0) < str.length) {
    await typeCharByChar(str.length);
  }
  await sleep(250);
  if (await tryClickBest()) return true;

  // Couldn't select suggestion — value is set from typing, highlight as-is
  if (input.value?.trim()) {
    highlightField(input, 'success');
    return true;
  }
  return false;
}

function highlightField(el, status = 'success') {
  const original = el.style.outline;
  let color = '#10b981'; // green
  if (status === 'warning') color = '#eab308'; // yellow
  if (status === 'error' || status === false) color = '#ef4444'; // red

  el.style.outline = `2px solid ${color}`;
  el.style.transition = 'outline 0.3s ease';
  setTimeout(() => { el.style.outline = original; }, 1500);
}

/**
 * Returns true if this text/textarea input is a conditional follow-up field
 * inside a radio/checkbox group (e.g. the text box that appears when "Custom"
 * or "Other" is selected). Such fields should NOT be filled unless the
 * associated option is actually checked.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} el
 * @param {string} fieldLabel
 * @returns {boolean}
 */
export function isConditionalFollowUp(el, fieldLabel) {
  const combined = `${fieldLabel || ''} ${el?.placeholder || ''} ${el?.getAttribute?.('aria-label') || ''}`.toLowerCase();
  // Referral-source free-text that appears after choosing "Other" is NOT a
  // radio follow-up — always allow the matcher / filler to run.
  if (
    /\b(specify|please explain|please describe|if other|additional detail|please enter)\b/.test(combined)
    && /\b(hear|heard|referral|source|opening|opportunity|position|job|find us|about us)\b/.test(combined)
  ) {
    return false;
  }

  // Find the nearest container that holds radio/checkbox inputs
  const container =
    el.closest('fieldset, [role="group"]') ??
    el.closest('.field, .form-group, li, [class*="question"], [class*="pronoun"], [class*="eeo"]');
  if (!container) return false;

  const checkboxes = Array.from(
    container.querySelectorAll('input[type="radio"], input[type="checkbox"]')
  );
  if (!checkboxes.length) return false;

  // 1. Find a checkbox whose label closely matches this field's label
  const lowerLabel = (fieldLabel || el.placeholder || '').toLowerCase().trim();
  if (lowerLabel) {
    for (const cb of checkboxes) {
      const cbLabel = (getLabelForInput(cb) || cb.value || '').toLowerCase().trim();
      if (cbLabel && (lowerLabel.includes(cbLabel) || cbLabel.includes(lowerLabel))) {
        return !cb.checked; // only skip if the associated checkbox is NOT checked
      }
    }
  }

  // 2. Generic: text input label/placeholder signals it's conditional
  if (/\b(custom|other|specify|please|describe|if yes|if so|pronoun)\b/i.test(fieldLabel || el.placeholder || '')) {
    // Skip unless at least one associated checkbox IS checked
    const anyChecked = checkboxes.some(cb => cb.checked);
    if (!anyChecked) return true; // nothing selected yet — definitely skip
    // If checked, still skip if no checkbox with a similar label is checked
    return !checkboxes.some(cb =>
      cb.checked &&
      /\b(custom|other)\b/i.test(getLabelForInput(cb) || cb.value || '')
    );
  }

  return false;
}

export function getLabelForInput(input) {
  if (input.id) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (label) return label.textContent?.trim();
  }
  const parent = input.closest('label');
  if (parent) return parent.textContent?.replace(input.value, '').trim();
  
  // Greenhouse/Workday specific: label is often a sibling or sibling of parent
  const container = input.closest('.field, [data-automation-id="formField"]');
  if (container) {
    const label = container.querySelector('label');
    if (label) return label.textContent?.trim();
  }

  return null;
}
