/**
 * Scans the page for all fillable fields and returns an array of FieldDescriptors.
 * For dynamic platforms (Workday, Lever, Ashby), sets up a MutationObserver
 * to catch fields added after the initial scan.
 *
 * @param {string} platform
 * @param {function} onNewFields - called with updated full field list when DOM changes
 * @returns {Array<FieldDescriptor>}
 */
export function scanFields(platform, onNewFields) {
  const fields = collectFields();

  if (['workday', 'lever', 'ashby', 'generic', 'generic-weak'].includes(platform)) {
    let lastFieldCount = fields.length;

    const observer = new MutationObserver(() => {
      const updated = collectFields();

      // Step-change detection: if visible field count drops to ≤1, Workday has
      // navigated to the next step. Signal this via onNewFields with the fresh list.
      const visibleCount = updated.filter(f => f.element?.isConnected).length;
      if (lastFieldCount > 1 && visibleCount <= 1) {
        // New Workday step — wait briefly for the next step's DOM to settle
        setTimeout(() => {
          const afterSettle = collectFields();
          lastFieldCount = afterSettle.length;
          onNewFields(afterSettle);
        }, 800);
        return;
      }

      lastFieldCount = updated.length;
      onNewFields(updated);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window._autoapplyObserver = observer;
  }

  return fields;
}

export function stopObserver() {
  window._autoapplyObserver?.disconnect();
  delete window._autoapplyObserver;
}

/**
 * Scrolls a specific field element into the center of the viewport and waits
 * for Angular/React to fully hydrate it. Call before filling any field on
 * Workday (and optionally other dynamic platforms).
 *
 * @param {Element} el
 * @returns {Promise<void>}
 */
export async function scrollFieldIntoView(el) {
  return new Promise(resolve => {
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch {
      // Element may not support scrollIntoView — safe to ignore
    }
    setTimeout(resolve, 300);
  });
}

/**
 * Retries a list of failed fields up to `maxRetries` times with increasing
 * delays. Calls `fillFn(field)` for each retry attempt.
 *
 * @param {Array} failedFields - fields that did not fill on first attempt
 * @param {Function} fillFn - async function(field) → boolean (true = success)
 * @param {number} maxRetries - default 3
 * @returns {Promise<Array>} - fields that still failed after all retries
 */
export async function retryFailedFields(failedFields, fillFn, maxRetries = 3) {
  const delays = [500, 1000, 2000];
  let remaining = [...failedFields];

  for (let attempt = 0; attempt < maxRetries && remaining.length > 0; attempt++) {
    await new Promise(r => setTimeout(r, delays[attempt] ?? 2000));
    const stillFailing = [];
    for (const field of remaining) {
      const ok = await fillFn(field);
      if (!ok) stillFailing.push(field);
    }
    remaining = stillFailing;
  }

  return remaining;
}

/**
 * Scrolls to the bottom of the page to trigger lazy rendering of submit buttons
 * (required for Workday multi-step forms).
 */
export async function scrollToBottom() {
  return new Promise(resolve => {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    setTimeout(resolve, 800);
  });
}

// ─── Shadow DOM Utilities ──────────────────────────────────────────────────────

/**
 * Returns the shadow root of an element, piercing closed roots via the
 * Chrome Extension API (chrome.dom.openOrClosedShadowRoot — available in MV3
 * content scripts since Chrome 106). Returns null if the element has no shadow.
 *
 * @param {Element} el
 * @returns {ShadowRoot|null}
 */
function getShadowRoot(el) {
  try {
    // Open shadow root: directly accessible
    if (el.shadowRoot) return el.shadowRoot;
    // Closed shadow root: requires the privileged extension API
    if (typeof chrome?.dom?.openOrClosedShadowRoot === 'function') {
      return chrome.dom.openOrClosedShadowRoot(el) ?? null;
    }
  } catch { /* ignore SecurityError or unsupported */ }
  return null;
}

// ─── Field Collection ──────────────────────────────────────────────────────────

/**
 * Entry point: collects all fillable fields from the document, including those
 * nested inside Shadow Roots (up to MAX_SHADOW_DEPTH levels deep).
 */
function collectFields() {
  const seen = new WeakSet();
  const platform = detectPlatform();
  const results = [];

  _walkRoot(document, results, seen, platform, 0);

  return results;
}

/** Maximum levels of Shadow DOM nesting to traverse. Workday uses ≤3 in practice. */
const MAX_SHADOW_DEPTH = 5;

/**
 * Recursively collects fillable fields from a DOM root (Document or ShadowRoot).
 * After collecting standard fields, it walks all elements in this root looking
 * for shadow hosts and recurses into each one (depth-limited).
 *
 * @param {Document|ShadowRoot} root
 * @param {Array} results        — accumulator (mutated in place)
 * @param {WeakSet} seen         — dedup set for elements and shadow roots
 * @param {string} platform
 * @param {number} depth         — current shadow nesting level
 */
function _walkRoot(root, results, seen, platform, depth) {
  // ── 1. Interactive form fields ────────────────────────────────────────────
  const candidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]), textarea, select, [role="combobox"], [role="listbox"]'
  );

  for (const el of candidates) {
    if (seen.has(el)) continue;
    if (el.type === 'hidden' || el.getAttribute('aria-hidden') === 'true') continue;
    try {
      if (el.tagName === 'IFRAME' && el.contentDocument === null) continue;
    } catch { continue; }
    if (!isVisible(el)) continue;

    seen.add(el);
    results.push({
      element: el,
      type: getFieldType(el),
      label: getLabelText(el, platform),
      placeholder: el.placeholder ?? el.getAttribute('placeholder') ?? '',
      name: el.name ?? el.getAttribute('name') ?? '',
      ariaLabel: el.getAttribute('aria-label') ?? '',
      context: getContext(el),
      maxLength: el.maxLength > 0 ? el.maxLength : null,
      platform,
      selectOptions: collectFieldOptions(el),
    });
  }

  // ── 2. File inputs (kept hidden by most ATSes — collect regardless of visibility) ──
  const fileInputs = root.querySelectorAll('input[type="file"]');
  for (const el of fileInputs) {
    if (seen.has(el)) continue;
    if (el.getAttribute('aria-hidden') === 'true') continue;
    if (el.disabled) continue;

    seen.add(el);
    results.push({
      element: el,
      type: 'file',
      label: getLabelText(el, platform) || guessUploadLabelFromContext(el),
      placeholder: el.getAttribute('placeholder') ?? '',
      name: el.name ?? el.getAttribute('name') ?? '',
      ariaLabel: el.getAttribute('aria-label') ?? '',
      context: getUploadContext(el),
      maxLength: null,
      platform,
      selectOptions: [],
    });
  }

  // ── 3. Recurse into Shadow Roots (depth-limited) ──────────────────────────
  if (depth < MAX_SHADOW_DEPTH) {
    const allEls = root.querySelectorAll('*');
    for (const el of allEls) {
      const shadow = getShadowRoot(el);
      if (!shadow) continue;
      // Use the shadow root object itself as the dedup key so we never walk the
      // same shadow twice even if the host element appears in multiple queries.
      if (seen.has(shadow)) continue;
      seen.add(shadow);
      _walkRoot(shadow, results, seen, platform, depth + 1);
    }
  }
}

