# AutoApply Extension

Chrome extension (Manifest V3) that auto-detects job application pages and fills every form field using the user's Aladdin profile, resume, and LLM-powered answers.

## Setup

### 1. Install dependencies

```bash
cd extension
npm install
```

### 2. Build

```bash
npm run build
```

The built extension lands in `extension/dist/`.

### 3. Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** → select `extension/dist/`

### 4. Connect to Aladdin

Two ways to authenticate:

**Option A — Sign-in flow (recommended)**
1. Click the extension icon
2. Click **Sign in with Aladdin** — opens `https://aladdin.so/connect-extension`
3. Authenticate with Clerk; the page sends your token to the extension automatically

**Option B — Personal access token**
1. Visit Settings → Auto Apply in Aladdin → copy your token
2. Open the extension options page → paste the token → click Save

## Environment Variables

Add to `.env.local`:

```
NEXT_PUBLIC_EXTENSION_ID=<chrome extension ID from chrome://extensions>
```

The extension ID is only needed to enable the automatic `AUTH_TOKEN` handshake from the `/connect-extension` page. Without it, users can still authenticate via the manual token fallback.

## Supported Platforms

Greenhouse, Lever, Workday, Ashby, iCIMS, SmartRecruiters, JazzHR, BambooHR, and generic job application pages.

## Architecture

```
extension/
  src/
    background/index.js   # Service worker — auth, profile cache, LLM proxy
    content/
      index.js            # Orchestrator — boot, fill loop, submit
      shadow-root.js      # Shadow DOM injection
      ui/panel.js         # Side panel component
    popup/index.js        # Popup UI
    options/index.js      # Token setup page
    utils/
      pageDetector.js     # Job page detection + meta parsing
      fieldMatcher.js     # Rules-based profile field matching
      formFiller.js       # Input simulation (typewriter, select, file)
      platformDrivers.js  # DOM scanning + MutationObserver
      confetti.js         # Success celebration
```

All LLM calls are proxied through the Aladdin backend (`/api/extension/answer`) — no API keys in the extension.
