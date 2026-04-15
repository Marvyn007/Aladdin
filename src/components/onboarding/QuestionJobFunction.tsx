'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { X, ChevronRight, Search } from 'lucide-react';
import type { JobFunctionCategory, JobFunctionValue } from '@/lib/onboarding';

interface QuestionJobFunctionProps {
  taxonomy: JobFunctionCategory[];
  value: JobFunctionValue;
  onChange: (val: JobFunctionValue) => void;
}

export function QuestionJobFunction({ taxonomy, value, onChange }: QuestionJobFunctionProps) {
  const [activeIndustry, setActiveIndustry] = useState<string>(taxonomy[0]?.industry ?? '');
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedRoles = value.roles ?? [];
  const selectedSubs = value.subcategories ?? [];
  const selectedIndustries = value.industries ?? [];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleRole(industry: string, subcategory: string, role: string) {
    const hasRole = selectedRoles.includes(role);
    const newRoles = hasRole ? selectedRoles.filter((r) => r !== role) : [...selectedRoles, role];

    const cat = taxonomy.find((c) => c.industry === industry);
    const sub = cat?.subcategories.find((s) => s.label === subcategory);
    const subHasSelected = sub?.roles.some((r) => newRoles.includes(r)) ?? false;

    const newSubs = subHasSelected
      ? selectedSubs.includes(subcategory) ? selectedSubs : [...selectedSubs, subcategory]
      : selectedSubs.filter((s) => s !== subcategory);

    const industryHasSelected = cat?.subcategories.some((s) => s.roles.some((r) => newRoles.includes(r))) ?? false;
    const newIndustries = industryHasSelected
      ? selectedIndustries.includes(industry) ? selectedIndustries : [...selectedIndustries, industry]
      : selectedIndustries.filter((i) => i !== industry);

    onChange({ industries: newIndustries, subcategories: newSubs, roles: newRoles });
  }

  function removeRole(role: string) {
    for (const cat of taxonomy) {
      for (const sub of cat.subcategories) {
        if (sub.roles.includes(role)) {
          toggleRole(cat.industry, sub.label, role);
          return;
        }
      }
    }
  }

  const filteredTaxonomy = useMemo(() => {
    if (!search.trim()) return taxonomy;
    const q = search.toLowerCase();
    return taxonomy
      .map((cat) => ({
        ...cat,
        subcategories: cat.subcategories
          .map((sub) => ({
            ...sub,
            roles: sub.roles.filter((r) => r.toLowerCase().includes(q)),
          }))
          .filter((sub) => sub.roles.length > 0 || sub.label.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.subcategories.length > 0 || cat.industry.toLowerCase().includes(q));
  }, [taxonomy, search]);

  const activeCat = filteredTaxonomy.find((c) => c.industry === activeIndustry) ?? filteredTaxonomy[0];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Selected role pills ── */}
      {selectedRoles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {selectedRoles.map((role) => (
            <span
              key={role}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 8px 3px 11px',
                borderRadius: 9999,
                fontSize: 11.5,
                fontWeight: 500,
                background: 'rgba(29,161,242,0.10)',
                color: 'var(--ot-primary)',
                border: '1px solid rgba(29,161,242,0.30)',
                lineHeight: 1.5,
                letterSpacing: '-0.01em',
              }}
            >
              {role}
              <button
                type="button"
                onClick={() => removeRole(role)}
                aria-label={`Remove ${role}`}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '1px 0',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'inherit',
                  opacity: 0.55,
                  transition: 'opacity 0.12s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.55'; }}
              >
                <X size={10} strokeWidth={2.8} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Trigger input ── */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {/* Search icon */}
          <Search
            size={13}
            style={{
              position: 'absolute',
              left: 11,
              color: 'var(--ot-text-muted)',
              pointerEvents: 'none',
              opacity: 0.6,
              zIndex: 1,
            }}
          />
          <input
            type="text"
            placeholder="Search roles, functions…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            style={{
              padding: '10px 36px 10px 32px',
              borderRadius: isOpen ? '10px 10px 0 0' : 10,
              border: `1.5px solid ${isOpen ? 'var(--ot-primary)' : 'var(--ot-card-border)'}`,
              borderBottom: isOpen ? '1.5px solid var(--ot-card-border)' : undefined,
              fontSize: 13,
              background: 'var(--ot-bg)',
              color: search ? 'var(--ot-text)' : 'var(--ot-text-muted)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              cursor: 'text',
              transition: 'border-color 0.15s',
              fontFamily: 'inherit',
            }}
          />
          <ChevronRight
            size={13}
            style={{
              position: 'absolute',
              right: 11,
              color: 'var(--ot-text-muted)',
              pointerEvents: 'none',
              transform: isOpen ? 'rotate(270deg)' : 'rotate(90deg)',
              transition: 'transform 0.18s ease',
              opacity: 0.5,
            }}
          />
        </div>

        {/* ── Dropdown panel ── */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: 'min(100%, 760px)',
              zIndex: 50,
              display: 'flex',
              border: '1.5px solid var(--ot-card-border)',
              borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              overflow: 'hidden',
              height: 340,
              background: 'var(--ot-bg)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
            }}
            onMouseDown={(e) => e.preventDefault()}
          >

            {/* Left: industry list */}
            <div
              style={{
                width: 210,
                flexShrink: 0,
                borderRight: '1px solid var(--ot-card-border)',
                overflowY: 'auto',
                background: 'var(--ot-bg)',
                padding: '6px 0',
              }}
            >
              {filteredTaxonomy.map((cat) => {
                const isActive = cat.industry === activeIndustry;
                const selCount = cat.subcategories.reduce(
                  (n, s) => n + s.roles.filter((r) => selectedRoles.includes(r)).length,
                  0
                );
                return (
                  <button
                    key={cat.industry}
                    type="button"
                    onClick={() => setActiveIndustry(cat.industry)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px 7px 14px',
                      fontSize: 12,
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      border: 'none',
                      background: isActive
                        ? 'rgba(29,161,242,0.10)'
                        : 'transparent',
                      color: isActive ? 'var(--ot-primary)' : 'var(--ot-text)',
                      gap: 6,
                      transition: 'background 0.1s, color 0.1s',
                      borderLeft: isActive ? '3px solid var(--ot-primary)' : '3px solid transparent',
                      fontFamily: 'inherit',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--ot-row-bg)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <span style={{ flex: 1, lineHeight: 1.4 }}>{cat.industry}</span>
                    {selCount > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          lineHeight: 1,
                          padding: '2px 6px',
                          borderRadius: 9999,
                          background: isActive ? 'var(--ot-primary)' : 'rgba(29,161,242,0.15)',
                          color: isActive ? '#fff' : 'var(--ot-primary)',
                          flexShrink: 0,
                          minWidth: 18,
                          textAlign: 'center',
                        }}
                      >
                        {selCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Right: role pills */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '14px 16px',
                background: 'var(--ot-bg)',
              }}
            >
              {activeCat ? (
                <>
                  {/* Industry heading */}
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--ot-text)',
                      marginBottom: 12,
                      letterSpacing: '-0.02em',
                    }}
                  >
                    {activeCat.industry}
                  </div>

                  {activeCat.subcategories.map((sub) => (
                    <div key={sub.label} style={{ marginBottom: 14 }}>
                      {/* Subcategory label */}
                      <div
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          color: 'var(--ot-text-muted)',
                          marginBottom: 7,
                          opacity: 0.75,
                        }}
                      >
                        {sub.label}
                      </div>

                      {/* Role pill buttons — flex-wrap, no checkboxes */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {sub.roles.map((role) => {
                          const selected = selectedRoles.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleRole(activeCat.industry, sub.label, role)}
                              style={{
                                padding: '5px 12px',
                                borderRadius: 9999,
                                fontSize: 11.5,
                                fontWeight: selected ? 600 : 400,
                                cursor: 'pointer',
                                border: `1.5px solid ${selected ? 'var(--ot-primary)' : 'var(--ot-card-border)'}`,
                                background: selected
                                  ? 'var(--ot-primary)'
                                  : 'var(--ot-bg)',
                                color: selected ? '#fff' : 'var(--ot-text)',
                                transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                                whiteSpace: 'nowrap',
                                letterSpacing: '-0.01em',
                                fontFamily: 'inherit',
                                boxShadow: selected ? '0 1px 4px rgba(29,161,242,0.25)' : 'none',
                              }}
                              onMouseEnter={(e) => {
                                if (!selected) {
                                  e.currentTarget.style.borderColor = 'var(--ot-primary)';
                                  e.currentTarget.style.background = 'rgba(29,161,242,0.06)';
                                  e.currentTarget.style.color = 'var(--ot-primary)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!selected) {
                                  e.currentTarget.style.borderColor = 'var(--ot-card-border)';
                                  e.currentTarget.style.background = 'var(--ot-bg)';
                                  e.currentTarget.style.color = 'var(--ot-text)';
                                }
                              }}
                            >
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div
                  style={{
                    color: 'var(--ot-text-muted)',
                    fontSize: 12,
                    padding: '24px 0',
                    textAlign: 'center',
                    opacity: 0.6,
                  }}
                >
                  No roles found for &ldquo;{search}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
