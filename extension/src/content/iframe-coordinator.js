/**
 * iframe-coordinator.js — Top-frame ↔ ATS iframe bridge (parent side).
 *
 * Why this exists:
 *   Many career sites (DataDog, Stripe, Figma, etc.) embed their Greenhouse /
 *   Lever / Workday / Ashby application form inside a **cross-origin iframe**.
 *   The top frame's `document` contains zero fillable inputs, so `scanFields`
 *   finds nothing and the fill loop exits immediately. Meanwhile the iframe's
 *   own content script boots `iframe-bridge.bootHeadlessFrame()` but sits idle
 *   because nobody has told it to fill.
 *
 *   This module is the missing half: it lives in the **top frame**, tracks
 *   which ATS iframes have announced `FRAME_READY`, and on demand postMessages
 *   a `FILL_FRAME` command with the user profile down into every one of them.
 *   The iframe replies with `FILL_RESULT`; we aggregate counts and surface
 *   them through the panel log.
 *
 * Protocol (mirror of iframe-bridge.js):
 *   Parent → Frame:  { source: 'aladdin-parent', action: 'FILL_FRAME',
 *                      requestId, profile, jobTitle, company }
 *   Frame  → Parent: { source: 'aladdin-frame',  action: 'FRAME_READY', href }
 *   Frame  → Parent: { source: 'aladdin-frame',  action: 'FILL_RESULT',
 *                      requestId, filled, skipped, failed }
 */

import { ATS_IFRAME_HOSTS } from '../utils/pageDetector.js';

const FILL_TIMEOUT_MS = 30_000; // iframe fill should finish well under this.
const DEFAULT_POLL_MS = 150;

let _installed = false;

/** Map<Window, { href: string }> — frames that posted FRAME_READY. */
const readyFrames = new Map();

/** Map<requestId, { resolve, frames: Set<Window>, partial: Array }> */
const inflight = new Map();

let _nextRequestId = 1;

/**
 * Public API — call once in the top frame during boot. Idempotent.
 */
export function initIframeCoordinator() {
  if (_installed) return;
  if (typeof window === 'undefined') return;
  _installed = true;
  window.addEventListener('message', _onMessage);
}

export function _resetForTests() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('message', _onMessage);
  }
  _installed = false;
  readyFrames.clear();
  inflight.clear();
  _nextRequestId = 1;
}

function _onMessage(event) {
  const msg = event?.data;
  if (!msg || msg.source !== 'aladdin-frame') return;

  if (msg.action === 'FRAME_READY') {
    if (event.source) readyFrames.set(event.source, { href: msg.href || '' });
    return;
  }

  if (msg.action === 'FILL_RESULT') {
    const ticket = inflight.get(msg.requestId);
    if (!ticket) return;
    ticket.partial.push({
      filled: Number(msg.filled) || 0,
      skipped: Number(msg.skipped) || 0,
      failed: Number(msg.failed) || 0,
      frame: event.source,
    });
    ticket.frames.delete(event.source);
    if (ticket.frames.size === 0) {
      clearTimeout(ticket.timer);
      inflight.delete(msg.requestId);
      ticket.resolve(ticket.partial);
    }
  }
}

/**
 * Find every `<iframe>` on the page whose src hostname is a known ATS embed.
 * Includes nested iframes (same-origin only — cross-origin descendants
 * announce themselves via FRAME_READY instead).
 */
export function collectAtsIframes(root = typeof document === 'undefined' ? null : document) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const matches = [];
  const iframes = root.querySelectorAll('iframe');
  for (const el of iframes) {
    const src = el.getAttribute('src') || el.src || '';
    if (!src) continue;
    let host = '';
    try { host = new URL(src, location.href).hostname.toLowerCase(); }
    catch { continue; }
    if (_matchesAtsHost(host)) matches.push(el);
  }
  return matches;
}

export function hasAtsIframes(root) {
  return collectAtsIframes(root).length > 0;
}

