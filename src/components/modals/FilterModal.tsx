'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useFilters, type FilterType, parseFilterWithType, FILTER_TYPE_OPTIONS } from '@/contexts/FilterContext';
import { useStore } from '@/store/useStore';

const PREFILLED_TAGS = [
    'senior', 'staff', 'lead', 'principal', 'manager', 'director', 'vp',
    'architect', 'clearance', 'secret', 'ts/sci', 'polygraph', 'citizen',
    'sr.', 'sr', 'iii', 'iv', 'expert', 'master'
];

const MAX_FILTERS = 20;

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    onApply?: () => void;
}

export function FilterModal({ isOpen, onClose, onApply }: FilterModalProps) {
    const { 
        activeFilters, 
        isLoading, 
        isSaving, 
        addFilter, 
        removeFilter, 
        clearFilters, 
        setFilters,
        applyFilters 
    } = useFilters();
    
    const loadSettings = useStore(state => state.loadSettings);
    
    const [inputValue, setInputValue] = useState('');
    const [selectedType, setSelectedType] = useState<FilterType>('all');
    const [localFilters, setLocalFilters] = useState<string[]>([]);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const typeDropdownRef = useRef<HTMLDivElement>(null);

    const currentTypeOption = FILTER_TYPE_OPTIONS.find(o => o.value === selectedType)!;

    useEffect(() => {
        if (isOpen) {
            setLocalFilters([...activeFilters]);
            loadSettings();
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen, activeFilters, loadSettings]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (typeDropdownRef.current && !typeDropdownRef.current.contains(e.target as Node)) {
                setShowTypeDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleTag = (tag: string) => {
        const fullFilter = selectedType === 'all' ? tag.toLowerCase() : `${selectedType}:${tag.toLowerCase()}`;
        if (localFilters.includes(fullFilter)) {
            setLocalFilters(localFilters.filter(f => f !== fullFilter));
        } else {
            if (localFilters.length >= MAX_FILTERS) {
                showToastMessage(`Maximum ${MAX_FILTERS} filters allowed`);
                return;
            }
            setLocalFilters([...localFilters, fullFilter]);
        }
    };

    const addCustomTag = () => {
        const val = inputValue.trim();
        if (!val) return;
        
        const fullFilter = selectedType === 'all' ? val.toLowerCase() : `${selectedType}:${val.toLowerCase()}`;
        
        if (localFilters.includes(fullFilter)) {
            showToastMessage('Filter already exists');
            setInputValue('');
            return;
        }
        if (localFilters.length >= MAX_FILTERS) {
            showToastMessage(`Maximum ${MAX_FILTERS} filters allowed`);
            return;
        }
        setLocalFilters([...localFilters, fullFilter]);
        setInputValue('');
    };

    const showToastMessage = (message: string) => {
        setToastMessage(message);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);
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

    const handleApplyFilter = async () => {
        const uniqueFilters = Array.from(new Set(localFilters)).slice(0, MAX_FILTERS);
        setFilters(uniqueFilters);
        await applyFilters(uniqueFilters);
        
        if (uniqueFilters.length !== activeFilters.length || 
            uniqueFilters.some(f => !activeFilters.includes(f))) {
            showToastMessage(`${uniqueFilters.length} filter${uniqueFilters.length !== 1 ? 's' : ''} applied — searching title, company, location, skills`);
        }
        
        onApply?.();
        onClose();
    };

    const handleClearAll = () => {
        setLocalFilters([]);
        clearFilters();
        showToastMessage('All filters cleared');
    };

    const allTags = useMemo(() => {
        return Array.from(new Set([...PREFILLED_TAGS, ...localFilters])).sort();
    }, [localFilters]);

    if (!isOpen) return null;

    return (
        <>
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
                            Search Jobs by Keywords
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
                            Select a field type and enter your search term.
                        </p>

                        {/* Input with Type Selector */}
                        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                            {/* Type Selector Dropdown */}
                            <div style={{ position: 'relative' }} ref={typeDropdownRef}>
                                <button
                                    type="button"
                                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '10px 12px',
                                        fontSize: '13px',
                                        fontWeight: 500,
                                        borderRadius: '8px 0 0 8px',
                                        border: '1px solid var(--border)',
                                        borderRight: 'none',
                                        background: 'var(--background)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        minWidth: '120px',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <span>{currentTypeOption.label}</span>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showTypeDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                        <polyline points="6 9 12 15 18 9" />
                                    </svg>
                                </button>
                                
                                {showTypeDropdown && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        marginTop: '4px',
                                        background: 'var(--surface)',
                                        border: '1px solid var(--border)',
                                        borderRadius: '8px',
                                        boxShadow: 'var(--shadow-lg)',
                                        zIndex: 20,
                                        width: '160px',
                                        overflow: 'hidden',
                                    }}>
                                        {FILTER_TYPE_OPTIONS.map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => {
                                                    setSelectedType(option.value);
                                                    setShowTypeDropdown(false);
                                                }}
                                                style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    textAlign: 'left',
                                                    padding: '10px 14px',
                                                    fontSize: '13px',
                                                    background: selectedType === option.value ? 'var(--accent-light)' : 'transparent',
                                                    color: selectedType === option.value ? 'var(--accent)' : 'var(--text-primary)',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            
                            {/* Text Input */}
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={currentTypeOption.placeholder}
                                style={{
                                    flex: 1,
                                    padding: '10px 14px',
                                    fontSize: '14px',
                                    borderRadius: '0 8px 8px 0',
                                    border: '1px solid var(--border)',
                                    borderLeft: 'none',
                                    background: 'var(--background)',
                                    color: 'var(--text-primary)',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        {/* Selected Keywords (Chips) */}
                        {localFilters.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                        Active Filters ({localFilters.length})
                                    </span>
                                    <button
                                        onClick={handleClearAll}
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--accent)',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontWeight: 500
                                        }}
                                    >
                                        Clear all
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {localFilters.map(tag => {
                                        const { type, value } = parseFilterWithType(tag);
                                        const typeLabel = FILTER_TYPE_OPTIONS.find(o => o.value === type)?.label || 'All';
                                        return (
                                        <span
                                            key={tag}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                fontSize: '11px',
                                                background: 'rgba(59, 130, 246, 0.1)',
                                                color: '#3b82f6',
                                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                                padding: '4px 8px',
                                                borderRadius: '14px',
                                                fontWeight: 500
                                            }}
                                        >
                                            {type !== 'all' && <span style={{ opacity: 0.7, marginRight: '4px' }}>{type}:</span>}
                                            {value}
                                            <button
                                                onClick={() => toggleTag(value)}
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
                                        );
                                    })}
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
                                    const isSelected = localFilters.includes(tag);
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
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ marginRight: '10px', color: 'var(--text-tertiary)' }}>
                                                <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                                                <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                                                <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                                                <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                                                <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                                                <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                                            </svg>

                                            <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                                                {tag}
                                            </span>

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
                            disabled={isSaving}
                            style={{
                                padding: '10px 20px',
                                fontSize: '14px',
                                fontWeight: 500,
                                borderRadius: '8px',
                                border: 'none',
                                background: 'var(--accent)',
                                color: '#fff',
                                cursor: isSaving ? 'wait' : 'pointer',
                                opacity: isSaving ? 0.7 : 1
                            }}
                        >
                            {isSaving ? 'Saving...' : 'Apply Filter'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Toast Notification */}
            {showToast && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        padding: '10px 20px',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-lg)',
                        zIndex: 1100,
                        fontSize: '13px',
                        color: 'var(--text-primary)'
                    }}
                >
                    {toastMessage}
                </div>
            )}
        </>
    );
}
