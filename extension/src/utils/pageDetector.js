/**
 * pageDetector.js — Job-application detection with multi-signal scoring.
 *
 * Detection runs in 5 layers, in order:
 *   0. Suppression (Q7.2): path/submit heuristics for login/checkout/search pages
 *      → if suppressed, return null immediately.
 *   1. URL patterns for ~20 known ATSes.
 *   2. URL param fingerprints (gh_jid, ashby_jid, lever_source, …) — these catch
 *      white-label career sites that proxy Greenhouse/Ashby/etc. under the
 *      employer's own domain (e.g. instacart.careers/job?gh_jid=…).
 *   3. DOM / iframe / script fingerprints for embedded ATS widgets.
 *   4. Generic DOM signal count (≥2 = generic; =1 = generic-weak).
 *
 * Back-compat entry point `detectJobApplicationPage()` returns the platform
 * string (or null). New entry point `detectJobApplicationPageDetailed()`
 * returns `{ platform, strength }` where strength is:
 *   'strong'   — known ATS or ≥2 DOM signals → panel auto-opens
 *   'weak'     — 1 DOM signal → floating ★ grip, no auto-open (Branch 2 D)
 *   null       — no activation at all
 */

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Legacy string-based detector, preserved for callers that rely on the
 * 'greenhouse' | 'lever' | … | 'generic' | 'generic-weak' | null shape.
 * @returns {string|null}
 */
export function detectJobApplicationPage() {
  return detectJobApplicationPageDetailed().platform;
}

/**
 * Full detector. Returns `{ platform, strength }`.
 *   - platform: canonical ATS string, 'generic', 'generic-weak', or null
 *   - strength: 'strong' | 'weak' | null
 */
export function detectJobApplicationPageDetailed() {
  if (isSuppressedPage()) return { platform: null, strength: null };

  // 1. ATS URL patterns
  const byUrl = detectByUrlPattern();
  if (byUrl) return { platform: byUrl, strength: 'strong' };

  // 2. URL param fingerprints (whitelabel → Greenhouse/Ashby/Lever/Workable)
  const byParam = detectByUrlParams();
  if (byParam) return { platform: byParam, strength: 'strong' };

  // 3. DOM/iframe/script fingerprints for embedded ATSes
  const byFingerprint = detectByATSFingerprint();
  if (byFingerprint) return { platform: byFingerprint, strength: 'strong' };

  // 4. Generic DOM signals
  const { platform, signalCount } = detectByDomSignals();
  if (platform === 'generic') return { platform: 'generic', strength: 'strong' };
  if (platform === 'generic-weak' || signalCount === 1) {
    return { platform: 'generic-weak', strength: 'weak' };
  }

  return { platform: null, strength: null };
}

// ─── Layer 0: Suppression (Q7.2) ──────────────────────────────────────────────

/**
 * Path fragments that typically indicate "this page is not a job application".
 * Match against `location.pathname` (and minor query hints).
 */
const SUPPRESSED_PATH_PATTERNS = [
  /\/log[-_]?in(\/|$)/i,
  /\/sign[-_]?in(\/|$)/i,
  /\/sign[-_]?up(\/|$)/i,
  /\/register(\/|$)/i,
  /\/checkout(\/|$)/i,
  /\/cart(\/|$)/i,
  /\/basket(\/|$)/i,
  /\/account\/billing/i,
  /\/billing(\/|$)/i,
  /\/subscribe(\/|$)/i,
  /\/payments?(\/|$)/i,
  /\/search(\/|$)/i,
];

/** Primary-submit-button texts that tell us this is a login/checkout/search page. */
const SUPPRESSED_SUBMIT_TEXT = /^\s*(sign\s*in|log\s*in|log\s*on|login|pay|pay\s*now|continue\s*to\s*payment|place\s*order|subscribe|search)\s*$/i;

/**
 * Returns true if this page should never auto-activate Aladdin, even if a
 * job-shaped form exists. Used by both Layer 0 of the detector and by the
 * re-detection engine as a fast early-exit.
 */
export function isSuppressedPage() {
  // Path heuristic
  const path = location.pathname || '';
  if (SUPPRESSED_PATH_PATTERNS.some((re) => re.test(path))) return true;

  // Root landing page with a giant single-form "Sign in" button = likely login
  const submit = document.querySelector(
    'button[type="submit"], input[type="submit"], button[data-testid*="submit" i]'
  );
  if (submit) {
    const text = (submit.textContent || submit.value || submit.getAttribute('aria-label') || '')
      .trim();
    if (SUPPRESSED_SUBMIT_TEXT.test(text)) return true;
  }
  return false;
}

// ─── Layer 1: URL Patterns ────────────────────────────────────────────────────

