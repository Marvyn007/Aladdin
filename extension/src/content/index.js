/**
 * index.js — The Orchestrator + Detection Engine
 *
 * Architecture (Branches 2-7):
 *   - In every sub-frame: if the frame's origin is a known ATS embed
 *     (boards.greenhouse.io, jobs.lever.co, apply.workable.com, iCIMS, Taleo,
 *     Workday, Ashby, …), boot the headless fill engine. Otherwise exit.
 *   - In the top frame: run a continuous Detection Engine that re-evaluates
 *     the page whenever anything plausibly changed:
 *         * SPA navigation (pushState/replaceState/popstate/hashchange)
 *         * Large DOM mutations (debounced)
 *         * Clicks on "Apply" buttons (retry window)
 *         * First page paint (DOMContentLoaded / idle)
 *     Engine automatically goes dormant after 30s of no positive detection,
 *     and wakes up on the next navigation / hashchange.
 *
 *   - First detection of a supported page → attach panel (collapsed for
 *     weak matches, opened for strong) and never auto-restart fill on later
 *     SPA nav within that tab (Q5.3 B). Dismissal is not persisted (Q5.2 C).
 */

import {
  detectJobApplicationPageDetailed,
  getJobMeta,
  shouldActivate,
  shouldAnchor,
  isAtsIframeHost,
  installErrorBoundary,
} from './detector.js';
import { bootHeadlessFrame } from './iframe-bridge.js';
import { initIframeCoordinator } from './iframe-coordinator.js';
import { isContextValid } from '../utils/contextGuard.js';
import {
  init as initAutomation,
  setPanel,
  setProfile as setAutomationProfile,
  setJobMeta as setAutomationJobMeta,
  startFill,
  pause as pauseAutomation,
} from './automation.js';
import {
  getOrCreatePanel,
  getPanel,
  ensureProfile,
  syncPanelProfileData,
  saveLearnedAnswer,
  getProfile,
  clearProfile,
} from './ui-bridge.js';

// ─── Step 1: Install the Error Boundary IMMEDIATELY ────────────────────────────
// Must be first so zombie-script errors are caught before any other code throws.
installErrorBoundary();

// ─── Sub-frame Short-Circuit ──────────────────────────────────────────────────
//
// With `all_frames: true`, content.js is injected into every iframe on every
// page (ad iframes, chat widgets, etc). We exit fast unless the frame's origin
// is one we know we need to fill into.
const IS_SUBFRAME = (() => {
  try { return window !== window.top; } catch { return true; }
})();

if (IS_SUBFRAME) {
  try {
    const host = location.hostname;
    if (isAtsIframeHost(host)) {
      bootHeadlessFrame();
    }
    // For non-ATS iframes, do nothing. No observers, no detectors. This keeps
    // per-page content-script overhead close to what it was before `all_frames`.
  } catch {
    /* cross-origin access error — safe to ignore */
  }
} else {
  // Top frame: install the iframe coordinator IMMEDIATELY so we don't miss
  // FRAME_READY pings from fast-booting child iframes (e.g. Greenhouse
  // embeds that were prerendered in the DOM before we finished parsing).
  initIframeCoordinator();
}

// ─── Module-level state ───────────────────────────────────────────────────────

let platform = null;
let strength = null; // 'strong' | 'weak' | null
let jobTitle = '';
let company = '';
let lastLocationHref = location.href;

/** True once the panel has been injected at least once for this tab. */
let panelEverInjected = false;

/** Detection-engine lifecycle state */
let mutationObserver = null;
let mutationDebounceTimer = null;
let dormancyTimer = null;
let detectionPaused = false;
let applyClickRetryTimer = null;
let applyClickRetriesLeft = 0;

const MUTATION_DEBOUNCE_MS = 500;
const DORMANCY_MS = 30_000;
const APPLY_CLICK_RETRY_INTERVAL_MS = 500;
const APPLY_CLICK_RETRY_COUNT = 10;

