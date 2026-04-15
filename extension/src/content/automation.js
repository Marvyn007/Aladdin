/**
 * automation.js — Core Form-Filling Engine with Dead Man's Switch
 *
 * Responsibilities:
 *   1. The main `runFillLoop` that iterates fields and fills them.
 *   2. `processField` — evaluate each field, match to profile, ask LLM, or prompt user.
 *   3. `startFill` — the public entry point that resets state and kicks off the loop.
 *   4. Dead Man's Switch — if the extension context is invalidated mid-loop,
 *      the loop self-terminates silently without crashing the page.
 */

import { matchFieldToProfile, inferSelectHintFromProfile } from '../utils/fieldMatcher.js';
import {
  fillTextInput,
  fillSelect,
  fillRadioOrCheckbox,
  fillFileInput,
  getNativeSelectOptions,
  clickAutocompleteSuggestion,
  sniffComboboxOptions,
  getRadioGroupLabel,
  getRadioGroupOptions,
  fillRadioGroupOption,
  isConditionalFollowUp,
  fillLocationWithAutocomplete,
} from '../utils/formFiller.js';
import { scanFields, stopObserver, scrollFieldIntoView, retryFailedFields } from '../utils/platformDrivers.js';
import { isContextValid } from '../utils/contextGuard.js';
import { safeSendMessage } from '../utils/contextGuard.js';
import {
  showBackgroundWarningBanner,
  hideBackgroundWarningBanner,
  resetBackgroundWarningDismissal,
} from './ui/background-warning-banner.js';

// ─── Module State ──────────────────────────────────────────────────────────────

let isPaused = false;
let isStopped = false;
let isRunning = false;
let answerCache = {};
let fieldsToFill = [];
let currentIndex = 0;
let completedElements = new Set();
let progressBreakdown = { profileAnswered: 0, aiAnswered: 0, manualAnswered: 0 };
let pendingFileUploads = []; // labels of file fields that need manual upload
let failedFields = []; // fields that failed to fill — retried after main loop
let processedRadioGroups = new Set(); // tracks name attrs of already-handled radio/checkbox groups
let _inVerificationPass = false; // signals stricter AI mode during verification

// ─── Background Sprint Mode ────────────────────────────────────────────────────
// Platforms where instant fills may miss lazy-rendered fields — show a warning.
const BACKGROUND_UNRELIABLE_PLATFORMS = ['workday'];
const PLATFORM_LABELS = { workday: 'Workday' };

let _lockRelease = null;        // resolves the Web Lock promise when fill ends
let _visibilityHandler = null;  // stored so we can removeEventListener on stop

// These are injected by the orchestrator via `init()`
let _panel = null;
let _profile = null;
let _jobTitle = '';
let _company = '';
let _platform = null;
let _ensureProfile = null;
let _saveLearnedAnswer = null;
let _syncPanelProfileData = null;

