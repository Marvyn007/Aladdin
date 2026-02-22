'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';

// Get dynamic color based on company name
export function getCompanyColor(companyName: string | null): string {
    if (!companyName) return 'var(--text-tertiary)';
    const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#4ade80', '#34d399', '#2dd4bf', '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

export function getCompanyInitial(companyName: string | null): string {
    if (!companyName) return '?';
    return companyName.charAt(0).toUpperCase();
}

interface CompanySuggestion {
    id: string;
    name: string;
    domain: string;
    logo_url: string | null;
}

interface CompanyAutocompleteProps {
    value: string;
    onSelect: (data: { name: string; logoUrl: string; logoFile: File | null; isCustom: boolean }) => void;
    error?: string;
    label?: string;
    placeholder?: string;
    initialLogoUrl?: string;
}

export function CompanyAutocomplete({
    value,
    onSelect,
    error,
    label = "Company *",
    placeholder = "Search for a company...",
    initialLogoUrl = ""
}: CompanyAutocompleteProps) {
    const [companySearch, setCompanySearch] = useState(value);
    const [company, setCompany] = useState(value);
    const [companyLogoUrl, setCompanyLogoUrl] = useState(initialLogoUrl);
    const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
    const [isCustomCompany, setIsCustomCompany] = useState(false);
    const [companySuggestions, setCompanySuggestions] = useState<CompanySuggestion[]>([]);
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);
    const [activeCompanySuggestionIndex, setActiveCompanySuggestionIndex] = useState(-1);

    const companyInputRef = useRef<HTMLInputElement>(null);
    const companySuggestionsRef = useRef<HTMLDivElement>(null);
    const companyDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Sync with external value if needed (e.g. initial load)
    useEffect(() => {
        if (value && !company) {
            setCompany(value);
            setCompanySearch(value);
        }
    }, [value]);

    useEffect(() => {
        if (initialLogoUrl && !companyLogoUrl) {
            setCompanyLogoUrl(initialLogoUrl);
        }
    }, [initialLogoUrl]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                companySuggestionsRef.current &&
                !companySuggestionsRef.current.contains(e.target as Node) &&
                companyInputRef.current &&
                !companyInputRef.current.contains(e.target as Node)
            ) {
                setShowCompanySuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchCompanySuggestions = useCallback(async (query: string) => {
        if (!query.trim() || query.trim().length < 2) {
            setCompanySuggestions([]);
            return;
        }
        try {
            const res = await fetch(`/api/company-logos?query=${encodeURIComponent(query)}`);
            if (!res.ok) return;
            const data = await res.json();
            setCompanySuggestions(data || []);
            if (query.trim()) {
                setShowCompanySuggestions(true);
            }
            setActiveCompanySuggestionIndex(-1);
        } catch {
            // fail silently
        }
    }, []);

    const handleCompanySearchChange = (val: string) => {
        setCompanySearch(val);
        setCompany(''); // Clear selection if user edits search
        setCompanyLogoUrl('');

        // Notify parent that the selection is cleared
        onSelect({ name: '', logoUrl: '', logoFile: null, isCustom: false });

        if (!val.trim()) {
            setCompanySuggestions([]);
            setShowCompanySuggestions(false);
            return;
        }

        setShowCompanySuggestions(true);

        if (companyDebounceTimerRef.current) clearTimeout(companyDebounceTimerRef.current);
        companyDebounceTimerRef.current = setTimeout(() => {
            fetchCompanySuggestions(val);
        }, 150);
    };

    const handleSelectCompany = (suggestion: CompanySuggestion) => {
        setCompany(suggestion.name);
        setCompanySearch(suggestion.name);
        setCompanyLogoUrl(suggestion.logo_url || '');
        setCompanyLogoFile(null);
        setIsCustomCompany(false);
        setShowCompanySuggestions(false);
        setCompanySuggestions([]);

        onSelect({
            name: suggestion.name,
            logoUrl: suggestion.logo_url || '',
            logoFile: null,
            isCustom: false
        });
    };

    const handleCompanyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showCompanySuggestions || companySuggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveCompanySuggestionIndex(prev => prev < companySuggestions.length - 1 ? prev + 1 : 0);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveCompanySuggestionIndex(prev => prev > 0 ? prev - 1 : companySuggestions.length - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeCompanySuggestionIndex >= 0 && activeCompanySuggestionIndex < companySuggestions.length) {
                handleSelectCompany(companySuggestions[activeCompanySuggestionIndex]);
            }
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md, 8px)',
        border: '1px solid var(--border)',
        background: 'var(--background)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '6px',
    };

    const errorStyle: React.CSSProperties = {
        fontSize: '12px',
        color: '#ef4444',
        marginTop: '4px',
    };

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>

                {isCustomCompany && (
                    <button type="button" onClick={() => {
                        setIsCustomCompany(false);
                        setCompany('');
                        setCompanySearch('');
                        setCompanyLogoUrl('');
                        setCompanyLogoFile(null);
                        onSelect({ name: '', logoUrl: '', logoFile: null, isCustom: false });
                    }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '11px', cursor: 'pointer', fontWeight: 500 }}>
                        Cancel & Search
                    </button>
                )}
            </div>

            {!isCustomCompany ? (
                <div style={{ position: 'relative' }}>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        {(companyLogoUrl || (!isCustomCompany && company)) ? (
                            companyLogoUrl ? (
                                <img src={companyLogoUrl} alt="" style={{ position: 'absolute', left: '12px', width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover' }} onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    if (e.currentTarget.nextElementSibling) {
                                        (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                    }
                                }} />
                            ) : null
                        ) : null}
                        {(companyLogoUrl || (!isCustomCompany && company)) && (
                            <div
                                style={{
                                    position: 'absolute',
                                    left: '12px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '4px',
                                    display: companyLogoUrl ? 'none' : 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: getCompanyColor(company),
                                    color: '#fff',
                                    fontSize: '12px',
                                    fontWeight: 'bold'
                                }}
                            >
                                {getCompanyInitial(company)}
                            </div>
                        )}
                        <input
                            ref={companyInputRef}
                            type="text"
                            value={companySearch}
                            onChange={(e) => handleCompanySearchChange(e.target.value)}
                            onKeyDown={handleCompanyKeyDown}
                            onFocus={() => { if (companySearch.trim()) setShowCompanySuggestions(true); }}
                            style={{
                                ...inputStyle,
                                borderColor: error ? '#ef4444' : undefined,
                                paddingLeft: (companyLogoUrl || (!isCustomCompany && company)) ? '40px' : '12px'
                            }}
                            placeholder={placeholder}
                            autoComplete="off"
                        />
                        {company && (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success, #10b981)" strokeWidth="3" style={{ position: 'absolute', right: '12px' }}>
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        )}
                    </div>

                    {showCompanySuggestions && (
                        <div
                            ref={companySuggestionsRef}
                            style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1001, maxHeight: '220px', overflowY: 'auto' }}
                        >
                            {companySuggestions.map((suggestion, index) => (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => handleSelectCompany(suggestion)}
                                    onMouseEnter={() => setActiveCompanySuggestionIndex(index)}
                                    style={{ width: '100%', padding: '8px 14px', border: 'none', background: index === activeCompanySuggestionIndex ? 'var(--accent-muted, rgba(59, 130, 246, 0.1))' : 'transparent', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                                >
                                    {suggestion.logo_url ? (
                                        <img src={suggestion.logo_url} alt="" style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }} onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            if (e.currentTarget.nextElementSibling) {
                                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                            }
                                        }} />
                                    ) : null}
                                    <div
                                        style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '4px',
                                            flexShrink: 0,
                                            display: suggestion.logo_url ? 'none' : 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: getCompanyColor(suggestion.name),
                                            color: '#fff',
                                            fontSize: '12px',
                                            fontWeight: 'bold'
                                        }}
                                    >
                                        {getCompanyInitial(suggestion.name)}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                                        <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestion.name}</span>
                                        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestion.domain}</span>
                                    </div>
                                </button>
                            ))}

                            {!companySuggestions.some(s => s.name.toLowerCase() === companySearch.trim().toLowerCase()) &&
                                !(company && companySearch.trim().toLowerCase() === company.toLowerCase()) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCompany(companySearch);
                                            setIsCustomCompany(true);
                                            setShowCompanySuggestions(false);
                                            onSelect({ name: companySearch, logoUrl: '', logoFile: null, isCustom: true });
                                        }}
                                        style={{ width: '100%', padding: '10px 14px', border: 'none', background: 'var(--surface-hover, #f9fafb)', color: 'var(--accent)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500 }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                        {companySearch.trim() ? `Add "${companySearch}" as new company` : 'Add a new company'}
                                    </button>
                                )}
                        </div>
                    )}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '12px', background: 'var(--surface-hover, #f9fafb)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                        <input
                            type="text"
                            value={company}
                            onChange={(e) => {
                                setCompany(e.target.value);
                                onSelect({ name: e.target.value, logoUrl: companyLogoUrl, logoFile: companyLogoFile, isCustom: true });
                            }}
                            style={{ ...inputStyle, borderColor: error ? '#ef4444' : undefined }}
                            placeholder="Company Name"
                        />
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            {companyLogoFile ? (
                                <div style={{ width: '16px', height: '16px', borderRadius: '4px', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                                </div>
                            ) : companyLogoUrl ? (
                                <img src={companyLogoUrl} alt="" style={{ width: '16px', height: '16px', borderRadius: '4px', objectFit: 'cover' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-tertiary)' }}>
                                    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
                                    <rect x="9" y="9" width="6" height="6" />
                                </svg>
                            )}
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Company Logo <span style={{ fontWeight: 400 }}>(Optional URL or File)</span></label>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                                type="text"
                                value={companyLogoUrl}
                                onChange={(e) => {
                                    setCompanyLogoUrl(e.target.value);
                                    setCompanyLogoFile(null);
                                    onSelect({ name: company, logoUrl: e.target.value, logoFile: null, isCustom: true });
                                }}
                                style={{ ...inputStyle, flex: 1 }}
                                placeholder="https://... (Image URL)"
                                disabled={!!companyLogoFile}
                            />
                            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, transition: 'background 0.2s', minWidth: '80px' }}>
                                <input
                                    type="file"
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setCompanyLogoFile(file);
                                            setCompanyLogoUrl('');
                                            onSelect({ name: company, logoUrl: '', logoFile: file, isCustom: true });
                                        }
                                    }}
                                />
                                {companyLogoFile ? 'Selected' : 'Upload'}
                            </label>
                        </div>
                        {companyLogoFile && (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>{companyLogoFile.name} ({(companyLogoFile.size / 1024).toFixed(0)}KB)</span>
                                <button type="button" onClick={() => {
                                    setCompanyLogoFile(null);
                                    onSelect({ name: company, logoUrl: '', logoFile: null, isCustom: true });
                                }} style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', padding: 0 }}>Remove</button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {error && <p style={errorStyle}>{error}</p>}
        </div>
    );
}
