/**
 * detector.js — Platform Detection & Global Error Boundary
 *
 * Responsibilities:
 *   1. Detect what job platform (if any) the current page belongs to.
 *   2. Extract job metadata (title, company).
 *   3. Install a global error boundary that silences extension zombie errors
 *      and cleans up the Ghost UI (Shadow DOM panel) when the context dies.
 */

import { detectJobApplicationPage, parseJobMeta } from '../utils/pageDetector.js';
import { isContextValid, isFatalExtensionError } from '../utils/contextGuard.js';
import { removePanel } from './shadow-root.js';

// Re-export detectJobApplicationPage as the single, canonical platform detection function.
// This is the ONLY function that should be used to determine the current page's platform.
export { detectJobApplicationPage };

/**
 * Parse job title and company from the current page.
 * @returns {{ jobTitle: string, company: string }}
 */
export function getJobMeta() {
  return parseJobMeta();
}

/**
 * Returns true if Aladdin should boot and auto-show the panel on this page.
 * 'generic'      → detected via DOM signals (2+) → auto-show
 * 'generic-weak' → only 1 DOM signal → popup/manual trigger only, don't auto-show
 * null           → no activation at all
 */
export function shouldActivate(platform) {
  return !!platform && platform !== 'generic-weak';
}

/**
 * Installs a global error boundary that:
 *   1. Catches "Extension context invalidated" and "Access to storage" errors
 *      from zombie scripts and suppresses them from cluttering the console.
 *   2. Removes the Shadow DOM panel ("Ghost Cleanup") when a fatal extension
 *      error is caught, so the side-panel doesn't stay stuck on the screen.
 */
export function installErrorBoundary() {
  // Synchronous error boundary
  window.addEventListener('error', (event) => {
    if (event.error && isFatalExtensionError(event.error)) {
      event.preventDefault(); // Suppress from DevTools console
      performGhostCleanup();
      return true;
    }
  });

  // Async error boundary (Promise rejections)
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason && isFatalExtensionError(event.reason)) {
      event.preventDefault(); // Suppress from DevTools console
      performGhostCleanup();
    }
  });
}

/**
 * Ghost Cleanup — removes the dead Shadow DOM host element from the page
 * so that a crashed extension UI doesn't linger on the screen.
 */
function performGhostCleanup() {
  try {
    removePanel();
  } catch {
    // The shadow root itself may be dead — nothing more to do.
  }

  // Also try to remove by ID as a failsafe
  try {
    document.getElementById('autoapply-root')?.remove();
  } catch {
    // Truly dead — page will clean it up naturally.
  }
}
