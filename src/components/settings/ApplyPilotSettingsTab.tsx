'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import { Loader2, Copy, Check, RefreshCw, ChevronDown } from 'lucide-react';
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

/** Match Account Settings → Preferences typography + control sizing */
const cardStyle: CSSProperties = {
  background:   'var(--background-secondary)',
  borderRadius: '12px',
  border:       '1px solid var(--border)',
  padding:      '20px',
};

const pageTitle: CSSProperties = {
  fontSize:   '16px',
  fontWeight: 600,
  color:      'var(--text-primary)',
  margin:     0,
};

const pageSubtitle: CSSProperties = {
  fontSize:   '13px',
  color:      'var(--text-secondary)',
  margin:     '6px 0 0',
  lineHeight: 1.55,
};

const sectionHeading: CSSProperties = {
  fontSize:   '14px',
  fontWeight: 600,
  color:      'var(--text-primary)',
  margin:     '0 0 12px',
};

const labelStyle: CSSProperties = {
  fontSize:     '13px',
  fontWeight:   500,
  color:        'var(--text-secondary)',
  display:      'block',
  marginBottom: '6px',
  lineHeight:   1.35,
};

const inputStyle: CSSProperties = {
  width:           '100%',
  padding:         '10px 12px',
  borderRadius:    '8px',
  border:          '1px solid var(--border)',
  background:      'var(--background-secondary)',
  color:           'var(--text-primary)',
  fontSize:        '13px',
  lineHeight:      1.45,
  outline:         'none',
  boxSizing:       'border-box',
  fontFamily:      'inherit',
};

const selectShell: CSSProperties = {
  position: 'relative',
  width:    '100%',
};

const nativeSelectStyle: CSSProperties = {
  ...inputStyle,
  appearance:       'none',
  WebkitAppearance: 'none',
  MozAppearance:    'none',
  paddingRight:     '38px',
  cursor:           'pointer',
};

const chevronStyle: CSSProperties = {
  position:     'absolute',
  right:        '12px',
  top:          '50%',
  transform:    'translateY(-50%)',
  pointerEvents:'none',
  color:        'var(--text-tertiary)',
  display:      'flex',
  alignItems:     'center',
};

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display:               'grid',
        gridTemplateColumns:   'repeat(auto-fill, minmax(220px, 1fr))',
        gap:                   '16px',
        alignItems:            'start',
      }}
    >
      {children}
    </div>
  );
}