function detectByUrlPattern() {
  const url = location.href;
  if (/greenhouse\.io\/[^/]+\/jobs\/|boards\.greenhouse\.io|job-boards\.greenhouse\.io/.test(url)) return 'greenhouse';
  if (/jobs\.lever\.co\/[^/]+\/[a-f0-9-]{36}/.test(url)) return 'lever';
  if (/myworkdayjobs\.com|wd\d+\.myworkdayjobs\.com/.test(url)) return 'workday';
  if (/jobs\.ashbyhq\.com|ashbyhq\.com\/[^/]+/.test(url)) return 'ashby';
  if (/icims\.com/.test(url)) return 'icims';
  if (/recruiting\.ultipro\.com/.test(url)) return 'ultipro';
  if (/smartrecruiters\.com\/[^/]+\/[^/]+/.test(url)) return 'smartrecruiters';
  if (/jobvite\.com\/[^/]+\/job\/|app\.jobvite\.com\/j\//.test(url)) return 'jobvite';
  if (/taleo\.net|taleo\.com/.test(url)) return 'taleo';
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
  if (/\.linkedin\.com\/jobs\/view\//.test(url)) return 'linkedin';
  if (/indeed\.com\/(viewjob|jobs|apply)/.test(url)) return 'indeed';
  if (/glassdoor\.com\/job/.test(url)) return 'glassdoor';
  return null;
}

// ─── Layer 2: URL Param Fingerprints ──────────────────────────────────────────
// White-label / proxy cases where the URL host is the employer's own domain
// (e.g. `instacart.careers`, `careers.roblox.com`) but the query param betrays
// the underlying ATS.

function detectByUrlParams() {
  const params = new URLSearchParams(location.search);
  // Greenhouse: every employer-hosted Greenhouse page carries gh_jid (and often
  // gh_src / gh_jid_ref). This alone fixes the Instacart / Unity / Pinterest /
  // MongoDB / Roblox class of misses.
  if (params.has('gh_jid') || params.has('gh_src') || params.has('gh_aid')) return 'greenhouse';
  // Ashby: ashby_jid OR ashbyJobId
  if (params.has('ashby_jid') || params.has('ashbyJobId')) return 'ashby';
  // Lever: lever_source is the common referral param when embedded
  if (params.has('lever_source')) return 'lever';
  // Workable: sometimes employers iframe workable with ?workable_job=
  if (params.has('workable_job')) return 'workable';
  // Jobvite embed fingerprint
  if (params.has('jvs') || params.has('__jvst')) return 'jobvite';
  // SmartRecruiters embed
  if (params.has('srjid')) return 'smartrecruiters';
  return null;
}

// ─── Layer 3: DOM / Iframe / Script Fingerprints ──────────────────────────────

function detectByATSFingerprint() {
  // ── Embedded iframes: employer-hosted pages that iframe the ATS widget ───
  if (document.querySelector('iframe[src*="boards.greenhouse.io" i], iframe[src*="job-boards.greenhouse.io" i]')) return 'greenhouse';
  if (document.querySelector('iframe[src*="jobs.lever.co" i]')) return 'lever';
  if (document.querySelector('iframe[src*="apply.workable.com" i]')) return 'workable';
  if (document.querySelector('iframe[src*="jobs.ashbyhq.com" i]')) return 'ashby';
  if (document.querySelector('iframe[src*="myworkdayjobs.com" i]')) return 'workday';
  if (document.querySelector('iframe[src*="icims.com" i]')) return 'icims';
  if (document.querySelector('iframe[src*="smartrecruiters.com" i]')) return 'smartrecruiters';

  // ── Embedded scripts: Greenhouse embed script, Lever apply widget, etc. ──
  if (document.querySelector('script[src*="boards.greenhouse.io" i], script[src*="greenhouse.io/embed" i]')) return 'greenhouse';
  if (document.querySelector('script[src*="jobs.lever.co" i], script[src*="lever.co/embed" i]')) return 'lever';
  if (document.querySelector('script[src*="ashbyhq.com" i]')) return 'ashby';
  if (document.querySelector('script[src*="workable.com" i]')) return 'workable';

  // ── Meta / structural fingerprints (existing) ────────────────────────────
  if (
    document.querySelector('meta[name="application-name"][content="Workday"]') ||
    document.querySelector('[data-automation-id="jobPostingPage"]') ||
    document.querySelector('[data-automation-id="jobApplicationPage"]') ||
    (document.querySelector('[data-automation-id]') && /workday/i.test(document.title))
  ) return 'workday';

  if (
    document.querySelector('[data-gh-id], [data-ghs-id]') ||
    document.querySelector('meta[name="generator"][content*="Greenhouse" i]') ||
    document.querySelector('div#grnhse_app, div#grnhse_iframe, #grnhse')
  ) return 'greenhouse';

  if (
    document.querySelector('[class*="lever-"], [data-qa*="lever"]') ||
    document.querySelector('meta[name="generator"][content*="Lever" i]')
  ) return 'lever';

  if (
    document.querySelector('meta[name="generator"][content*="iCIMS" i]') ||
    document.querySelector('[class*="icims-"]') ||
    document.querySelector('link[href*="icims.com"]')
  ) return 'icims';

  if (
    document.getElementById('oracleTaleo') ||
    document.querySelector('[id*="taleo" i]') ||
    document.querySelector('script[src*="taleo"]')
  ) return 'taleo';

  if (
    document.querySelector('meta[name="generator"][content*="Ashby" i]') ||
    document.querySelector('[data-ashby-job-posting-id], [data-ashby-application-id]') ||
    document.querySelector('div#ashby_embed, div#ashby_job_board_embed')
  ) return 'ashby';

  if (
    document.querySelector('meta[name="generator"][content*="SmartRecruiters" i]') ||
    document.querySelector('[class*="smartrecruiters"]')
  ) return 'smartrecruiters';

  if (document.querySelector('[data-workable-widget], [data-whatever-workable]')) return 'workable';

  return null;
}

// ─── Layer 4: Generic DOM Signals ─────────────────────────────────────────────

/**
 * Scores the page on 5 job-specific signals. ≥2 = generic (strong), 1 = weak.
 * Returns { platform, signalCount }.
 */
function detectByDomSignals() {
  let score = 0;

  // Signal 1: file input inside a form (strong "resume upload" indicator)
  const form = document.querySelector('form');
  if (form && form.querySelector('input[type="file"]')) score += 1;

  // Signal 2: job-specific keywords present in page text
  const pageText = (document.body?.innerText || '').toLowerCase();
  const jobTextSignals = [
    'resume', 'cover letter', 'work authorization',
    'years of experience', 'linkedin profile', 'sponsorship',
    'eeo', 'voluntary self-identification',
  ];
  if (jobTextSignals.some((s) => pageText.includes(s))) score += 1;

  // Signal 3: title/h1 contains apply keywords
  const titleText = (document.title + ' ' + (document.querySelector('h1')?.textContent ?? ''))
    .toLowerCase();
  if (/\b(apply|application|job application|careers?|hiring)\b/.test(titleText)) score += 1;

  // Signal 4: JobPosting structured data
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const ld of ldScripts) {
    try {
      const data = JSON.parse(ld.textContent || '{}');
      const types = Array.isArray(data) ? data : [data];
      for (const t of types) {
        const ty = t?.['@type'];
        if (ty === 'JobPosting' || (Array.isArray(ty) && ty.includes('JobPosting'))) {
          score += 1;
          break;
        }
      }
    } catch { /* ignore parse errors */ }
  }

  // Signal 5: form with ≥4 inputs + url path mentions careers/jobs/apply
  if (form) {
    const visibleInputs = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select'
    );
    const pathLower = location.pathname.toLowerCase();
    if (visibleInputs.length >= 4 && /\/(careers?|jobs?|apply|application)(\/|$)/.test(pathLower)) score += 1;
  }

  if (score >= 2) return { platform: 'generic', signalCount: score };
  if (score === 1) return { platform: 'generic-weak', signalCount: score };
  return { platform: null, signalCount: 0 };
}

