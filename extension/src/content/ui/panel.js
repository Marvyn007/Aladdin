import { fireConfetti } from '../../utils/confetti.js';
import { inlineIcons as icons } from './inline-icons.js';

/** Brand mark only — PNG in extension `assets/`; all other UI chrome uses bundled inline SVGs (no extra files). */
const LOGO_URL = chrome.runtime.getURL('assets/aladdin-logo.png');

/** Square logo cell + drag grip strip */
const WHITE_SIDE = 76;
const GRIP = 34;
const PANEL_WIDTH = 400;
const PANEL_TOP_ANCHOR = 56;
const GUTTER = 16;
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function cloneDraft(draft) {
  return {
    answers: { ...(draft?.answers ?? {}) },
    customQA: Array.isArray(draft?.customQA)
      ? draft.customQA.map((entry) => ({
        question: typeof entry?.question === 'string' ? entry.question : '',
        answer: typeof entry?.answer === 'string' ? entry.answer : ''
      }))
      : []
  };
}

export class AutoApplyPanel {
  constructor(shadowRoot) {
    this.shadowRoot = shadowRoot;
    this.host = shadowRoot.host;
    this.state = 'idle';
    this.logEntries = [];
    this.answers = [];
    this.captchaAlert = false;
    this.fileAlert = null;
    this.askingQuestion = null;
    this.autoAdvance = false;
    this.onStart = null;
    this.onPause = null;
    this.onResume = null;
    this.onSkip = null;
    this.onSaveSettings = null;
    this.onAutoAdvanceChange = null;
    this.onSignIn = null;
    this.onDisconnect = null;
    this.onConnectPat = null;
    this.onOpenAladdin = null;
    this.onStop = null;
    this.patConnectError = null;
    this.patConnectBusy = false;
    /** Preserves pasted key while the "not connected" view re-renders (errors / loading). */
    this._patDraft = '';
    this.isOpen = false;
    this.isVisible = true;
    this.activeTab = 'overview';
    this.settingsSaving = false;
    this.settingsMessage = null;
    this.settingsDirty = false;
    this.pageMeta = { jobTitle: '', company: '', platform: '' };
    this.progress = { totalQuestions: 0, answeredQuestions: 0, profileAnswered: 0, aiAnswered: 0, manualAnswered: 0, pendingQuestions: 0 };
    this.profileData = {
      user: null,
      sections: [],
      answers: {},
      customQA: [],
      documents: {
        resume: { ready: false, filename: '', description: 'Add a default resume to upload it automatically.' },
        coverLetter: { ready: false, filename: '', description: 'Add a saved cover letter to upload it automatically.' }
      }
    };
    this.settingsDraft = cloneDraft(this.profileData);
    /** Bookmark is always docked to the right viewport edge; only Y is user-adjustable. */
    this.snappedEdge = 'right';
    const initBm = this._bmSize();
    this.position = {
      x: this._bookmarkRightX(initBm.w),
      y: clamp(108, GUTTER, window.innerHeight - initBm.h - GUTTER)
    };
    this._dragState = null;
    this._mount();
  }

  _bmSize() {
    // Horizontal strip: logo + grip — always used (right-wall dock only).
    return { w: WHITE_SIDE + GRIP, h: WHITE_SIDE };
  }

  /** Fixed X for the bookmark so it stays flush to the right edge of the viewport. */
  _bookmarkRightX(bookmarkWidth) {
    const w = bookmarkWidth ?? this._bmSize().w;
    return Math.max(GUTTER, window.innerWidth - w - GUTTER);
  }

  _applyBookmarkLayout() {
    if (!this.bookmarkEl) return;
    const { w, h } = this._bmSize();
    this.bookmarkEl.style.width = `${w}px`;
    this.bookmarkEl.style.height = `${h}px`;
    this.bookmarkEl.classList.remove('aa-bookmark--edge-left', 'aa-bookmark--edge-right', 'aa-bookmark--edge-top', 'aa-bookmark--edge-bottom');
    this.bookmarkEl.classList.add(`aa-bookmark--edge-${this.snappedEdge}`);
  }

  _markSettingsDirty() {
    if (this.activeTab !== 'settings') return;
    this.settingsDirty = true;
    this.settingsMessage = null;
    const bar = this.panelEl?.querySelector('#aa-settings-sticky');
    if (bar) bar.style.display = 'flex';
  }

  _clearSettingsDirty() {
    this.settingsDirty = false;
    const bar = this.panelEl?.querySelector('#aa-settings-sticky');
    if (bar) bar.style.display = 'none';
  }