function _matchesAtsHost(host) {
  if (!host) return false;
  return ATS_IFRAME_HOSTS.some(x => host === x || host.endsWith('.' + x) || host.includes(x));
}

/**
 * Post FILL_FRAME into every ATS iframe on the page and await their results.
 *
 * @param {object} opts
 * @param {object} opts.profile       Apply-pilot user profile payload.
 * @param {string} [opts.jobTitle]
 * @param {string} [opts.company]
 * @param {object} [opts.panel]       Optional panel with .addLog(str).
 * @param {number} [opts.timeoutMs]   Overall timeout for all replies.
 * @param {Window} [opts.win]         Override for tests.
 * @returns {Promise<{filled:number, skipped:number, failed:number,
 *                    dispatched:number, replied:number}>}
 */
export async function fillAllAtsIframes({
  profile,
  jobTitle = '',
  company = '',
  panel = null,
  timeoutMs = FILL_TIMEOUT_MS,
  win = typeof window !== 'undefined' ? window : null,
} = {}) {
  const zero = { filled: 0, skipped: 0, failed: 0, dispatched: 0, replied: 0 };
  if (!profile || !win) return zero;

  const iframes = collectAtsIframes(win.document);
  if (iframes.length === 0) return zero;

  // We need the frame's contentWindow to know where to send.
  // Cross-origin iframes expose `contentWindow` (we just can't read properties)
  // which is all postMessage needs.
  const targets = [];
  for (const el of iframes) {
    try {
      const cw = el.contentWindow;
      if (cw) targets.push({ el, cw });
    } catch { /* ignore */ }
  }
  if (targets.length === 0) return zero;

  // If some iframes haven't posted FRAME_READY yet (script still booting),
  // give them a short window to register before we dispatch.
  await _waitForFramesReady(targets.map(t => t.cw), 1500);

  const requestId = `aladdin-fill-${Date.now()}-${_nextRequestId++}`;
  const frameSet = new Set(targets.map(t => t.cw));

  panel?.addLog?.(
    `Form lives inside ${targets.length} embedded iframe${targets.length > 1 ? 's' : ''}. Filling there.`
  );

  const resultPromise = new Promise((resolve) => {
    const timer = setTimeout(() => {
      inflight.delete(requestId);
      resolve(_ticketOrEmpty());
    }, timeoutMs);
    inflight.set(requestId, {
      resolve: (partial) => resolve(partial),
      frames: frameSet,
      partial: [],
      timer,
    });
  });

  for (const { cw } of targets) {
    try {
      cw.postMessage({
        source: 'aladdin-parent',
        action: 'FILL_FRAME',
        requestId,
        profile,
        jobTitle,
        company,
      }, '*');
    } catch { /* ignore */ }
  }

  const results = await resultPromise;
  const agg = results.reduce((acc, r) => ({
    filled:   acc.filled   + (r.filled   || 0),
    skipped:  acc.skipped  + (r.skipped  || 0),
    failed:   acc.failed   + (r.failed   || 0),
  }), { filled: 0, skipped: 0, failed: 0 });

  const summary = {
    ...agg,
    dispatched: targets.length,
    replied: results.length,
  };

  if (panel?.addLog) {
    if (summary.replied === 0) {
      panel.addLog('Embedded application did not respond. Try refreshing the page.');
    } else {
      panel.addLog(
        `Embedded form: filled ${summary.filled}, skipped ${summary.skipped}` +
        (summary.failed ? `, failed ${summary.failed}` : '') + '.'
      );
    }
  }
  return summary;
}

function _ticketOrEmpty() {
  return [];
}

async function _waitForFramesReady(expected, maxMs) {
  const start = Date.now();
  // Quick path: already all ready.
  const allReady = () => expected.every(w => readyFrames.has(w));
  if (allReady()) return;
  while (Date.now() - start < maxMs) {
    await new Promise(r => setTimeout(r, DEFAULT_POLL_MS));
    if (allReady()) return;
  }
  // Proceed anyway — some iframes may never call FRAME_READY (e.g. stuck load).
}
