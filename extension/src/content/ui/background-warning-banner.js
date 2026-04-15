/**
 * background-warning-banner.js
 *
 * Renders a sticky amber warning banner at the top of the page when the user
 * switches away from a tab that is actively running autofill on a platform
 * (like Workday) whose lazy DOM rendering requires the tab to stay visible.
 *
 * The banner is injected directly into <body> (NOT the shadow DOM) so it
 * remains visible regardless of panel state.
 */

const BANNER_ID = 'aladdin-bg-warning-banner';
const DISMISSED_KEY = 'aladdin-bg-warning-dismissed';

/**
 * Show the sticky warning banner.
 * @param {string} platformLabel — Human-readable name shown in the message.
 */
export function showBackgroundWarningBanner(platformLabel = 'This page') {
  // Don't show if user already dismissed it this session
  if (sessionStorage.getItem(DISMISSED_KEY) === '1') return;
  // Don't create a duplicate
  if (document.getElementById(BANNER_ID)) return;

  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  Object.assign(banner.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    right: '0',
    zIndex: '2147483646',
    background: '#FEF3C7',
    color: '#92400E',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    fontWeight: '500',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    borderBottom: '2px solid #F59E0B',
    boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
    lineHeight: '1.5',
    boxSizing: 'border-box',
  });

  const message = document.createElement('span');
  message.textContent = `⚠️  ${platformLabel} requires your attention to fill some fields correctly. AutoApply may miss certain questions if you switch away from this tab — please stay here while it runs.`;

  const dismiss = document.createElement('button');
  dismiss.textContent = 'Got it';
  Object.assign(dismiss.style, {
    background: '#F59E0B',
    color: '#ffffff',
    border: 'none',
    borderRadius: '5px',
    padding: '5px 12px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: '0',
    lineHeight: '1.4',
  });

  dismiss.addEventListener('click', () => {
    banner.remove();
    // Suppress re-appearance for the rest of this browser session
    try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch { /* ignore */ }
  });

  banner.appendChild(message);
  banner.appendChild(dismiss);

  // Append to body — guard in case body isn't ready yet
  (document.body ?? document.documentElement).appendChild(banner);
}

/**
 * Remove the banner (called when user returns to the tab or fill completes).
 * Does NOT mark it as dismissed — it will reappear if they leave again.
 */
export function hideBackgroundWarningBanner() {
  document.getElementById(BANNER_ID)?.remove();
}

/**
 * Reset the session-level dismissal flag (call on new fill session start).
 */
export function resetBackgroundWarningDismissal() {
  try { sessionStorage.removeItem(DISMISSED_KEY); } catch { /* ignore */ }
}
