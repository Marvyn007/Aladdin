/**
 * index.js — The Orchestrator
 *
 * This file is intentionally thin. It wires together the three domain modules:
 *   - detector.js  → Platform detection & global error boundary
 *   - automation.js → Core fill loop & field processing
 *   - ui-bridge.js  → Panel management & profile syncing
 *
 * It handles:
 *   1. Installing the global error boundary (first thing, before anything else).
 *   2. Booting: detecting platform, parsing job meta, creating the panel.
 *   3. Chrome message routing.
 *   4. Session expiration handling.
 */

import { detectJobApplicationPage, getJobMeta, shouldActivate, installErrorBoundary } from './detector.js';
import { isContextValid } from '../utils/contextGuard.js';
import {
  init as initAutomation,
  setPanel,
  setProfile as setAutomationProfile,
  setJobMeta as setAutomationJobMeta,
  startFill,
  pause as pauseAutomation,
  resume as resumeAutomation,
  getIsRunning,
  handleNewFields,
  getFieldsToFill,
  getCompletedCount
} from './automation.js';
import {
  getOrCreatePanel,
  getPanel,
  ensureProfile,
  syncPanelProfileData,
  saveLearnedAnswer,
  getProfile,
  setProfile,
  clearProfile
} from './ui-bridge.js';

// ─── Step 1: Install the Error Boundary IMMEDIATELY ────────────────────────────
// This MUST be the first thing that runs so zombie-script errors
// are caught before any other code has a chance to throw.
installErrorBoundary();

// ─── Module-level State ────────────────────────────────────────────────────────

let platform = null;
let jobTitle = '';
let company = '';

// ─── Boot ──────────────────────────────────────────────────────────────────────

async function boot() {
  // Context guard: if the extension has been unloaded, stop immediately.
  if (!isContextValid()) return;
  if (window !== window.top) return;

  platform = detectJobApplicationPage();
  if (!shouldActivate(platform)) {
    // Silent exit — Aladdin only loads on supported job boards.
    return;
  }

  const meta = getJobMeta();
  jobTitle = meta.jobTitle;
  company = meta.company;

  // Create the panel and wire it to the automation engine
  const panel = getOrCreatePanel(platform, jobTitle, company, startFillWrapper);
  if (!panel) return;

  panel.setJobMeta(jobTitle, company, platform);
  panel.setState('idle');

  // Initialise the automation engine with references
  initAutomation({
    panel,
    profile: getProfile(),
    jobTitle,
    company,
    platform,
    ensureProfile,
    saveLearnedAnswer,
    syncPanelProfileData
  });

  // Kick off a background profile fetch (non-blocking)
  ensureProfile().catch(() => {});
}

/**
 * Thin wrapper around startFill that syncs the latest profile
 * into the automation engine before starting.
 */
async function startFillWrapper(opts) {
  const currentPanel = getOrCreatePanel(platform, jobTitle, company, startFillWrapper);
  if (!currentPanel) {
    return { success: false, error: 'This page is not a supported job application.' };
  }

  // Sync latest references into the automation engine
  setPanel(currentPanel);
  setAutomationProfile(getProfile());
  setAutomationJobMeta(jobTitle, company);

  return startFill(opts);
}

// ─── Chrome Message Router ─────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  // ── Session Expiration (broadcast from background.js) ──
  if (message.action === 'SESSION_EXPIRED') {
    pauseAutomation();
    clearProfile();
    const panel = getPanel();
    panel?.addLog('Session Expired. Please sign in to Aladdin again.');
    panel?.setState('idle');
    sendResponse({ success: true });
    return true;
  }

  // ── Session Updated (user just signed in) ──
  if (message.action === 'SESSION_UPDATED') {
    ensureProfile(true).then((freshProfile) => {
      if (freshProfile) {
        setAutomationProfile(freshProfile);
        const panel = getPanel();
        panel?.addLog('Signed in to Aladdin. Ready to auto-fill.');
        panel?.setState('idle');
      }
    }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }

  const handle = async () => {
    // ── Dead Man's Switch: if context is dead, respond with error and bail ──
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
            pendingQuestions: 0
          },
          requiresInput: false
        };
        return { supported: !!platform, snapshot };
      }

      case 'SHOW_AUTO_APPLY_PANEL':
      case 'OPEN_AUTO_APPLY_PANEL':
      case 'OPEN_PANEL': {
        // If the panel wasn't created because it's a generic page, create it now
        const currentPlatform = platform || 'generic';
        const currentPanel = getOrCreatePanel(currentPlatform, jobTitle, company, startFillWrapper, true);
        if (!currentPanel) {
          return { success: false, error: 'Could not create panel on this page.', supported: false };
        }

        await ensureProfile(true);
        currentPanel.show();
        currentPanel.open();
        return { success: true, supported: currentPlatform !== 'generic', snapshot: currentPanel.getSnapshot() };
      }

      case 'HIDE_AUTO_APPLY_PANEL': {
        const panel = getPanel();
        if (!panel) {
          return { success: false, error: 'The AutoApply panel is not open on this page.', supported: platform !== 'generic' };
        }
        panel.hide();
        return { success: true, supported: platform !== 'generic', snapshot: panel.getSnapshot() };
      }

      case 'START_AUTO_APPLY': {
        const result = await startFillWrapper({ source: 'popup' });
        const currentPanel = getOrCreatePanel(platform || 'generic', jobTitle, company, startFillWrapper);
        return { ...result, supported: true, snapshot: currentPanel?.getSnapshot() ?? null };
      }

      default:
        return { error: 'Something went wrong. Please refresh the page and try again.' };
    }
  };

  handle().then(sendResponse).catch((error) => {
    sendResponse({ error: error?.message ?? String(error) });
  });
  return true;
});

// ─── Boot Trigger ──────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
