/**
 * Returns the detected platform name if the current page is a job application,
 * or null if it's not.
 *
 * Return values:
 *   'greenhouse' | 'lever' | 'workday' | 'ashby' | 'icims' | 'ultipro' |
 *   'smartrecruiters' | 'jobvite' | 'taleo' | 'successfactors' | 'bamboohr' |
 *   'rippling' | 'breezy' | 'recruitee' | 'wellfound' | 'pinpoint' | 'dover' |
 *   'workable' | 'jazzhr' | 'bullhorn' |
 *   'generic'        → auto-show panel (2+ DOM signals)
 *   'generic-weak'   → popup-only trigger (1 DOM signal)
 *   null             → no activation
 *
 * @returns {string|null}
 */
export function detectJobApplicationPage() {
  const url = window.location.href;

  // ── Layer 1: URL patterns ──────────────────────────────────────────────────
  if (/greenhouse\.io\/[^/]+\/jobs\/|boards\.greenhouse\.io/.test(url)) return 'greenhouse';
  if (/jobs\.lever\.co\/[^/]+\/[a-f0-9-]{36}/.test(url)) return 'lever';
  if (/myworkdayjobs\.com/.test(url)) return 'workday';
  if (/jobs\.ashbyhq\.com/.test(url)) return 'ashby';
  if (/icims\.com/.test(url)) return 'icims';
  if (/recruiting\.ultipro\.com/.test(url)) return 'ultipro';
  if (/smartrecruiters\.com\/[^/]+\/[^/]+/.test(url)) return 'smartrecruiters';
  if (/jobvite\.com\/[^/]+\/job\//.test(url)) return 'jobvite';
  if (/taleo\.net/.test(url)) return 'taleo';
  if (/successfactors\.com|sapsf\.com/.test(url)) return 'successfactors';
  if (/bamboohr\.com/.test(url)) return 'bamboohr';
  if (/jobs\.rippling\.com/.test(url)) return 'rippling';
  if (/breezy\.hr/.test(url)) return 'breezy';
  if (/recruitee\.com/.test(url)) return 'recruitee';
  if (/wellfound\.com\/jobs/.test(url)) return 'wellfound';
  if (/pinpointhq\.com/.test(url)) return 'pinpoint';
  if (/app\.dover\.com/.test(url)) return 'dover';
  if (/apply\.workable\.com/.test(url)) return 'workable';
  if (/applytojob\.com/.test(url)) return 'jazzhr';
  if (/bullhornstaffing\.com/.test(url)) return 'bullhorn';

  // ── Layer 2: DOM signal count ──────────────────────────────────────────────
  return detectByDomSignals();
}

// ── False-positive blocklist ──────────────────────────────────────────────────
const BLOCKED_HOSTS = [
  'google.com', 'chatgpt.com', 'notion.so', 'slack.com',
  'mail.google.com', 'docs.google.com', 'sheets.google.com',
  'localhost',
];

const BLOCKED_SUBMIT_PATTERNS = /^(subscribe|contact us|send message|sign up|log in|login|register|search)$/i;

function isBlockedPage() {
  const host = window.location.hostname;
  if (BLOCKED_HOSTS.some(b => host.includes(b))) return true;

  // Check primary submit button text
  const submitBtn = document.querySelector(
    'button[type="submit"], input[type="submit"]'
  );
  if (submitBtn) {
    const text = (submitBtn.textContent || submitBtn.value || '').trim();
    if (BLOCKED_SUBMIT_PATTERNS.test(text)) return true;
  }
  return false;
}

function detectByDomSignals() {
  if (isBlockedPage()) return null;

  let score = 0;

  // Signal 1: file input inside a form
  const form = document.querySelector('form');
  if (form && form.querySelector('input[type="file"]')) score += 1;

  // Signal 2: job-related label/placeholder/aria text
  const pageText = document.body.innerText.toLowerCase();
  const jobTextSignals = ['resume', 'cover letter', 'work authorization', 'years of experience', 'linkedin', 'sponsorship'];
  if (jobTextSignals.some(s => pageText.includes(s))) score += 1;

  // Signal 3: page title / h1 contains apply keywords
  const titleText = (document.title + ' ' + (document.querySelector('h1')?.textContent ?? '')).toLowerCase();
  if (/\b(apply|application|job application)\b/.test(titleText)) score += 1;

  // Signal 4: structured data JobPosting
  const ldJson = document.querySelector('script[type="application/ld+json"]');
  if (ldJson) {
    try {
      const data = JSON.parse(ldJson.textContent);
      if (data['@type'] === 'JobPosting') score += 1;
    } catch { /* ignore */ }
  }

  // Signal 5: form with 4+ inputs + URL path contains /careers/ /jobs/ /apply
  if (form) {
    const visibleInputs = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    );
    const pathLower = window.location.pathname.toLowerCase();
    if (visibleInputs.length >= 4 && /\/(careers|jobs|apply)(\/|$)/.test(pathLower)) score += 1;
  }

  if (score >= 2) return 'generic';
  if (score === 1) return 'generic-weak';
  return null;
}

/**
 * Parses job title and company name from the current page.
 * @returns {{ jobTitle: string, company: string }}
 */
export function parseJobMeta() {
  // Try structured data first
  const ldJson = document.querySelector('script[type="application/ld+json"]');
  if (ldJson) {
    try {
      const data = JSON.parse(ldJson.textContent);
      if (data['@type'] === 'JobPosting') {
        return { jobTitle: data.title ?? '', company: data.hiringOrganization?.name ?? '' };
      }
    } catch { /* ignore parse errors */ }
  }

  const ogTitle = document.querySelector('meta[property="og:title"]')?.content ?? '';
  const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
  const titleTag = document.title ?? '';
  const jobTitle = h1 || ogTitle || titleTag;

  const companyEl = document.querySelector('[class*="company"], [class*="employer"], [data-company]');
  const company = companyEl?.textContent?.trim() ?? '';

  return { jobTitle, company };
}