// Strict match: only these exact (trimmed, lowercased) texts trigger the
// "user probably just opened an apply form" retry window. Prevents "Apply
// coupon", "Apply filter", etc. from firing this.
const APPLY_BUTTON_TEXTS = new Set([
  'apply',
  'apply now',
  'apply for this job',
  'apply for job',
  'start application',
  'submit application',
  'easy apply',
  'begin application',
]);

// ─── Public boot ──────────────────────────────────────────────────────────────

async function runInitialBoot() {
  if (!isContextValid()) return;

  // First detection pass
  runDetection('boot');

  // Wire up all re-detection triggers, regardless of whether the first pass
  // succeeded. SPA apps commonly render the form AFTER the initial paint.
  installReDetectionTriggers();
}

// ─── Detection Engine: triggers ───────────────────────────────────────────────

function installReDetectionTriggers() {
  // (1) History API patching for SPA navigation
  try {
    const _push = history.pushState;
    const _replace = history.replaceState;
    history.pushState = function (...args) {
      const r = _push.apply(this, args);
      scheduleDetection('pushstate');
      return r;
    };
    history.replaceState = function (...args) {
      const r = _replace.apply(this, args);
      scheduleDetection('replacestate');
      return r;
    };
  } catch { /* ignore — history API frozen by a weird site */ }

  window.addEventListener('popstate', () => scheduleDetection('popstate'));
  window.addEventListener('hashchange', () => scheduleDetection('hashchange'));

  // (2) Debounced MutationObserver on <body> — fires when forms appear/disappear
  startMutationObserver();

  // (3) Delegated "Apply" click listener (bubble phase, on document)
  document.addEventListener('click', onDocumentClickCapture, true);
  document.addEventListener('click', onDocumentClickCapture, false);

  // (4) Safety net: periodic re-check for the first 30s after DOM is ready
  //     (handles sites that don't fire any of the above when the form mounts).
  armDormancyTimer();
}

function startMutationObserver() {
  if (mutationObserver) return;
  try {
    mutationObserver = new MutationObserver(() => {
      if (detectionPaused) return;
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = setTimeout(() => {
        mutationDebounceTimer = null;
        scheduleDetection('mutation');
      }, MUTATION_DEBOUNCE_MS);
    });
    mutationObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
      attributes: false,
    });
  } catch { /* body not ready or observer disallowed */ }
}

function stopMutationObserver() {
  try { mutationObserver?.disconnect(); } catch { /* ignore */ }
  mutationObserver = null;
  if (mutationDebounceTimer) {
    clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = null;
  }
}

function armDormancyTimer() {
  if (dormancyTimer) clearTimeout(dormancyTimer);
  dormancyTimer = setTimeout(() => {
    // 30s of no positive detection → go dormant (stop burning CPU on
    // mutation observers). History events still wake us up.
    if (!platform) {
      detectionPaused = true;
      stopMutationObserver();
    }
  }, DORMANCY_MS);
}

function wakeFromDormancy() {
  if (!detectionPaused) return;
  detectionPaused = false;
  startMutationObserver();
  armDormancyTimer();
}

function onDocumentClickCapture(e) {
  try {
    const el = e.target?.closest?.('a, button, [role="button"], input[type="submit"], input[type="button"]');
    if (!el) return;
    const text = (
      el.textContent
      || el.value
      || el.getAttribute('aria-label')
      || ''
    ).trim().toLowerCase();
    if (!text || text.length > 40) return;
    if (!APPLY_BUTTON_TEXTS.has(text)) return;
    // The user just clicked an apply-style button. Run a short retry loop —
    // even if detection fails now, the form might mount within ~5s.
    wakeFromDormancy();
    startApplyClickRetry();
  } catch { /* ignore */ }
}

