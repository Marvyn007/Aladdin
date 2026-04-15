import { AutoApplyPanel } from './ui/panel.js';

let host = null;
let shadow = null;
let panel = null;

/**
 * Injects the AutoApply floating widget into the page using Shadow DOM.
 * Returns the panel instance. Safe to call multiple times — returns existing panel.
 * @returns {AutoApplyPanel}
 */
export function injectPanel() {
  if (panel) return panel;

  host = document.createElement('div');
  host.id = 'autoapply-root';
  // Zero-size anchor positioned above everything.
  // DO NOT use `all: initial` — it resets positioning and stacking context.
  host.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    right: 0 !important;
    width: 0px !important;
    height: 0px !important;
    z-index: 2147483647 !important;
    pointer-events: none !important;
    overflow: visible !important;
    margin: 0 !important;
    padding: 0 !important;
    border: none !important;
    background: none !important;
    opacity: 1 !important;
    visibility: visible !important;
    display: block !important;
    transform: none !important;
    isolation: isolate !important;
    contain: none !important;
  `;

  document.documentElement.appendChild(host);
  shadow = host.attachShadow({ mode: 'closed' });
  
  // Ensure visual immunity by resetting all inherited CSS inside the shadow root
  const styleReset = document.createElement('style');
  styleReset.textContent = `
    :host {
      all: initial !important;
      display: block !important;
    }
  `;
  shadow.appendChild(styleReset);

  panel = new AutoApplyPanel(shadow);

  // Ensure we stay on top — re-append if anything moves us
  const observer = new MutationObserver(() => {
    if (host && host.parentNode !== document.documentElement) {
      document.documentElement.appendChild(host);
    }
    // If anything tries to hide us, force it back
    if (host && (host.style.display === 'none' || host.style.visibility === 'hidden')) {
      host.style.display = 'block';
      host.style.visibility = 'visible';
    }
  });
  observer.observe(document.documentElement, { childList: true, attributes: true, subtree: false });

  return panel;
}

export function removePanel() {
  host?.remove();
  host = null;
  shadow = null;
  panel = null;
}

export function getPanel() {
  return panel;
}
