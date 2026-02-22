'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store/useStore';
import { CompanyAutocomplete } from '@/components/shared/CompanyAutocomplete';

interface ManualImportModalProps {
    onClose: () => void;
    onImportSuccess?: () => void;
}

const MIN_DESCRIPTION_LENGTH = 50;
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface LocationSuggestion {
    id: string;
    place_name: string;
}

export function ManualImportModal({ onClose, onImportSuccess }: ManualImportModalProps) {
    const { addImportedJob } = useStore();
    const [url, setUrl] = useState('');
    const [title, setTitle] = useState('');

    // Company states handled by CompanyAutocomplete
    const [company, setCompany] = useState('');
    const [companyLogoUrl, setCompanyLogoUrl] = useState('');
    const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
    const [isCustomCompany, setIsCustomCompany] = useState(false);

    // Mapbox states
    const [location, setLocation] = useState('');
    const [locationInput, setLocationInput] = useState('');
    const [isRemote, setIsRemote] = useState(false);
    const [locationConfirmed, setLocationConfirmed] = useState(false);
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

    const [description, setDescription] = useState('');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [success, setSuccess] = useState<{ job: any } | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const locationInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Initial focus only on mount
    useEffect(() => {
        titleInputRef.current?.focus();
    }, []);

    // Escape listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showSuggestions) {
                    setShowSuggestions(false);
                    return;
                }
                onClose();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, showSuggestions]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(e.target as Node) &&
                locationInputRef.current &&
                !locationInputRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
                // Revert if typed text doesn't match a confirmed selection
                if (!locationConfirmed) {
                    setLocationInput(location);
                    if (location) setLocationConfirmed(true);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [location, locationConfirmed]);

    // Mapbox Location fetching
    const fetchSuggestions = useCallback(async (query: string) => {
        if (!query.trim() || query.trim().length < 2 || !MAPBOX_TOKEN) {
            setSuggestions([]);
            return;
        }

        try {
            const encoded = encodeURIComponent(query.trim());
            const res = await fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&types=place,locality,neighborhood,district,region,country&limit=3&language=en`
            );
            if (!res.ok) return;
            const data = await res.json();
            const results: LocationSuggestion[] = (data.features || []).map((f: { id: string; place_name: string }) => ({
                id: f.id,
                place_name: f.place_name,
            }));
            setSuggestions(results);
            setShowSuggestions(results.length > 0);
            setActiveSuggestionIndex(-1);
        } catch {
            // fail silently
        }
    }, []);


    const handleLocationInputChange = (value: string) => {
        setLocationInput(value);
        setLocationConfirmed(false);
        setErrors(prev => ({ ...prev, location: '' }));

        if (!value.trim()) {
            setLocation('');
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            fetchSuggestions(value);
        }, 300);
    };

    const handleSelectSuggestion = (suggestion: LocationSuggestion) => {
        setLocation(suggestion.place_name);
        setLocationInput(suggestion.place_name);
        setLocationConfirmed(true);
        setShowSuggestions(false);
        setSuggestions([]);
        setErrors(prev => ({ ...prev, location: '' }));
    };

    const handleLocationKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveSuggestionIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
                handleSelectSuggestion(suggestions[activeSuggestionIndex]);
            }
        }
    };

    const validate = (): boolean => {
        const errs: Record<string, string> = {};

        if (!url.trim()) {
            errs.url = 'Job URL is required for authenticity verification';
        } else {
            try {
                new URL(url.trim());
            } catch {
                errs.url = 'Please enter a valid URL (e.g. https://...)';
            }
        }

        if (!title.trim()) errs.title = 'Title is required';

        if (isCustomCompany) {
            if (!company.trim()) errs.company = 'Company name is required';
        } else {
            if (!company.trim()) {
                errs.company = 'Please select a company from the dropdown or click "Add Custom Company".';
            }
        }

        if (!description.trim()) {
            errs.description = 'Description is required';
        } else if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
            errs.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
        }

        if (!isRemote && !locationConfirmed) {
            errs.location = 'Please select a location from the dropdown';
        }

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setIsSaving(true);
        setSaveError(null);
        setErrors({}); // Reset specific errors

        try {
            const finalLocation = isRemote ? 'Remote' : location.trim();
            let finalLogoUrl = companyLogoUrl.trim();
            let finalCompany = company.trim();

            if (isCustomCompany && companyLogoFile) {
                // Upload custom logo first
                const formData = new FormData();
                formData.append('name', finalCompany);
                formData.append('logo', companyLogoFile);

                const uploadRes = await fetch('/api/company', {
                    method: 'POST',
                    body: formData,
                });

                if (uploadRes.ok) {
                    const uploadData = await uploadRes.json();
                    if (uploadData.success && uploadData.company?.logo_url) {
                        finalLogoUrl = uploadData.company.logo_url;
                    }
                } else {
                    console.error('Failed to upload custom logo');
                }
            }

            const res = await fetch('/api/import-job', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: url.trim(),
                    title: title.trim(),
                    company: finalCompany,
                    company_logo_url: finalLogoUrl || undefined,
                    location: finalLocation,
                    description: description.trim(),
                    bypassValidation: true, // It's manual input, bypass generic regex scraping checks
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                // Check if it's our specific authenticity failure
                if (data.action === 'authenticity_failed' && data.details) {
                    setSaveError(`Authenticity Check Failed: ${data.details}`);
                    return;
                }
                throw new Error(data.error || 'Failed to import job. Our AI verification might be temporarily unavailable.');
            }

            if (data.success) {
                addImportedJob(data.job);
                setSuccess({ job: data.job });
                if (onImportSuccess) onImportSuccess();
                setTimeout(() => onClose(), 2000);
            }
        } catch (err: any) {
            setSaveError(err.message || 'Failed to connect to server');
        } finally {
            setIsSaving(false);
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

    // Success state UI
    if (success) {
        return (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
                <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', width: '90%', maxWidth: '400px', padding: '32px', textAlign: 'center', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #10b981, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)' }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Job Added Successfully!</h3>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '16px' }}>
                        {success.job.company_logo_url && (
                            <img src={success.job.company_logo_url} alt="Logo" style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover' }} />
                        )}
                        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0 }}>
                            <strong>{success.job.title}</strong><span> at {success.job.company}</span>
                        </p>
                    </div>

                    <p style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Closing automatically...</p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }} onClick={onClose} role="dialog" aria-modal="true">
            <div ref={modalRef} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg, 12px)', width: '100%', maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--background)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Add Job Manually</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-secondary)', borderRadius: '50%' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {/* Form */}
                <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    {/* URL */}
                    <div>
                        <label htmlFor="manual-job-url" style={labelStyle}>Job URL * <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', fontSize: '11px' }}>(Required for verification)</span></label>
                        <input
                            id="manual-job-url"
                            type="text"
                            value={url}
                            onChange={(e) => { setUrl(e.target.value); setErrors(prev => ({ ...prev, url: '' })); }}
                            style={{ ...inputStyle, borderColor: errors.url ? '#ef4444' : undefined }}
                            placeholder="https://linkedin.com/jobs/..."
                        />
                        {errors.url && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.url}</p>}
                    </div>

                    {/* Title */}
                    <div>
                        <label htmlFor="manual-job-title" style={labelStyle}>Job Title *</label>
                        <input
                            ref={titleInputRef}
                            id="manual-job-title"
                            type="text"
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: '' })); }}
                            style={{ ...inputStyle, borderColor: errors.title ? '#ef4444' : undefined }}
                            placeholder="e.g. Software Engineer"
                        />
                        {errors.title && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.title}</p>}
                    </div>

                    {/* Company */}
                    <CompanyAutocomplete
                        value={company}
                        error={errors.company}
                        initialLogoUrl={companyLogoUrl}
                        onSelect={({ name, logoUrl, logoFile, isCustom }) => {
                            setCompany(name);
                            setCompanyLogoUrl(logoUrl);
                            setCompanyLogoFile(logoFile);
                            setIsCustomCompany(isCustom);
                            setErrors(prev => ({ ...prev, company: '' }));
                        }}
                    />

                    {/* Location with Autocomplete & Toggle */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label htmlFor="manual-job-location" style={{ ...labelStyle, marginBottom: 0 }}>
                                Location *
                                {!isRemote && <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '6px', fontSize: '11px' }}>(select from suggestions)</span>}
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRemote(!isRemote);
                                        setErrors(prev => ({ ...prev, location: '' }));
                                        if (showSuggestions) setShowSuggestions(false);
                                    }}
                                    style={{ width: '36px', height: '20px', borderRadius: '10px', background: isRemote ? 'var(--accent)' : 'var(--border)', border: 'none', position: 'relative', cursor: 'pointer', padding: 0 }}
                                    aria-label="Toggle Remote"
                                >
                                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: isRemote ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                                </button>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>This position is fully remote</span>
                            </div>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <input
                                ref={locationInputRef}
                                id="manual-job-location"
                                type="text"
                                value={isRemote ? 'Remote' : locationInput}
                                disabled={isRemote}
                                onChange={(e) => handleLocationInputChange(e.target.value)}
                                onKeyDown={handleLocationKeyDown}
                                onFocus={() => { if (!isRemote && suggestions.length > 0) setShowSuggestions(true); }}
                                style={{
                                    ...inputStyle,
                                    borderColor: errors.location ? '#ef4444' : undefined,
                                    opacity: isRemote ? 0.6 : 1,
                                    cursor: isRemote ? 'not-allowed' : 'text',
                                    background: isRemote ? 'var(--surface-hover, #f3f4f6)' : 'var(--background)',
                                    color: isRemote ? 'var(--text-secondary)' : 'var(--text-primary)',
                                }}
                                placeholder="e.g. San Francisco, CA"
                                autoComplete="off"
                            />
                        </div>

                        {/* Suggestions dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div
                                ref={suggestionsRef}
                                style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1001, maxHeight: '220px', overflowY: 'auto' }}
                            >
                                {suggestions.map((suggestion, index) => (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                                        style={{ width: '100%', padding: '10px 14px', border: 'none', background: index === activeSuggestionIndex ? 'var(--accent-muted, rgba(59, 130, 246, 0.1))' : 'transparent', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: index < suggestions.length - 1 ? '1px solid var(--border)' : 'none', transition: 'background 0.15s' }}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="2" style={{ flexShrink: 0 }}>
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{suggestion.place_name}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {errors.location && <p style={{ fontSize: '12px', color: '#ef4444', marginTop: '4px' }}>{errors.location}</p>}

                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="manual-job-description" style={labelStyle}>
                            Description * <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(min {MIN_DESCRIPTION_LENGTH} chars)</span>
                        </label>
                        <textarea
                            id="manual-job-description"
                            value={description}
                            onChange={(e) => { setDescription(e.target.value); setErrors(prev => ({ ...prev, description: '' })); }}
                            style={{
                                ...inputStyle,
                                minHeight: '160px',
                                resize: 'vertical',
                                fontFamily: 'inherit',
                                lineHeight: '1.5',
                                borderColor: errors.description ? '#ef4444' : undefined,
                            }}
                            placeholder="Full job description..."
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            {errors.description ? <p style={{ fontSize: '12px', color: '#ef4444' }}>{errors.description}</p> : <span />}
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>{description.trim().length} chars</span>
                        </div>
                    </div>

                    {saveError && (
                        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md, 8px)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '13px' }}>
                            {saveError}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--background)' }}>
                    <button onClick={onClose} disabled={isSaving} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={isSaving} style={{ padding: '10px 20px', borderRadius: 'var(--radius-md, 8px)', border: 'none', background: isSaving ? 'var(--text-tertiary)' : 'var(--accent)', color: 'white', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {isSaving ? 'Saving...' : 'Add Job'}
                    </button>
                </div>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
