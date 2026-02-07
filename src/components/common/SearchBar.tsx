'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ArrowLeft, History as HistoryIcon, ArrowUpLeft, Loader2 } from 'lucide-react';
import { useStore, useStoreActions } from '@/store/useStore';
import type { SuggestionResponse } from '@/lib/search/types';

const HISTORY_KEY = 'aladdin_search_history';
const MAX_HISTORY_ITEMS = 5;
const SUGGESTION_DEBOUNCE_MS = 150;

export function SearchBar() {
    const [localQuery, setLocalQuery] = useState('');
    const [suggestions, setSuggestions] = useState<SuggestionResponse['suggestions']>({ titles: [], companies: [], locations: [] });
    const [history, setHistory] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [isLoading, setIsLoading] = useState(false);
    const [activeCategory, setActiveCategory] = useState<'all' | 'title' | 'company' | 'location'>('all');

    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const suggestionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const searchMode = useStore(state => state.searchMode);
    const searchQuery = useStore(state => state.searchQuery);
    const isLoadingJobs = useStore(state => state.isLoadingJobs);
    const { performServerSearch, exitSearchMode, clearSearchResults } = useStoreActions();

    // Load history on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(HISTORY_KEY);
            if (saved) {
                setHistory(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load search history', e);
        }
    }, []);

    const saveToHistory = (term: string) => {
        if (!term.trim()) return;
        const cleanTerm = term.trim();

        setHistory(prev => {
            const newHistory = [cleanTerm, ...prev.filter(item => item !== cleanTerm)].slice(0, MAX_HISTORY_ITEMS);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            return newHistory;
        });
    };

    const deleteHistoryItem = (term: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setHistory(prev => {
            const newHistory = prev.filter(item => item !== term);
            localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
            return newHistory;
        });
    };

    // Sync localQuery with searchQuery
    useEffect(() => {
        if (searchMode) {
            setLocalQuery(searchQuery);
        } else {
            setLocalQuery('');
        }
    }, [searchMode, searchQuery]);

    // Handle outside click
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch suggestions from API
    const fetchSuggestions = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setSuggestions({ titles: [], companies: [], locations: [] });
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/search/suggestions?query=${encodeURIComponent(query)}&type=${activeCategory}&limit=6`);
            if (response.ok) {
                const data: SuggestionResponse = await response.json();
                setSuggestions(data.suggestions);
            }
        } catch (error) {
            console.error('Failed to fetch suggestions:', error);
        } finally {
            setIsLoading(false);
        }
    }, [activeCategory]);

    // Debounced suggestion fetching
    useEffect(() => {
        if (suggestionTimeoutRef.current) {
            clearTimeout(suggestionTimeoutRef.current);
        }

        if (localQuery.length >= 2) {
            suggestionTimeoutRef.current = setTimeout(() => {
                fetchSuggestions(localQuery);
            }, SUGGESTION_DEBOUNCE_MS);
        } else {
            setSuggestions({ titles: [], companies: [], locations: [] });
        }

        setSelectedIndex(-1);

        return () => {
            if (suggestionTimeoutRef.current) {
                clearTimeout(suggestionTimeoutRef.current);
            }
        };
    }, [localQuery, fetchSuggestions]);

    // Combine all suggestions for display
    const allSuggestions = useCallback(() => {
        const all: Array<{ text: string; type: 'title' | 'company' | 'location' }> = [];

        suggestions.titles.forEach(t => {
            if (!all.some(item => item.text === t)) {
                all.push({ text: t, type: 'title' });
            }
        });

        suggestions.companies.forEach(c => {
            if (c && !all.some(item => item.text === c)) {
                all.push({ text: c, type: 'company' });
            }
        });

        suggestions.locations.forEach(l => {
            if (l && !all.some(item => item.text === l)) {
                all.push({ text: l, type: 'location' });
            }
        });

        return all.slice(0, 8);
    }, [suggestions]);

    const getDisplayedItems = () => {
        if (localQuery.length < 2) {
            return history.map(h => ({ text: h, type: 'title' as const }));
        }
        return allSuggestions();
    };

    const displayedItems = getDisplayedItems();
    const isShowingHistory = localQuery.length < 2;

    const performSearch = async (term: string) => {
        if (!term.trim()) return;

        setShowSuggestions(false);
        setLocalQuery(term);
        inputRef.current?.blur();

        saveToHistory(term);
        await performServerSearch(term);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            return;
        }

        if (!showSuggestions) {
            if (e.key === 'Enter') {
                performSearch(localQuery);
            }
            return;
        }

        if (displayedItems.length === 0) {
            if (e.key === 'Enter') {
                performSearch(localQuery);
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < displayedItems.length - 1 ? prev + 1 : 0));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : displayedItems.length - 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedIndex >= 0 && selectedIndex < displayedItems.length) {
                performSearch(displayedItems[selectedIndex].text);
            } else {
                performSearch(localQuery);
            }
        }
    };

    const clearSearch = () => {
        clearSearchResults();
        setLocalQuery('');
        setShowSuggestions(false);
    };

    const getCategoryIcon = (type: 'title' | 'company' | 'location') => {
        switch (type) {
            case 'title': return '💼';
            case 'company': return '🏢';
            case 'location': return '📍';
            default: return '🔍';
        }
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
            <div style={{ position: 'relative' }}>
                {searchMode ? (
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{
                            position: 'absolute',
                            left: '8px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-tertiary)',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center'
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                ) : (
                    <Search
                        size={18}
                        style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}
                    />
                )}

                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search by title, company, or location"
                    value={localQuery}
                    onChange={(e) => {
                        setLocalQuery(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoadingJobs}
                    style={{
                        width: '100%',
                        padding: '10px 40px 10px 40px',
                        fontSize: '14px',
                        borderRadius: '24px',
                        border: '1px solid var(--border)',
                        background: 'var(--surface)',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        transition: 'box-shadow 0.2s, border-color 0.2s',
                        opacity: isLoadingJobs ? 0.7 : 1,
                    }}
                    className="search-input"
                />

                {(localQuery || isLoadingJobs) && (
                    <button
                        onClick={isLoadingJobs ? undefined : () => window.location.href = '/'}
                        disabled={isLoadingJobs}
                        style={{
                            position: 'absolute',
                            right: '12px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'transparent',
                            border: 'none',
                            cursor: isLoadingJobs ? 'default' : 'pointer',
                            color: 'var(--text-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: isLoadingJobs ? 0.5 : 1,
                        }}
                    >
                        {isLoadingJobs ? (
                            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <X size={16} />
                        )}
                    </button>
                )}
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '8px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 50,
                    overflow: 'hidden',
                    maxHeight: '400px',
                    overflowY: 'auto',
                }}>
                    {/* Category tabs (only show when typing) */}
                    {!isShowingHistory && (
                        <div style={{
                            display: 'flex',
                            borderBottom: '1px solid var(--border)',
                            padding: '4px',
                        }}>
                            {(['all', 'title', 'company', 'location'] as const).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '12px',
                                        border: 'none',
                                        background: activeCategory === cat ? 'var(--accent-muted)' : 'transparent',
                                        color: activeCategory === cat ? 'var(--accent)' : 'var(--text-secondary)',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: activeCategory === cat ? 600 : 400,
                                        textTransform: 'capitalize',
                                    }}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Loading state */}
                    {isLoading && !isShowingHistory && (
                        <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: 'var(--text-tertiary)',
                            fontSize: '13px',
                        }}>
                            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: '8px' }} />
                            Loading suggestions...
                        </div>
                    )}

                    {/* History header */}
                    {isShowingHistory && history.length > 0 && (
                        <div style={{
                            padding: '8px 12px',
                            fontSize: '11px',
                            color: 'var(--text-tertiary)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px'
                        }}>
                            Recent Searches
                        </div>
                    )}

                    {/* Suggestions list */}
                    {!isLoading && displayedItems.length > 0 && (
                        displayedItems.map((item, index) => (
                            <div
                                key={index}
                                onClick={() => performSearch(item.text)}
                                onMouseEnter={() => setSelectedIndex(index)}
                                style={{
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '10px 14px',
                                    background: index === selectedIndex ? 'var(--surface-hover)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    fontSize: '14px',
                                    color: 'var(--text-primary)',
                                    transition: 'background 0.1s',
                                    position: 'relative'
                                }}
                            >
                                {isShowingHistory ? (
                                    <HistoryIcon size={14} style={{ color: 'var(--text-tertiary)' }} />
                                ) : (
                                    <span style={{ fontSize: '14px' }}>{getCategoryIcon(item.type)}</span>
                                )}

                                <span style={{ flex: 1 }}>{item.text}</span>

                                {!isShowingHistory && (
                                    <span style={{
                                        fontSize: '11px',
                                        color: 'var(--text-tertiary)',
                                        textTransform: 'capitalize',
                                        background: 'var(--surface-hover)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                    }}>
                                        {item.type}
                                    </span>
                                )}

                                {isShowingHistory && (
                                    <button
                                        onClick={(e) => deleteHistoryItem(item.text, e)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: '4px',
                                            cursor: 'pointer',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--text-tertiary)'
                                        }}
                                        className="history-delete-btn"
                                        title="Remove from history"
                                    >
                                        <X size={14} />
                                    </button>
                                )}

                                {!isShowingHistory && (
                                    <ArrowUpLeft
                                        size={12}
                                        style={{
                                            opacity: index === selectedIndex ? 0.5 : 0,
                                            color: 'var(--text-tertiary)'
                                        }}
                                    />
                                )}
                            </div>
                        ))
                    )}

                    {/* No suggestions state */}
                    {!isLoading && !isShowingHistory && displayedItems.length === 0 && localQuery.length >= 2 && (
                        <div style={{
                            padding: '20px',
                            textAlign: 'center',
                        }}>
                            <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', marginBottom: '12px' }}>
                                No suggestions found
                            </div>
                            <button
                                onClick={() => performSearch(localQuery)}
                                style={{
                                    padding: '8px 16px',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '20px',
                                    fontSize: '13px',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    boxShadow: 'var(--shadow-sm)',
                                    transition: 'transform 0.1s, box-shadow 0.1s',
                                }}
                                className="see-results-btn"
                            >
                                <Search size={14} />
                                See results for "{localQuery}"
                            </button>
                        </div>
                    )}
                </div>
            )}

            <style jsx>{`
                .search-input:focus {
                    border-color: var(--accent);
                    box-shadow: 0 0 0 3px var(--accent-muted);
                }
                .history-delete-btn:hover {
                    background: var(--surface-hover);
                    color: var(--error);
                }
                .see-results-btn:hover {
                    transform: scale(1.02);
                    box-shadow: var(--shadow-md);
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
