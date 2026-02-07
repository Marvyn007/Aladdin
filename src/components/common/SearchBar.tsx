'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, ArrowLeft, History as HistoryIcon, ArrowUpLeft, Loader2, TrendingUp, Sparkles } from 'lucide-react';
import { useStore, useStoreActions } from '@/store/useStore';
import type { SmartSuggestionResponse, SmartSuggestion } from '@/lib/search/types';

const HISTORY_KEY = 'aladdin_search_history';
const MAX_HISTORY_ITEMS = 5;
const SUGGESTION_DEBOUNCE_MS = 150;

export function SearchBar() {
    const [localQuery, setLocalQuery] = useState('');
    const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
    const [trending, setTrending] = useState<Array<{ text: string; type: string; count: number }>>([]);
    const [autofillText, setAutofillText] = useState<string | null>(null);
    const [autofillType, setAutofillType] = useState<'title' | 'company' | 'location' | null>(null);
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

    // Fetch smart suggestions from API
    const fetchSuggestions = useCallback(async (query: string) => {
        if (!query.trim() || query.length < 2) {
            setSuggestions([]);
            setAutofillText(null);
            return;
        }

        setIsLoading(true);
        try {
            const response = await fetch(`/api/search/smart-suggestions?query=${encodeURIComponent(query)}&type=${activeCategory}&limit=20`);
            if (response.ok) {
                const data: SmartSuggestionResponse = await response.json();
                setSuggestions(data.suggestions);
                setTrending(data.trending);
                // Set autofill to best match if query is a prefix of it
                if (data.autofill && data.autofill.toLowerCase().startsWith(query.toLowerCase())) {
                    setAutofillText(data.autofill);
                    setAutofillType(data.autofillType);
                } else {
                    setAutofillText(null);
                    setAutofillType(null);
                }
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
            setSuggestions([]);
            setAutofillText(null);
            setAutofillType(null);
        }

        setSelectedIndex(-1);

        return () => {
            if (suggestionTimeoutRef.current) {
                clearTimeout(suggestionTimeoutRef.current);
            }
        };
    }, [localQuery, fetchSuggestions]);

    const getDisplayedItems = () => {
        if (localQuery.length < 2) {
            // Show trending searches when query is empty
            if (trending.length > 0) {
                return trending.map((t: { text: string; type: string }) => ({ 
                    text: t.text, 
                    type: 'title' as const,
                    isPopular: true,
                    isExactMatch: false,
                    matchCount: 0
                }));
            }
            return history.map(h => ({ 
                text: h, 
                type: 'title' as const,
                isPopular: false,
                isExactMatch: false,
                matchCount: 0
            }));
        }
        return suggestions;
    };

    const displayedItems = getDisplayedItems();
    const isShowingHistory = localQuery.length < 2 && trending.length === 0;

    const performSearch = async (term: string) => {
        if (!term.trim()) return;

        setShowSuggestions(false);
        setLocalQuery(term);
        setAutofillText(null);
        setAutofillType(null);
        inputRef.current?.blur();

        saveToHistory(term);
        
        // Track search analytics
        try {
            await fetch('/api/search/smart-suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: term,
                    userId: null, // Will be handled by auth context if available
                    resultsCount: null // Will be updated after search completes
                })
            });
        } catch (error) {
            // Silent fail - analytics tracking should not break search
            console.log('Analytics tracking failed:', error);
        }
        
        await performServerSearch(term);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            setShowSuggestions(false);
            return;
        }

        // Tab key for autofill
        if (e.key === 'Tab' && !e.shiftKey && autofillText && localQuery.length >= 2) {
            e.preventDefault();
            performSearch(autofillText);
            return;
        }

        if (!showSuggestions) {
            if (e.key === 'Enter') {
                performSearch(localQuery);
            }
            return;
        }

        const displayedItems = getDisplayedItems();
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

    const getCategoryColor = (type: 'title' | 'company' | 'location') => {
        switch (type) {
            case 'title': return '#3b82f6'; // Blue
            case 'company': return '#10b981'; // Green
            case 'location': return '#f59e0b'; // Orange/amber
            default: return '#6b7280'; // Gray
        }
    };

    const getCategoryLabel = (type: 'title' | 'company' | 'location') => {
        switch (type) {
            case 'title': return 'Title';
            case 'company': return 'Company';
            case 'location': return 'Location';
            default: return 'Search';
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
                            alignItems: 'center',
                            zIndex: 2
                        }}
                    >
                        <ArrowLeft size={18} />
                    </button>
                ) : (
                    <Search
                        size={18}
                        style={{ 
                            position: 'absolute', 
                            left: '12px', 
                            top: '50%', 
                            transform: 'translateY(-50%)', 
                            color: 'var(--text-tertiary)',
                            zIndex: 2,
                            pointerEvents: 'none'
                        }}
                    />
                )}

                {/* Autofill display layer with color coding */}
                {autofillText && localQuery.length >= 2 && (
                    <div style={{
                        position: 'absolute',
                        left: '40px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        fontSize: '14px',
                        color: 'var(--text-tertiary)',
                        pointerEvents: 'none',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 'calc(100% - 80px)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                    }}>
                        <span style={{ opacity: 0 }}>{localQuery}</span>
                        <span>{autofillText.slice(localQuery.length)}</span>
                        {autofillType && (
                            <div
                                style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: getCategoryColor(autofillType),
                                    flexShrink: 0,
                                    marginLeft: '4px'
                                }}
                                title={getCategoryLabel(autofillType)}
                            />
                        )}
                    </div>
                )}

                <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search by title, company, or location (Tab to autofill)"
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
                        position: 'relative',
                        zIndex: 1,
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
                    maxHeight: '500px',
                    display: 'flex',
                    flexDirection: 'column',
                }}>
                    <div style={{
                        overflowY: 'auto',
                        maxHeight: '500px',
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

                    {/* History/Trending header */}
                    {isShowingHistory && (
                        <div style={{
                            padding: '8px 12px',
                            fontSize: '11px',
                            color: 'var(--text-tertiary)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.5px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}>
                            {trending.length > 0 ? (
                                <><TrendingUp size={12} /> Trending Searches</>
                            ) : (
                                <><HistoryIcon size={12} /> Recent Searches</>
                            )}
                        </div>
                    )}

                    {/* Suggestions list */}
                    {!isLoading && displayedItems.length > 0 && (
                        displayedItems.map((item: { text: string; type: 'title' | 'company' | 'location'; isPopular?: boolean; matchCount?: number; isExactMatch?: boolean }, index: number) => (
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
                                    item.isPopular ? (
                                        <TrendingUp size={14} style={{ color: 'var(--accent)' }} />
                                    ) : (
                                        <HistoryIcon size={14} style={{ color: 'var(--text-tertiary)' }} />
                                    )
                                ) : (
                                    <div
                                        style={{
                                            width: '8px',
                                            height: '8px',
                                            borderRadius: '50%',
                                            backgroundColor: getCategoryColor(item.type),
                                            flexShrink: 0
                                        }}
                                        title={getCategoryLabel(item.type)}
                                    />
                                )}

                                <span style={{ flex: 1 }}>
                                    {localQuery.length >= 2 && item.text.toLowerCase().startsWith(localQuery.toLowerCase()) ? (
                                        <>
                                            <span style={{ fontWeight: 600 }}>{item.text.slice(0, localQuery.length)}</span>
                                            <span>{item.text.slice(localQuery.length)}</span>
                                        </>
                                    ) : (
                                        item.text
                                    )}
                                </span>

                                {/* Popular badge */}
                                {item.isPopular && !isShowingHistory && (
                                    <span style={{
                                        fontSize: '10px',
                                        color: 'var(--accent)',
                                        background: 'var(--accent-muted)',
                                        padding: '2px 6px',
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '2px',
                                        fontWeight: 600
                                    }}>
                                        <Sparkles size={10} />
                                        Popular
                                    </span>
                                )}

                                {/* Match count */}
                                {!isShowingHistory && item.matchCount && item.matchCount > 0 && (
                                    <span style={{
                                        fontSize: '11px',
                                        color: 'var(--text-tertiary)',
                                        background: 'var(--surface-hover)',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                    }}>
                                        {item.matchCount} jobs
                                    </span>
                                )}

                                {/* Exact match badge */}
                                {!isShowingHistory && 'isExactMatch' in item && item.isExactMatch && (
                                    <span style={{
                                        fontSize: '10px',
                                        color: '#fff',
                                        background: getCategoryColor(item.type),
                                        padding: '2px 6px',
                                        borderRadius: '10px',
                                        fontWeight: 600
                                    }}>
                                        Exact
                                    </span>
                                )}

                                {/* Category badge */}
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

                                {isShowingHistory && !item.isPopular && (
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
