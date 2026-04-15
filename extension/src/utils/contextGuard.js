/**
 * Context Guard — Safety layer for all Chrome extension API calls.
 *
 * When an extension is reloaded, updated, or disabled, the old content script
 * becomes a "zombie" — still running in the page but unable to talk to the
 * extension backend.  Every call to chrome.storage or chrome.runtime.sendMessage
 * will throw "Access to storage is not allowed from this context" or
 * "Extension context invalidated."
 *
 * This module wraps those calls so they fail gracefully (return null)
 * instead of throwing red console errors.
 */

const FATAL_PATTERNS = [
  'Extension context invalidated',
  'Access to storage is not allowed',
  'The message port closed',
  'Could not establish connection',
];

/**
 * Returns true if the extension context is still alive.
 * If this returns false, the content script is a zombie and should
 * stop all further automation immediately.
 */
export function isContextValid() {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
}

/**
 * Returns true if the error message matches a known fatal extension error.
 */
export function isFatalExtensionError(error) {
  const msg = error?.message ?? String(error);
  return FATAL_PATTERNS.some(pattern => msg.includes(pattern));
}

/**
 * Wraps chrome.storage.local.get with a context check.
 * Returns null instead of throwing if the context is dead.
 */
export async function safeGetStorage(key) {
  if (!isContextValid()) return null;
  try {
    const result = await chrome.storage.local.get(key);
    return result ?? null;
  } catch (error) {
    if (isFatalExtensionError(error)) return null;
    throw error;
  }
}

/**
 * Wraps chrome.storage.local.set with a context check.
 * Returns false instead of throwing if the context is dead.
 */
export async function safeSetStorage(data) {
  if (!isContextValid()) return false;
  try {
    await chrome.storage.local.set(data);
    return true;
  } catch (error) {
    if (isFatalExtensionError(error)) return false;
    throw error;
  }
}

/**
 * Wraps chrome.runtime.sendMessage with a context check AND
 * chrome.runtime.lastError silencing.
 *
 * Returns { _invalidated: true } when the context is dead so callers
 * can short-circuit without special try/catch logic.
 */
export async function safeSendMessage(message) {
  if (!isContextValid()) {
    return { _invalidated: true, error: 'Extension context invalidated' };
  }

  try {
    return await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        // Silence chrome.runtime.lastError to prevent red console errors
        if (chrome.runtime.lastError) {
          resolve({ _invalidated: true, error: chrome.runtime.lastError.message });
          return;
        }
        resolve(response);
      });
    });
  } catch (error) {
    if (isFatalExtensionError(error)) {
      return { _invalidated: true, error: 'Extension context invalidated' };
    }
    console.warn('Aladdin sendMessage error:', error);
    throw error;
  }
}
