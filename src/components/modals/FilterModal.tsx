'use client';

import { useState, useRef, useEffect } from 'react';
import { useStore } from '@/store/useStore';

const PREFILLED_TAGS = [
    'senior', 'staff', 'lead', 'principal', 'manager', 'director', 'vp',
    'architect', 'clearance', 'secret', 'ts/sci', 'polygraph', 'citizen',
    'sr.', 'sr', 'iii', 'iv', 'expert', 'master'
];

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function FilterModal({ isOpen, onClose }: FilterModalProps) {
    const excludedKeywords = useStore(state => state.excludedKeywords ?? []);
    const updateExcludedKeywords = useStore(state => state.updateExcludedKeywords);
    const loadSettings = useStore(state => state.loadSettings);

    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Load settings on mount
    useEffect(() => {
        if (isOpen) {
            loadSettings();
            // Focus input when modal opens
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, loadSettings]);

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
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleApplyFilter = () => {
        onClose();
    };

    // All tags: combine prefilled + any custom ones not in prefilled
    const allTags = Array.from(new Set([...PREFILLED_TAGS, ...excludedKeywords]));

    if (!isOpen) return null;

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
                backdropFilter: 'blur(4px)'
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                style={{
                    background: 'var(--surface)',
                    borderRadius: '12px',
                    width: '100%',
                    maxWidth: '420px',
                    maxHeight: '80vh',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--border)'
                }}
            >
                {/* Header */}
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        Filter Jobs by Keywords
                    </h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            padding: '4px',
                            display: 'flex'
                        }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 16px 0' }}>
                        Select keywords to exclude from job titles. Jobs containing these keywords will be hidden.
                    </p>

                    {/* Input */}
                    <div style={{ marginBottom: '16px' }}>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a keyword and press Enter..."
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                fontSize: '14px',
                                borderRadius: '8px',
                                border: '1px solid var(--border)',
                                background: 'var(--background)',
                                color: 'var(--text-primary)',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Selected Keywords (Chips) */}
                    {excludedKeywords.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                                Active Filters ({excludedKeywords.length})
                            </span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                        </div>
                    )}

                    {/* Tag List */}
                    <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                            Suggested Tags
                        </span>
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            background: 'var(--background)'
                        }}>
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
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 20px',
                    borderTop: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '12px'
                }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: 500,
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            background: 'var(--background)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleApplyFilter}
                        style={{
                            padding: '10px 20px',
                            fontSize: '14px',
                            fontWeight: 500,
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--accent)',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Apply Filter
                    </button>
                </div>
            </div>
        </div>
    );
}
