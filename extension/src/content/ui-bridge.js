/**
 * ui-bridge.js — Panel Management, Profile Syncing & Settings
 *
 * Responsibilities:
 *   1. Create and manage the Shadow DOM side-panel.
 *   2. Sync profile data to the panel UI.
 *   3. Handle profile fetching, saving settings drafts, and
 *      learning new answers.
 *   4. Expose a clean interface for the orchestrator to wire up.
 */

import { injectPanel } from './shadow-root.js';
import { safeSendMessage } from '../utils/contextGuard.js';
import { stop as stopAutofill } from './automation.js';

// ─── Module State ──────────────────────────────────────────────────────────────

let panel = null;
let profile = null;

// ─── Text Helpers ──────────────────────────────────────────────────────────────

function normalizeText(value) {
  return typeof value === 'string' ? value : '';
}

function cloneCustomQA(customQA = []) {
  return customQA.map((entry) => ({
    question: normalizeText(entry?.question),
    answer: normalizeText(entry?.answer)
  }));
}

function getAutoApplyKeys(sections = []) {
  return sections.flatMap((section) => section?.fields?.map((field) => field.key) ?? []);
}

// ─── User Context Encoding / Decoding ──────────────────────────────────────────

function decodeUserContextSnapshot(snapshot, autoApplyKeys, onboardingAnswers = []) {
  const answers = {};
  const indexedCustom = [];
  const looseCustom = [];
  const keySet = new Set(autoApplyKeys);

  for (const [key, rawValue] of Object.entries(snapshot ?? {})) {
    if (keySet.has(key) && typeof rawValue === 'string') {
      answers[key] = rawValue;
      continue;
    }

    if (key.startsWith('aa_custom_') && rawValue && typeof rawValue === 'object') {
      const index = Number.parseInt(key.replace('aa_custom_', ''), 10);
      const entry = {
        question: normalizeText(rawValue.questionLabel),
        answer: normalizeText(rawValue.value)
      };
      if (Number.isFinite(index)) {
        indexedCustom[index] = entry;
      } else {
        looseCustom.push(entry);
      }
      continue;
    }

    if (typeof rawValue === 'string' && rawValue.trim()) {
      looseCustom.push({ question: key, answer: rawValue });
    }
  }

  for (const onboardingEntry of onboardingAnswers ?? []) {
    const key = normalizeText(onboardingEntry?.questionKey);
    const answer = normalizeText(onboardingEntry?.answerText).trim();
    if (keySet.has(key) && answer && !answers[key]) {
      answers[key] = answer;
    }
  }

  return {
    answers,
    customQA: [...indexedCustom.filter(Boolean), ...looseCustom]
  };
}

function encodeUserContextSnapshot(answers, customQA, autoApplyKeys) {
  const payload = {};

  for (const key of autoApplyKeys) {
    const value = normalizeText(answers?.[key]).trim();
    if (value) payload[key] = value;
  }

  cloneCustomQA(customQA)
    .map((entry) => ({
      question: normalizeText(entry.question).trim(),
      answer: normalizeText(entry.answer).trim()
    }))
    .filter((entry) => entry.question || entry.answer)
    .forEach((entry, index) => {
      payload[`aa_custom_${index}`] = {
        questionLabel: entry.question,
        value: entry.answer
      };
    });

  return payload;
}

// ─── Profile Data for Panel ────────────────────────────────────────────────────

