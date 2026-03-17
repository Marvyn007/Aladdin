'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin } from 'lucide-react';

interface LocationAutocompleteProps {
    value: string;
    onSelect: (location: string) => void;
    error?: string;
    label?: string;
    placeholder?: string;
}

interface LocationSuggestion {
    display_name: string;
    lat: string;
    lon: string;
}

export function LocationAutocomplete({
    value,
    onSelect,
    error,
    label = "Location *",
    placeholder = "e.g. San Francisco, CA"
}: LocationAutocompleteProps) {
    const [search, setSearch] = useState(value);
    const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(false);
    const [isValidSelection, setIsValidSelection] = useState(!!value);

    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (value && value !== search && isValidSelection) {
            setSearch(value);
        }
    }, [value, isValidSelection]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchSuggestions = useCallback(async (query: string) => {
        if (!query.trim() || query.trim().length < 2) {
            setSuggestions([]);
            return;
        }
        setIsLoading(true);
        try {
            // Using OpenStreetMap Nominatim for free geolocation search
            // We append 'city' or limit features to make it more relevant to job locations if needed,
            // but for now a general search works. We can also add "countrycodes=us,in,uk,ca" etc if needed, but keeping global.
            const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&featuretype=city,settlement`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'en-US,en;q=0.9' } });
            if (!res.ok) throw new Error('Failed to fetch');
            const data: LocationSuggestion[] = await res.json();
            
            // Further filtering/formatting
            const formatted = data.map(item => {
                const parts = item.display_name.split(', ');
                // Typically: City, County, State, ZIP, Country
                // We want to simplify it. E.g. "Seattle, King County, Washington, United States" -> "Seattle, Washington, United States"
                const simplified = parts.length > 3 
                    ? `${parts[0]}, ${parts[parts.length - 2]}, ${parts[parts.length - 1]}`
                    : item.display_name;
                return { ...item, display_name: simplified };
            });

            // Remove EXACT duplicates
            const unique = formatted.filter((v, i, a) => a.findIndex(t => t.display_name === v.display_name) === i);
            
            setSuggestions(unique);
            if (query.trim()) setShowSuggestions(true);
            setActiveIndex(-1);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleChange = (val: string) => {
        setSearch(val);
        setIsValidSelection(false);
        onSelect(''); // Clear valid selection until they pick one

        if (!val.trim()) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        setShowSuggestions(true);

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            fetchSuggestions(val);
        }, 500); // 500ms debounce to be polite to the Nominatim API
    };

    const handleSelect = (suggestion: LocationSuggestion) => {
        setSearch(suggestion.display_name);
        setIsValidSelection(true);
        setShowSuggestions(false);
        setSuggestions([]);
        onSelect(suggestion.display_name);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex(prev => prev < suggestions.length - 1 ? prev + 1 : 0);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex(prev => prev > 0 ? prev - 1 : suggestions.length - 1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIndex >= 0 && activeIndex < suggestions.length) {
                handleSelect(suggestions[activeIndex]);
            }
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '10px 12px 10px 40px',
        borderRadius: 'var(--radius-md, 8px)',
        border: `1px solid ${error ? '#ef4444' : 'var(--border)'}`,
        background: 'var(--background)',
        color: 'var(--text-primary)',
        fontSize: '14px',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    };

    const labelStyle: React.CSSProperties = {
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: 'var(--text-secondary)',
        marginBottom: '6px',
    };

    return (
        <div style={{ position: 'relative', flex: 1 }}>
            <label style={labelStyle}>{label}</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <div style={{ position: 'absolute', left: '12px', color: 'var(--text-tertiary)', display: 'flex' }}>
                    <MapPin size={18} />
                </div>
                <input
                    ref={inputRef}
                    type="text"
                    value={search}
                    onChange={(e) => handleChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => { if (search.trim() && !isValidSelection) setShowSuggestions(true); }}
                    style={inputStyle}
                    placeholder={placeholder}
                    autoComplete="off"
                />
                {isLoading && (
                    <div style={{ position: 'absolute', right: '12px', color: 'var(--text-tertiary)' }}>
                        <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                            <line x1="2" y1="12" x2="6" y2="12"></line>
                            <line x1="18" y1="12" x2="22" y2="12"></line>
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                        </svg>
                    </div>
                )}
                {!isLoading && isValidSelection && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--success, #10b981)" strokeWidth="3" style={{ position: 'absolute', right: '12px' }}>
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '4px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md, 8px)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 1001, maxHeight: '220px', overflowY: 'auto' }}
                >
                    {suggestions.map((suggestion, index) => (
                        <button
                            key={index}
                            type="button"
                            onClick={() => handleSelect(suggestion)}
                            onMouseEnter={() => setActiveIndex(index)}
                            style={{ width: '100%', padding: '10px 14px', border: 'none', background: index === activeIndex ? 'var(--accent-muted, rgba(59, 130, 246, 0.1))' : 'transparent', color: 'var(--text-primary)', fontSize: '13px', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                        >
                            <MapPin size={14} color="var(--text-tertiary)" />
                            {suggestion.display_name}
                        </button>
                    ))}
                </div>
            )}
            {error && <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>{error}</p>}
        </div>
    );
}
