'use client';

import { useState } from 'react';
import {
  LoaderCircle,
  X,
  Globe,
  Building2,
  Link as LinkIcon,
  Camera,
  Settings2,
  Sparkles,
  BriefcaseBusiness,
} from 'lucide-react';

interface AddCompanyDrawerProps {
  adminId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function AddCompanyDrawer({
  adminId,
  open,
  onOpenChange,
  onCreated,
}: AddCompanyDrawerProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [hasPracticeQuestions, setHasPracticeQuestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim()) {
      setError('Company name is required');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/branding/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          domain: domain.trim() || null,
          logoUrl: logoUrl.trim() || null,
          hasPracticeQuestions,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create company');
      setName('');
      setDomain('');
      setLogoUrl('');
      setHasPracticeQuestions(false);
      onCreated();
      onOpenChange(false);
    } catch (err) {
      console.error('Creation error:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 55,
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={() => onOpenChange(false)}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 60,
          width: '100%',
          maxWidth: '540px',
          backgroundColor: '#ffffff',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid #f1f5f9',
            flexShrink: 0,
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                backgroundColor: '#eff6ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2563eb',
                flexShrink: 0,
              }}
            >
              <BriefcaseBusiness size={20} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                Add Company
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '2px' }}>
                Entity Bootstrap
              </div>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#94a3b8',
              transition: 'background-color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f1f5f9')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

            {/* Brand Identity Preview */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '16px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div
                  style={{
                    width: '96px',
                    height: '96px',
                    borderRadius: '16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '12px',
                  }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={name || 'Preview'}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  ) : (
                    <img
                      src="/default company icon.png"
                      alt="Default"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 0.35, filter: 'grayscale(1)' }}
                    />
                  )}
                </div>
                <button
                  style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: '#2563eb',
                    border: '2px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                  }}
                >
                  <Camera size={13} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
                  {name || 'Company Name'}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#64748b', marginTop: '2px', marginBottom: '12px' }}>
                  {domain || 'No domain configured'}
                </div>
                <span
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '9px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    padding: '4px 8px',
                    borderRadius: '6px',
                  }}
                >
                  New Entry
                </span>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#e11d48',
                  textAlign: 'center',
                }}
              >
                {error}
              </div>
            )}

            {/* Basic Configuration */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Settings2 size={15} style={{ color: '#93c5fd' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#94a3b8' }}>
                  Basic Configuration
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '2px' }}>
                    Canonical Name <span style={{ color: '#f43f5e' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. OpenAI"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'Inter, sans-serif',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '2px' }}>
                    Web Domain
                  </label>
                  <div style={{ position: 'relative' }}>
                    <Globe
                      size={16}
                      style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}
                    />
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      placeholder="e.g. openai.com"
                      style={{
                        width: '100%',
                        padding: '12px 16px 12px 42px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: 600,
                        color: '#0f172a',
                        outline: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'Inter, sans-serif',
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#3b82f6';
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#e2e8f0';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                </div>

                {/* Practice Questions toggle */}
                <div
                  onClick={() => setHasPracticeQuestions(!hasPracticeQuestions)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '14px',
                    padding: '16px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: hasPracticeQuestions ? '#eff6ff' : '#f8fafc',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s, border-color 0.15s',
                    borderColor: hasPracticeQuestions ? '#bfdbfe' : '#e2e8f0',
                    userSelect: 'none',
                  }}
                >
                  {/* Custom checkbox */}
                  <div
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '5px',
                      border: `2px solid ${hasPracticeQuestions ? '#2563eb' : '#cbd5e1'}`,
                      backgroundColor: hasPracticeQuestions ? '#2563eb' : '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '1px',
                      transition: 'all 0.15s',
                    }}
                  >
                    {hasPracticeQuestions && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#0f172a', lineHeight: 1 }}>
                      Enable Practice Tab
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      Enable LeetCode question mapping for this entity.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Branding Assets */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <Sparkles size={15} style={{ color: '#93c5fd' }} />
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#94a3b8' }}>
                  Branding Assets
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', marginLeft: '2px' }}>
                    Logo Resource URL
                  </label>
                  {logoUrl && (
                    <button
                      onClick={() => setLogoUrl('')}
                      style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#f43f5e', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div style={{ position: 'relative' }}>
                  <LinkIcon
                    size={16}
                    style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}
                  />
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.svg"
                    style={{
                      width: '100%',
                      padding: '12px 16px 12px 42px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: 600,
                      color: '#0f172a',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontFamily: 'Inter, sans-serif',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <p style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, lineHeight: 1.6, fontStyle: 'italic', marginTop: '4px', paddingLeft: '2px' }}>
                  Direct link to transparent asset. Overrides automated discovery.
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            flexShrink: 0,
            borderTop: '1px solid #f1f5f9',
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <button
            onClick={() => onOpenChange(false)}
            style={{
              fontSize: '14px',
              fontWeight: 600,
              color: '#475569',
              padding: '10px 20px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              backgroundColor: '#f8fafc',
              cursor: 'pointer',
              transition: 'background-color 0.15s, border-color 0.15s',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
          >
            Cancel
          </button>

          <button
            onClick={handleCreate}
            disabled={isSaving}
            style={{
              backgroundColor: '#0f172a',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '14px',
              padding: '12px 32px',
              borderRadius: '12px',
              border: 'none',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.5 : 1,
              boxShadow: '0 4px 14px rgba(15,23,42,0.2)',
              transition: 'transform 0.15s, box-shadow 0.15s',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'Inter, sans-serif',
            }}
            onMouseEnter={(e) => { if (!isSaving) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,42,0.25)'; } }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.2)'; }}
          >
            {isSaving ? (
              <>
                <LoaderCircle size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Creating...
              </>
            ) : (
              'Bootstrap Entity'
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
