'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Check, X, ChevronDown } from 'lucide-react';
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

  // Close dropdown on outside click
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
    let newRoles: string[];
    let newSubs: string[];
    let newIndustries: string[];

    if (hasRole) {
      newRoles = selectedRoles.filter((r) => r !== role);
    } else {
      newRoles = [...selectedRoles, role];
    }

    // Sync subcategory: active if any of its roles are selected
    const cat = taxonomy.find((c) => c.industry === industry);
    const sub = cat?.subcategories.find((s) => s.label === subcategory);
    const subHasSelected = sub?.roles.some((r) => newRoles.includes(r)) ?? false;

    if (subHasSelected && !selectedSubs.includes(subcategory)) {
      newSubs = [...selectedSubs, subcategory];
    } else if (!subHasSelected) {
      newSubs = selectedSubs.filter((s) => s !== subcategory);
    } else {
      newSubs = selectedSubs;
    }

    // Sync industry: active if any of its roles are selected
    const industryHasSelected = cat?.subcategories.some((s) =>
      s.roles.some((r) => newRoles.includes(r))
    ) ?? false;

    if (industryHasSelected && !selectedIndustries.includes(industry)) {
      newIndustries = [...selectedIndustries, industry];
    } else if (!industryHasSelected) {
      newIndustries = selectedIndustries.filter((i) => i !== industry);
    } else {
      newIndustries = selectedIndustries;
    }

    onChange({ industries: newIndustries, subcategories: newSubs, roles: newRoles });
  }

  function removeRole(role: string) {
    // Find which industry/sub it belongs to
    for (const cat of taxonomy) {
      for (const sub of cat.subcategories) {
        if (sub.roles.includes(role)) {
          toggleRole(cat.industry, sub.label, role);
          return;
        }
      }
    }
  }

  // Filter taxonomy by search
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

  const activeCat = filteredTaxonomy.find((c) => c.industry === activeIndustry)
    ?? filteredTaxonomy[0];

  return (
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Selected chips */}
      {selectedRoles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {selectedRoles.map((role) => (
            <span
              key={role}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 10px 3px 12px',
                borderRadius: 9999,
                fontSize: 12.5,
                fontWeight: 500,
                background: 'var(--ot-pill-selected-bg)',
                color: 'var(--ot-pill-selected-color)',
                border: '1px solid var(--ot-pill-selected-border)',
                lineHeight: 1.6,
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
                  padding: '1px',
                  display: 'flex',
                  alignItems: 'center',
                  color: 'inherit',
                  opacity: 0.65,
                  marginLeft: 1,
                }}
              >
                <X size={11} strokeWidth={2.5} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Trigger + dropdown anchored together */}
      <div style={{ position: 'relative' }}>
        {/* Trigger field */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Please select/enter your expected job function"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            style={{
              padding: '10px 38px 10px 12px',
              borderRadius: isOpen ? '6px 6px 0 0' : 6,
              border: `1px solid ${isOpen ? 'var(--ot-primary)' : 'var(--ot-pill-border, #d1d5db)'}`,
              borderBottom: isOpen ? `1px solid var(--ot-card-border, #e5e7eb)` : undefined,
              fontSize: 13,
              background: 'var(--ot-bg, #fff)',
              color: search ? 'var(--ot-text)' : 'var(--ot-text-muted)',
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
              cursor: 'text',
              transition: 'border-color 0.15s',
            }}
          />
          <ChevronDown
            size={14}
            style={{
              position: 'absolute',
              right: 11,
              color: 'var(--ot-text-muted)',
              pointerEvents: 'none',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.18s ease',
            }}
          />
        </div>

        {/* Dropdown panel — fixed compact width, not full-card-width */}
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              width: 'min(100%, 480px)',
              zIndex: 50,
              display: 'flex',
              border: '1px solid var(--ot-card-border, #e5e7eb)',
              borderTop: 'none',
              borderRadius: '0 0 8px 8px',
              overflow: 'hidden',
              height: 340,
              background: 'var(--ot-bg, #fff)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Left: industry list */}
            <div
              style={{
                width: 190,
                flexShrink: 0,
                borderRight: '1px solid var(--ot-card-border, #e5e7eb)',
                overflowY: 'auto',
                background: 'var(--ot-card-bg)',
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
                      padding: '7px 10px 7px 12px',
                      fontSize: 12.5,
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      border: 'none',
                      background: 'transparent',
                      gap: 6,
                    }}
                  >
                    {/* Active = filled primary pill; inactive = plain text */}
                    <span
                      style={{
                        flex: 1,
                        lineHeight: 1.35,
                        padding: isActive ? '3px 8px' : '3px 0',
                        borderRadius: isActive ? 9999 : 0,
                        background: isActive ? 'var(--ot-primary)' : 'transparent',
                        color: isActive ? 'var(--ot-primary-fg, #fff)' : 'var(--ot-text)',
                        transition: 'background 0.15s, color 0.15s',
                        display: 'inline-block',
                      }}
                    >
                      {cat.industry}
                    </span>
                    {selCount > 0 && !isActive && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          lineHeight: 1,
                          padding: '2px 5px',
                          borderRadius: 9999,
                          background: 'var(--ot-primary)',
                          color: 'var(--ot-primary-fg, #fff)',
                          flexShrink: 0,
                        }}
                      >
                        {selCount}
                      </span>
                    )}
                    <ChevronDown
                      size={11}
                      style={{
                        transform: 'rotate(-90deg)',
                        flexShrink: 0,
                        color: isActive ? 'var(--ot-primary)' : 'var(--ot-text-muted)',
                        opacity: isActive ? 0.5 : 0.35,
                      }}
                    />
                  </button>
                );
              })}
            </div>

            {/* Right: subcategories + roles as plain text */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', background: 'var(--ot-bg, #fff)' }}>
              {activeCat ? (
                <>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--ot-text)',
                      marginBottom: 12,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {activeCat.industry}
                  </div>
                  {activeCat.subcategories.map((sub) => (
                    <div key={sub.label} style={{ marginBottom: 14 }}>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          letterSpacing: '0.07em',
                          color: 'var(--ot-text-muted)',
                          marginBottom: 6,
                        }}
                      >
                        {sub.label}
                      </div>
                      {/* Roles as plain inline text tokens, no pill borders */}
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 6px' }}>
                        {sub.roles.map((role) => {
                          const selected = selectedRoles.includes(role);
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => toggleRole(activeCat.industry, sub.label, role)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '3px 9px',
                                borderRadius: 9999,
                                fontSize: 12,
                                fontWeight: selected ? 600 : 400,
                                cursor: 'pointer',
                                border: `1px solid ${selected ? 'var(--ot-primary)' : 'var(--ot-card-border, #e5e7eb)'}`,
                                background: selected ? 'var(--ot-pill-selected-bg)' : 'transparent',
                                color: selected ? 'var(--ot-primary)' : 'var(--ot-text)',
                                transition: 'background 0.12s, border-color 0.12s, color 0.12s',
                                lineHeight: 1.5,
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {selected && <Check size={10} strokeWidth={2.5} />}
                              {role}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ color: 'var(--ot-text-muted)', fontSize: 13, padding: '20px 0' }}>
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