function startApplyClickRetry() {
  applyClickRetriesLeft = APPLY_CLICK_RETRY_COUNT;
  if (applyClickRetryTimer) clearInterval(applyClickRetryTimer);
  applyClickRetryTimer = setInterval(() => {
    applyClickRetriesLeft -= 1;
    scheduleDetection('apply-click-retry');
    if (applyClickRetriesLeft <= 0 || platform) {
      clearInterval(applyClickRetryTimer);
      applyClickRetryTimer = null;
    }
  }, APPLY_CLICK_RETRY_INTERVAL_MS);
}

/**
 * Coalesce multiple near-simultaneous triggers into a single detection pass.
 */
let pendingDetectionReason = null;
let pendingDetectionTimer = null;
function scheduleDetection(reason) {
  wakeFromDormancy();
  if (pendingDetectionTimer) return;
  pendingDetectionReason = reason;
  pendingDetectionTimer = setTimeout(() => {
    pendingDetectionTimer = null;
    const r = pendingDetectionReason;
    pendingDetectionReason = null;
    runDetection(r);
  }, 150);
}

// ─── Detection Engine: body ───────────────────────────────────────────────────

async function runDetection(reason) {
  if (!isContextValid()) return;

  const urlChanged = location.href !== lastLocationHref;
  lastLocationHref = location.href;

  const detection = detectJobApplicationPageDetailed();
  const nextPlatform = detection.platform;
  const nextStrength = detection.strength;

  const transitionedToMatch = !platform && !!nextPlatform;
  const strengthChanged = nextStrength !== strength;
  const platformChanged = nextPlatform !== platform;

  platform = nextPlatform;
  strength = nextStrength;

  if (!platform) {
    // No match yet. Engine stays active unless it times out via dormancy.
    return;
  }

  // Reset dormancy timer — we got a hit.
  armDormancyTimer();

  // Refresh job meta regardless (works for SPA navigation too).
  const meta = getJobMeta();
  const titleChanged = meta.jobTitle && meta.jobTitle !== jobTitle;
  const companyChanged = meta.company && meta.company !== company;
  jobTitle = meta.jobTitle || jobTitle;
  company = meta.company || company;

  // Case 1 — first-ever positive detection in this tab.
  if (transitionedToMatch || !panelEverInjected) {
    await attachPanelForFirstTime(reason);
    return;
  }

  // Case 2 — same platform, but SPA navigation changed the URL/meta. Refresh
  // meta in the panel, DO NOT auto-restart fill (Q5.3 B).
  if (urlChanged || titleChanged || companyChanged || platformChanged || strengthChanged) {
    const panel = getPanel();
    if (panel) {
      panel.setJobMeta(jobTitle, company, platform);
      if (urlChanged) {
        panel.addLog('New job detected — click Start to fill this application.');
      }
      // If fill is running on the OLD URL, stop it before user confirms.
      if (urlChanged) pauseAutomation();
    }

    // If we were previously only on a weak match but this page is now a strong
    // match, promote the panel: show it openly.
    if (strength === 'strong' && panel) {
      panel.show();
    }
  }
}

// ─── Panel attach (first-ever detection) ──────────────────────────────────────

async function attachPanelForFirstTime(reason) {
  const panel = getOrCreatePanel(platform, jobTitle, company, startFillWrapper, true);
  if (!panel) return;

  panelEverInjected = true;

  panel.setJobMeta(jobTitle, company, platform);
  panel.setState('idle');

  initAutomation({
    panel,
    profile: getProfile(),
    jobTitle,
    company,
    platform,
    ensureProfile,
    saveLearnedAnswer,
    syncPanelProfileData,
  });

  // Weak match: keep collapsed (just the ★ grip floats). User clicks to open.
  // Strong match: leave collapsed as well but add a ready-to-go log line.
  // (We intentionally don't auto-open the panel on strong matches — that would
  // be too aggressive. Users see the grip, click it to start.)
  panel.show();

  // Non-blocking profile fetch
  ensureProfile().catch(() => {});

  // Diagnostic
  if (reason && reason !== 'boot') {
    // intentionally quiet — no panel log on re-detection bootstraps
  }
}

// ─── startFill wrapper (unchanged logic, slimmed) ─────────────────────────────

