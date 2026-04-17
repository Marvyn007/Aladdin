/**
 * Workday footer navigation — locate "Save and Continue" / Next controls.
 * Workday often renders these as <div role="button"> inside
 * [data-automation-id="footerButtons"], not native <button> elements.
 */

function isVisible(el) {
  if (!el || !el.getBoundingClientRect) return false;
  const s = window.getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
  const r = el.getBoundingClientRect();
  if (r.width > 0 && r.height > 0) return true;
  // jsdom / pre-paint: Workday often uses div[role="button"] with no layout box yet
  const tag = el.tagName;
  const txt = (el.textContent || el.value || '').trim();
  if (txt && (tag === 'BUTTON' || el.getAttribute('role') === 'button')) return true;
  return false;
}

function textOf(el) {
  return (el.textContent || el.value || el.getAttribute('aria-label') || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * @param {ParentNode} [root=document]
 * @returns {Element|null}
 */
export function findWorkdaySaveAndContinue(root = document) {
  const selectors = [
    '[data-automation-id="bottom-navigation-next-button"]',
    '[data-automation-id="nextButton"]',
    '[data-automation-id="footerButtons"] button',
    '[data-automation-id="footerButtons"] [role="button"]',
    '[data-automation-id="footerButtons"] div[tabindex="0"]',
    '[data-automation-id="pageFooter"] button',
    '[data-automation-id="pageFooter"] [role="button"]',
    '[data-automation-id="pageFooter"] div[tabindex="0"]',
    '[data-automation-id="footerContainer"] [role="button"]',
    '[data-automation-id="footerContainer"] button',
  ];

  const rank = (txt) => {
    if (txt.includes('save and continue')) return 0;
    if (txt === 'continue' || txt.startsWith('continue ')) return 1;
    if (txt.includes('next step')) return 2;
    if (txt === 'next' || txt.startsWith('next ')) return 3;
    return 99;
  };

  let best = null;
  let bestRank = Infinity;

  for (const sel of selectors) {
    let nodes;
    try {
      nodes = root.querySelectorAll(sel);
    } catch {
      continue;
    }
    for (const el of nodes) {
      if (!isVisible(el)) continue;
      const txt = textOf(el);
      const r = rank(txt);
      if (r === 99) continue;
      if (r < bestRank) {
        bestRank = r;
        best = el;
      }
    }
  }

  if (best) return best;

  // Last resort: walk footer region for any clickable with matching text
  const footer = root.querySelector(
    '[data-automation-id="pageFooter"], [data-automation-id="footerContainer"], [data-automation-id="footerButtons"]'
  );
  if (!footer) return null;

  const candidates = footer.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"], a[role="button"], div[tabindex="0"]');
  for (const el of candidates) {
    if (!isVisible(el)) continue;
    const txt = textOf(el);
    const r = rank(txt);
    if (r === 99) continue;
    if (r < bestRank) {
      bestRank = r;
      best = el;
    }
  }
  return best;
}