const DOCUMENT_PATTERNS = {
  resume: /\b(resume|cv|curriculum vitae)\b/i,
  coverLetter: /\b(cover letter|motivation letter|motivational letter|letter of motivation)\b/i
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function notifyIfBackground(title, message) {
  if (document.visibilityState !== 'hidden') return;
  const tabResponse = await safeSendMessage({ action: 'GET_TAB_ID' });
  const tabId = tabResponse?.tabId ?? null;
  await safeSendMessage({ action: 'NOTIFY_USER', title, message, tabId });
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Initialise references from the orchestrator.
 * Called once after boot, and again whenever profile/panel changes.
 */
export function init({ panel, profile, jobTitle, company, platform, ensureProfile, saveLearnedAnswer, syncPanelProfileData }) {
  _panel = panel;
  _profile = profile;
  _jobTitle = jobTitle;
  _company = company;
  _platform = platform;
  _ensureProfile = ensureProfile;
  _saveLearnedAnswer = saveLearnedAnswer;
  _syncPanelProfileData = syncPanelProfileData;
}

/** Update a single reference without re-initialising everything. */
export function setPanel(panel) { _panel = panel; }
export function setProfile(profile) { _profile = profile; }
export function setJobMeta(jobTitle, company) { _jobTitle = jobTitle; _company = company; }

export function pause() { isPaused = true; }
export function resume() { isPaused = false; }
export function stop() {
  isStopped = true;
  stopObserver();
  _cleanupBackgroundSession();
}
export function getIsRunning() { return isRunning; }
export function getFieldsToFill() { return fieldsToFill; }

/**
 * Tear down the Web Lock and visibility listener at the end of any fill
 * session (whether it completed, was stopped, or errored).
 */
function _cleanupBackgroundSession() {
  // Release the Web Lock (allows Chrome to reclaim the scheduler slot)
  _lockRelease?.();
  _lockRelease = null;

  // Remove the visibility change listener
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
    _visibilityHandler = null;
  }

  // Hide the banner (fill is over, no need to warn any more)
  hideBackgroundWarningBanner();
}
export function getCompletedCount() { return completedElements.size; }

// ─── Field Utilities ───────────────────────────────────────────────────────────

function normalizeText(value) {
  return typeof value === 'string' ? value : '';
}

function isFieldAnswered(field) {
  const { element, type } = field;
  if (!element || !element.isConnected) return false;
  if (type === 'checkbox' || type === 'radio') return !!element.checked;
  if (type === 'file') return (element.files?.length ?? 0) > 0;
  return typeof element.value === 'string' ? element.value.trim().length > 0 : !!element.value;
}

function getFieldLabel(field) {
  return field.label || field.placeholder || field.name || 'This field';
}

function isLocationField(field) {
  const text = [field.label, field.placeholder, field.name, field.ariaLabel]
    .filter(Boolean).join(' ').toLowerCase();
  return /\b(location|city|address|zip|postal|state|region|where are you|current location)\b/.test(text);
}

function getFieldText(field) {
  return [field.label, field.placeholder, field.name, field.ariaLabel, field.context]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function detectRequestedDocument(field) {
  const fieldText = getFieldText(field);
  if (DOCUMENT_PATTERNS.resume.test(fieldText)) return 'resume';
  if (DOCUMENT_PATTERNS.coverLetter.test(fieldText)) return 'coverLetter';
  return null;
}

function getStoredDocument(documentType) {
  if (documentType === 'resume' && _profile?.resume?.ready) {
    return { label: 'resume', filename: normalizeText(_profile.resume.filename) || 'resume.pdf' };
  }
  if (documentType === 'coverLetter' && _profile?.coverLetter?.ready) {
    return { label: 'cover letter', filename: normalizeText(_profile.coverLetter.filename) || 'cover-letter.pdf' };
  }
  return null;
}

// ─── Progress Tracking ─────────────────────────────────────────────────────────

function updateProgress() {
  _panel?.setProgress({
    totalQuestions: fieldsToFill.length,
    answeredQuestions: completedElements.size,
    profileAnswered: progressBreakdown.profileAnswered,
    aiAnswered: progressBreakdown.aiAnswered,
    manualAnswered: progressBreakdown.manualAnswered,
    pendingQuestions: Math.max(fieldsToFill.length - completedElements.size, 0)
  });
}

function markAnswered(field, source = null) {
  if (!field?.element) return;
  if (!completedElements.has(field.element)) {
    completedElements.add(field.element);
    if (source === 'profile') progressBreakdown.profileAnswered += 1;
    else if (source === 'ai') progressBreakdown.aiAnswered += 1;
    else if (source === 'manual') progressBreakdown.manualAnswered += 1;
  }
  updateProgress();
}

function syncExistingAnswers(fieldList) {
  for (const field of fieldList) {
    if (isFieldAnswered(field)) completedElements.add(field.element);
  }
  updateProgress();
}

// ─── New Field Handler (MutationObserver callback) ─────────────────────────────

export function handleNewFields(updatedFields) {
  const newFields = updatedFields.filter(
    (field) => !fieldsToFill.some((existing) => existing.element === field.element)
  );
  if (!newFields.length) return;

  fieldsToFill.push(...newFields);
  syncExistingAnswers(newFields);
  _panel?.addLog(`${newFields.length} new questions were detected on the page.`);

  // MutationObserver heartbeat: restart the loop if it finished
  if (!isRunning && !isStopped && !isPaused) {
    _panel?.addLog('Restarting Autofill for new questions...');
    isRunning = true;
    runFillLoop().catch(console.error);
  }
}

// ─── Field Processing (the "brain") ────────────────────────────────────────────

async function processField(field) {
  // ─── Dead Man's Switch: check context before every field ───
  if (!isContextValid()) {
    return { _invalidated: true };
  }

  const { element, type, label, placeholder, name, ariaLabel, context, maxLength, selectOptions = [] } =
    field;
  const fieldLabel = getFieldLabel(field);

  const alreadyAnswered = isFieldAnswered(field);

  // For non-select fields (text, textarea, checkbox, etc.) skip if already filled —
  // the user may have typed something intentionally.
  // For select/combobox fields we ALWAYS attempt a profile match first because the
  // element may have a wrong default value (e.g. first-alphabetically country code,
  // wrong gender default) that the user hasn't manually set.
  if (alreadyAnswered && type !== 'select') {
    markAnswered(field);
    return;
  }

  // ═══ FILE UPLOAD ═══
  if (type === 'file') {
    const documentType = detectRequestedDocument(field);
    const savedDocument = getStoredDocument(documentType);

    if (savedDocument) {
      _panel?.hideFileAlert();
      _panel?.addLog(`Fetching your saved ${savedDocument.label}...`);

      try {
        const response = await safeSendMessage({ action: 'GET_DOCUMENT', type: documentType });
        if (response?._invalidated || response?.error === 'SESSION_EXPIRED') return response;

        const docPayload = response?.document;
        const base64 =
          (typeof docPayload?.pdfBase64 === 'string' && docPayload.pdfBase64) ||
          (typeof docPayload?.base64 === 'string' && docPayload.base64) ||
          (typeof docPayload?.data === 'string' && docPayload.data) ||
          '';
        const filename =
          (typeof docPayload?.filename === 'string' && docPayload.filename.trim()) ||
          savedDocument.filename;

        if (base64) {
          _panel?.addLog(`Uploading your saved ${savedDocument.label}.`);
          if (fillFileInput(element, base64, filename)) {
            markAnswered(field, 'profile');
            return;
          }
          _panel?.addLog(`The page rejected the automatic ${savedDocument.label} upload, so manual review is needed.`);
        }
      } catch {
        _panel?.addLog(`Failed to load ${savedDocument.label}.`);
      }
    }

    // Track this field for the manual-upload banner and skip (don't pause).
    await notifyIfBackground(
      'AutoApply — File Upload Needed',
      `${_company ? _company + ': ' : ''}Please upload a file to continue.`
    );
    pendingFileUploads.push(fieldLabel);
    const uploadCount = pendingFileUploads.length;
    const plural = uploadCount === 1 ? 'field' : 'fields';
    _panel?.showFileAlert(
      `${uploadCount} ${plural} still need${uploadCount === 1 ? 's' : ''} a manual document upload on this page.`
    );
    _panel?.addLog(`Skipped ${fieldLabel} — manual upload required.`);
    return;
  }

  let optionList =
    selectOptions?.length > 0
      ? selectOptions
      : type === 'select' && element.tagName === 'SELECT'
        ? getNativeSelectOptions(element)
        : [];

  // For custom comboboxes where options couldn't be pre-scanned, open the
  // dropdown briefly to sniff available options before asking the AI.
  // This lets the AI pick "Yes" / "No" / "May 2026" instead of writing prose.
  if (type === 'select' && optionList.length === 0 && element.tagName !== 'SELECT') {
    const sniffed = await sniffComboboxOptions(element);
    if (sniffed.length > 0) optionList = sniffed;
  }

  // ═══ RADIO / CHECKBOX GROUP (handled as a unit before profile match) ═══
  if (type === 'radio' || type === 'checkbox') {
    // Deduplicate: process each visual group only once.
    // Key priority: (1) shared name attr, (2) nearest fieldset/role=group container,
    // (3) nearest labeled container. This handles Lever-style checkboxes that have
    // unique name attributes per option but belong to the same visual group.
    // ── Step 1: Determine group container and groupKey ───────────────────────
    // Priority: (1) <fieldset>/role=group, (2) DOM section with 2+ same-type inputs
    // (catches Lever/Spotify unique-name-per-option pattern), (3) shared name attr.
    const fieldsetEl = element.closest('fieldset, [role="group"]');
    let groupKey;
    let groupContainerEl = fieldsetEl;

    if (fieldsetEl) {
      if (!fieldsetEl._aladdinGid) fieldsetEl._aladdinGid = `gid_${Math.random().toString(36).slice(2)}`;
      groupKey = fieldsetEl._aladdinGid;
    } else {
      // Walk up the DOM to find a section that holds 2+ same-type inputs.
      // This merges "unique name per option" groups into a single logical unit.
      let walkEl = element.parentElement;
      for (let d = 0; d < 8 && walkEl && !groupContainerEl; d++) {
        const siblings = walkEl.querySelectorAll(`input[type="${type}"]`);
        if (siblings.length >= 2) {
          const hasLabel =
            walkEl.querySelector('label, legend, p, span') ||
            (walkEl.previousElementSibling?.textContent?.trim().length ?? 0) > 4;
          if (hasLabel) {
            groupContainerEl = walkEl;
            if (!walkEl._aladdinGid) walkEl._aladdinGid = `gid_${Math.random().toString(36).slice(2)}`;
            groupKey = walkEl._aladdinGid;
          }
        }
        walkEl = walkEl.parentElement;
      }
      if (!groupContainerEl) {
        if (element.name) {
          groupKey = element.name;
        } else {
          const container = element.closest('.field, .form-group, li, [class*="question"]');
          if (container) {
            if (!container._aladdinGid) container._aladdinGid = `gid_${Math.random().toString(36).slice(2)}`;
            groupKey = container._aladdinGid;
          }
        }
      }
    }

    if (groupKey && processedRadioGroups.has(groupKey)) {
      markAnswered(field);
      return;
    }
    if (groupKey) processedRadioGroups.add(groupKey);

    // ── Step 2: Collect label + all options ──────────────────────────────────
    const groupLabel = getRadioGroupLabel(element) || fieldLabel;
    const collectInputOptions = (container) =>
      Array.from(container.querySelectorAll(`input[type="radio"],input[type="checkbox"]`))
        .filter(el => el.isConnected)
        .map(el => ({
          element: el,
          text: (el.id ? document.querySelector(`label[for="${el.id}"]`)?.textContent?.trim() : null)
            || el.closest('label')?.textContent?.replace(el.value, '').trim()
            || el.value || ''
        }))
        .filter(o => o.text.trim().length > 0);

    const groupOptions = groupContainerEl
      ? collectInputOptions(groupContainerEl)
      : getRadioGroupOptions(element);
    const optionTexts = groupOptions.map(o => o.text);

    // ── Step 3: Single-option catch-all safety ────────────────────────────────
    // Still only 1 option? (e.g. "Custom" or "Prefer not to disclose" separated
    // by an <hr>). Only click if the profile explicitly matches this single option.
    // Never send AI a single forced option — it always returns that option.
    if (groupOptions.length === 1) {
      const singleOptText = groupOptions[0].text;
      const profileVal = matchFieldToProfile(
        { label: groupLabel, placeholder: '', name: element.name || '', ariaLabel: '' },
        _profile
      );
      if (profileVal !== null) {
        const cands = (String(profileVal).toLowerCase().split(/\W+/).filter(w => w.length > 1));
        const optWords = singleOptText.toLowerCase().split(/\W+/).filter(w => w.length > 1);
        const isMatch = cands.some(c => optWords.some(w => w === c || w.includes(c) || c.includes(w)));
        if (isMatch) {
          await fillRadioGroupOption(groupOptions, String(profileVal));
          markAnswered(field, 'profile');
        } else {
          _panel?.addLog(`Skipped: "${singleOptText}" — not the profile answer for "${groupLabel}".`);
          markAnswered(field);
        }
      } else {
        _panel?.addLog(`Skipped: "${singleOptText}" — single-option group, no profile match.`);
        markAnswered(field);
      }
      return;
    }

    _panel?.addLog(`Processing: ${groupLabel}.`);

    // Profile match using GROUP label (not individual option label)
    const groupProfileValue = matchFieldToProfile(
      { label: groupLabel, placeholder: '', name: element.name || '', ariaLabel: '' },
      _profile
    );

    if (groupProfileValue !== null) {
      const ok = await fillRadioGroupOption(groupOptions, String(groupProfileValue));
      if (ok) markAnswered(field, 'profile');
      return;
    }

    // AI answer with group question + available options list
    const cacheKey = `radio_${groupLabel}_${optionTexts.join('|')}`.slice(0, 200);
    let answerObj = answerCache[cacheKey];

    if (!answerObj && optionTexts.length > 0) {
      try {
        const response = await safeSendMessage({
          action: 'GET_ANSWER',
          payload: {
            fieldLabel: groupLabel,
            fieldContext: context,
            jobTitle: _jobTitle,
            company: _company,
            maxLength: null,
            selectOptions: optionTexts,
            strict: _inVerificationPass, // stricter AI during verification pass
          },
        });
        if (response?._invalidated || response?.error === 'SESSION_EXPIRED') return response;
        if (response?.answer) {
          answerObj = { answer: response.answer, confidence: response.confidence ?? 100 };
          answerCache[cacheKey] = answerObj;
        }
      } catch { /* safeSendMessage surfaced the error */ }
    }

    if (answerObj) {
      _panel?.addAnswer(groupLabel, answerObj.answer);
      const ok = await fillRadioGroupOption(groupOptions, answerObj.answer,
        answerObj.confidence < 70 ? 'warning' : 'success');
      if (ok) markAnswered(field, 'ai');
      else _panel?.addLog(`Could not select option for: ${groupLabel} — please review manually.`);
      return;
    }

    // No options or AI failed — skip
    _panel?.addLog(`Skipped: ${groupLabel} — please review manually.`);
    return;
  }

  // ═══ PROFILE MATCH (non-radio fields) ═══
  const profileValue = matchFieldToProfile({ label, placeholder, name, ariaLabel }, _profile);
  if (profileValue !== null) {
    _panel?.addLog(`Filling ${fieldLabel}.`);
    let success = false;

    if (type === 'select') {
      success = await fillSelect(element, profileValue, 'success', optionList.length ? optionList : null);
    } else if (isLocationField(field) && type !== 'textarea') {
      // Location fields: type progressively and pick the best autocomplete suggestion
      // at each step (instead of pasting the full value at once).
      success = await fillLocationWithAutocomplete(element, profileValue);
      if (!success) {
        // Fallback: try standard fill
        success = await fillTextInput(element, profileValue, 'success', { instant: false });
      }
    } else {
      // Use char-by-char typing (instant: false) for text inputs so that
      // autocomplete / autosuggest frameworks (Google Places, React-controlled
      // pickers, etc.) receive the insertText events they need to show options.
      // Textarea and long values still use instant mode to avoid slow fills.
      const useInstant =
        type === 'textarea' ||
        (typeof profileValue === 'string' && profileValue.length > 80);
      success = await fillTextInput(element, profileValue, 'success', { instant: useInstant });
      if (success) {
        await clickAutocompleteSuggestion(element, profileValue);
        // Verify value persisted — some location/autocomplete fields clear the
        // input if no suggestion was confirmed, leaving the field empty.
        await sleep(150);
        if (!element.value?.trim()) success = false;
      }
    }

    if (success) markAnswered(field, 'profile');
    return;
  }

  // ═══ SELECT: profile-derived hint (university, EEO, etc.) without AI ═══
  if (type === 'select' && optionList.length > 0) {
    const hinted = inferSelectHintFromProfile({ label, placeholder, name, ariaLabel }, _profile);
    if (hinted) {
      _panel?.addLog(`Matching ${fieldLabel} to a dropdown option from your profile.`);
      const ok = await fillSelect(element, hinted, 'success', optionList);
      if (ok) {
        markAnswered(field, 'profile');
        return;
      }
    }
  }

  // If this was a select field that already had a default value and all profile-based
  // fill attempts failed, preserve the existing value rather than sending it to the AI
  // (which might pick something worse than the default).
  if (alreadyAnswered && type === 'select') {
    markAnswered(field);
    return;
  }

  // ═══ CONDITIONAL FOLLOW-UP CHECK ═══
  // Skip text/textarea inputs that are conditional follow-ups to radio/checkbox
  // options (e.g. the text box that appears when "Custom" pronoun is selected).
  // Filling them would trigger the associated checkbox to auto-check via JS.
  if (['text', 'textarea'].includes(type) && isConditionalFollowUp(element, fieldLabel)) {
    _panel?.addLog(`Skipped: ${fieldLabel} — conditional field (linked option not selected).`);
    markAnswered(field); // treat as done so verification pass doesn't retry
    return;
  }

  // ═══ AI ANSWER ═══
  if (['text', 'textarea', 'email', 'url', 'tel'].includes(type) || type === 'select') {
    const cacheKey = `${fieldLabel}${context || ''}${type === 'select' ? JSON.stringify(optionList.map((o) => o.text)) : ''}`.slice(0, 200);
    let answerObj = answerCache[cacheKey];

    if (!answerObj) {
      const useSelectOptions = type === 'select' && optionList.length > 0;
      _panel?.addLog(
        useSelectOptions
          ? `Choosing a dropdown option for ${fieldLabel}.`
          : `Generating an answer for ${fieldLabel}.`
      );
      try {
        const response = await safeSendMessage({
          action: 'GET_ANSWER',
          payload: {
            fieldLabel,
            fieldContext: context,
            jobTitle: _jobTitle,
            company: _company,
            maxLength,
            selectOptions: useSelectOptions ? optionList.map((o) => o.text) : undefined,
            strict: _inVerificationPass, // stricter AI during verification pass
          },
        });
        if (response?._invalidated || response?.error === 'SESSION_EXPIRED') return response;
        if (response?.answer) {
          answerObj = { answer: response.answer, confidence: response.confidence ?? 100 };
          answerCache[cacheKey] = answerObj;
        }
      } catch {
        // safeSendMessage already surfaced the issue
      }
    }

    if (answerObj) {
      const { answer, confidence } = answerObj;
      _panel?.addAnswer(fieldLabel, answer);

      const isLowConfidence = confidence < 70;
      const status = isLowConfidence ? 'warning' : 'success';
      if (isLowConfidence) {
        _panel?.addLog(`Requires review: Aladdin is unsure about ${fieldLabel}.`);
      } else {
        _panel?.addLog(
          type === 'select' && optionList.length
            ? `Selected an option for ${fieldLabel}.`
            : `Answered ${fieldLabel} with Aladdin AI.`
        );
      }

      let success = false;
      if (type === 'select') {
        // noFallback: true — AI gave a specific answer; if it doesn't match any option,
        // return false rather than silently picking the first option (e.g. "Argentina").
        success = await fillSelect(element, answer, status, optionList.length ? optionList : null, { noFallback: true });
      } else {
        const instant =
          type !== 'textarea' &&
          typeof answer === 'string' &&
          answer.length <= 800 &&
          !answer.includes('\n');
        success = await fillTextInput(element, answer, status, { instant });
        if (success) {
          await clickAutocompleteSuggestion(element, answer);
          // Verify value persisted after autocomplete
          await sleep(150);
          if (!element.value?.trim()) success = false;
        }
      }

      if (success) markAnswered(field, 'ai');
      return;
    }
  }

  // ═══ SKIP — no user prompt ═══
  // Could not answer this field automatically. Skip it now; the verification
  // pass will retry, and the user can fill it manually before submitting.
  _panel?.addLog(`Skipped: ${fieldLabel} — will review in verification pass.`);
  return { success: true };
}

// ─── Verification Pass ─────────────────────────────────────────────────────────

/**
 * Strict verification pass — runs after the main fill loop.
 *
 * Strategy (in priority order):
 *   1. Profile match → ALWAYS override the current value, no exceptions.
 *      The user's stored profile data is the source of truth.
 *   2. Radio/checkbox groups → re-evaluate from scratch against profile + AI.
 *   3. Select fields → re-evaluate (profile match or re-apply AI answer).
 *   4. Empty fields → fill with AI (no user prompt).
 *   5. AI-only text fields that already have a value → accept them (don't waste calls).
 *
 * The pass is intentionally conservative: it never removes a correct answer,
 * but it always enforces profile data over anything the AI guessed.
 */
async function runVerificationPass() {
  if (!isContextValid() || isStopped) return;

  _inVerificationPass = true; // enables stricter AI calls throughout this pass
  _panel?.addLog('Verifying all answers against your profile…');

  // Re-scan to catch any fields that appeared after the main loop
  const freshFields = scanFields(_platform, () => {});
  for (const f of freshFields) {
    if (!fieldsToFill.some(existing => existing.element === f.element)) {
      fieldsToFill.push(f);
    }
  }

  // Reset radio group deduplication so every group gets re-evaluated
  processedRadioGroups = new Set();

  let corrections = 0;

  for (const field of fieldsToFill) {
    if (!isContextValid() || isStopped) break;
    if (!field.element?.isConnected) continue;

    const { type, label, placeholder, name: fieldName, ariaLabel } = field;

    // ── FILE: never touch ──
    if (type === 'file') continue;

    // ── RADIO / CHECKBOX: always re-evaluate as a group ──
    if (type === 'radio' || type === 'checkbox') {
      // processField handles deduplication via processedRadioGroups
      await processField(field);
      continue;
    }

    // ── PROFILE MATCH: strict override — profile always wins ──
    const profileValue = matchFieldToProfile(
      { label, placeholder, name: fieldName, ariaLabel },
      _profile
    );

    if (profileValue !== null) {
      const current = field.element.value?.trim() ?? '';
      const expected = String(profileValue).trim();
      if (current !== expected) {
        if (type === 'select') {
          const opts = field.selectOptions?.length
            ? field.selectOptions
            : getNativeSelectOptions(field.element);
          await fillSelect(field.element, profileValue, 'success', opts.length ? opts : null);
        } else {
          await fillTextInput(field.element, profileValue, 'success', { instant: true });
        }
        markAnswered(field, 'profile');
        corrections++;
      }
      continue;
    }

    // ── UNANSWERED: fill with AI, no user prompt ──
    if (!isFieldAnswered(field)) {
      await processField(field);
      corrections++;
    }
  }

  if (corrections > 0) {
    _panel?.addLog(`Verification complete — corrected ${corrections} answer(s) to match your profile.`);
  } else {
    _panel?.addLog('Verification complete — all answers match your profile.');
  }

  _inVerificationPass = false; // exit strict mode
}

// ─── The Main Loop ─────────────────────────────────────────────────────────────

function resetScan() {
  // Intentionally empty — scanFields is called in startFill.
  // This function is a placeholder for future platform-specific pre-scan logic.
}

export async function runFillLoop() {
  // ─── Dead Man's Switch: abort before we even start if the context is gone ───
  if (!isContextValid()) {
    isRunning = false;
    return;
  }

  resetScan();
  await sleep(15);

  try {
    while (currentIndex < fieldsToFill.length && !isStopped) {
      // ── Dead Man's Switch: check every iteration ──
      if (!isContextValid()) {
        stopObserver();
        break;
      }

      while (isPaused && !isStopped) {
        await sleep(120);
        if (!isContextValid()) { stopObserver(); isStopped = true; break; }
      }

      if (isStopped) break;

      const field = fieldsToFill[currentIndex];
      if (field?.element?.isConnected) {
        // Scroll into view before filling on Workday and other dynamic platforms
        // so that lazy-rendered Angular/React components are fully hydrated.
        // Skip entirely when the tab is hidden — scrollIntoView is a no-op in
        // invisible tabs and wastes the throttled setTimeout budget.
        if (['workday', 'ashby', 'lever', 'generic', 'generic-weak'].includes(_platform) &&
            document.visibilityState !== 'hidden') {
          await scrollFieldIntoView(field.element);
        }

        const wasAnswered = completedElements.has(field.element);

        try {
          const result = await processField(field);
          if (result?._invalidated || result?.error === 'SESSION_EXPIRED') {
            stopObserver();
            break;
          }

          // Track fields that still aren't answered after processing (fill failed)
          if (!wasAnswered && !completedElements.has(field.element) && field.type !== 'file') {
            failedFields.push(field);
          }
        } catch (error) {
          // ── Dead Man's Switch: trap fatal errors inside the loop ──
          const msg = error?.message ?? String(error);
          if (msg.includes('Extension context invalidated') || msg.includes('Access to storage')) {
            stopObserver();
            break;
          }
          console.warn('Aladdin: field processing error', error);
        }
      }

      currentIndex += 1;
      // Skip the inter-field pause when backgrounded — it burns our throttled
      // setTimeout budget for no benefit (the page isn’t being watched).
      if (document.visibilityState !== 'hidden') {
        await sleep(8 + Math.random() * 17);
      }
    }

    stopObserver();

    // ── Retry queue: re-attempt fields that didn't fill on first pass ──
    if (failedFields.length > 0 && !isStopped && isContextValid()) {
      _panel?.addLog(`Retrying ${failedFields.length} field(s) that didn't fill…`);
      const stillFailing = await retryFailedFields(
        failedFields,
        async (field) => {
          if (!field.element?.isConnected) return true; // disconnected = skip
          await scrollFieldIntoView(field.element);
          await processField(field);
          return completedElements.has(field.element);
        }
      );

      for (const field of stillFailing) {
        const label = field.label || field.placeholder || field.name || 'Unknown field';
        _panel?.addLog(`Could not fill: ${label} — please fill manually`);
      }
      failedFields = [];
    }

    // ── Verification pass: strictly re-check all answers against profile ──
    if (!isStopped && isContextValid()) {
      await runVerificationPass();
    }

    // ── Auto-stop: always finish in 'done' state after verification ──
    if (!isStopped && isContextValid()) {
      if (fieldsToFill.length === 0) {
        _panel?.addLog('No fillable questions were detected on this page.');
        _panel?.setState('idle');
      } else {
        const unanswered = fieldsToFill.filter(f => f.element?.isConnected && !isFieldAnswered(f)).length;
        if (unanswered > 0) {
          _panel?.addLog(`Done — ${unanswered} field(s) need manual review before submitting.`);
        } else {
          _panel?.addLog('All questions filled. Review and submit your application!');
        }
        _panel?.setState('done');
        _panel?.celebrateSuccess();
      }
    }
  } finally {
    isRunning = false;
    isPaused = false;
    _cleanupBackgroundSession();
  }
}

// ─── Public Entry Point ────────────────────────────────────────────────────────

export async function startFill({ source = 'panel' } = {}) {
  if (!_panel) {
    return { success: false, error: 'No panel available.' };
  }

  if (isRunning) {
    _panel.show();
    if (source === 'panel') _panel.open();
    _panel.addLog('Autofill is already running on this page.');
    return { success: true, alreadyRunning: true };
  }

  _profile = await _ensureProfile?.(true);
  if (!_profile) {
    _panel.show();
    _panel.setState('idle');
    _panel.addLog('Not connected to Aladdin. Use the browser extension popup to sign in.');
    return { success: false, error: 'Not connected to Aladdin.' };
  }

  _panel.resetSession();
  _syncPanelProfileData?.();
  _panel.setJobMeta(_jobTitle, _company, _platform);
  _panel.show();

  if (source === 'panel') {
    _panel.open();
  } else {
    _panel.collapse();
  }

  _panel.setState('running');
  _panel.addLog('Starting Auto Fill Application on this page.');

  stopObserver();
  fieldsToFill = [];
  currentIndex = 0;
  answerCache = {};
  isStopped = false;
  isPaused = false;
  isRunning = true;
  completedElements = new Set();
  progressBreakdown = { profileAnswered: 0, aiAnswered: 0, manualAnswered: 0 };
  pendingFileUploads = [];
  failedFields = [];
  processedRadioGroups = new Set();
  _inVerificationPass = false;

  // ── Background Sprint Mode setup ──────────────────────────────────────────
  // Reset session-level banner dismissal so the user gets warned again on
  // each new fill session (they may have left the previous one open).
  resetBackgroundWarningDismissal();

  // Acquire a Web Lock for the duration of the fill. This signals to Chrome’s
  // scheduler that the tab has pending work, softening the background timer
  // throttle from ~1000 ms down to ~100 ms — a useful safety net on top of
  // our sleep-elimination strategy.
  if (typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function') {
    const lockHeld = new Promise(resolve => { _lockRelease = resolve; });
    navigator.locks.request('aladdin-autofill', { mode: 'shared' }, () => lockHeld).catch(() => {});
  }

  // Register a visibility listener. For platforms where background fills are
  // unreliable (Workday lazy Angular rendering), show a sticky amber banner
  // the moment the user leaves, and hide it when they come back.
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
  }
  if (BACKGROUND_UNRELIABLE_PLATFORMS.includes(_platform)) {
    const label = PLATFORM_LABELS[_platform] ?? _platform;
    _visibilityHandler = () => {
      if (!isRunning) return; // fill ended while listener was still attached
      if (document.visibilityState === 'hidden') {
        showBackgroundWarningBanner(label);
      } else {
        hideBackgroundWarningBanner();
      }
    };
    document.addEventListener('visibilitychange', _visibilityHandler);
  } else {
    _visibilityHandler = null;
  }
  // ─────────────────────────────────────────────────────────────────────────

  fieldsToFill = scanFields(_platform, handleNewFields);
  syncExistingAnswers(fieldsToFill);

  _panel.addLog(
    fieldsToFill.length
      ? `Detected ${fieldsToFill.length} fillable questions.`
      : 'Scanning the page for fillable questions.'
  );

  runFillLoop().catch((error) => {
    console.error('Auto fill failed:', error);
    _panel.addLog('Autofill stopped because of an unexpected error.');
    _panel.setState('paused');
    stopObserver();
    isRunning = false;
    _cleanupBackgroundSession();
  });

  return { success: true };
}