export function buildPanelProfileData(currentProfile) {
  if (!currentProfile) {
    return {
      user: null,
      sections: [],
      answers: {},
      customQA: [],
      documents: {
        resume: { ready: false, filename: '', description: 'Add a default resume to upload it automatically.' },
        coverLetter: { ready: false, filename: '', description: 'Add a saved cover letter to upload it automatically.' }
      }
    };
  }

  const sections = Array.isArray(currentProfile.autoApplySections) ? currentProfile.autoApplySections : [];
  const { answers, customQA } = decodeUserContextSnapshot(
    currentProfile.userContext,
    getAutoApplyKeys(sections),
    currentProfile.onboardingAnswers
  );

  return {
    user: currentProfile.user ?? null,
    sections,
    answers,
    customQA,
    documents: {
      resume: {
        ready: !!(currentProfile.resume?.id || currentProfile.resume?.pdfBase64),
        filename: normalizeText(currentProfile.resume?.filename),
        description: (currentProfile.resume?.id || currentProfile.resume?.pdfBase64)
          ? 'Your default resume will be uploaded automatically when resume fields appear.'
          : 'No default resume is available yet.'
      },
      coverLetter: {
        ready: !!(currentProfile.coverLetter?.id || currentProfile.coverLetter?.pdfBase64),
        filename: normalizeText(currentProfile.coverLetter?.filename || 'cover-letter.pdf'),
        description: (currentProfile.coverLetter?.id || currentProfile.coverLetter?.pdfBase64)
          ? 'Your saved cover letter will be uploaded automatically when cover letter fields appear.'
          : 'No saved cover letter is available yet.'
      }
    }
  };
}

// ─── Profile Fetching ──────────────────────────────────────────────────────────

async function fetchProfile(force = false) {
  try {
    const response = await safeSendMessage({ action: 'GET_PROFILE', force });
    return response?.profile ?? null;
  } catch {
    return null;
  }
}

export async function ensureProfile(force = false) {
  if (!force && profile) {
    syncPanelProfileData();
    return profile;
  }

  const nextProfile = await fetchProfile(force);
  if (nextProfile) {
    profile = nextProfile;
    syncPanelProfileData();
    return profile;
  }

  if (force) syncPanelProfileData();
  return profile;
}

export function syncPanelProfileData() {
  panel?.setProfileData(buildPanelProfileData(profile));
}

export function getProfile() {
  return profile;
}

export function setProfile(p) {
  profile = p;
}

export function clearProfile() {
  profile = null;
}

// ─── Settings Draft Saving ─────────────────────────────────────────────────────

async function saveSettingsDraft(draft) {
  const currentProfile = await ensureProfile();
  if (!currentProfile) {
    throw new Error('You need to be signed in to save your profile details. Please connect the extension first.');
  }

  const sections = Array.isArray(draft?.sections) && draft.sections.length
    ? draft.sections
    : buildPanelProfileData(currentProfile).sections;
  const autoApplyKeys = getAutoApplyKeys(sections);
  const payload = encodeUserContextSnapshot(draft?.answers ?? {}, draft?.customQA ?? [], autoApplyKeys);

  const response = await safeSendMessage({
    action: 'SET_USER_CONTEXT',
    payload: { context: payload }
  });

  if (response?._invalidated) return response;
  if (response?.error) throw new Error(response.error);

  profile = response?.profile ?? await fetchProfile(true);
  syncPanelProfileData();
  panel?.addLog('Saved bookmark settings to your Aladdin profile.');
  return profile;
}

export async function saveLearnedAnswer(question, answer) {
  const currentProfile = await ensureProfile();
  if (!currentProfile) return;

  const panelProfileData = buildPanelProfileData(currentProfile);
  const customQA = cloneCustomQA(panelProfileData.customQA);
  const normalizedQuestion = normalizeText(question).trim().toLowerCase();
  const matchIndex = customQA.findIndex(
    (entry) => normalizeText(entry.question).trim().toLowerCase() === normalizedQuestion
  );

  if (matchIndex >= 0) {
    customQA[matchIndex] = { question, answer };
  } else {
    customQA.push({ question, answer });
  }

  const payload = encodeUserContextSnapshot(
    panelProfileData.answers,
    customQA,
    getAutoApplyKeys(panelProfileData.sections)
  );

  const response = await safeSendMessage({
    action: 'SET_USER_CONTEXT',
    payload: { context: payload }
  });

  if (!response?.error) {
    profile = response?.profile ?? await fetchProfile(true);
    syncPanelProfileData();
  }
}

// ─── Panel Creation & Wiring ───────────────────────────────────────────────────

/**
 * Creates (or returns existing) panel and wires up all event callbacks.
 * @param {string} platform
 * @param {string} jobTitle
 * @param {string} company
 * @param {function} onStartFill — called when user presses "Start" in the panel.
 * @returns {AutoApplyPanel|null}
 */