/**
 * Options for native <select> or <input list="..."> (datalist).
 * @param {Element} el
 * @returns {{ value: string, text: string }[]}
 */
function collectFieldOptions(el) {
  if (el.tagName === 'SELECT') {
    return Array.from(el.options)
      .filter((o) => !o.disabled && (o.text || '').trim().length > 0)
      .filter((o) => !(o.value === '' && /^(select|choose|please|--)/i.test((o.text || '').trim())))
      .map((o) => ({ value: o.value, text: (o.text || o.value || '').trim() }));
  }
  const listId = el.getAttribute?.('list');
  if (listId && el.tagName === 'INPUT') {
    const dl = document.getElementById(listId);
    if (dl) {
      return Array.from(dl.querySelectorAll('option'))
        .map((o) => ({
          value: o.value || o.textContent?.trim() || '',
          text: (o.textContent || o.value || '').trim(),
        }))
        .filter((o) => o.text.length > 0);
    }
  }
  return [];
}

/**
 * Lightweight hostname-based platform detection used internally by field collection.
 * For the full page-level detection (including generic job form sniffing),
 * use detectJobApplicationPage() from pageDetector.js instead.
 */
export function detectPlatform() {
  const host = window.location.hostname;
  
  // Explicitly skip major non-job domains to prevent false positives or errors
  if (host.includes('chatgpt.com') || host.includes('google.com') || host.includes('localhost')) {
    return 'generic';
  }

  if (host.includes('greenhouse.io')) return 'greenhouse';
  if (host.includes('lever.co')) return 'lever';
  if (host.includes('myworkdayjobs.com')) return 'workday';
  if (host.includes('ashbyhq.com')) return 'ashby';
  if (document.querySelector('[data-gh-id]')) return 'greenhouse';
  
  return 'generic';
}

