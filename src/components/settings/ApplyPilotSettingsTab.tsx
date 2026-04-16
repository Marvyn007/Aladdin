'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Loader2, Copy, Check, RefreshCw } from 'lucide-react';
import type { ApplyPilotProfilePayload } from '@/lib/apply-pilot-profile/types';
import { EMPTY_APPLY_PILOT_PAYLOAD } from '@/lib/apply-pilot-profile/types';
import {
  YES_NO_UNSPECIFIED,
  PHONE_COUNTRY_CODES,
  US_STATES,
  COUNTRIES,
  RACE_OPTIONS,
  HISPANIC_OPTIONS,
  GENDER_OPTIONS,
  PRONOUN_OPTIONS,
  VETERAN_OPTIONS,
  DISABILITY_OPTIONS,
  CLEARANCE_OPTIONS,
  YEARS_EXPERIENCE_OPTIONS,
  NOTICE_PERIOD_OPTIONS,
  LGBTQ_OPTIONS,
} from '@/lib/apply-pilot-profile/types';

type ApplyPilotApiBody = {
  payload?: ApplyPilotProfilePayload;
  updatedAt?: string | null;
  ok?: boolean;
  error?: string;
};

/** Avoid SyntaxError when the dev server returns HTML (e.g. Internal Server Error) after EBUSY. */
async function fetchApplyPilotApi(
  url: string,
  init?: RequestInit
): Promise<{ ok: true; body: ApplyPilotApiBody } | { ok: false; message: string }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Network error' };
  }
  const text = await res.text();
  let body: ApplyPilotApiBody;
  try {
    body = text ? (JSON.parse(text) as ApplyPilotApiBody) : {};
  } catch {
    const hint = text.trim().replace(/\s+/g, ' ').slice(0, 140);
    return {
      ok: false,
      message: res.ok
        ? `Invalid response (${hint || 'not JSON'})`
        : `Request failed (${res.status})${hint ? `: ${hint}` : ''}`,
    };
  }
  if (!res.ok) {
    const err = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    return { ok: false, message: err };
  }
  return { ok: true, body };
}

/** Compact controls so Apply Pilot fits the standard Account Settings modal (700×600). */
const inputStyle: CSSProperties = {
  width:           '100%',
  padding:         '5px 8px',
  borderRadius:    '6px',
  border:          '1px solid var(--border)',
  background:      'var(--background-secondary)',
  color:           'var(--text-primary)',
  fontSize:        '11px',
  lineHeight:      1.35,
  outline:         'none',
  boxSizing:       'border-box',
  fontFamily:      'inherit',
};

const labelStyle: CSSProperties = {
  fontSize:     '10px',
  fontWeight:   600,
  color:        'var(--text-secondary)',
  display:      'block',
  marginBottom: '3px',
  lineHeight:   1.25,
};

const sectionTitle: CSSProperties = {
  fontSize:    '11px',
  fontWeight:  700,
  color:       'var(--text-primary)',
  margin:      '10px 0 6px',
  paddingTop:  '6px',
  borderTop:   '1px solid var(--border)',
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
};

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display:               'grid',
        gridTemplateColumns:   'repeat(auto-fill, minmax(132px, 1fr))',
        gap:                   '8px 10px',
        alignItems:            'start',
      }}
    >
      {children}
    </div>
  );
}

