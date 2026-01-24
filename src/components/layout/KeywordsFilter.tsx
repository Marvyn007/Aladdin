'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';

const PREFILLED_TAGS = [
    'senior', 'staff', 'lead', 'principal', 'manager', 'director', 'vp',
    'architect', 'clearance', 'secret', 'ts/sci', 'polygraph', 'citizen',
    'sr.', 'sr', 'iii', 'iv', 'expert', 'master'
];

interface KeywordsFilterProps {
    className?: string;
    onFilter?: () => void;
}

export function KeywordsFilter({ className, onFilter }: KeywordsFilterProps) {
    const excludedKeywords = useStore(state => state.excludedKeywords ?? []);
    const updateExcludedKeywords = useStore(state => state.updateExcludedKeywords);
    const loadSettings = useStore(state => state.loadSettings);

    const [inputValue, setInputValue] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Load initial settings
    useEffect(() => {
        loadSettings();
    }, [loadSettings]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTag = async (tag: string) => {
        const normalized = tag.toLowerCase();
        if (excludedKeywords.includes(normalized)) {
            await updateExcludedKeywords(excludedKeywords.filter(k => k !== normalized));
        } else {
            await updateExcludedKeywords([...excludedKeywords, normalized]);
        }
    };

    const addCustomTag = async () => {
        const val = inputValue.trim().toLowerCase();
        if (!val) return;
        if (!excludedKeywords.includes(val)) {
            await updateExcludedKeywords([...excludedKeywords, val]);
        }
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCustomTag();
        }
    };

    // All tags: combine prefilled + any custom ones not in prefilled
    const allTags = Array.from(new Set([...PREFILLED_TAGS, ...excludedKeywords]));

    return (
        <div className={className} ref={containerRef} style={{ position: 'relative', marginTop: '8px' }}>
            {/* Label */}
            <div style={{ marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Exclude Keywords (Title):
                </span>
            </div>

            {/* Input + Add + Filter Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '0px' }}>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add keyword (e.g. senior)..."
                    style={{
                        flex: 1,
                        padding: '8px 12px',
                        fontSize: '13px',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        outline: 'none'
                    }}
                />
                <button
                    onClick={addCustomTag}
                    style={{
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '6px',
                        border: 'none',
                        background: 'var(--text-primary)',
                        color: 'var(--background)',
                        cursor: 'pointer'
                    }}
                >
                    Add
                </button>
                <button
                    onClick={() => {
                        setIsDropdownOpen(false);
                        onFilter?.();
                    }}
                    style={{
                        padding: '8px 14px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '6px',
                        border: '1px solid var(--accent)',
                        background: 'var(--accent)',
                        color: '#fff',
                        cursor: 'pointer'
                    }}
                >
                    Filter
                </button>
            </div>

            {/* Dropdown with Selectable Tags */}
            {isDropdownOpen && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 100,
                    maxHeight: '280px',
                    overflowY: 'auto',
                    padding: '8px 0'
                }}>
                    <div style={{ padding: '4px 12px 8px', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                            Select Tags
                        </span>
                    </div>
                    {allTags.map(tag => {
                        const isSelected = excludedKeywords.includes(tag);
                        return (
                            <div
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '10px 12px',
                                    cursor: 'pointer',
                                    background: isSelected ? 'var(--accent-light)' : 'transparent',
                                    transition: 'background 0.15s'
                                }}
                                onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'var(--background-secondary)';
                                }}
                                onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                    else e.currentTarget.style.background = 'var(--accent-light)';
                                }}
                            >
                                {/* Drag Handle Icon (visual only) */}
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: '10px', color: 'var(--text-tertiary)' }}>
                                    <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                                    <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                                    <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                                    <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                                    <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                                    <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                                </svg>

                                {/* Tag Name */}
                                <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                    {tag}
                                </span>

                                {/* Selection Indicator (Radio style) */}
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    border: isSelected ? '5px solid var(--text-primary)' : '2px solid var(--border)',
                                    background: 'var(--background)',
                                    transition: 'border 0.15s'
                                }} />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Selected Tags Display (Chips) */}
            {excludedKeywords.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                    {excludedKeywords.map(tag => (
                        <span
                            key={tag}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                fontSize: '12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                color: '#ef4444',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                padding: '4px 10px',
                                borderRadius: '14px',
                                fontWeight: 500
                            }}
                        >
                            {tag}
                            <button
                                onClick={() => toggleTag(tag)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    color: 'inherit',
                                    marginLeft: '6px',
                                    cursor: 'pointer',
                                    padding: 0,
                                    display: 'flex',
                                    fontSize: '14px',
                                    fontWeight: 700
                                }}
                            >
                                ×
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
