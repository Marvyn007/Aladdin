'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Copy, Check, Loader2, RefreshCw } from 'lucide-react';

const inputStyle: CSSProperties = {
  width: '100%', padding: '5px 8px', borderRadius: '6px',
  border: '1px solid var(--border)', background: 'var(--background-secondary)',
  color: 'var(--text-primary)', fontSize: '11px', lineHeight: 1.35,
  outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace',
};

const labelStyle: CSSProperties = {
  fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)',
  display: 'block', marginBottom: '3px', lineHeight: 1.25,
};

function btnStyle(accent = false, disabled = false): CSSProperties {
  return {
    padding: '6px 14px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
    border: accent ? 'none' : '1px solid var(--border)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
    background: accent
      ? (disabled ? 'var(--accent-muted)' : 'var(--accent)')
      : 'var(--background-secondary)',
    color: accent ? (disabled ? 'var(--accent)' : '#fff') : 'var(--text-primary)',
  };
}

export function ExtensionKeyTab() {
  const [hasToken,   setHasToken]   = useState(false);
  const [lastUsedAt, setLastUsedAt] = useState<string | null>(null);
  const [createdAt,  setCreatedAt]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState(false);
  const [rawToken,   setRawToken]   = useState<string | null>(null);
  const [copied,     setCopied]     = useState(false);
  const [msg,        setMsg]        = useState<string | null>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const res  = await fetch('/api/extension/access-tokens', { cache: 'no-store' });
      const data = await res.json();
      setHasToken(!!data.hasToken);
      setLastUsedAt(data.lastUsedAt ?? null);
      setCreatedAt(data.createdAt ?? null);
    } catch {
      setMsg('Could not load extension key status.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); }, []);

  async function generate() {
    setGenerating(true);
    setRawToken(null);
    setMsg(null);
    try {
      const res  = await fetch('/api/extension/access-tokens', { method: 'POST', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error ?? 'Failed to generate key.'); return; }
      setRawToken(data.token);
      setHasToken(true);
      setCreatedAt(new Date().toISOString());
      setLastUsedAt(null);
    } catch {
      setMsg('Failed to generate key. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function copyToken() {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
      <div>
        <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          Browser Extension
        </h3>
        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          Generate a key to connect the Aladdin Chrome extension. Your Apply Pilot answers
          will be available automatically when you fill job applications.
        </p>
      </div>

      {hasToken && !rawToken && (
        <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {createdAt  && <div>Key created: {new Date(createdAt).toLocaleDateString()}</div>}
          {lastUsedAt
            ? <div>Last used: {new Date(lastUsedAt).toLocaleDateString()}</div>
            : <div>Not yet used by the extension.</div>}
        </div>
      )}

      {rawToken && (
        <div>
          <label style={labelStyle}>Your extension key (copy this — shown only once)</label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              readOnly
              type="text"
              value={rawToken}
              style={{ ...inputStyle, flex: 1 }}
              onFocus={e => e.target.select()}
            />
            <button type="button" onClick={copyToken} style={btnStyle(false, false)}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', marginTop: 4 }}>
            Paste this into the extension panel → Connect tab. It will not be shown again.
          </p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button type="button" onClick={generate} disabled={generating} style={btnStyle(true, generating)}>
          {generating && <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />}
          <RefreshCw size={13} />
          {hasToken ? 'Re-generate Key' : 'Generate Key'}
        </button>
        {msg && (
          <span style={{ fontSize: '10px', color: msg.includes('ailed') ? 'var(--error, #ef4444)' : 'var(--accent)' }}>
            {msg}
          </span>
        )}
      </div>

      {hasToken && (
        <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', margin: 0 }}>
          Re-generating a key immediately revokes the previous one. The extension will
          prompt you to connect again.
        </p>
      )}
    </div>
  );
}