export function ApplyPilotSettingsTab() {
  const [p, setP] = useState<ApplyPilotProfilePayload>({ ...EMPTY_APPLY_PILOT_PAYLOAD });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  // Extension key state
  const [extHasToken,   setExtHasToken]   = useState(false);
  const [extLastUsedAt, setExtLastUsedAt] = useState<string | null>(null);
  const [extCreatedAt,  setExtCreatedAt]  = useState<string | null>(null);
  const [extGenerating, setExtGenerating] = useState(false);
  const [extRawToken,   setExtRawToken]   = useState<string | null>(null);
  const [extCopied,     setExtCopied]     = useState(false);
  const [extMsg,        setExtMsg]        = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/extension/access-tokens', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        setExtHasToken(!!data.hasToken);
        setExtLastUsedAt(data.lastUsedAt ?? null);
        setExtCreatedAt(data.createdAt ?? null);
      })
      .catch(() => {});
  }, []);

  async function generateExtKey() {
    setExtGenerating(true);
    setExtRawToken(null);
    setExtMsg(null);
    try {
      const res  = await fetch('/api/extension/access-tokens', { method: 'POST', cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) { setExtMsg(data.error ?? 'Failed to generate key.'); return; }
      setExtRawToken(data.token);
      setExtHasToken(true);
      setExtCreatedAt(new Date().toISOString());
      setExtLastUsedAt(null);
    } catch {
      setExtMsg('Failed to generate key. Please try again.');
    } finally {
      setExtGenerating(false);
    }
  }

  async function copyExtToken() {
    if (!extRawToken) return;
    await navigator.clipboard.writeText(extRawToken);
    setExtCopied(true);
    setTimeout(() => setExtCopied(false), 2000);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchApplyPilotApi('/api/user/apply-pilot-profile', { cache: 'no-store' });
        if (!cancelled) {
          if (!result.ok) {
            setMsg(result.message);
          } else if (result.body.payload) {
            setP({ ...EMPTY_APPLY_PILOT_PAYLOAD, ...result.body.payload });
            setUpdatedAt(result.body.updatedAt ?? null);
          }
        }
      } catch {
        if (!cancelled) setMsg('Could not load saved answers.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const set = <K extends keyof ApplyPilotProfilePayload>(key: K, value: ApplyPilotProfilePayload[K]) => {
    setP((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const result = await fetchApplyPilotApi('/api/user/apply-pilot-profile', {
        method:      'PUT',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ payload: p }),
        cache:       'no-store',
      });
      if (!result.ok) {
        setMsg(result.message);
        return;
      }
      setUpdatedAt(result.body.updatedAt ?? null);
      setMsg('Saved. Apply Pilot will use these answers first.');
      setTimeout(() => setMsg(null), 3200);
    } catch {
      setMsg('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: 8 }}>

      {/* ── Extension key section ─────────────────────────────── */}
      <div style={{
        background:   'var(--background-secondary)',
        border:       '1px solid var(--border)',
        borderRadius: '8px',
        padding:      '10px 12px',
        display:      'flex',
        flexDirection:'column',
        gap:          8,
        marginBottom: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Browser Extension Key
            </p>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.4 }}>
              Connect the Aladdin Chrome extension so it can fill applications automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={generateExtKey}
            disabled={extGenerating}
            style={{
              padding:    '5px 11px',
              borderRadius:'6px',
              fontSize:   '11px',
              fontWeight: 600,
              border:     'none',
              cursor:     extGenerating ? 'not-allowed' : 'pointer',
              background: extGenerating ? 'var(--accent-muted)' : 'var(--accent)',
              color:      extGenerating ? 'var(--accent)' : '#fff',
              display:    'flex',
              alignItems: 'center',
              gap:        5,
              flexShrink: 0,
            }}
          >
            {extGenerating
              ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={12} />}
            {extHasToken ? 'Re-generate' : 'Generate key'}
          </button>
        </div>

        {extHasToken && !extRawToken && (
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {extCreatedAt  && <span>Created {new Date(extCreatedAt).toLocaleDateString()} · </span>}
            {extLastUsedAt
              ? <span>Last used {new Date(extLastUsedAt).toLocaleDateString()}</span>
              : <span>Not yet used</span>}
          </div>
        )}

        {extRawToken && (
          <div>
            <label style={{ ...labelStyle, marginBottom: 4 }}>
              Your extension key — copy now, shown only once
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                readOnly
                type="text"
                value={extRawToken}
                style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={copyExtToken}
                style={{
                  padding:'5px 10px', borderRadius:'6px', fontSize:'11px', fontWeight:600,
                  border:'1px solid var(--border)', cursor:'pointer',
                  background:'var(--background-secondary)', color:'var(--text-primary)',
                  display:'flex', alignItems:'center', gap:5,
                }}
              >
                {extCopied ? <Check size={12} /> : <Copy size={12} />}
                {extCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', margin: '3px 0 0' }}>
              Paste into the extension panel → Connect tab.
            </p>
          </div>
        )}

        {extMsg && (
          <span style={{ fontSize: '10px', color: 'var(--error, #ef4444)' }}>{extMsg}</span>
        )}

        {extHasToken && (
          <p style={{ fontSize: '9px', color: 'var(--text-tertiary)', margin: 0 }}>
            Re-generating revokes the previous key — the extension will prompt you to reconnect.
          </p>
        )}
      </div>
      {/* ──────────────────────────────────────────────────────── */}

      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Apply Pilot
          </h3>
          {updatedAt && (
            <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
              Saved {new Date(updatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
        <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.4 }}>
          US ATS answers + URLs for the apply agent. “Agent decides” uses defaults; your explicit choices always win.
        </p>
      </div>

      <p style={{ ...sectionTitle, borderTop: 'none', marginTop: 0, paddingTop: 0 }}>Personal info</p>
      <FieldGrid>
        <div>
          <label style={labelStyle}>Preferred name</label>
          <input type="text" value={p.preferredName} onChange={(e) => set('preferredName', e.target.value)} style={inputStyle} placeholder="e.g. Alex" />
        </div>
        <div>
          <label style={labelStyle}>Suffix (optional)</label>
          <input type="text" value={p.nameSuffix} onChange={(e) => set('nameSuffix', e.target.value)} style={inputStyle} placeholder="Jr., Sr., II…" />
        </div>
        <div>
          <label style={labelStyle}>Date of birth</label>
          <input type="text" value={p.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} style={inputStyle} placeholder="MM/DD/YYYY" />
        </div>
        <div>
          <label style={labelStyle}>Phone code</label>
          <select value={p.phoneCountryCode} onChange={(e) => set('phoneCountryCode', e.target.value)} style={inputStyle}>
            <option value="">— Select —</option>
            {PHONE_COUNTRY_CODES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Phone #</label>
          <input
            type="tel"
            value={p.phoneNational}
            onChange={(e) => set('phoneNational', e.target.value)}
            placeholder="10-digit #"
            style={inputStyle}
          />
        </div>
      </FieldGrid>

      <p style={sectionTitle}>Links</p>
      <FieldGrid>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>LinkedIn</label>
          <input type="url" value={p.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} style={inputStyle} placeholder="linkedin.com/in/…" />
        </div>
        <div>
          <label style={labelStyle}>GitHub</label>
          <input type="url" value={p.githubUrl} onChange={(e) => set('githubUrl', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Portfolio</label>
          <input type="url" value={p.portfolioUrl} onChange={(e) => set('portfolioUrl', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Other URL</label>
          <input type="url" value={p.otherWebsiteUrl} onChange={(e) => set('otherWebsiteUrl', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Twitter / X</label>
          <input type="url" value={p.twitterUrl} onChange={(e) => set('twitterUrl', e.target.value)} style={inputStyle} />
        </div>
      </FieldGrid>

      <p style={sectionTitle}>Location</p>
      <FieldGrid>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Address line 1</label>
          <input type="text" value={p.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} style={inputStyle} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Address line 2 (apt, suite…)</label>
          <input type="text" value={p.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} style={inputStyle} placeholder="Optional" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Address line 3</label>
          <input type="text" value={p.addressLine3} onChange={(e) => set('addressLine3', e.target.value)} style={inputStyle} placeholder="Optional" />
        </div>
        <div>
          <label style={labelStyle}>City</label>
          <input type="text" value={p.city} onChange={(e) => set('city', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>State (US)</label>
          <select value={p.state} onChange={(e) => set('state', e.target.value)} style={inputStyle}>
            {US_STATES.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>ZIP / postal code</label>
          <input type="text" value={p.zipCode} onChange={(e) => set('zipCode', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Country</label>
          <select value={p.country} onChange={(e) => set('country', e.target.value)} style={inputStyle}>
            {COUNTRIES.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </FieldGrid>

      <p style={sectionTitle}>Work auth & flexibility</p>
      <FieldGrid>
        <div>
          <label style={labelStyle}>Authorized US?</label>
          <select value={p.authorizedToWorkUs} onChange={(e) => set('authorizedToWorkUs', e.target.value)} style={inputStyle}>
            {YES_NO_UNSPECIFIED.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Authorized Canada?</label>
          <select value={p.authorizedToWorkCanada} onChange={(e) => set('authorizedToWorkCanada', e.target.value)} style={inputStyle}>
            {YES_NO_UNSPECIFIED.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Authorized UK?</label>
          <select value={p.authorizedToWorkUk} onChange={(e) => set('authorizedToWorkUk', e.target.value)} style={inputStyle}>
            {YES_NO_UNSPECIFIED.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Visa sponsorship?</label>
          <select value={p.sponsorshipRequired} onChange={(e) => set('sponsorshipRequired', e.target.value)} style={inputStyle}>
            {YES_NO_UNSPECIFIED.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Willing to relocate?</label>
          <select value={p.willingToRelocate} onChange={(e) => set('willingToRelocate', e.target.value)} style={inputStyle}>
            {YES_NO_UNSPECIFIED.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Remote / hybrid OK?</label>
          <select value={p.openToRemote} onChange={(e) => set('openToRemote', e.target.value)} style={inputStyle}>
            {YES_NO_UNSPECIFIED.map((o) => (
              <option key={o.value || 'default'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </FieldGrid>

      <p style={sectionTitle}>EEO (voluntary)</p>
      <FieldGrid>
        <div>
          <label style={labelStyle}>Gender</label>
          <select value={p.gender} onChange={(e) => set('gender', e.target.value)} style={inputStyle}>
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Pronouns</label>
          <select value={p.pronouns} onChange={(e) => set('pronouns', e.target.value)} style={inputStyle}>
            {PRONOUN_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>LGBTQ+ identity</label>
          <select value={p.lgbtqIdentity} onChange={(e) => set('lgbtqIdentity', e.target.value)} style={inputStyle}>
            {LGBTQ_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Race</label>
          <select value={p.race} onChange={(e) => set('race', e.target.value)} style={inputStyle}>
            {RACE_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Hispanic / Latino</label>
          <select value={p.hispanicLatino} onChange={(e) => set('hispanicLatino', e.target.value)} style={inputStyle}>
            {HISPANIC_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Veteran status</label>
          <select value={p.veteranStatus} onChange={(e) => set('veteranStatus', e.target.value)} style={inputStyle}>
            {VETERAN_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Disability status</label>
          <select value={p.disabilityStatus} onChange={(e) => set('disabilityStatus', e.target.value)} style={inputStyle}>
            {DISABILITY_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Clearance</label>
          <select value={p.governmentClearance} onChange={(e) => set('governmentClearance', e.target.value)} style={inputStyle}>
            {CLEARANCE_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </FieldGrid>

      <p style={sectionTitle}>Role & timing</p>
      <FieldGrid>
        <div>
          <label style={labelStyle}>Current title</label>
          <input type="text" value={p.currentJobTitle} onChange={(e) => set('currentJobTitle', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Employer</label>
          <input type="text" value={p.currentEmployer} onChange={(e) => set('currentEmployer', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Yrs experience</label>
          <select value={p.yearsExperienceRange} onChange={(e) => set('yearsExperienceRange', e.target.value)} style={inputStyle}>
            {YEARS_EXPERIENCE_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Salary (text)</label>
          <input
            type="text"
            value={p.expectedSalary}
            onChange={(e) => set('expectedSalary', e.target.value)}
            style={inputStyle}
            placeholder="e.g. $140k–$160k base"
          />
        </div>
        <div>
          <label style={labelStyle}>Notice period</label>
          <select value={p.noticePeriod} onChange={(e) => set('noticePeriod', e.target.value)} style={inputStyle}>
            {NOTICE_PERIOD_OPTIONS.map((o) => (
              <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Start / availability</label>
          <input type="text" value={p.earliestStartDate} onChange={(e) => set('earliestStartDate', e.target.value)} style={inputStyle} placeholder="e.g. 2wk, Jan 15" />
        </div>
      </FieldGrid>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding:       '6px 14px',
            borderRadius:  '6px',
            fontSize:      '11px',
            fontWeight:   600,
            border:        'none',
            background:    saving ? 'var(--accent-muted)' : 'var(--accent)',
            color:         saving ? 'var(--accent)' : '#fff',
            cursor:        saving ? 'not-allowed' : 'pointer',
            display:       'flex',
            alignItems:    'center',
            gap:           6,
          }}
        >
          {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {saving ? 'Saving…' : 'Save'}
        </button>
        {msg && (
          <span style={{ fontSize: 10, color: msg.includes('failed') ? 'var(--error, #ef4444)' : 'var(--accent)' }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
