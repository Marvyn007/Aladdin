/**
 * iframe-bridge.js — Headless Fill Engine for ATS iFrames
 *
 * Architecture (Branch 4 decision, Paths A + B combined):
 *   - manifest.json injects content.js into `all_frames: true`.
 *   - Inside any sub-frame, the top orchestrator (index.js) decides whether
 *     the frame's origin belongs to a known ATS embed. If yes, it calls
 *     `bootHeadlessFrame()` from this module; if not, the sub-frame exits.
 *   - No panel UI is ever rendered inside a sub-frame. The top frame remains
 *     the sole orchestrator and messages us via `postMessage`.
 *
 * Covers: iCIMS, Taleo, Greenhouse (boards.greenhouse.io), Lever, Workable,
 *         Ashby, Workday, SmartRecruiters, Jobvite, UltiPro.
 *
 * Message protocol:
 *   Parent → Frame:  { source: 'aladdin-parent', action: 'FILL_FRAME',
 *                      requestId, profile, jobTitle, company }
 *   Frame → Parent:  { source: 'aladdin-frame',  action: 'FRAME_READY', href }
 *   Frame → Parent:  { source: 'aladdin-frame',  action: 'FILL_RESULT',
 *                      requestId, filled, skipped, failed }
 */

import { scanFields } from '../utils/platformDrivers.js';
import { matchFieldToProfile, inferSelectHintFromProfile, fuzzyMatchFieldToProfile } from '../utils/fieldMatcher.js';
import {
  fillTextInput,
  fillSelect,
  fillRadioOrCheckbox,
  fillFileInput,
  getNativeSelectOptions,
  sniffComboboxOptions,
  getRadioGroupLabel,
  getRadioGroupOptions,
  fillRadioGroupOption,
} from '../utils/formFiller.js';
import { isContextValid } from '../utils/contextGuard.js';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

let _booted = false;

/**
 * Boot the headless fill engine inside an iCIMS or Taleo iframe.
 * Safe to call multiple times — only initialises once.
 */
export function bootHeadlessFrame() {
  if (_booted) return;
  _booted = true;

  // Signal readiness to the parent window
  _postToParent({ action: 'FRAME_READY', href: window.location.href });

  window.addEventListener('message', async (event) => {
    // Origin check: only accept messages from the parent frame
    if (event.source !== window.parent) return;

    const msg = event.data;
    if (!msg || msg.source !== 'aladdin-parent') return;

    if (msg.action === 'FILL_FRAME') {
      const { profile, jobTitle = '', company = '', requestId = null } = msg;
      const result = await _fillFrame(profile, jobTitle, company);
      _postToParent({ action: 'FILL_RESULT', requestId, ...result });
    }
  });
}

function detectFramePlatform() {
  const host = String(window.location.hostname || '').toLowerCase();
  if (host.includes('icims.com')) return 'icims';
  if (host.includes('taleo')) return 'taleo';
  if (host.includes('greenhouse.io')) return 'greenhouse';
  if (host.includes('lever.co')) return 'lever';
  if (host.includes('workable.com')) return 'workable';
  if (host.includes('ashbyhq.com')) return 'ashby';
  if (host.includes('myworkdayjobs.com')) return 'workday';
  if (host.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (host.includes('jobvite.com')) return 'jobvite';
  if (host.includes('recruiting.ultipro.com')) return 'ultipro';
  return 'generic';
}

function _postToParent(payload) {
  try {
    window.parent.postMessage({ source: 'aladdin-frame', ...payload }, '*');
  } catch { /* cross-origin parent — safe to ignore */ }
}

/**
 * Scans and fills all fields visible in this frame.
 * Returns a summary { filled, skipped, failed }.
 */
async function _fillFrame(profile, jobTitle, company) {
  if (!isContextValid()) return { filled: 0, skipped: 0, failed: 0 };

  const platform = detectFramePlatform();
  const fields = scanFields(platform, () => {}); // no live observer in headless mode

  let filled = 0;
  let skipped = 0;
  let failed = 0;

  const processedRadioGroups = new Set();

  for (const field of fields) {
    if (!isContextValid()) break;
    const { element, type, label, placeholder, name, ariaLabel, selectOptions = [] } = field;
    if (!element?.isConnected) continue;

    // ── File uploads: skip in headless mode (no panel to notify user) ──
    if (type === 'file') { skipped++; continue; }

    // ── Radio / checkbox groups ──
    if (type === 'radio' || type === 'checkbox') {
      const groupKey = element.name || element.closest('fieldset, [role="group"]')?.id || null;
      if (groupKey && processedRadioGroups.has(groupKey)) { skipped++; continue; }
      if (groupKey) processedRadioGroups.add(groupKey);

      const groupLabel = getRadioGroupLabel(element) || label;
      const groupOptions = getRadioGroupOptions(element);
      const profileVal =
        matchFieldToProfile({ label: groupLabel, placeholder: '', name: element.name || '', ariaLabel: '' }, profile) ??
        fuzzyMatchFieldToProfile({ label: groupLabel, placeholder: '', name: element.name || '', ariaLabel: '' }, profile);

      if (profileVal) {
        const ok = await fillRadioGroupOption(groupOptions, String(profileVal));
        ok ? filled++ : failed++;
      } else {
        skipped++;
      }
      continue;
    }

    // ── Profile / fuzzy match ──
    const profileValue =
      matchFieldToProfile({ label, placeholder, name, ariaLabel }, profile) ??
      fuzzyMatchFieldToProfile({ label, placeholder, name, ariaLabel }, profile);

    if (profileValue !== null) {
      let ok = false;
      if (type === 'select') {
        let opts = selectOptions?.length ? selectOptions : getNativeSelectOptions(element);
        if (!opts.length) opts = await sniffComboboxOptions(element);
        ok = await fillSelect(element, profileValue, 'success', opts.length ? opts : null);
      } else {
        ok = await fillTextInput(element, profileValue, 'success', { instant: true });
      }
      ok ? filled++ : failed++;
      await sleep(30);
    } else {
      skipped++;
    }
  }

  return { filled, skipped, failed };
}