export function getOrCreatePanel(platform, jobTitle, company, onStartFill, forceGeneric = false) {
  if (window !== window.top) return null;
  if (!platform && !forceGeneric) return null;

  if (!panel) {
    panel = injectPanel();
    panel.onStart = () => onStartFill({ source: 'panel' });
    panel.onPause = () => {
      panel.setState('paused');
      panel.addLog('Autofill paused.');
    };
    panel.onResume = () => {
      panel.setState('running');
      panel.addLog('Autofill resumed.');
    };
    panel.onStop = () => {
      stopAutofill();
      panel.setState('paused');
      panel.addLog('Autofill stopped.');
    };
    panel.onSkip = () => {
      panel.addLog('Skip step — not wired to the engine yet.');
    };
    panel.onSignIn = () => {
      safeSendMessage({ action: 'SIGN_IN' }).catch(() => {});
    };
    panel.onOpenAladdin = () => {
      safeSendMessage({ action: 'OPEN_ALADDIN' }).catch(() => {});
    };
    panel.onConnectPat = async (raw) => {
      panel.patConnectBusy = true;
      panel.patConnectError = null;
      panel._renderPanel();
      try {
        const r = await safeSendMessage({ action: 'CONNECT_PAT', token: raw });
        if (r?._invalidated) {
          panel.patConnectBusy = false;
          panel._renderPanel();
          return;
        }
        if (r?.error) {
          panel.patConnectError = r.error;
          panel.patConnectBusy = false;
          panel._renderPanel();
          return;
        }
        panel._patDraft = '';
        profile = await fetchProfile(true);
        syncPanelProfileData();
        panel.patConnectBusy = false;
        panel.patConnectError = null;
        panel._renderPanel();
        panel.addLog('Connected with your extension secret key.');
      } catch {
        panel.patConnectError = 'Something went wrong. Try again.';
        panel.patConnectBusy = false;
        panel._renderPanel();
      }
    };
    panel.onDisconnect = async () => {
      try {
        await safeSendMessage({ action: 'CLEAR_AUTH' });
      } catch {
        /* ignore */
      }
      clearProfile();
      panel._patDraft = '';
      syncPanelProfileData();
      panel.addLog('Disconnected from Aladdin.');
      panel.setSettingsMessage(
        'You have been disconnected. Generate a new key under Account → Auto Apply to reconnect.',
        'info'
      );
      panel._renderPanel();
    };
    panel.onOpenSettings = () => {
      panel.setSettingsMessage('Refreshing your saved Aladdin details...', 'info');
      ensureProfile(true)
        .then((currentProfile) => {
          if (!currentProfile) {
            panel.setSettingsMessage('Please connect your extension key under Account → Auto Apply to view and edit your profile.', 'error');
            return;
          }
          panel.setSettingsMessage('Changes saved here stay in sync with Auto Apply in Account Settings.', 'info');
        })
        .catch(() => {
          panel.setSettingsMessage('Could not load your profile right now. Check your connection and try again.', 'error');
        });
    };
    panel.onResumePreview = async () => {
      try {
        panel.addLog('Opening resume preview…');
        const r = await safeSendMessage({ action: 'OPEN_DOCUMENT', type: 'resume' });
        if (r?._invalidated) return;
        if (r?.error) {
          panel.setSettingsMessage(r.error, 'error');
          panel.addLog(`Resume preview failed — ${r.error}`);
          return;
        }
      } catch {
        panel.setSettingsMessage('Could not open the resume preview. Please try again.', 'error');
        panel.addLog('Resume preview failed — could not reach Aladdin.');
      }
    };
    panel.onSaveSettings = async (draft) => {
      panel.setSettingsSaving(true);
      panel.setSettingsMessage('Saving your Aladdin application profile...', 'info');
      try {
        await saveSettingsDraft(draft);
        panel.setSettingsMessage('Saved to your Aladdin profile.', 'success');
      } catch (error) {
        panel.setSettingsMessage(error?.message ?? 'Could not save your profile. Please try again.', 'error');
      } finally {
        panel.setSettingsSaving(false);
      }
    };
  }

  panel.setJobMeta(jobTitle, company, platform);
  panel.setPlatform(platform);
  syncPanelProfileData();
  return panel;
}

export function getPanel() {
  return panel;
}
