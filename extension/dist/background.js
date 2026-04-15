const ALADDIN_BASE_URL = "https://aladdin-staging.vercel.app";
async function getSession() {
  const { session } = await chrome.storage.local.get("session");
  return session ?? null;
}
async function setSession(session) {
  await chrome.storage.local.set({ session });
}
async function clearLocalSession() {
  await chrome.storage.local.remove(["session", "profileCache", "profileCachedAt"]);
}
async function revokePatAndClearLocal() {
  const session = await getSession();
  const jwt = session == null ? void 0 : session.jwt;
  if (jwt && jwt.startsWith("ald_ext_")) {
    try {
      await fetch(`${ALADDIN_BASE_URL}/api/extension/access-tokens`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${jwt}` }
      });
    } catch {
    }
  }
  await clearLocalSession();
}
const PROFILE_TTL_MS = 60 * 60 * 1e3;
const inFlightRequests = /* @__PURE__ */ new Map();
async function getProfile(force = false) {
  const session = await getSession();
  if (!(session == null ? void 0 : session.jwt)) return null;
  const { profileCache, profileCachedAt } = await chrome.storage.local.get(["profileCache", "profileCachedAt"]);
  const now = Date.now();
  if (!force && profileCache && profileCachedAt && now - profileCachedAt < PROFILE_TTL_MS) {
    return profileCache;
  }
  if (inFlightRequests.has("profile")) {
    return inFlightRequests.get("profile");
  }
  const req = (async () => {
    try {
      const res = await fetch(`${ALADDIN_BASE_URL}/api/extension/profile`, {
        headers: { Authorization: `Bearer ${session.jwt}` }
      });
      if (res.status === 401 || res.status === 403) {
        await clearLocalSession();
        return null;
      }
      if (!res.ok) return null;
      const profile = await res.json();
      await chrome.storage.local.set({ profileCache: profile, profileCachedAt: Date.now() });
      return profile;
    } catch {
      return null;
    } finally {
      inFlightRequests.delete("profile");
    }
  })();
  inFlightRequests.set("profile", req);
  return req;
}
async function getAnswer(payload) {
  const session = await getSession();
  if (!(session == null ? void 0 : session.jwt)) throw new Error("You are not signed in. Please connect the extension first.");
  const res = await fetch(`${ALADDIN_BASE_URL}/api/extension/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.jwt}` },
    body: JSON.stringify(payload)
  });
  if (res.status === 401 || res.status === 403) {
    await clearLocalSession();
    throw new Error("SESSION_EXPIRED");
  }
  if (!res.ok) throw new Error("Aladdin could not generate an answer right now. Please try again.");
  const { answer, confidence } = await res.json();
  return { answer, confidence };
}
async function getDocument(type) {
  const cacheKey = `doc_${type}`;
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }
  const req = (async () => {
    const session = await getSession();
    if (!(session == null ? void 0 : session.jwt)) throw new Error("You are not signed in. Please connect the extension first.");
    try {
      const res = await fetch(`${ALADDIN_BASE_URL}/api/extension/document?type=${encodeURIComponent(type)}`, {
        headers: { Authorization: `Bearer ${session.jwt}` }
      });
      if (res.status === 401 || res.status === 403) {
        await clearLocalSession();
        throw new Error("SESSION_EXPIRED");
      }
      if (!res.ok) throw new Error("Could not load your document right now. Please try again.");
      return await res.json();
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();
  inFlightRequests.set(cacheKey, req);
  return req;
}
async function logApplication(payload) {
  const session = await getSession();
  if (!(session == null ? void 0 : session.jwt)) return;
  fetch(`${ALADDIN_BASE_URL}/api/extension/application`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.jwt}` },
    body: JSON.stringify(payload)
  }).catch(() => {
  });
}
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const handle = async () => {
    var _a, _b;
    switch (msg.action) {
      case "GET_PROFILE": {
        const profile = await getProfile(msg.force || false);
        if (!profile) return { error: "Your profile could not be loaded. Please make sure you are signed in." };
        return { profile };
      }
      case "GET_ANSWER": {
        const result = await getAnswer(msg.payload);
        return { answer: result.answer, confidence: result.confidence };
      }
      case "GET_DOCUMENT": {
        const doc = await getDocument(msg.type);
        return { document: doc };
      }
      case "OPEN_DOCUMENT": {
        const doc = await getDocument(msg.type);
        const base64 = typeof (doc == null ? void 0 : doc.pdfBase64) === "string" && doc.pdfBase64 || typeof (doc == null ? void 0 : doc.base64) === "string" && doc.base64 || typeof (doc == null ? void 0 : doc.data) === "string" && doc.data || typeof ((_a = doc == null ? void 0 : doc.document) == null ? void 0 : _a.pdfBase64) === "string" && doc.document.pdfBase64 || "";
        const mime = typeof (doc == null ? void 0 : doc.mimeType) === "string" && doc.mimeType || typeof (doc == null ? void 0 : doc.mime) === "string" && doc.mime || "application/pdf";
        const filename = typeof (doc == null ? void 0 : doc.filename) === "string" && doc.filename.trim() || (msg.type === "coverLetter" ? "cover-letter.pdf" : "resume.pdf");
        if (!base64) return { error: "No resume found. Please upload a resume in your Aladdin account settings first." };
        const url = `data:${mime};base64,${base64}`;
        chrome.tabs.create({ url });
        return { success: true, filename };
      }
      case "LOG_APPLICATION": {
        await logApplication(msg.payload);
        return { success: true };
      }
      case "CLEAR_AUTH": {
        await revokePatAndClearLocal();
        return { success: true };
      }
      case "CHECK_AUTH": {
        const session = await getSession();
        return { authenticated: !!(session == null ? void 0 : session.jwt), session };
      }
      case "SIGN_IN": {
        chrome.tabs.create({ url: ALADDIN_BASE_URL });
        return { success: true };
      }
      case "OPEN_ALADDIN": {
        chrome.tabs.create({ url: ALADDIN_BASE_URL });
        return { success: true };
      }
      case "GET_ALADDIN_URL": {
        return { url: ALADDIN_BASE_URL };
      }
      case "CONNECT_PAT": {
        const raw = typeof msg.token === "string" ? msg.token.trim() : "";
        if (!raw.startsWith("ald_ext_")) {
          return {
            error: "That does not look like a valid key. Make sure you copy the full key from Aladdin → Account → Auto Apply."
          };
        }
        await chrome.storage.local.remove(["profileCache", "profileCachedAt"]);
        const authRes = await fetch(`${ALADDIN_BASE_URL}/api/extension/auth`, {
          headers: { Authorization: `Bearer ${raw}` }
        });
        if (authRes.status === 401 || authRes.status === 403) {
          return {
            error: "This key has expired or been revoked. Please generate a new one from Aladdin → Account → Auto Apply."
          };
        }
        if (!authRes.ok) {
          return { error: "Could not connect to Aladdin. Check your internet connection and try again." };
        }
        await setSession({ jwt: raw });
        await getProfile(true);
        return { success: true };
      }
      case "UPDATE_USER_CONTEXT": {
        const session = await getSession();
        if (!(session == null ? void 0 : session.jwt)) return { error: "You are not signed in. Please connect the extension first." };
        const res = await fetch(`${ALADDIN_BASE_URL}/api/extension/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.jwt}`
          },
          body: JSON.stringify({ context: msg.payload.context })
        });
        if (res.status === 401 || res.status === 403) {
          await clearLocalSession();
          return { error: "Your session has expired. Please sign in again." };
        }
        if (!res.ok) return { error: "Could not save your changes. Please try again." };
        await getProfile(true);
        return { success: true };
      }
      case "SET_USER_CONTEXT": {
        const session = await getSession();
        if (!(session == null ? void 0 : session.jwt)) return { error: "You are not signed in. Please connect the extension first." };
        const res = await fetch(`${ALADDIN_BASE_URL}/api/extension/profile`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.jwt}`
          },
          body: JSON.stringify({
            context: msg.payload.context,
            replace: true
          })
        });
        if (res.status === 401 || res.status === 403) {
          await clearLocalSession();
          return { error: "Your session has expired. Please sign in again." };
        }
        if (!res.ok) return { error: "Could not save your profile changes. Please try again." };
        const data = await res.json();
        const profile = await getProfile(true);
        return { success: true, context: data.context, profile };
      }
      case "GET_TAB_ID": {
        return { tabId: (_b = _sender.tab) == null ? void 0 : _b.id };
      }
      case "NOTIFY_USER": {
        const { title = "AutoApply", message = "Action needed", tabId } = msg;
        const notifId = `autoapply-${Date.now()}`;
        chrome.notifications.create(notifId, {
          type: "basic",
          iconUrl: "assets/icon48.png",
          title,
          message
        });
        const clickHandler = (clickedId) => {
          if (clickedId !== notifId) return;
          if (tabId) chrome.tabs.update(tabId, { active: true });
          chrome.notifications.onClicked.removeListener(clickHandler);
        };
        chrome.notifications.onClicked.addListener(clickHandler);
        return { success: true };
      }
      default:
        return { error: "Unknown action" };
    }
  };
  try {
    handle().then(sendResponse).catch((err) => {
      const msgText = (err == null ? void 0 : err.message) ?? String(err);
      if (msgText.includes("Extension context invalidated")) return;
      sendResponse({ error: msgText });
    });
  } catch {
  }
  return true;
});
chrome.storage.onChanged.addListener((changes, area) => {
  var _a, _b;
  if (area !== "local" || !changes.session) return;
  if (!changes.session.newValue) {
    chrome.tabs.query({}, (tabs) => {
      if (chrome.runtime.lastError) return;
      for (const tab of tabs) {
        if (!tab.id) continue;
        chrome.tabs.sendMessage(tab.id, { action: "SESSION_EXPIRED" }, () => {
          if (chrome.runtime.lastError) ;
        });
      }
    });
  } else if (((_a = changes.session.newValue) == null ? void 0 : _a.jwt) && changes.session.newValue.jwt !== ((_b = changes.session.oldValue) == null ? void 0 : _b.jwt)) {
    getProfile(true).then(() => {
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) return;
        for (const tab of tabs) {
          if (!tab.id) continue;
          chrome.tabs.sendMessage(tab.id, { action: "SESSION_UPDATED" }, () => {
            if (chrome.runtime.lastError) ;
          });
        }
      });
    }).catch(() => {
    });
  }
});
chrome.runtime.onMessageExternal.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "OPEN_AND_APPLY" && msg.url) {
    chrome.tabs.create({ url: msg.url }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  sendResponse({ error: `Unknown external action: ${msg.action}` });
});
//# sourceMappingURL=background.js.map
