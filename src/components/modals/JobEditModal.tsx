'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CompanyAutocomplete } from '@/components/shared/CompanyAutocomplete';
import type { Job } from '@/types';

interface JobEditModalProps {
    job: Job;
    onClose: () => void;
    onSave: (fields: { title: string; company: string; location: string; description: string }) => Promise<void>;
}

const MIN_DESCRIPTION_LENGTH = 50;
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface LocationSuggestion {
    id: string;
    place_name: string;
}

export function JobEditModal({ job, onClose, onSave }: JobEditModalProps) {
    const [title, setTitle] = useState(job.title);
    const [company, setCompany] = useState(job.company || '');
    const [companyLogoUrl, setCompanyLogoUrl] = useState(job.company_logo_url || '');
    const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);
    const [isCustomCompany, setIsCustomCompany] = useState(false);
    const initialIsRemote = job.location === 'Remote' || job.location_display === 'Remote';
    const initialLocation = initialIsRemote ? '' : (job.location_display || job.location || '');

    const [location, setLocation] = useState(initialLocation);
    const [locationInput, setLocationInput] = useState(initialLocation);
    const [locationConfirmed, setLocationConfirmed] = useState(true); // starts confirmed (original value)
    const [isRemote, setIsRemote] = useState(initialIsRemote);
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const [description, setDescription] = useState(
        job.job_description_plain || job.normalized_text || job.raw_text_summary || ''
    );
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    const modalRef = useRef<HTMLDivElement>(null);
    const titleInputRef = useRef<HTMLInputElement>(null);
    const locationInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Focus trap + Esc close
    useEffect(() => {
        titleInputRef.current?.focus();

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (showSuggestions) {
                    setShowSuggestions(false);
                    return;
                }
                onClose();
                return;
            }
            // Focus trap
            if (e.key === 'Tab' && modalRef.current) {
                const focusable = modalRef.current.querySelectorAll<HTMLElement>(
                    'input, textarea, button, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable.length === 0) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose, showSuggestions]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(e.target as Node) &&
                locationInputRef.current &&
                !locationInputRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
                // Revert if not confirmed
                if (!locationConfirmed) {
                    setLocationInput(location);
                    setLocationConfirmed(true);
                }
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [location, locationConfirmed]);

    // Fetch location suggestions from Mapbox
    const fetchSuggestions = async (query: string) => {
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
            // Silently fail — user can still type
        }
    };

    const handleLocationInputChange = (value: string) => {
        setLocationInput(value);
        setLocationConfirmed(false);
        setErrors(prev => ({ ...prev, location: '' }));

        // If cleared, confirm empty
        if (!value.trim()) {
            setLocation('');
            setLocationConfirmed(true);
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // Debounce API calls
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
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
            setActiveSuggestionIndex(prev =>
                prev < suggestions.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveSuggestionIndex(prev =>
                prev > 0 ? prev - 1 : suggestions.length - 1
            );
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
                handleSelectSuggestion(suggestions[activeSuggestionIndex]);
            }
        }
    };

    const validate = (): boolean => {
        const errs: Record<string, string> = {};
        if (!title.trim()) errs.title = 'Title is required';
        if (!company.trim()) errs.company = 'Company is required';
        if (!description.trim()) errs.description = 'Description is required';
        else if (description.trim().length < MIN_DESCRIPTION_LENGTH)
            errs.description = `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters`;
        // Location: if user typed something but didn't select from dropdown
        if (!isRemote && locationInput.trim() && !locationConfirmed) {
            errs.location = 'Please select a location from the dropdown';
        }
        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    const handleSave = async () => {
        if (!validate()) return;
        setIsSaving(true);
        setSaveError(null);
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
                }
            }

            const res = await fetch(`/api/job/${job.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: title.trim(),
                    company: finalCompany,
                    company_logo_url: finalLogoUrl || null,
                    location: finalLocation,
                    description: description.trim(),
                }),
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || 'Failed to save changes');
            }
            await onSave({
                title: title.trim(),
                company: finalCompany,
                location: finalLocation,
                description: description.trim(),
            });
            onClose();
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
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

    const errorStyle: React.CSSProperties = {
        fontSize: '12px',
        color: '#ef4444',
        marginTop: '4px',
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
            }}
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="Edit job"
        >
            <div
                ref={modalRef}
                style={{
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-lg)',
                    width: '90%',
                    maxWidth: '560px',
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: 'var(--shadow-xl)',
                    border: '1px solid var(--border)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--background)',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>Edit Job</h2>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px',
                            color: 'var(--text-secondary)',
                            borderRadius: '50%',
                        }}
                        aria-label="Close"
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Form */}
                <div
                    style={{
                        padding: '24px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px',
                    }}
                >
                    {/* Title */}
                    <div>
                        <label htmlFor="edit-job-title" style={labelStyle}>Job Title *</label>
                        <input
                            ref={titleInputRef}
                            id="edit-job-title"
                            type="text"
                            value={title}
                            onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: '' })); }}
                            style={{ ...inputStyle, borderColor: errors.title ? '#ef4444' : undefined }}
                            placeholder="e.g. Software Engineer"
                        />
                        {errors.title && <p style={errorStyle}>{errors.title}</p>}
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

                    {/* Location with Autocomplete */}
                    <div style={{ position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <label htmlFor="edit-job-location" style={{ ...labelStyle, marginBottom: 0 }}>
                                Location
                                <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: '6px', fontSize: '11px' }}>
                                    (select from suggestions)
                                </span>
                            </label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRemote(!isRemote);
                                        setErrors(prev => ({ ...prev, location: '' }));
                                        if (showSuggestions) setShowSuggestions(false);
                                    }}
                                    style={{
                                        width: '36px',
                                        height: '20px',
                                        borderRadius: '10px',
                                        background: isRemote ? 'var(--accent)' : 'var(--border)',
                                        border: 'none',
                                        position: 'relative',
                                        cursor: 'pointer',
                                        transition: 'background 0.2s',
                                        padding: 0,
                                    }}
                                    aria-label="Toggle Remote"
                                    aria-pressed={isRemote}
                                >
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        borderRadius: '50%',
                                        background: 'white',
                                        position: 'absolute',
                                        top: '2px',
                                        left: isRemote ? '18px' : '2px',
                                        transition: 'left 0.2s',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                    }} />
                                </button>
                                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                    This position is fully remote
                                </span>
                            </div>
                        </div>
                        <div style={{ position: 'relative' }}>
                            <input
                                ref={locationInputRef}
                                id="edit-job-location"
                                type="text"
                                value={isRemote ? 'Remote' : locationInput}
                                disabled={isRemote}
                                onChange={(e) => handleLocationInputChange(e.target.value)}
                                onKeyDown={handleLocationKeyDown}
                                onFocus={() => {
                                    if (!isRemote && suggestions.length > 0) setShowSuggestions(true);
                                }}
                                style={{
                                    ...inputStyle,
                                    borderColor: errors.location ? '#ef4444' : (showSuggestions ? 'var(--accent)' : undefined),
                                    paddingRight: (!isRemote && locationInput) ? '36px' : '12px',
                                    opacity: isRemote ? 0.6 : 1,
                                    cursor: isRemote ? 'not-allowed' : 'text',
                                    background: isRemote ? 'var(--surface-hover, #f3f4f6)' : 'var(--background)',
                                    color: isRemote ? 'var(--text-secondary)' : 'var(--text-primary)',
                                }}
                                placeholder="e.g. San Francisco, CA"
                                autoComplete="off"
                            />
                            {/* Clear button */}
                            {!isRemote && locationInput && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLocationInput('');
                                        setLocation('');
                                        setLocationConfirmed(true);
                                        setSuggestions([]);
                                        setShowSuggestions(false);
                                        setErrors(prev => ({ ...prev, location: '' }));
                                        locationInputRef.current?.focus();
                                    }}
                                    style={{
                                        position: 'absolute',
                                        right: '8px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-tertiary)',
                                        padding: '2px',
                                        lineHeight: 0,
                                        borderRadius: '50%',
                                    }}
                                    aria-label="Clear location"
                                >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="15" y1="9" x2="9" y2="15" />
                                        <line x1="9" y1="9" x2="15" y2="15" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Suggestions dropdown */}
                        {showSuggestions && suggestions.length > 0 && (
                            <div
                                ref={suggestionsRef}
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: '4px',
                                    background: 'var(--surface)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md, 8px)',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                                    zIndex: 1001,
                                    maxHeight: '220px',
                                    overflowY: 'auto',
                                }}
                            >
                                {suggestions.map((suggestion, index) => (
                                    <button
                                        key={suggestion.id}
                                        type="button"
                                        onClick={() => handleSelectSuggestion(suggestion)}
                                        onMouseEnter={() => setActiveSuggestionIndex(index)}
                                        style={{
                                            width: '100%',
                                            padding: '10px 14px',
                                            border: 'none',
                                            background: index === activeSuggestionIndex
                                                ? 'var(--accent-muted, rgba(59, 130, 246, 0.1))'
                                                : 'transparent',
                                            color: 'var(--text-primary)',
                                            fontSize: '13px',
                                            textAlign: 'left',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '10px',
                                            borderBottom: index < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                                            transition: 'background 0.15s',
                                        }}
                                    >
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="var(--text-tertiary)"
                                            strokeWidth="2"
                                            style={{ flexShrink: 0 }}
                                        >
                                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                                            <circle cx="12" cy="10" r="3" />
                                        </svg>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {suggestion.place_name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}

                        {errors.location && <p style={errorStyle}>{errors.location}</p>}
                    </div>

                    {/* Description */}
                    <div>
                        <label htmlFor="edit-job-description" style={labelStyle}>
                            Description * <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>
                                (min {MIN_DESCRIPTION_LENGTH} chars)
                            </span>
                        </label>
                        <textarea
                            id="edit-job-description"
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
                            {errors.description ? (
                                <p style={errorStyle}>{errors.description}</p>
                            ) : <span />}
                            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                                {description.trim().length} chars
                            </span>
                        </div>
                    </div>

                    {/* Save Error */}
                    {saveError && (
                        <div
                            style={{
                                padding: '10px 14px',
                                borderRadius: 'var(--radius-md, 8px)',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                color: '#ef4444',
                                fontSize: '13px',
                            }}
                        >
                            {saveError}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    style={{
                        padding: '16px 24px',
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--background)',
                    }}
                >
                    {/* View Original - bottom left */}
                    <a
                        href={job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '13px',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            fontWeight: 500,
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        View Original
                    </a>

                    {/* Cancel + Save - bottom right */}
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                            onClick={onClose}
                            disabled={isSaving}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: '1px solid var(--border)',
                                background: 'var(--surface)',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            style={{
                                padding: '10px 20px',
                                borderRadius: 'var(--radius-md, 8px)',
                                border: 'none',
                                background: isSaving ? 'var(--text-tertiary)' : 'var(--accent)',
                                color: 'white',
                                cursor: isSaving ? 'not-allowed' : 'pointer',
                                fontSize: '14px',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                            }}
                        >
                            {isSaving ? (
                                <>
                                    <span style={{
                                        width: '14px',
                                        height: '14px',
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        display: 'inline-block',
                                        animation: 'spin 0.6s linear infinite',
                                    }} />
                                    Saving...
                                </>
                            ) : 'Save Changes'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Spinner animation */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