async function startFillWrapper(opts) {
  const currentPanel = getOrCreatePanel(platform, jobTitle, company, startFillWrapper, true);
  if (!currentPanel) {
    return { success: false, error: 'This page is not a supported job application.' };
  }
  setPanel(currentPanel);
  setAutomationProfile(getProfile());
  setAutomationJobMeta(jobTitle, company);
  return startFill(opts);
}

// ─── Chrome message router ────────────────────────────────────────────────────
// Installed only in the top frame — sub-frames are orchestrated via postMessage
// (see iframe-bridge.js), not chrome.runtime messages.

if (!IS_SUBFRAME) chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === 'SESSION_EXPIRED') {
    pauseAutomation();
    clearProfile();
    const panel = getPanel();
    panel?.addLog('Session Expired. Please sign in to Aladdin again.');
    panel?.setState('idle');
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'SESSION_UPDATED') {
    ensureProfile(true)
      .then((freshProfile) => {
        if (freshProfile) {
          setAutomationProfile(freshProfile);
          const panel = getPanel();
          panel?.addLog('Signed in to Aladdin. Ready to auto-fill.');
          panel?.setState('idle');
        }
      })
      .catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  const handle = async () => {
    if (!isContextValid()) {
      return { error: 'The extension was reloaded or updated. Please refresh the page and try again.' };
    }

    switch (message.action) {
      case 'GET_AUTO_APPLY_STATE': {
        const panel = getPanel();
        const snapshot = panel?.getSnapshot() ?? {
          visible: false,
          open: false,
          state: 'idle',
          jobTitle,
          company,
          platform: platform || '',
          progress: {
            totalQuestions: 0,
            answeredQuestions: 0,
            profileAnswered: 0,
            aiAnswered: 0,
            manualAnswered: 0,
            pendingQuestions: 0,
          },
          requiresInput: false,
        };
        return { supported: !!platform, snapshot };
      }

      case 'SHOW_AUTO_APPLY_PANEL':
      case 'OPEN_AUTO_APPLY_PANEL':
      case 'OPEN_PANEL': {
        // Popup-triggered: force-create the panel even on unsupported pages
        // (user explicitly asked for it).
        const currentPlatform = platform || 'generic';
        const currentPanel = getOrCreatePanel(currentPlatform, jobTitle, company, startFillWrapper, true);
        if (!currentPanel) {
          return { success: false, error: 'Could not create panel on this page.', supported: false };
        }
        await ensureProfile(true);
        currentPanel.show();
        currentPanel.open();
        return {
          success: true,
          supported: currentPlatform !== 'generic',
          snapshot: currentPanel.getSnapshot(),
        };
      }

      case 'HIDE_AUTO_APPLY_PANEL': {
        const panel = getPanel();
        if (!panel) {
          return {
            success: false,
            error: 'The AutoApply panel is not open on this page.',
            supported: !!platform && platform !== 'generic',
          };
        }
        panel.hide();
        return {
          success: true,
          supported: !!platform && platform !== 'generic',
          snapshot: panel.getSnapshot(),
        };
      }

      case 'START_AUTO_APPLY': {
        const result = await startFillWrapper({ source: 'popup' });
        const currentPanel = getOrCreatePanel(
          platform || 'generic',
          jobTitle,
          company,
          startFillWrapper,
          true
        );
        return { ...result, supported: true, snapshot: currentPanel?.getSnapshot() ?? null };
      }

      default:
        return { error: 'Something went wrong. Please refresh the page and try again.' };
    }
  };

  handle()
    .then(sendResponse)
    .catch((error) => {
      sendResponse({ error: error?.message ?? String(error) });
    });
  return true;
});

// ─── Boot trigger ─────────────────────────────────────────────────────────────

if (!IS_SUBFRAME) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInitialBoot);
  } else {
    runInitialBoot();
  }
}

// Voluntary exports for tests (no-op at runtime in production)
export const __test__ = { scheduleDetection, runDetection };