function getFieldType(el) {
  if (el.tagName === 'TEXTAREA') return 'textarea';
  if (el.tagName === 'SELECT') return 'select';
  // Custom dropdowns are often <input type="text" role="combobox">.
  // Role must win over the input's "type" or we incorrectly treat it as text.
  if (el.getAttribute('role') === 'combobox') return 'select';
  if (el.getAttribute('role') === 'listbox') return 'select';
  if (el.getAttribute('aria-haspopup') === 'listbox') return 'select';
  if (el.getAttribute('type')) return el.getAttribute('type');
  return 'text';
}

function isVisible(el) {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
  
  const rect = el.getBoundingClientRect();
  // Greenhouse/Workday sometimes have fields with 0 height until scrolled into view or parent height settles
  // We allow fields with 0 area if they have a name/id and aren't display:none
  if (style.display !== 'none' && (el.id || el.name)) return true;
  
  return rect.width > 0 && rect.height > 0;
}

function getLabelText(el, platform) {
  // Resolve the root that contains this element — either a ShadowRoot or the
  // top-level document. Label lookups must be scoped to the same root; a
  // document.querySelector cannot reach inside a shadow root and vice-versa.
  const root = (el.getRootNode && el.getRootNode() instanceof ShadowRoot)
    ? el.getRootNode()
    : document;

  // Common: Check for 'for' attribute
  if (el.id) {
    const label = root.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      ?? document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent?.trim() ?? '';
  }

  // Workday specialized: labels are often wrapped in a container above the input
  if (platform === 'workday') {
    const wdContainer = el.closest('[data-automation-id="formField"]');
    if (wdContainer) {
      const label = wdContainer.querySelector('label');
      if (label) return label.textContent?.trim() ?? '';
    }
  }

  // Greenhouse specialized: uses data-gh-id and specific field structure
  if (platform === 'greenhouse') {
    const ghField = el.closest('.field, .field-wrapper, [data-gh-id]');
    if (ghField) {
      const label = ghField.querySelector('label, .label, .field-label');
      if (label) {
        // Remove ' (Required)' or '*' from Greenhouse labels
        return label.textContent?.replace(/\(Required\)$/i, '').replace(/\*$/, '').trim() ?? '';
      }
    }
  }

  // Aria-label / Labeledby
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;
  
  const labelledBy = el.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref) return ref.textContent?.trim() ?? '';
  }

  // Parent label / sibling search
  const parent = el.closest('label');
  if (parent) return parent.textContent?.trim() ?? '';
  
  const prev = el.previousElementSibling;
  if (prev && prev.tagName === 'LABEL') return prev.textContent?.trim() ?? '';
  
  // Last resort: search ancestor text
  let current = el.parentElement;
  for (let i = 0; i < 3 && current; i++) {
    const label = current.querySelector('label, span.label, .label');
    if (label) return label.textContent?.trim() ?? '';
    current = current.parentElement;
  }

  return '';
}

function getContext(el) {
  const container = el.closest('fieldset, [role="group"], .field, .form-group, li, div') ?? el.parentElement;
  return container?.textContent?.replace(/\s+/g, ' ').trim().slice(0, 300) ?? '';
}

function getUploadContext(el) {
  const container =
    el.closest(
      'fieldset, [role="group"], .field, .form-group, [data-automation-id="formField"], [data-testid*="upload"], [class*="upload"], li, div'
    ) ?? el.parentElement;
  const text = container?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  // For hidden inputs, sometimes the nearest container is tiny; walk up a bit to capture "Resume/CV".
  if (text.length >= 12) return text.slice(0, 300);

  let current = container?.parentElement ?? el.parentElement;
  for (let i = 0; i < 5 && current; i++) {
    const t = current.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    if (t.length >= 12) return t.slice(0, 300);
    current = current.parentElement;
  }
  return text.slice(0, 300);
}

function guessUploadLabelFromContext(el) {
  const ctx = getUploadContext(el).toLowerCase();
  if (/\b(resume|cv|curriculum vitae)\b/.test(ctx)) return 'Resume/CV';
  if (/\bcover letter\b/.test(ctx)) return 'Cover letter';
  if (/\bportfolio\b/.test(ctx)) return 'Portfolio';
  if (/\btranscript\b/.test(ctx)) return 'Transcript';
  return 'File upload';
}
