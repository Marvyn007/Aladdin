'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowLeft, History as HistoryIcon, ArrowUpLeft } from 'lucide-react';
import { useStore, useStoreActions } from '@/store/useStore';
import { getSearchSuggestions, type SearchSuggestions } from '@/actions/search';

const HISTORY_KEY = 'aladdin_search_history';
const MAX_HISTORY_ITEMS = 5;

// Simple debounce hook for search queries
function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export function SearchBar() {
    const [localQuery, setLocalQuery] = useState('');
    const debouncedQuery = useDebounce(localQuery, 300);

    // Server-side suggestions
    const [serverSuggestions, setServerSuggestions] = useState<SearchSuggestions>({ history: [], jobs: [] });
    // Combined list for display
    const [suggestions, setSuggestions] = useState<string[]>([]);

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
    const jobs = useStore(state => state.jobs);
    const { performServerSearch, exitSearchMode, clearSearchResults } = useStoreActions();

    const [autofillText, setAutofillText] = useState<string | null>(null);
    const [autofillType, setAutofillType] = useState<string | null>(null);

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

    // Fetch suggestions when debounced query changes
    useEffect(() => {
<<<<<<< Updated upstream
        if (!localQuery.trim() || localQuery.length < 2) {
            setSuggestions([]);
            setAutofillText(null);
            setAutofillType(null);
            return;
        }
        const lower = localQuery.toLowerCase();
        const matches = allPhrases
            .filter(p => p.includes(lower))
            .sort((a, b) => {
                const aStart = a.startsWith(lower) ? 0 : 1;
                const bStart = b.startsWith(lower) ? 0 : 1;
                if (aStart !== bStart) return aStart - bStart;
                return a.length - b.length;
            })
            .slice(0, 6);

        setSuggestions(matches);
        setSelectedIndex(-1); // Reset selection on query change

        // precise autofill logic
        if (matches.length > 0 && matches[0].toLowerCase().startsWith(lower)) {
            setAutofillText(matches[0]);
            setAutofillType('phrase');
        } else {
            setAutofillText(null);
            setAutofillType(null);
        }
    }, [localQuery, allPhrases]);
=======
        const fetchSuggestions = async () => {
            if (!debouncedQuery.trim() || debouncedQuery.length < 2) {
                setServerSuggestions({ history: [], jobs: [] });
                setSuggestions([]);
                return;
            }

            try {
                const data = await getSearchSuggestions(debouncedQuery);
                setServerSuggestions(data);

                // Combine history (common searches) and job suggestions
                // Unique set to avoid duplicates
                const combined = Array.from(new Set([...data.history, ...data.jobs]));
                setSuggestions(combined.slice(0, 8)); // Limit total display
                setSelectedIndex(-1);
            } catch (error) {
                console.error("Failed to fetch suggestions", error);
            }
        };

        fetchSuggestions();
    }, [debouncedQuery]);
>>>>>>> Stashed changes

    // Determine what to show in dropdown
    const displayedItems = localQuery.length < 2 ? history : suggestions;
    const isShowingHistory = localQuery.length < 2;

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
                    performSearch(displayedItems[selectedIndex]);
                } else {
                    performSearch(localQuery);
                }
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        };

        return (
            <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: '600px' }}>
                <div style={{ position: 'relative' }}>
                    {searchMode ? (
                        <button
                            onClick={() => window.location.reload()}
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
                        style={{
                            width: '100%',
                            padding: '10px 12px 10px 40px',
                            fontSize: '14px',
                            borderRadius: '24px',
                            border: '1px solid var(--border)',
                            background: 'var(--surface)',
                            color: 'var(--text-primary)',
                            outline: 'none',
                            transition: 'box-shadow 0.2s, border-color 0.2s'
                        }}
                        className="search-input"
                    />

                    {localQuery && (
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                color: 'var(--text-tertiary)',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                {/* Suggestions Dropdown */}
                {showSuggestions && displayedItems.length > 0 && (
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
                    }}>
                        {isShowingHistory && (
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

                        {displayedItems.map((item, index) => (
                            <div
                                key={index}
                                onClick={() => performSearch(item)}
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
                                    <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
                                )}

                                <span style={{ flex: 1 }}>{item}</span>

                                {isShowingHistory && (
                                    <button
                                        onClick={(e) => deleteHistoryItem(item, e)}
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
                        ))}
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