// ─── Job-meta parsing ─────────────────────────────────────────────────────────

/**
 * Parses job title and company name from the current page.
 * @returns {{ jobTitle: string, company: string }}
 */
export function parseJobMeta() {
  // Try structured data first
  const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const ld of ldScripts) {
    try {
      const data = JSON.parse(ld.textContent || '{}');
      const items = Array.isArray(data) ? data : [data];
      for (const it of items) {
        const ty = it?.['@type'];
        if (ty === 'JobPosting' || (Array.isArray(ty) && ty.includes('JobPosting'))) {
          return {
            jobTitle: it.title ?? '',
            company: it.hiringOrganization?.name ?? ''
          };
        }
      }
    } catch { /* ignore */ }
  }

  const ogTitle = document.querySelector('meta[property="og:title"]')?.content ?? '';
  const h1 = document.querySelector('h1')?.textContent?.trim() ?? '';
  const titleTag = document.title ?? '';
  const jobTitle = h1 || ogTitle || titleTag;

  const ogSite = document.querySelector('meta[property="og:site_name"]')?.content ?? '';
  const companyEl = document.querySelector('[class*="company" i], [class*="employer" i], [data-company]');
  const company = companyEl?.textContent?.trim() || ogSite || '';

  return { jobTitle, company };
}

/**
 * Fast boolean: is this frame's origin a known ATS embed we should bring
 * to life via `bootHeadlessFrame()`? Only consulted in sub-frames.
 */
export const ATS_IFRAME_HOSTS = [
  'icims.com',
  'taleo.net',
  'taleo.com',
  'boards.greenhouse.io',
  'job-boards.greenhouse.io',
  'jobs.lever.co',
  'apply.workable.com',
  'jobs.ashbyhq.com',
  'myworkdayjobs.com',
  'smartrecruiters.com',
  'jobs.smartrecruiters.com',
  'jobvite.com',
  'app.jobvite.com',
  'recruiting.ultipro.com',
];

export function isAtsIframeHost(hostname = location.hostname) {
  const h = String(hostname || '').toLowerCase();
  return ATS_IFRAME_HOSTS.some((x) => h === x || h.endsWith('.' + x) || h.includes(x));
}
