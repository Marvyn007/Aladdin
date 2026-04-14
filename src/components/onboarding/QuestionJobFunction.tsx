'use client';

import { useState, useMemo } from 'react';
import { Check, X } from 'lucide-react';
import type { JobFunctionCategory, JobFunctionValue } from '@/lib/onboarding';

interface QuestionJobFunctionProps {
  taxonomy: JobFunctionCategory[];
  value: JobFunctionValue;
  onChange: (val: JobFunctionValue) => void;
}

export function QuestionJobFunction({ taxonomy, value, onChange }: QuestionJobFunctionProps) {
  const [activeIndustry, setActiveIndustry] = useState<string>(taxonomy[0]?.industry ?? '');
  const [search, setSearch] = useState('');

  const selectedRoles = value.roles ?? [];
  const selectedSubs = value.subcategories ?? [];
  const selectedIndustries = value.industries ?? [];

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search */}
      <input
        type="text"
        placeholder="Search roles..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          padding: '10px 14px',
          borderRadius: 8,
          border: '1.5px solid var(--ot-pill-border, #d1d5db)',
          fontSize: 14,
          background: 'var(--ot-input-bg, #fff)',
          color: 'var(--ot-text, #111)',
          outline: 'none',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />

      {/* Selected chips */}
      {selectedRoles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {selectedRoles.map((role) => (
            <span
              key={role}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 500,
                background: 'var(--ot-pill-selected-bg, #ede9fe)',
                color: 'var(--ot-pill-selected-text, #5b21b6)',
                border: '1.5px solid var(--ot-pill-selected-border, #7c3aed)',
              }}
            >
              {role}
              <button
                type="button"
                onClick={() => removeRole(role)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                aria-label={`Remove ${role}`}
              >
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Two-panel picker */}
      <div style={{ display: 'flex', gap: 0, border: '1.5px solid var(--ot-pill-border, #d1d5db)', borderRadius: 10, overflow: 'hidden', minHeight: 320 }}>
        {/* Left: industry list */}
        <div style={{ width: 200, flexShrink: 0, borderRight: '1px solid var(--ot-pill-border, #d1d5db)', overflowY: 'auto' }}>
          {filteredTaxonomy.map((cat) => {
            const isActive = cat.industry === activeIndustry;
            const hasSelected = cat.subcategories.some((s) => s.roles.some((r) => selectedRoles.includes(r)));
            return (
              <button
                key={cat.industry}
                type="button"
                onClick={() => setActiveIndustry(cat.industry)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 14px',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  cursor: 'pointer',
                  border: 'none',
                  background: isActive ? 'var(--ot-pill-selected-bg, #ede9fe)' : 'transparent',
                  color: isActive ? 'var(--ot-pill-selected-text, #5b21b6)' : 'var(--ot-text, #111)',
                  borderLeft: isActive ? '3px solid var(--ot-pill-selected-border, #7c3aed)' : '3px solid transparent',
                }}
              >
                {hasSelected && !isActive && (
                  <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#7c3aed', marginRight: 6, verticalAlign: 'middle' }} />
                )}
                {cat.industry}
              </button>
            );
          })}
        </div>

        {/* Right: subcategories + roles */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
          {activeCat ? (
            activeCat.subcategories.map((sub) => (
              <div key={sub.label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--ot-text-muted, #6b7280)', marginBottom: 8 }}>
                  {sub.label}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
                          gap: 6,
                          padding: '6px 14px',
                          borderRadius: 9999,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: 'pointer',
                          border: `1.5px solid ${selected ? 'var(--ot-pill-selected-border, #7c3aed)' : 'var(--ot-pill-border, #d1d5db)'}`,
                          background: selected ? 'var(--ot-pill-selected-bg, #ede9fe)' : 'transparent',
                          color: selected ? 'var(--ot-pill-selected-text, #5b21b6)' : 'var(--ot-text, #111)',
                        }}
                      >
                        {selected && <Check size={12} />}
                        {role}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--ot-text-muted, #6b7280)', fontSize: 14, padding: '20px 0' }}>
              No roles found matching "{search}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