  _mount() {
    const style = document.createElement('style');
    style.textContent = `
      *,*::before,*::after{box-sizing:border-box}
      :host {
        --primary: #0066FF;
        --primary-bg: #EBF3FF;
        --secondary: #6366f1;
        --tertiary: #f59e0b;
        --success: #10b981;
        --danger: #ef4444;
        --background: #F8FAFC;
        --surface: #FFFFFF;
        --text: #1E293B;
        --text-muted: #64748B;
        --border: #E2E8F0;
        --radius-lg: 20px;
        --radius-md: 10px;
        --radius-ui: 8px;
        --shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        --glass: rgba(255, 255, 255, 0.7);
      }
      .aa-bookmark,.aa-panel{position:fixed;z-index:2147483647;pointer-events:auto;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      h1, h2, h3, .headline { font-family: 'Manrope', system-ui, sans-serif; font-weight: 800; }
      
      /* Gradient "Aladdin AI" label in logs */
      .aa-ai-label{background:linear-gradient(90deg,#6366f1 0%,#a855f7 50%,#ec4899 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:600}
      /* Tick animation for completion */
      @keyframes aa-tick-pop{0%{transform:scale(0.3);opacity:0}60%{transform:scale(1.2);opacity:1}100%{transform:scale(1);opacity:1}}
      .aa-tick-anim{animation:aa-tick-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) both}

      .aa-bookmark{padding:0;background:transparent;pointer-events:auto;display:flex;align-items:stretch;border-radius:var(--radius-ui);box-shadow:0 6px 22px rgba(15,23,42,.12);overflow:hidden;border:1px solid #dbeafe}
      .aa-bookmark.state-running{box-shadow:0 0 0 2px var(--primary),0 6px 22px rgba(15,23,42,.12)}
      .aa-bookmark.state-paused{box-shadow:0 0 0 2px var(--tertiary),0 6px 22px rgba(15,23,42,.12)}
      .aa-bookmark.state-done{box-shadow:0 0 0 2px var(--success),0 6px 22px rgba(15,23,42,.12)}
      .aa-bookmark--edge-right{flex-direction:row}
      .aa-bookmark--edge-left{flex-direction:row}
      .aa-bookmark--edge-left .aa-bookmark-toggle{order:2}
      .aa-bookmark--edge-left .aa-bookmark-grip{order:1}
      .aa-bookmark--edge-top{flex-direction:column}
      .aa-bookmark--edge-top .aa-bookmark-toggle{order:2}
      .aa-bookmark--edge-top .aa-bookmark-grip{order:1}
      .aa-bookmark--edge-bottom{flex-direction:column}
      .aa-bookmark-toggle{flex:none;width:${WHITE_SIDE}px;height:${WHITE_SIDE}px;border:none;background:#fafbfc;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;transition:background .15s ease,color .15s ease}
      .aa-bookmark-toggle:hover{background:#f1f5f9}
      .aa-bookmark-toggle img{width:36px;height:36px;object-fit:contain;display:block;pointer-events:none}
      .aa-bookmark-grip{flex-shrink:0;background:#2d3748;cursor:grab;display:flex;align-items:center;justify-content:center;touch-action:none;transition:background .15s ease}
      .aa-bookmark--edge-right .aa-bookmark-grip,.aa-bookmark--edge-left .aa-bookmark-grip{width:${GRIP}px;align-self:stretch;min-height:${WHITE_SIDE}px}
      .aa-bookmark--edge-top .aa-bookmark-grip,.aa-bookmark--edge-bottom .aa-bookmark-grip{width:100%;height:${GRIP}px}
      .aa-bookmark-grip:active{cursor:grabbing}
      .aa-bookmark-grip:hover{background:#1e293b}
      .aa-grip-dots{display:grid;grid-template-columns:repeat(2,5px);grid-template-rows:repeat(3,5px);gap:3px;place-content:center}
      .aa-bookmark--edge-top .aa-grip-dots,.aa-bookmark--edge-bottom .aa-grip-dots{grid-template-columns:repeat(3,5px);grid-template-rows:repeat(2,5px)}
      .aa-grip-dots span{width:4px;height:4px;border-radius:50%;background:#94a3b8;display:block}
      
      .aa-panel{width:372px;max-height:calc(100vh - ${PANEL_TOP_ANCHOR + GUTTER}px);display:flex;flex-direction:column;background:var(--background);border-radius:var(--radius-lg);box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;opacity:0;pointer-events:none;transition:opacity .18s ease; color:var(--text);border:1px solid var(--border)}
      .aa-panel.aa-panel--connect{
        background:var(--surface);
        border:none;
        box-shadow:0 24px 48px -14px rgba(15,23,42,0.14), 0 0 0 1px rgba(15,23,42,0.045);
      }
      .aa-panel.open{opacity:1;pointer-events:auto}
      
      .aa-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--surface);cursor:grab;position:sticky;top:0;z-index:100;border-bottom:1px solid var(--border)}
      .aa-header:active{cursor:grabbing}
      .aa-header-left{display:flex;align-items:center;gap:12px}
      .aa-header-left .logo-box{width:40px;height:40px;background:var(--primary-bg);border-radius:var(--radius-ui);display:flex;align-items:center;justify-content:center;box-shadow: inset 0 0 0 1px rgba(0,102,255,0.1);}
      .aa-header-left img{width:26px;height:26px;object-fit:contain;display:block}
      .aa-inline-icon{display:block;flex-shrink:0;pointer-events:none}
      .aa-nav-item .aa-inline-icon{width:22px;height:22px}
      .aa-icon-btn--img .aa-inline-icon{width:20px;height:20px}
      .aa-activity-header-icon .aa-inline-icon{width:22px;height:22px}
      .aa-doc-icon .aa-inline-icon{width:20px;height:20px}
      .aa-connect-btn-icon .aa-inline-icon{width:18px;height:18px}
      .aa-inline-icon--chevron{color:var(--primary)}
      .aa-header-left h1{font-size:18px;font-weight:800;margin:0;letter-spacing:-0.03em;color:var(--text)}
      .aa-header-right{display:flex;align-items:center;gap:8px}
      .aa-panel-close{appearance:none;border:none;background:transparent;width:34px;height:34px;border-radius:var(--radius-ui);cursor:pointer;color:var(--text-muted);font-size:20px;line-height:1;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;font-weight:600;padding:0}
      .aa-panel-close:hover{background:var(--background);color:var(--text)}
      .aa-header--connect{background:transparent;border-bottom:1px solid rgba(15,23,42,0.07);padding:12px 16px 14px}
      .aa-header--connect .logo-box{background:rgba(255,255,255,0.75);box-shadow:inset 0 0 0 1px rgba(0,102,255,0.12), 0 1px 2px rgba(15,23,42,0.04)}
      .aa-header--connect .aa-header-left h1{font-size:17px;letter-spacing:-0.035em;color:#0f172a}
      
      .aa-badge-ai{background:var(--tertiary);color:#fff;padding:4px 10px;border-radius:999px;font-size:10px;font-weight:900;letter-spacing:0.1em;box-shadow:0 0 12px rgba(245,158,11,0.3)}
      .aa-badge-user{width:36px;height:36px;border-radius:var(--radius-ui);background:var(--secondary);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:none}
      
      .aa-body{flex:1;display:flex;flex-direction:column;gap:16px;padding:16px;overflow-y:auto}
      .aa-body::-webkit-scrollbar{width:6px}
      .aa-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:999px}
      
      .aa-bottom-nav{display:flex;justify-content:space-around;align-items:center;padding:6px 6px;background:var(--surface);border-top:1px solid var(--border);position:relative;z-index:50;gap:4px}
      .aa-nav-item{appearance:none;border:none;background:transparent;display:flex;align-items:center;justify-content:center;color:var(--text-muted);width:40px;height:40px;padding:0;transition:background .15s ease,color .15s ease;cursor:pointer;border-radius:var(--radius-ui)}
      .aa-nav-item .aa-inline-icon{opacity:0.5;transition:opacity .15s ease,color .15s ease}
      .aa-nav-item:hover .aa-inline-icon,.aa-nav-item.is-active .aa-inline-icon{opacity:1}
      .aa-nav-item:hover{color:var(--primary);background:var(--primary-bg)}
      .aa-nav-item.is-active{color:var(--primary);background:var(--primary-bg)}
      .aa-doc-row{display:flex;align-items:center;gap:10px;padding:12px 12px;border-radius:var(--radius-md);background:var(--background);border:1px solid var(--border)}
      .aa-doc-row .aa-doc-icon{flex-shrink:0;display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:var(--radius-ui);background:var(--surface);border:1px solid var(--border)}
      .aa-doc-row .aa-doc-icon .aa-inline-icon{width:20px;height:20px;color:var(--primary)}
      .aa-doc-row .aa-doc-meta{flex:1;min-width:0}
      .aa-doc-row .aa-doc-name{font-size:12px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
      .aa-doc-row .aa-doc-sub{font-size:10.5px;color:var(--text-muted);margin:3px 0 0}
      .btn-connect-pat{display:inline-flex;align-items:center;justify-content:center;gap:10px}
      .btn-connect-pat .aa-connect-btn-icon{display:flex;align-items:center;justify-content:center}
      .btn-connect-pat .aa-connect-btn-icon .aa-inline-icon{opacity:0.95;color:#fff}
      
      .bento{background:var(--surface);border-radius:var(--radius-md);padding:16px;border:1px solid var(--border);box-shadow:0 1px 3px rgba(0,0,0,0.05);transition:border-color .15s ease,background .15s ease}
      .bento:hover{border-color:#cbd5e1}
      .bento-kicker{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;color:var(--text-muted);margin:0 0 8px}
      .bento-title{font-size:20px;font-weight:800;margin:0 0 10px;letter-spacing:-0.02em}
      
      .progress-container{margin-bottom:12px}
      .progress-label{display:flex;justify-content:space-between;font-size:12px;font-weight:700;margin-bottom:6px}
      .progress-bar{height:8px;background:var(--background);border-radius:999px;overflow:hidden}
      .progress-fill{height:100%;background:linear-gradient(90deg, var(--primary), var(--secondary));border-radius:999px;transition:width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)}
      
      .grid-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .stat-card{background:var(--surface);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border)}
      .stat-val{font-size:24px;font-weight:900;color:var(--text);display:block}
      .stat-label{font-size:11px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em}
      
      .btn-primary{width:100%;padding:10px 12px;background:var(--primary);color:#fff;border-radius:var(--radius-ui);border:none;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:background .15s ease,filter .15s ease;box-shadow:none}
      .btn-primary:hover{filter:brightness(1.06)}
      .btn-primary:active{filter:brightness(0.95)}
      .btn-secondary{width:100%;padding:10px 12px;background:var(--surface);color:var(--text);border-radius:var(--radius-ui);border:1px solid var(--border);font-weight:600;font-size:13px;display:flex;align-items:center;justify-content:center;gap:8px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
      .btn-secondary:hover{background:var(--primary-bg);border-color:var(--primary);color:var(--primary)}
      .aa-icon-btn{appearance:none;border:1px solid var(--border);background:var(--surface);color:var(--text);width:38px;height:38px;padding:0;border-radius:var(--radius-ui);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease}
      .aa-icon-btn:hover{background:var(--primary-bg);border-color:var(--primary);color:var(--primary)}
      .aa-icon-btn.aa-icon-btn--primary{background:var(--primary);color:#fff;border-color:var(--primary)}
      .aa-icon-btn.aa-icon-btn--primary:hover{filter:brightness(1.06);background:var(--primary);color:#fff;border-color:var(--primary)}
      .aa-icon-btn:disabled{opacity:0.5;cursor:not-allowed}
      .aa-toolbar{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-start;margin-top:auto;padding-top:6px}
      
      .match-card{background:var(--surface);border-radius:var(--radius-md);border:1px solid var(--border);overflow:hidden;margin-bottom:12px;cursor:pointer;transition:border-color .15s ease,background .15s ease}
      .match-card:hover{border-color:var(--primary);background:#fafbfc}
      .match-top{padding:14px;display:flex;gap:12px;align-items:center}
      .match-logo{width:42px;height:42px;border-radius:12px;background:#000;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0}
      .match-logo img{width:100%;height:100%;object-fit:contain}
      .match-info h3{font-size:14px;font-weight:800;margin:0 0 2px}
      .match-info p{font-size:12px;color:var(--text-muted);margin:0}
      .match-score{margin-left:auto;text-align:right}
      .match-score .val{display:block;font-size:16px;font-weight:900;color:var(--primary)}
      .match-score .lbl{font-size:10px;font-weight:800;text-transform:uppercase}
      .match-bottom{padding:8px 14px;background:rgba(248,250,252,0.5);border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
      .match-tags{display:flex;gap:6px}
      .match-tag{font-size:10px;font-weight:800;padding:4px 8px;border-radius:6px;background:var(--background);color:var(--text-muted);text-transform:uppercase}
      
      .activity-item{display:grid;grid-template-columns:56px 1fr;gap:10px;margin-bottom:10px}
      .activity-time{font-size:11px;font-weight:800;color:var(--text-muted)}
      .activity-msg{font-size:12px;color:var(--text)}
      
      .aa-section{background:var(--surface);padding:16px;border-radius:var(--radius-md);border:1px solid var(--border);margin-bottom:12px}
      .aa-fields{display:grid;gap:12px}
      .aa-field-label{font-size:12px;font-weight:800;color:var(--text);margin-bottom:5px;display:block}
      .aa-control{width:100%;padding:10px;border:1px solid var(--border);border-radius:var(--radius-ui);font-size:13px;background:var(--background);transition:border-color .15s ease,box-shadow .15s ease}
      .aa-control:focus{outline:none;border-color:var(--primary);background:var(--surface);box-shadow:0 0 0 3px var(--primary-bg)}
      
      .spotlight{background:linear-gradient(135deg, var(--primary), var(--secondary));color:#fff;padding:24px;border-radius:var(--radius-md);position:relative;overflow:hidden}
      .spotlight h3{font-size:20px;margin:0 0 8px}
      .spotlight p{font-size:13px;margin:0 0 16px;opacity:0.9;line-height:1.5}
      .spotlight-btn{background:#fff;color:var(--primary);padding:10px 18px;border-radius:var(--radius-ui);border:none;font-weight:700;font-size:13px;cursor:pointer;transition:filter .15s ease;display:inline-flex;align-items:center;gap:8px}
      .spotlight-btn:hover{filter:brightness(0.97)}
      .aa-connect-body{padding:16px 18px 20px;gap:0}
      .aa-connect-intro{margin-bottom:16px}
      .aa-connect-eyebrow{font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin:0 0 8px}
      .aa-connect-title{font-size:clamp(19px,4.4vw,23px);font-weight:800;letter-spacing:-0.035em;line-height:1.18;margin:0 0 10px;color:#0f172a}
      .aa-connect-lead{font-size:13px;line-height:1.55;margin:0;color:#475569;max-width:36ch}
      .aa-connect-steps-list{list-style:none;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:11px}
      .aa-connect-steps-list li{display:flex;gap:10px;align-items:flex-start;font-size:12px;line-height:1.45;color:#334155;margin:0}
      .aa-connect-step-num{flex-shrink:0;width:22px;height:22px;border-radius:999px;background:rgba(0,102,255,0.1);color:var(--primary);font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;line-height:1;margin-top:1px}
      .aa-connect-field{margin-bottom:14px}
      .aa-connect-label{display:block;font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:#64748b;margin:0 0 8px}
      .aa-connect-input{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px;line-height:1.45;min-height:72px;resize:vertical;background:rgba(255,255,255,0.85);border-color:rgba(15,23,42,0.1);box-shadow:inset 0 1px 2px rgba(15,23,42,0.03)}
      .aa-connect-input:focus{background:#fff}
      .aa-connect-hint{font-size:11px;color:#94a3b8;margin:8px 0 0;line-height:1.4}
      .aa-connect-hint code{font-size:10px;font-weight:600;padding:2px 6px;border-radius:4px;background:rgba(15,23,42,0.04);color:#475569}
      .aa-connect-error{font-size:12px;margin:0 0 12px;line-height:1.45;color:var(--danger);padding:10px 12px;border-radius:var(--radius-ui);background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15)}
      .aa-connect-actions{display:flex;flex-direction:column;gap:10px;margin-top:8px}
      .btn-connect-pat{width:100%;padding:11px 14px;background:var(--primary);color:#fff;border:none;border-radius:7px;font-weight:700;font-size:13px;letter-spacing:0.01em;cursor:pointer;transition:filter .15s ease,transform .12s ease;box-shadow:0 1px 0 rgba(255,255,255,0.12) inset, 0 2px 8px rgba(0,102,255,0.25)}
      .btn-connect-pat:hover{filter:brightness(1.05)}
      .btn-connect-pat:active{transform:translateY(1px)}
      .btn-connect-pat:disabled{opacity:0.55;cursor:not-allowed;transform:none;box-shadow:none}
      .btn-open-aladdin-secondary{width:100%;padding:10px 12px;background:rgba(255,255,255,0.65);color:#0f172a;border:1px solid rgba(15,23,42,0.1);border-radius:var(--radius-ui);font-weight:600;font-size:12.5px;cursor:pointer;transition:background .15s ease,border-color .15s ease,color .15s ease,box-shadow .15s ease;box-shadow:0 1px 2px rgba(15,23,42,0.04)}
      .btn-open-aladdin-secondary:hover{background:#fff;border-color:rgba(0,102,255,0.35);color:var(--primary);box-shadow:0 2px 8px rgba(0,102,255,0.08)}
      .aa-settings-topbar{display:flex;justify-content:flex-end;align-items:center;margin:0 0 12px}
      #aa-settings-sticky{display:none;flex-direction:column;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border)}
      .aa-activity-header-icon{display:flex;align-items:center;justify-content:center;color:var(--primary)}
      .aa-activity-header-icon .aa-inline-icon{opacity:0.85;color:var(--primary)}
      
      .pulsing-indicator{width:10px;height:10px;background:var(--success);border-radius:50%;display:inline-block;margin-right:8px;position:relative}
      .pulsing-indicator::after{content:'';position:absolute;inset:-4px;border-radius:50%;background:var(--success);opacity:0.4;animation:pulse-dot 1.5s infinite}
      @keyframes pulse-dot{0%{transform:scale(1);opacity:0.4}100%{transform:scale(2.5);opacity:0}}
    `;
    this.shadowRoot.appendChild(style);
    
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Manrope:wght@600;700;800&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    this.bookmarkEl = document.createElement('div');
    this.panelEl = document.createElement('section');
    this.shadowRoot.appendChild(this.bookmarkEl);
    this.shadowRoot.appendChild(this.panelEl);
    this._bindGlobals();
    this._renderBookmark();
    this._renderPanel();
    this._syncVisibility();
    this._place();
  }