function SelectField(props: {
  value:    string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div style={selectShell}>
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        style={nativeSelectStyle}
      >
        {props.children}
      </select>
      <span style={chevronStyle} aria-hidden>
        <ChevronDown size={16} />
      </span>
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
      setMsg('Saved. The extension will prefer these answers when filling forms.');
      setTimeout(() => setMsg(null), 3200);
    } catch {
      setMsg('Save failed. Try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 200 }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, paddingBottom: 8 }}>

      {/* Extension key */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={pageTitle}>Extension access</h3>
            <p style={pageSubtitle}>
              Generate a personal access token for the Aladdin Chrome extension. This is separate from your sign-in session.
            </p>
          </div>
          <button
            type="button"
            onClick={generateExtKey}
            disabled={extGenerating}
            style={{
              padding:       '9px 18px',
              borderRadius:  8,
              fontSize:      13,
              fontWeight:    600,
              border:        'none',
              cursor:        extGenerating ? 'not-allowed' : 'pointer',
              background:    extGenerating ? 'var(--accent-muted)' : 'var(--accent)',
              color:         extGenerating ? 'var(--accent)' : '#fff',
              display:       'flex',
              alignItems:    'center',
              gap:           7,
              flexShrink:     0,
              transition:    'background 0.15s ease',
            }}
          >
            {extGenerating
              ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              : <RefreshCw size={14} />}
            {extHasToken ? 'Regenerate token' : 'Generate token'}
          </button>
        </div>

        {extHasToken && !extRawToken && (
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '14px 0 0', lineHeight: 1.55 }}>
            {extCreatedAt && <span>Created {new Date(extCreatedAt).toLocaleString()} · </span>}
            {extLastUsedAt
              ? <span>Last used {new Date(extLastUsedAt).toLocaleString()}</span>
              : <span>Not used yet</span>}
          </p>
        )}

        {extRawToken && (
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>Your token (copy now — shown only once)</label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
              <input
                readOnly
                type="text"
                value={extRawToken}
                style={{
                  ...inputStyle,
                  flex:       '1 1 280px',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={copyExtToken}
                style={{
                  padding:       '9px 16px',
                  borderRadius:  8,
                  fontSize:      13,
                  fontWeight:    600,
                  border:        '1px solid var(--border)',
                  cursor:        'pointer',
                  background:    'var(--background)',
                  color:         'var(--text-primary)',
                  display:       'flex',
                  alignItems:    'center',
                  gap:           7,
                }}
              >
                {extCopied ? <Check size={14} /> : <Copy size={14} />}
                {extCopied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Paste this into the extension panel under Connect.
            </p>
          </div>
        )}

        {extMsg && (
          <p style={{ fontSize: 13, color: 'var(--error, #ef4444)', margin: '12px 0 0', lineHeight: 1.45 }}>
            {extMsg}
          </p>
        )}

        {extHasToken && (
          <p style={{ fontSize: 12, color: 'var(--text-tertiary)', margin: '12px 0 0', lineHeight: 1.5 }}>
            Regenerating revokes your previous token. You will need to reconnect the extension.
          </p>
        )}
      </div>

      {/* Autofill profile */}
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={pageTitle}>Autofill profile</h3>
            <p style={pageSubtitle}>
              Common ATS screening answers and profile links. Empty fields stay unspecified; anything you set here wins over defaults.
            </p>
          </div>
          {updatedAt && (
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', whiteSpace: 'nowrap', paddingTop: 4 }}>
              Last saved {new Date(updatedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div style={cardStyle}>
        <h4 style={sectionHeading}>Personal</h4>
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
            <label style={labelStyle}>Phone country code</label>
            <SelectField value={p.phoneCountryCode} onChange={(v) => set('phoneCountryCode', v)}>
              <option value="">Select…</option>
              {PHONE_COUNTRY_CODES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Phone number</label>
            <input
              type="tel"
              value={p.phoneNational}
              onChange={(e) => set('phoneNational', e.target.value)}
              placeholder="10-digit number"
              style={inputStyle}
            />
          </div>
        </FieldGrid>
      </div>

      <div style={cardStyle}>
        <h4 style={sectionHeading}>Links</h4>
        <FieldGrid>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>LinkedIn</label>
            <input type="url" value={p.linkedinUrl} onChange={(e) => set('linkedinUrl', e.target.value)} style={inputStyle} placeholder="https://linkedin.com/in/…" />
          </div>
          <div>
            <label style={labelStyle}>GitHub</label>
            <input type="url" value={p.githubUrl} onChange={(e) => set('githubUrl', e.target.value)} style={inputStyle} placeholder="https://github.com/…" />
          </div>
          <div>
            <label style={labelStyle}>Portfolio</label>
            <input type="url" value={p.portfolioUrl} onChange={(e) => set('portfolioUrl', e.target.value)} style={inputStyle} placeholder="https://…" />
          </div>
          <div>
            <label style={labelStyle}>Other website</label>
            <input type="url" value={p.otherWebsiteUrl} onChange={(e) => set('otherWebsiteUrl', e.target.value)} style={inputStyle} placeholder="https://…" />
          </div>
          <div>
            <label style={labelStyle}>Twitter / X</label>
            <input type="url" value={p.twitterUrl} onChange={(e) => set('twitterUrl', e.target.value)} style={inputStyle} placeholder="https://x.com/…" />
          </div>
        </FieldGrid>
      </div>

      <div style={cardStyle}>
        <h4 style={sectionHeading}>Location</h4>
        <FieldGrid>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Address line 1</label>
            <input type="text" value={p.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Address line 2</label>
            <input type="text" value={p.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} style={inputStyle} placeholder="Apartment, suite, unit (optional)" />
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
            <SelectField value={p.state} onChange={(v) => set('state', v)}>
              {US_STATES.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>ZIP / postal code</label>
            <input type="text" value={p.zipCode} onChange={(e) => set('zipCode', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Country</label>
            <SelectField value={p.country} onChange={(v) => set('country', v)}>
              {COUNTRIES.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
        </FieldGrid>
      </div>

      <div style={cardStyle}>
        <h4 style={sectionHeading}>Work authorization</h4>
        <FieldGrid>
          <div>
            <label style={labelStyle}>Authorized to work in the US?</label>
            <SelectField value={p.authorizedToWorkUs} onChange={(v) => set('authorizedToWorkUs', v)}>
              {YES_NO_UNSPECIFIED.map((o) => (
                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Authorized to work in Canada?</label>
            <SelectField value={p.authorizedToWorkCanada} onChange={(v) => set('authorizedToWorkCanada', v)}>
              {YES_NO_UNSPECIFIED.map((o) => (
                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Authorized to work in the UK?</label>
            <SelectField value={p.authorizedToWorkUk} onChange={(v) => set('authorizedToWorkUk', v)}>
              {YES_NO_UNSPECIFIED.map((o) => (
                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Will you need visa sponsorship?</label>
            <SelectField value={p.sponsorshipRequired} onChange={(v) => set('sponsorshipRequired', v)}>
              {YES_NO_UNSPECIFIED.map((o) => (
                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Willing to relocate?</label>
            <SelectField value={p.willingToRelocate} onChange={(v) => set('willingToRelocate', v)}>
              {YES_NO_UNSPECIFIED.map((o) => (
                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Open to remote or hybrid?</label>
            <SelectField value={p.openToRemote} onChange={(v) => set('openToRemote', v)}>
              {YES_NO_UNSPECIFIED.map((o) => (
                <option key={o.value || 'default'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
        </FieldGrid>
      </div>

      <div style={cardStyle}>
        <h4 style={sectionHeading}>EEO (voluntary)</h4>
        <p style={{ ...pageSubtitle, margin: '0 0 16px' }}>
          These questions are optional. Share only what you are comfortable providing.
        </p>
        <FieldGrid>
          <div>
            <label style={labelStyle}>Gender</label>
            <SelectField value={p.gender} onChange={(v) => set('gender', v)}>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Pronouns</label>
            <SelectField value={p.pronouns} onChange={(v) => set('pronouns', v)}>
              {PRONOUN_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>LGBTQ+ identity</label>
            <SelectField value={p.lgbtqIdentity} onChange={(v) => set('lgbtqIdentity', v)}>
              {LGBTQ_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Race</label>
            <SelectField value={p.race} onChange={(v) => set('race', v)}>
              {RACE_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Hispanic / Latino</label>
            <SelectField value={p.hispanicLatino} onChange={(v) => set('hispanicLatino', v)}>
              {HISPANIC_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Veteran status</label>
            <SelectField value={p.veteranStatus} onChange={(v) => set('veteranStatus', v)}>
              {VETERAN_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Disability status</label>
            <SelectField value={p.disabilityStatus} onChange={(v) => set('disabilityStatus', v)}>
              {DISABILITY_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Government clearance</label>
            <SelectField value={p.governmentClearance} onChange={(v) => set('governmentClearance', v)}>
              {CLEARANCE_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
        </FieldGrid>
      </div>

      <div style={cardStyle}>
        <h4 style={sectionHeading}>Role and timing</h4>
        <FieldGrid>
          <div>
            <label style={labelStyle}>Current title</label>
            <input type="text" value={p.currentJobTitle} onChange={(e) => set('currentJobTitle', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Current employer</label>
            <input type="text" value={p.currentEmployer} onChange={(e) => set('currentEmployer', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Years of experience</label>
            <SelectField value={p.yearsExperienceRange} onChange={(v) => set('yearsExperienceRange', v)}>
              {YEARS_EXPERIENCE_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Expected compensation</label>
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
            <SelectField value={p.noticePeriod} onChange={(v) => set('noticePeriod', v)}>
              {NOTICE_PERIOD_OPTIONS.map((o) => (
                <option key={o.value || 'empty'} value={o.value}>{o.label}</option>
              ))}
            </SelectField>
          </div>
          <div>
            <label style={labelStyle}>Earliest start / availability</label>
            <input type="text" value={p.earliestStartDate} onChange={(e) => set('earliestStartDate', e.target.value)} style={inputStyle} placeholder="e.g. 2 weeks, Jan 15" />
          </div>
        </FieldGrid>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 4, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding:       '9px 22px',
            borderRadius:  8,
            fontSize:      13,
            fontWeight:    600,
            border:        'none',
            background:    saving ? 'var(--accent-muted)' : 'var(--accent)',
            color:         saving ? 'var(--accent)' : '#fff',
            cursor:        saving ? 'not-allowed' : 'pointer',
            display:       'flex',
            alignItems:    'center',
            gap:           7,
            transition:    'background 0.15s ease',
          }}
        >
          {saving && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />}
          {saving ? 'Saving…' : 'Save autofill profile'}
        </button>
        {msg && (
          <span style={{ fontSize: 13, fontWeight: 500, color: /fail|error|invalid/i.test(msg) ? 'var(--error, #ef4444)' : 'var(--accent)' }}>
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
