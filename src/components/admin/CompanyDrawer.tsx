'use client';

import { useState, useEffect } from 'react';
import {
  LoaderCircle,
  X,
  Trash2,
  Globe,
  Building2,
  Link as LinkIcon,
  Camera,
  Settings2,
  Sparkles,
  BriefcaseBusiness,
} from 'lucide-react';

import type { AdminCompanyDetail } from '@/lib/admin/types';

interface CompanyDrawerProps {
  company: AdminCompanyDetail | null;
  adminId: string;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

export function CompanyDrawer({
  company,
  adminId,
  open,
  loading,
  onOpenChange,
  onUpdated,
  onDeleted,
}: CompanyDrawerProps) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [debouncedLogoUrl, setDebouncedLogoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedLogoUrl(logoUrl), 500);
    return () => clearTimeout(timer);
  }, [logoUrl]);

  useEffect(() => {
    if (company) {
      setName(company.name);
      setDomain(company.domain || '');
      setLogoUrl(company.logoUrl || '');
    }
  }, [company]);

  async function handleSave() {
    if (!company) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/admin/branding/companies/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, domain, logoUrl }),
      });
      if (!response.ok) throw new Error('Failed to update company');
      onUpdated();
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!company) return;
    if (!confirm(`Are you sure you want to delete ${company.name}?`)) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/admin/branding/companies/${company.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete company');
      onDeleted();
      onOpenChange(false);
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete company');
    } finally {
      setIsDeleting(false);
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
                Company Editor
              </div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.15em', marginTop: '2px' }}>
                Management Console
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
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <LoaderCircle size={32} style={{ color: '#cbd5e1', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : !company ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', padding: '40px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '16px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#cbd5e1', marginBottom: '16px' }}>
                <Building2 size={32} />
              </div>
              <p style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>No selection</p>
              <p style={{ marginTop: '4px', fontSize: '14px', color: '#64748b' }}>Click on a company row to begin.</p>
            </div>
          ) : (
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '40px' }}>

              {/* Brand Identity */}
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
                    {debouncedLogoUrl ? (
                      <img
                        src={
                          debouncedLogoUrl.startsWith('http') &&
                          !debouncedLogoUrl.includes('logo.dev') &&
                          !debouncedLogoUrl.includes('ui-avatars.com')
                            ? `/api/proxy-image?url=${encodeURIComponent(debouncedLogoUrl)}`
                            : debouncedLogoUrl
                        }
                        alt={name}
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        referrerPolicy="no-referrer"
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
                  <div style={{ display: 'flex', gap: '8px' }}>
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
                      {company.jobCount} {company.jobCount !== 1 ? 'Listings' : 'Listing'}
                    </span>
                    {company.logoFetched ? (
                      <span
                        style={{
                          backgroundColor: '#f0fdf4',
                          color: '#15803d',
                          fontSize: '9px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.12em',
                          padding: '4px 8px',
                          borderRadius: '6px',
                        }}
                      >
                        Verified
                      </span>
                    ) : (
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
                        Manual
                      </span>
                    )}
                  </div>
                </div>
              </div>

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
                      Canonical Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Toast Inc."
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
                        placeholder="e.g. toasttab.com"
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
                      placeholder="https://assets.example.com/logo.svg"
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
                    Optimize for high-density displays using transparent vector formats (SVG) where possible.
                  </p>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        {company && !loading && (
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
              onClick={handleDelete}
              disabled={isDeleting || isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#e11d48',
                fontWeight: 700,
                fontSize: '14px',
                padding: '10px 16px',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'transparent',
                cursor: isDeleting || isSaving ? 'not-allowed' : 'pointer',
                opacity: isDeleting || isSaving ? 0.5 : 1,
                transition: 'background-color 0.15s',
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={(e) => { if (!isDeleting && !isSaving) e.currentTarget.style.backgroundColor = '#fff1f2'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {isDeleting ? <LoaderCircle size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
              Archive
            </button>

            <button
              onClick={handleSave}
              disabled={isSaving || isDeleting}
              style={{
                backgroundColor: '#0f172a',
                color: '#ffffff',
                fontWeight: 700,
                fontSize: '14px',
                padding: '12px 32px',
                borderRadius: '12px',
                border: 'none',
                cursor: isSaving || isDeleting ? 'not-allowed' : 'pointer',
                opacity: isSaving || isDeleting ? 0.5 : 1,
                boxShadow: '0 4px 14px rgba(15,23,42,0.2)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'Inter, sans-serif',
              }}
              onMouseEnter={(e) => { if (!isSaving && !isDeleting) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,23,42,0.25)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(15,23,42,0.2)'; }}
            >
              {isSaving ? (
                <>
                  <LoaderCircle size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Updating...
                </>
              ) : (
                'Update Configuration'
              )}
            </button>
          </div>
        )}
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