  _bindGlobals() {
    this._onPointerMove = (event) => {
      if (!this._dragState || event.pointerId !== this._dragState.pointerId) return;
      const dx = event.clientX - this._dragState.startX;
      const dy = event.clientY - this._dragState.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) this._dragState.moved = true;
      const { w, h } = this._bmSize();
      // Right wall only: ignore horizontal drag; move bookmark vertically along the edge.
      this.position = {
        x: this._bookmarkRightX(w),
        y: clamp(this._dragState.originY + dy, GUTTER, window.innerHeight - h - GUTTER)
      };
      this._place();
    };
    this._onPointerUp = (event) => {
      if (!this._dragState || event.pointerId !== this._dragState.pointerId) return;
      const dragState = this._dragState;
      this._dragState = null;
      if (dragState.source === 'grip') {
        this._snapBookmarkToRightWall();
      }
    };
    this._onResize = () => {
      const { w, h } = this._bmSize();
      this.position = {
        x: this._bookmarkRightX(w),
        y: clamp(this.position.y, GUTTER, window.innerHeight - h - GUTTER)
      };
      this._place();
    };
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    window.addEventListener('pointercancel', this._onPointerUp);
    window.addEventListener('resize', this._onResize);
  }

  _startDrag(event, source) {
    if (event.button !== 0 || !this.isVisible) return;
    this._dragState = {
      pointerId: event.pointerId,
      source,
      startX: event.clientX,
      startY: event.clientY,
      originX: this.position.x,
      originY: this.position.y,
      moved: false
    };
    event.preventDefault();
  }

  _total() {
    return Math.max(this.progress.totalQuestions || 0, 0);
  }

  _answered() {
    return clamp(this.progress.answeredQuestions || 0, 0, this._total());
  }

  _percent() {
    const total = this._total();
    return total ? Math.round((this._answered() / total) * 100) : 0;
  }

  _filledSettingsCount() {
    const answers = Object.values(this.profileData.answers ?? {}).filter((value) => typeof value === 'string' && value.trim()).length;
    const custom = (this.profileData.customQA ?? []).filter((entry) => entry?.answer?.trim()).length;
    return answers + custom;
  }

  _snapBookmarkToRightWall() {
    const H = window.innerHeight;
    const { w, h } = this._bmSize();
    this.snappedEdge = 'right';
    this.position = {
      x: this._bookmarkRightX(w),
      y: clamp(this.position.y, GUTTER, H - h - GUTTER)
    };
    this._applyBookmarkLayout();
    this._place();
  }

  _place() {
    const { w: bmW, h: bmH } = this._bmSize();
    const bx = this._bookmarkRightX(bmW);
    const by = clamp(this.position.y, GUTTER, window.innerHeight - bmH - GUTTER);
    this.position = { x: bx, y: by };
    this.bookmarkEl.style.left = `${bx}px`;
    this.bookmarkEl.style.top = `${by}px`;
    const bmMidX = bx + bmW / 2;
    const openLeft = bmMidX < window.innerWidth / 2;
    const px = openLeft ? GUTTER : window.innerWidth - PANEL_WIDTH - GUTTER;
    const py = PANEL_TOP_ANCHOR;
    this.panelEl.style.left = `${px}px`;
    this.panelEl.style.top = `${py}px`;
    this.panelEl.style.transformOrigin = openLeft ? '16px 20px' : `calc(100% - 16px) 20px`;
  }

  _syncVisibility() {
    this.bookmarkEl.hidden = !this.isVisible;
    this.panelEl.hidden = !this.isVisible;
    if (!this.isVisible) this.panelEl.classList.remove('open');
  }

  _bookmarkAriaDetail() {
    const total = this._total();
    let s = this._stateLabel();
    if (total) s += `. ${this._answered()} of ${total} questions filled`;
    return s;
  }

  _stateLabel() {
    if (this.askingQuestion) return 'Needs input';
    return { idle: 'Ready to fill', running: 'Filling page...', paused: 'Check required', done: 'Page filled' }[this.state] ?? 'Ready to fill';
  }

  _resumeFileLabel() {
    const doc = this.profileData.documents?.resume;
    const name = typeof doc?.filename === 'string' ? doc.filename.trim() : '';
    if (name) return name;
    if (doc?.ready) return 'Saved resume';
    return 'No resume saved yet';
  }

  _coverFileLabel() {
    const doc = this.profileData.documents?.coverLetter;
    const name = typeof doc?.filename === 'string' ? doc.filename.trim() : '';
    if (name) return name;
    if (doc?.ready) return 'Saved cover letter';
    return 'No cover letter saved yet';
  }

  _overviewHtml() {
    const userName = this.profileData.user
      ? [this.profileData.user.firstName, this.profileData.user.lastName].filter(Boolean).join(' ').trim()
      : 'Job Hunter';
    
    return `
      <section>
        <p class="bento-kicker">Dashboard overview</p>
        <h2 class="bento-title">Hi, ${this._esc(userName)}!</h2>
        <div class="bento">
          <div class="progress-label">
            <span>Profile Completion</span>
            <span style="color:var(--primary)">85%</span>
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width: 85%"></div></div>
          <p style="font-size:12px;color:var(--text-muted);margin:12px 0 0">Syncing your latest <strong>Senior Developer</strong> persona.</p>
        </div>
      </section>

      <section>
        <button type="button" class="btn-primary" id="aa-start" title="Auto apply this page" aria-label="Auto apply this page">Auto apply</button>
      </section>

      <section class="grid-2">
        <div class="stat-card">
          <span class="stat-label">Applications</span>
          <strong class="stat-val">124</strong>
        </div>
         <div class="stat-card">
          <span class="stat-label">Offers</span>
          <strong class="stat-val" style="color:var(--success)">2</strong>
        </div>
      </section>

      <section>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 class="headline" style="font-size:18px;margin:0">Recent Matches</h2>
          <span style="color:var(--primary);font-size:12px;font-weight:800;cursor:pointer">See all</span>
        </div>
        
        <div class="match-card">
          <div class="match-top">
            <div class="match-logo"><img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCD3VBToBsql5kgau4oJE5b8dOCqU6b0pjPt-f5idgEKRPTvmiWwH1mZgdc1AOAzJ55ORsHLIxl0VLBbx3Zz_9jncetRPRerHW_x2Q6Qiov0MUBd8CCurR3JeeWeRxaJS5kdu0miY7N32vgNWsVtTIUH3QuvSM-kxWZ8u3ZPTShKJO6LplSMOtyv9O_mdmmXilDzkI52IZFabYfCehlkxpiauJhyWW1ZgpYYBawogNvcp8UwjLEX-EQrCNDm5ve1S7G5j6HkaBEOlA" alt="Spotify"></div>
            <div class="match-info">
              <h3>Senior UI Engineer</h3>
              <p>Spotify • Remote</p>
            </div>
            <div class="match-score"><span class="val">98%</span><span class="lbl">Match</span></div>
          </div>
          <div class="match-bottom">
            <div class="match-tags"><span class="match-tag">Full-time</span></div>
            <span class="aa-inline-icon--chevron" aria-hidden="true">${icons.chevronRight(18)}</span>
          </div>
        </div>
      </section>

    `;
  }

  _applicationsHtml() {
    return `
      <section class="bento">
        <p class="bento-kicker">Live Application</p>
        <h2 class="bento-title">${this._esc(this._stateLabel())}</h2>
        <div class="progress-label">
          <span>${this._answered()} of ${this._total()} questions</span>
          <span style="color:var(--primary)">${this._percent()}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${this._percent()}%"></div></div>
      </section>

      <section class="bento">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="aa-activity-header-icon" title="Activity" aria-hidden="true">${icons.activity(24)}</div>
          <span class="pulsing-indicator" title="Live updates" aria-label="Live"></span>
        </div>
        <div class="aa-activity">
          ${this.logEntries.length ? this.logEntries.slice(-8).reverse().map(entry => {
            const time = entry.match(/\[(.*?)\]/)?.[1] || '--:--';
            const msg = entry.replace(/\[.*?\]\s*/, '');
            const escapedMsg = this._esc(msg).replace(/Aladdin AI/g, '<span class="aa-ai-label">Aladdin AI</span>');
            return `<div class="activity-item"><span class="activity-time">${this._esc(time)}</span><span class="activity-msg">${escapedMsg}</span></div>`;
          }).join('') : '<p style="color:var(--text-muted);font-size:13px;font-style:italic">Waiting to start application...</p>'}
        </div>
      </section>
      
      ${this._fileAlertBanner() || ''}
      ${this._prompt() || ''}
      ${this._success() || ''}

      <div class="aa-toolbar" role="toolbar" aria-label="Autofill controls">
        ${this.state === 'paused'
    ? `<button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-resume" title="Resume" aria-label="Resume autofill">${icons.play(22)}</button>`
    : `<button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-pause" title="Pause" aria-label="Pause autofill">${icons.pause(22)}</button>`}
        <button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-toolbar-skip" title="Skip" aria-label="Skip step">${icons.skip(22)}</button>
        <button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-stop" title="Stop" aria-label="Stop autofill">${icons.stop(22)}</button>
      </div>
    `;
  }

  _fieldHtml(field) {
    const id = `aa-field-${field.key}`;
    const value = this.settingsDraft.answers?.[field.key] ?? '';
    if (field.type === 'select') {
      return `
        <div class="aa-field-wrap">
          <label class="aa-field-label" for="${id}">${this._esc(field.label)}</label>
          <select class="aa-control" id="${id}" data-aa-field-key="${this._esc(field.key)}">
            <option value="">Select an option</option>
            ${(field.options ?? []).map((option) => `<option value="${this._esc(option)}"${option === value ? ' selected' : ''}>${this._esc(option)}</option>`).join('')}
          </select>
        </div>
      `;
    }
    if (field.type === 'textarea') {
      return `
        <div class="aa-field-wrap">
          <label class="aa-field-label" for="${id}">${this._esc(field.label)}</label>
          <textarea class="aa-control" id="${id}" data-aa-field-key="${this._esc(field.key)}" style="min-height:80px;resize:vertical" placeholder="${this._esc(field.placeholder || '')}">${this._esc(value)}</textarea>
        </div>
      `;
    }
    return `
      <div class="aa-field-wrap">
        <label class="aa-field-label" for="${id}">${this._esc(field.label)}</label>
        <input class="aa-control" id="${id}" type="${this._esc(field.type || 'text')}" data-aa-field-key="${this._esc(field.key)}" value="${this._esc(value)}" placeholder="${this._esc(field.placeholder || '')}">
      </div>
    `;
  }

  _customAnswersHtml() {
    if (!this.settingsDraft.customQA?.length) {
      return '<p style="color:var(--text-muted);font-size:13px;font-style:italic">No custom answers yet. Add them below to remember weird questions.</p>';
    }
    return this.settingsDraft.customQA.map((entry, index) => `
      <div class="bento" style="margin-bottom:12px;background:var(--background)">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span class="aa-field-label" style="margin:0">Custom Question #${index + 1}</span>
          <span data-aa-remove-custom="${index}" style="color:var(--danger);cursor:pointer;display:inline-flex;align-items:center" title="Remove">${icons.delete(18)}</span>
        </div>
        <input class="aa-control" type="text" data-aa-custom-index="${index}" data-aa-custom-prop="question" value="${this._esc(entry.question)}" placeholder="The question asked..." style="margin-bottom:8px">
        <textarea class="aa-control" data-aa-custom-index="${index}" data-aa-custom-prop="answer" placeholder="Your remembered answer..." style="min-height:60px">${this._esc(entry.answer)}</textarea>
      </div>
    `).join('');
  }

  _settingsHtml() {
    const stickyDisplay = this.settingsDirty ? 'flex' : 'none';
    const resume = this.profileData.documents?.resume;
    const resumeReady = !!resume?.ready;
    return `
      <section>
        <div class="aa-settings-topbar">
          <button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-settings-reload" title="Reload from server" aria-label="Reload settings from server">${icons.refresh(22)}</button>
        </div>
        <p class="bento-kicker">Profile Settings</p>
        <h2 class="bento-title">Customize Flow</h2>
        <div class="aa-section">
          <h3 class="headline" style="font-size:16px;margin:0 0 12px">Automation</h3>
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none">
            <span style="font-size:13px;color:var(--text);flex:1;line-height:1.4">
              <strong>Auto-Advance</strong><br>
              <span style="color:var(--text-muted)">Automatically click Next after all fields on a step are filled. Blocks if mandatory fields are empty.</span>
            </span>
            <input type="checkbox" id="aa-auto-advance-toggle" ${this.autoAdvance ? 'checked' : ''} style="width:18px;height:18px;accent-color:var(--brand,#6366f1);cursor:pointer;flex-shrink:0">
          </label>
        </div>
        <div class="aa-section">
          <h3 class="headline" style="font-size:16px;margin:0 0 12px">Aladdin account</h3>
          ${this.profileData.user ? `
            <p style="font-size:13px;color:var(--text-muted);margin:0 0 12px;line-height:1.45">
              Connected as <strong>${this._esc(this.profileData.user.email || `${this.profileData.user.firstName || ''} ${this.profileData.user.lastName || ''}`.trim() || 'your account')}</strong>.
            </p>
            <button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-disconnect-aladdin" title="Sign out" aria-label="Sign out and disconnect extension" style="border-color:var(--danger);color:var(--danger)">${icons.signOut(22)}</button>
          ` : `
            <p style="font-size:13px;color:var(--text-muted);margin:0;line-height:1.45">Not connected. Generate a secret key in Aladdin → Account → Auto Apply, then paste it in the extension bookmark (overview when disconnected).</p>
          `}
        </div>
        <div class="aa-section">
          <h3 class="headline" style="font-size:16px;margin:0 0 12px">Resume</h3>
          <div class="aa-doc-row">
            <div class="aa-doc-icon" aria-hidden="true">${icons.document(22)}</div>
            <div class="aa-doc-meta">
              <p class="aa-doc-name">${this._esc(this._resumeFileLabel())}</p>
              <p class="aa-doc-sub">Used when applications ask for a résumé file.</p>
            </div>
            ${resumeReady ? `<button type="button" class="aa-icon-btn aa-icon-btn--img" id="aa-resume-preview" title="Preview resume" aria-label="Preview resume">${icons.preview(20)}</button>` : ''}
          </div>
        </div>
        <div class="aa-section">
          <h3 class="headline" style="font-size:16px;margin:0 0 12px">Cover letter</h3>
          <p class="aa-doc-sub" style="margin:0 0 12px">${this._esc(this._coverFileLabel())}</p>
          <button type="button" class="btn-secondary" id="aa-generate-cover-letter" style="width:100%;text-align:center">Generate cover letter using Aladdin</button>
        </div>
        
        ${(this.profileData.sections ?? []).map(section => `
          <div class="aa-section">
            <h3 class="headline" style="font-size:16px;margin:0 0 16px">${this._esc(section.title)}</h3>
            <div class="aa-fields">${section.fields.map(f => this._fieldHtml(f)).join('')}</div>
          </div>
        `).join('')}

        <div class="aa-section">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
            <h3 class="headline" style="font-size:16px;margin:0">Custom QA</h3>
            <button type="button" class="aa-icon-btn" id="aa-add-custom" title="Add custom Q and A" aria-label="Add custom question and answer">
              ${icons.add(22)}
            </button>
          </div>
          ${this._customAnswersHtml()}
        </div>

        ${this.settingsMessage ? `<p style="font-size:12px;margin:-4px 0 12px;color:var(--text-muted)">${this._esc(this.settingsMessage.text)}</p>` : ''}
        <div id="aa-settings-sticky" style="display:${stickyDisplay}">
           <div style="font-size:12px;color:var(--text-muted)">You have unsaved changes.</div>
           <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap">
            <button type="button" class="aa-icon-btn aa-icon-btn--primary" id="aa-settings-save" title="${this.settingsSaving ? 'Saving' : 'Save'}" aria-label="${this.settingsSaving ? 'Saving settings' : 'Save settings'}" ${this.settingsSaving ? 'disabled' : ''}>
              ${this.settingsSaving ? icons.hourglass(22) : icons.save(22)}
            </button>
           </div>
        </div>
      </section>
    `;
  }

  _fileAlertBanner() {
    if (!this.fileAlert) return '';
    return `
      <div class="bento" style="background:#fff7ed;border-color:#f59e0b;display:flex;align-items:flex-start;gap:10px">
        <span style="color:#f59e0b;flex-shrink:0;margin-top:1px">${icons.document(20)}</span>
        <p style="font-size:12px;color:#92400e;margin:0;line-height:1.5">${this._esc(this.fileAlert)}</p>
      </div>
    `;
  }

  _prompt() {
    if (!this.askingQuestion) return '';
    return `
      <section class="bento" style="background:var(--primary-bg);border-color:var(--primary)">
        <h3 class="headline" style="font-size:18px;margin:0 0 12px;color:var(--primary)">User Input Required</h3>
        <p style="font-size:14px;font-weight:600;margin:0 0 16px">${this._esc(this.askingQuestion.label)}</p>
        ${this.askingQuestion.type === 'file' ? `
           <label class="aa-icon-btn" style="margin-bottom:12px;cursor:pointer;width:100%;box-sizing:border-box" title="Choose file" aria-label="Choose file to upload">
             ${icons.uploadFile(22)}
             <input type="file" id="aa-prompt-file-input" style="display:none">
           </label>
        ` : `
          <input class="aa-control" id="aa-prompt-answer" type="text" placeholder="Type here..." style="margin-bottom:12px">
        `}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%">
          <button type="button" class="aa-icon-btn" style="width:100%" id="aa-prompt-save" title="Submit" aria-label="Submit answer">
            ${icons.check(22)}
          </button>
          <button type="button" class="aa-icon-btn" style="width:100%" id="aa-prompt-skip" title="Skip" aria-label="Skip question">
            ${icons.skipNext(22)}
          </button>
        </div>
      </section>
    `;
  }

  _success() {
    if (this.state !== 'done') return '';
    const allAnswered = !this._total() || this._answered() >= this._total();
    const label = allAnswered
      ? 'All questions filled!'
      : `${this._answered()} of ${this._total()} questions filled`;
    const sub = allAnswered
      ? 'Review your answers and submit the application.'
      : 'A few fields need manual review. Check the page before submitting.';
    return `
      <div class="bento" style="background:#ecfbf3;border-color:var(--success);text-align:center">
        <span class="aa-tick-anim" style="color:var(--success);display:flex;justify-content:center;margin-bottom:12px">${icons.checkCircle(48)}</span>
        <h3 class="headline" style="font-size:20px;margin:0 0 8px;color:#166d48">${label}</h3>
        <p style="font-size:13px;color:#166d48;margin:0">${sub}</p>
      </div>
    `;
  }

  _renderBookmark() {
    this.bookmarkEl.className = `aa-bookmark state-${this.state}${this.isOpen ? ' is-open' : ''}`;
    const dots = '<span class="aa-grip-dots">' + Array.from({ length: 6 }, () => '<span></span>').join('') + '</span>';
    const ariaToggle = `Open Aladdin. ${this._bookmarkAriaDetail()}`;
    this.bookmarkEl.innerHTML = `
      <button type="button" class="aa-bookmark-toggle">
        <img src="${LOGO_URL}" alt="">
      </button>
      <div class="aa-bookmark-grip" role="button" tabindex="0" aria-label="Drag to move anywhere. Release to snap to the nearest screen edge." title="Drag to move the widget anywhere on the page. Release to snap to the nearest edge.">
        ${dots}
      </div>
    `;
    const toggle = this.bookmarkEl.querySelector('.aa-bookmark-toggle');
    const grip = this.bookmarkEl.querySelector('.aa-bookmark-grip');
    if (toggle) {
      toggle.setAttribute('aria-label', ariaToggle);
      toggle.onclick = (e) => {
        e.stopPropagation();
        if (this.isOpen) this.collapse();
        else this.open();
      };
    }
    if (grip) {
      grip.onpointerdown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        this._startDrag(e, 'grip');
      };
    }
    this._applyBookmarkLayout();
  }

  _renderPanel() {
    this.panelEl.className = `aa-panel state-${this.state}${this.isOpen ? ' open' : ''}${!this.profileData?.user ? ' aa-panel--connect' : ''}`;

    if (!this.profileData?.user) {
      this.panelEl.innerHTML = `
        <div class="aa-header aa-header--connect" id="aa-header-drag">
          <div class="aa-header-left">
            <div class="logo-box"><img src="${LOGO_URL}" alt="Aladdin"></div>
            <h1 class="headline">Aladdin</h1>
          </div>
          <button type="button" class="aa-panel-close" id="aa-panel-close" title="Close" aria-label="Close panel">×</button>
        </div>
        <div class="aa-body aa-connect-body">
          <div class="aa-connect-intro">
            <p class="aa-connect-eyebrow">Auto Apply</p>
            <h2 class="aa-connect-title headline">Connect this extension</h2>
            <p class="aa-connect-lead">One secret key links your browser to Aladdin so applications can fill safely—nothing is stored in the page.</p>
          </div>
          <ol class="aa-connect-steps-list" aria-label="Steps to connect">
            <li><span class="aa-connect-step-num" aria-hidden="true">1</span><span>Open Aladdin in your browser and sign in.</span></li>
            <li><span class="aa-connect-step-num" aria-hidden="true">2</span><span>Go to <strong>Settings</strong> → <strong>Auto Apply</strong> and generate an <strong>extension secret key</strong>.</span></li>
            <li><span class="aa-connect-step-num" aria-hidden="true">3</span><span>Paste the key in the field, then tap <strong>Connect</strong>. Use <strong>Open Aladdin</strong> at the bottom if you still need the site.</span></li>
          </ol>
          <div class="aa-connect-field">
            <label class="aa-connect-label" for="aa-pat-input">Extension secret key</label>
            <textarea class="aa-control aa-connect-input" id="aa-pat-input" rows="3" placeholder="ald_ext_…" spellcheck="false" autocomplete="off"></textarea>
            <p class="aa-connect-hint">Keys usually start with <code>ald_ext_</code></p>
          </div>
          ${this.patConnectError ? `<p class="aa-connect-error" role="alert">${this._esc(this.patConnectError)}</p>` : ''}
          <div class="aa-connect-actions">
            <button type="button" class="btn-connect-pat" id="aa-pat-connect" title="${this.patConnectBusy ? 'Connecting' : 'Connect with secret key'}" aria-label="${this.patConnectBusy ? 'Connecting' : 'Connect extension'}" ${this.patConnectBusy ? 'disabled' : ''}>${this.patConnectBusy ? 'Connecting…' : `<span class="aa-connect-btn-icon">${icons.connect(18)}</span>Connect`}</button>
            <button type="button" class="btn-open-aladdin-secondary" id="aa-open-aladdin" title="Open Aladdin" aria-label="Open Aladdin in a new tab">Open Aladdin</button>
          </div>
        </div>
      `;
      this._bindPanelEvents();
      this._syncVisibility();
      this._place();
      return;
    }

    if (this.pageMeta.platform === 'generic') {
      this.panelEl.innerHTML = `
        <div class="aa-header" id="aa-header-drag">
           <div class="aa-header-left">
            <div class="logo-box"><img src="${LOGO_URL}" alt="Aladdin"></div>
            <h1 class="headline">Aladdin</h1>
          </div>
          <button type="button" class="aa-panel-close" id="aa-panel-close" title="Close" aria-label="Close panel">×</button>
        </div>
        <div class="aa-body">
           <div class="bento" style="text-align:center;padding:40px 20px">
            <span style="display:flex;justify-content:center;color:var(--text-muted);margin-bottom:16px">${icons.block(48)}</span>
            <h3 class="headline">Site Not Supported</h3>
            <p style="color:var(--text-muted);font-size:13px">Auto-apply is not enabled for this site. Navigate to a supported job board to see Aladdin in action.</p>
          </div>
        </div>
        <nav class="aa-bottom-nav">
          <button type="button" class="aa-nav-item is-active" id="aa-tab-overview" title="Home" aria-label="Home">${icons.home(24)}</button>
        </nav>
      `;
      this._bindPanelEvents();
      this._syncVisibility();
      this._place();
      return;
    }

    let innerContent = this._overviewHtml();
    if (this.activeTab === 'applications' || (this.state === 'running' && this.activeTab !== 'settings')) {
      innerContent = this._applicationsHtml();
    } else if (this.activeTab === 'settings') {
      innerContent = this._settingsHtml();
    }

    this.panelEl.innerHTML = `
      <div class="aa-header" id="aa-header-drag">
        <div class="aa-header-left">
          <div class="logo-box"><img src="${LOGO_URL}" alt="Aladdin"></div>
          <h1 class="headline">Aladdin</h1>
        </div>
        <div class="aa-header-right">
          <button type="button" class="aa-panel-close" id="aa-panel-close" title="Close" aria-label="Close panel">×</button>
        </div>
      </div>
      
      <div class="aa-body">
        ${innerContent}
      </div>

      <nav class="aa-bottom-nav">
        <button type="button" class="aa-nav-item ${this.activeTab === 'overview' ? 'is-active' : ''}" id="aa-tab-overview" title="Home" aria-label="Home">${icons.home(24)}</button>
        <button type="button" class="aa-nav-item ${this.activeTab === 'applications' ? 'is-active' : ''}" id="aa-tab-applications" title="Activity" aria-label="Activity">${icons.activity(24)}</button>
        <button type="button" class="aa-nav-item ${this.activeTab === 'settings' ? 'is-active' : ''}" id="aa-tab-settings" title="Settings" aria-label="Settings">${icons.settings(24)}</button>
      </nav>
    `;
    
    this._bindPanelEvents();
    this._syncVisibility();
    this._place();
  }

  _bindPanelEvents() {
    const patInput = this.panelEl.querySelector('#aa-pat-input');
    if (patInput) {
      patInput.value = this._patDraft;
      patInput.addEventListener('input', () => {
        this._patDraft = patInput.value;
      });
    }
    this.panelEl.querySelector('#aa-pat-connect')?.addEventListener('click', () => {
      const input = this.panelEl.querySelector('#aa-pat-input');
      this._patDraft = input?.value ?? this._patDraft;
      this.onConnectPat?.(this._patDraft);
    });
    this.panelEl.querySelector('#aa-open-aladdin')?.addEventListener('click', () => this.onOpenAladdin?.());

    const closeBtn = this.panelEl.querySelector('#aa-panel-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.collapse();
    });
    closeBtn?.addEventListener('pointerdown', (e) => e.stopPropagation());

    this.panelEl.querySelector('#aa-sign-in')?.addEventListener('click', () => this.onSignIn?.());
    this.panelEl.querySelector('#aa-header-drag')?.addEventListener('pointerdown', (event) => this._startDrag(event, 'panel'));
    this.panelEl.querySelector('#aa-tab-overview')?.addEventListener('click', () => this._switchTab('overview'));
    this.panelEl.querySelector('#aa-tab-applications')?.addEventListener('click', () => this._switchTab('applications'));
    this.panelEl.querySelector('#aa-tab-settings')?.addEventListener('click', () => this._switchTab('settings'));
    this.panelEl.querySelector('#aa-start')?.addEventListener('click', () => { this.activeTab = 'applications'; this.onStart?.(); });
    this.panelEl.querySelector('#aa-pause')?.addEventListener('click', () => this.onPause?.());
    this.panelEl.querySelector('#aa-resume')?.addEventListener('click', () => this.onResume?.());
    this.panelEl.querySelector('#aa-toolbar-skip')?.addEventListener('click', () => this.onSkip?.());
    this.panelEl.querySelector('#aa-stop')?.addEventListener('click', () => this.onStop?.());
    
    this.panelEl.querySelector('#aa-disconnect-aladdin')?.addEventListener('click', () => this.onDisconnect?.());

    this.panelEl.querySelector('#aa-settings-save')?.addEventListener('click', () => this.onSaveSettings?.(this.getSettingsDraft()));
    this.panelEl.querySelector('#aa-settings-reload')?.addEventListener('click', () => {
      this._clearSettingsDirty();
      this._syncDraft();
      this.setSettingsMessage('Settings reloaded.', 'info');
      this._renderPanel();
    });

    const autoAdvanceToggle = this.panelEl.querySelector('#aa-auto-advance-toggle');
    if (autoAdvanceToggle) {
      autoAdvanceToggle.addEventListener('change', () => {
        this.autoAdvance = autoAdvanceToggle.checked;
        this.onAutoAdvanceChange?.(this.autoAdvance);
      });
    }

    this.panelEl.querySelector('#aa-generate-cover-letter')?.addEventListener('click', () => {
      this.addLog('Generate cover letter — coming soon.');
    });

    this.panelEl.querySelector('#aa-resume-preview')?.addEventListener('click', () => {
      if (typeof this.onResumePreview === 'function') {
        this.onResumePreview();
      } else {
        this.addLog('Resume preview is not available yet.');
      }
    });

    this.panelEl.querySelector('#aa-add-custom')?.addEventListener('click', () => {
      this.settingsDraft.customQA.push({ question: '', answer: '' });
      this.settingsDirty = true;
      this.settingsMessage = null;
      this._renderPanel();
    });

    this.panelEl.querySelectorAll('[data-aa-remove-custom]').forEach((button) => {
      button.addEventListener('click', () => {
        const index = parseInt(button.getAttribute('data-aa-remove-custom'), 10);
        if (!isNaN(index)) {
          this.settingsDraft.customQA.splice(index, 1);
          this.settingsDirty = true;
          this.settingsMessage = null;
          this._renderPanel();
        }
      });
    });

    this.panelEl.querySelectorAll('[data-aa-field-key]').forEach((control) => {
      const sync = () => {
        this.settingsDraft.answers[control.getAttribute('data-aa-field-key')] = control.value;
        this._markSettingsDirty();
      };
      control.addEventListener('input', sync);
      control.addEventListener('change', sync);
    });

    this.panelEl.querySelectorAll('[data-aa-custom-index]').forEach((control) => {
      const sync = () => {
        const index = parseInt(control.getAttribute('data-aa-custom-index'), 10);
        const prop = control.getAttribute('data-aa-custom-prop');
        if (isNaN(index) || !prop) return;
        this.settingsDraft.customQA[index][prop] = control.value;
        this._markSettingsDirty();
      };
      control.addEventListener('input', sync);
      control.addEventListener('change', sync);
    });
    
    this.panelEl.querySelector('#aa-prompt-save')?.addEventListener('click', () => {
      const value = this.panelEl.querySelector('#aa-prompt-answer')?.value?.trim();
      if (value) this._resolvePrompt(value);
    });
    
    this.panelEl.querySelector('#aa-prompt-skip')?.addEventListener('click', () => this._resolvePrompt(null));

    this.panelEl.querySelector('#aa-prompt-file-input')?.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const result = loadEvent.target?.result;
        const base64 = typeof result === 'string' ? result.split(',')[1] : '';
        if (base64) this._resolvePrompt(base64);
      };
      reader.readAsDataURL(file);
    });
  }

  _switchTab(tab) {
    if (this.activeTab === tab) return;
    this.activeTab = tab;
    this._renderPanel();
    if (tab === 'settings') this.onOpenSettings?.();
  }

  _resolvePrompt(value) {
    if (typeof this._resolveAsking === 'function') this._resolveAsking(value);
  }

  _syncDraft() {
    this.settingsDraft = cloneDraft(this.profileData);
  }

  setProfileData(profileData) {
    this.profileData = {
      user: profileData?.user ?? null,
      sections: Array.isArray(profileData?.sections) ? profileData.sections : [],
      answers: { ...(profileData?.answers ?? {}) },
      customQA: Array.isArray(profileData?.customQA) ? profileData.customQA.map((entry) => ({
        question: typeof entry?.question === 'string' ? entry.question : '',
        answer: typeof entry?.answer === 'string' ? entry.answer : ''
      })) : [],
      documents: profileData?.documents ?? this.profileData.documents
    };
    this._syncDraft();
    this.settingsDirty = false;
    this._renderPanel();
  }

  setSettingsSaving(isSaving) {
    this.settingsSaving = !!isSaving;
    this._renderPanel();
  }

  setSettingsMessage(text, tone = 'info') {
    this.settingsMessage = text ? { text, tone } : null;
    this._renderPanel();
  }

  setJobMeta(jobTitle, company, platform = this.pageMeta.platform) {
    this.pageMeta = { jobTitle: jobTitle || '', company: company || '', platform: platform || '' };
    this._renderPanel();
  }

  setPlatform(platform) {
    this.pageMeta.platform = platform || '';
    this._renderPanel();
  }

  setProgress(progress) {
    this.progress = { ...this.progress, ...progress };
    this._renderBookmark();
    this._renderPanel();
  }

  resetSession() {
    this.logEntries = [];
    this.answers = [];
    this.askingQuestion = null;
    this.activeTab = 'overview';
    this.progress = { totalQuestions: 0, answeredQuestions: 0 };
    this._renderBookmark();
    this._renderPanel();
  }

  setState(state) {
    this.state = state;
    this._renderBookmark();
    this._renderPanel();
  }

  showFileAlert(message) {
    this.fileAlert = typeof message === 'string' ? message : 'A file upload is required on this page.';
    this._renderPanel();
  }

  hideFileAlert() {
    this.fileAlert = null;
    this._renderPanel();
  }

  addLog(message) {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    this.logEntries.push(`[${time}] ${message}`);
    this._renderPanel();
  }

  addAnswer(question, answer) {
    if (!this.answers.find((entry) => entry.question === question)) this.answers.push({ question, answer });
  }

  getAnswers() {
    return this.answers;
  }

  getSettingsDraft() {
    return {
      sections: this.profileData.sections,
      answers: { ...(this.settingsDraft.answers ?? {}) },
      customQA: (this.settingsDraft.customQA ?? []).map((entry) => ({
        question: typeof entry?.question === 'string' ? entry.question : '',
        answer: typeof entry?.answer === 'string' ? entry.answer : ''
      }))
    };
  }

  askUser(label, type = 'text') {
    return new Promise((resolve) => {
      this.askingQuestion = { label, type };
      this.activeTab = 'applications';
      this.show();
      this.open();
      this._resolveAsking = (value) => {
        this.askingQuestion = null;
        this._resolveAsking = null;
        this._renderPanel();
        resolve(value);
      };
      this._renderPanel();
    });
  }

  celebrateSuccess() {
    fireConfetti(this.shadowRoot);
  }

  open() {
    if (!this.isVisible) return;
    this.isOpen = true;
    this.panelEl.classList.add('open');
    this._renderBookmark();
    this._place();
  }

  collapse() {
    this.isOpen = false;
    this.panelEl.classList.remove('open');
    this._renderBookmark();
  }

  show() {
    this.isVisible = true;
    this._syncVisibility();
    this._place();
    this._renderBookmark();
  }

  hide() {
    this.isVisible = false;
    this.collapse();
    this._syncVisibility();
  }

  getSnapshot() {
    return {
      visible: this.isVisible,
      open: this.isOpen,
      state: this.state,
      jobTitle: this.pageMeta.jobTitle,
      company: this.pageMeta.company,
      platform: this.pageMeta.platform,
      progress: { ...this.progress },
      requiresInput: !!this.askingQuestion,
      activeTab: this.activeTab
    };
  }

  _esc(value) {
    if (value === null || value === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(value);
    return div.innerHTML;
  }
}
