'use client';

import React, { createContext, useContext, useCallback, useEffect, useState, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import type { Job } from '@/types';

const LOCAL_STORAGE_KEY = 'aladdin.jobFilters';
const MAX_FILTERS = 20;
const DEBOUNCE_MS = 300;

export type FilterType = 'all' | 'title' | 'company' | 'location' | 'skills';

export interface FilterWithType {
    type: FilterType;
    value: string;
}

export function parseFilterWithType(filter: string): FilterWithType {
    const colonIndex = filter.indexOf(':');
    if (colonIndex === -1) {
        return { type: 'all', value: filter };
    }
    
    const type = filter.substring(0, colonIndex).toLowerCase() as FilterType;
    const value = filter.substring(colonIndex + 1).trim();
    
    const validTypes: FilterType[] = ['all', 'title', 'company', 'location', 'skills'];
    if (!validTypes.includes(type)) {
        return { type: 'all', value: filter };
    }
    
    return { type, value };
}

export function formatFilterWithType(filter: FilterWithType): string {
    if (filter.type === 'all') {
        return filter.value;
    }
    return `${filter.type}:${filter.value}`;
}

export const FILTER_TYPE_OPTIONS: { value: FilterType; label: string; placeholder: string }[] = [
    { value: 'all', label: 'All Fields', placeholder: 'Enter to save the tag' },
    { value: 'title', label: 'Job Title', placeholder: 'Search job titles...' },
    { value: 'company', label: 'Company', placeholder: 'Search company names...' },
    { value: 'location', label: 'Location', placeholder: 'Search locations...' },
    { value: 'skills', label: 'Skills', placeholder: 'Search skills...' },
];

interface FilterData {
    filters: string[];
    updatedAt: string;
}

export type MatchField = 'title' | 'company' | 'location' | 'skills' | 'description';

export interface JobMatchResult {
    matches: boolean;
    matchedFields: MatchField[];
    filterTypes: FilterType[];
}

interface FilterContextValue {
    activeFilters: string[];
    filterSource: 'url' | 'server' | 'local' | 'none';
    isLoading: boolean;
    isSaving: boolean;
    addFilter: (tag: string, type?: FilterType) => void;
    removeFilter: (tag: string) => void;
    clearFilters: () => void;
    setFilters: (filters: string[]) => void;
    applyFilters: (filters: string[]) => Promise<void>;
    jobMatchesFilters: (jobText: string, filters: string[]) => boolean;
    checkJobMatch: (job: Job, filters: string[]) => JobMatchResult;
}

const FilterContext = createContext<FilterContextValue | null>(null);

function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function jobMatchesFilters(jobText: string, filters: string[]): boolean {
    if (!filters || filters.length === 0) return true;
    if (!jobText) return true;
    
    const text = jobText.toLowerCase();
    
    return filters.every(f => {
        const trimmed = f.trim();
        if (!trimmed) return true;
        
        const isPhrase = trimmed.startsWith('"') && trimmed.endsWith('"');
        const normalized = isPhrase ? trimmed.slice(1, -1).toLowerCase() : trimmed.toLowerCase();
        
        if (!normalized) return true;
        
        if (isPhrase || normalized.includes(' ')) {
            return text.includes(normalized);
        }
        
        const regex = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, 'i');
        return regex.test(text);
    });
}

function matchTermInText(text: string, term: string): boolean {
    if (!text || !term) return false;
    
    const isPhrase = term.startsWith('"') && term.endsWith('"');
    const normalized = isPhrase ? term.slice(1, -1).toLowerCase() : term.toLowerCase();
    
    if (!normalized) return false;
    
    const textLower = text.toLowerCase();
    
    if (isPhrase || normalized.includes(' ')) {
        return textLower.includes(normalized);
    }
    
    const regex = new RegExp(`\\b${escapeRegExp(normalized)}\\b`, 'i');
    return regex.test(textLower);
}

export function checkJobMatchFields(job: Job, filters: string[]): JobMatchResult {
    if (!filters || filters.length === 0) {
        return { matches: true, matchedFields: [], filterTypes: [] };
    }
    
    const matchedFields: MatchField[] = [];
    const filterTypes: FilterType[] = [];
    
    for (const filter of filters) {
        const { type: filterType, value: filterValue } = parseFilterWithType(filter);
        
        if (!filterValue) continue;
        
        filterTypes.push(filterType);
        
        let matched = false;
        
        const checkAndAddField = (fieldName: MatchField, fieldValue: string): boolean => {
            if (!fieldValue) return false;
            if (matchTermInText(fieldValue, filterValue)) {
                if (!matchedFields.includes(fieldName)) matchedFields.push(fieldName);
                return true;
            }
            return false;
        };
        
        if (filterType === 'all' || filterType === 'title') {
            if (checkAndAddField('title', job.title || '')) matched = true;
        }
        
        if (filterType === 'all' || filterType === 'company') {
            if (checkAndAddField('company', job.company || '')) matched = true;
        }
        
        if (filterType === 'all' || filterType === 'location') {
            if (checkAndAddField('location', job.location || '')) matched = true;
        }
        
        if (filterType === 'all' || filterType === 'skills') {
            if (job.matched_skills && job.matched_skills.length > 0) {
                const skillsText = job.matched_skills.join(' ').toLowerCase();
                if (matchTermInText(skillsText, filterValue)) {
                    if (!matchedFields.includes('skills')) matchedFields.push('skills');
                    matched = true;
                }
            }
            
            if (!matched || filterType === 'all') {
                const descriptionText = [
                    job.raw_text_summary,
                    job.normalized_text,
                    job.job_description_plain
                ].filter(Boolean).join(' ').toLowerCase();
                
                if (matchTermInText(descriptionText, filterValue)) {
                    if (!matchedFields.includes('description')) matchedFields.push('description');
                    matched = true;
                }
            }
        }
        
        if (!matched) {
            return { matches: false, matchedFields: [], filterTypes: [] };
        }
    }
    
    return { 
        matches: matchedFields.length > 0, 
        matchedFields,
        filterTypes 
    };
}

function loadFromLocalStorage(): FilterData | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (!stored) return null;
        return JSON.parse(stored) as FilterData;
    } catch {
        return null;
    }
}

function saveToLocalStorage(filters: string[]): void {
    if (typeof window === 'undefined') return;
    try {
        const data: FilterData = {
            filters,
            updatedAt: new Date().toISOString()
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.error('[FilterContext] Failed to save to localStorage:', e);
    }
}

async function fetchServerFilters(): Promise<string[]> {
    try {
        const res = await fetch('/api/user/preferences');
        if (!res.ok) return [];
        const data = await res.json();
        return data.filters || [];
    } catch {
        return [];
    }
}

async function saveServerFilters(filters: string[]): Promise<boolean> {
    try {
        const res = await fetch('/api/user/preferences/filters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filters })
        });
        return res.ok;
    } catch {
        return false;
    }
}

export function FilterProvider({ children }: { children: React.ReactNode }) {
    const { isSignedIn, isLoaded } = useAuth();
    const searchParams = useSearchParams();
    
    const [activeFilters, setActiveFilters] = useState<string[]>([]);
    const [filterSource, setFilterSource] = useState<'url' | 'server' | 'local' | 'none'>('none');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    const urlFilters = useMemo(() => {
        const filtersParam = searchParams?.get('filters');
        if (!filtersParam) return null;
        return filtersParam.split(',').map(f => f.trim().toLowerCase()).filter(Boolean);
    }, [searchParams]);

    useEffect(() => {
        if (!isLoaded || isInitialized) return;
        
        const initFilters = async () => {
            setIsLoading(true);
            
            try {
                if (urlFilters && urlFilters.length > 0) {
                    setActiveFilters(urlFilters);
                    setFilterSource('url');
                    saveToLocalStorage(urlFilters);
                    setIsInitialized(true);
                    setIsLoading(false);
                    return;
                }
                
                let serverFilters: string[] = [];
                if (isSignedIn) {
                    serverFilters = await fetchServerFilters();
                }
                
                const localData = loadFromLocalStorage();
                const localFilters = localData?.filters || [];
                
                if (isSignedIn && serverFilters.length > 0) {
                    setActiveFilters(serverFilters);
                    setFilterSource('server');
                    saveToLocalStorage(serverFilters);
                } else if (localFilters.length > 0) {
                    setActiveFilters(localFilters);
                    setFilterSource('local');
                } else {
                    setActiveFilters([]);
                    setFilterSource('none');
                }
            } catch (e) {
                console.error('[FilterContext] Failed to initialize filters:', e);
                const localData = loadFromLocalStorage();
                if (localData?.filters) {
                    setActiveFilters(localData.filters);
                    setFilterSource('local');
                }
            } finally {
                setIsLoading(false);
                setIsInitialized(true);
            }
        };
        
        initFilters();
    }, [isLoaded, isSignedIn, urlFilters, isInitialized]);

    const debouncedSave = useCallback((filters: string[]) => {
        if (saveTimeout) {
            clearTimeout(saveTimeout);
        }
        
        const timeout = setTimeout(async () => {
            saveToLocalStorage(filters);
            
            if (isSignedIn) {
                setIsSaving(true);
                const success = await saveServerFilters(filters);
                if (!success) {
                    console.warn('[FilterContext] Failed to save filters to server');
                }
                setIsSaving(false);
            }
        }, DEBOUNCE_MS);
        
        setSaveTimeout(timeout);
    }, [isSignedIn, saveTimeout]);

    const addFilter = useCallback((tag: string) => {
        const normalized = tag.trim().toLowerCase();
        if (!normalized || activeFilters.includes(normalized)) return;
        if (activeFilters.length >= MAX_FILTERS) {
            console.warn('[FilterContext] Max filters reached');
            return;
        }
        
        const newFilters = [...activeFilters, normalized];
        setActiveFilters(newFilters);
        setFilterSource('local');
        debouncedSave(newFilters);
        
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('filters', newFilters.join(','));
            window.history.pushState({}, '', url.toString());
        }
    }, [activeFilters, debouncedSave]);

    const removeFilter = useCallback((tag: string) => {
        const normalized = tag.trim().toLowerCase();
        const newFilters = activeFilters.filter(f => f !== normalized);
        setActiveFilters(newFilters);
        setFilterSource('local');
        debouncedSave(newFilters);
        
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (newFilters.length > 0) {
                url.searchParams.set('filters', newFilters.join(','));
            } else {
                url.searchParams.delete('filters');
            }
            window.history.pushState({}, '', url.toString());
        }
    }, [activeFilters, debouncedSave]);

    const clearFilters = useCallback(() => {
        setActiveFilters([]);
        setFilterSource('none');
        
        if (typeof window !== 'undefined') {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
            const url = new URL(window.location.href);
            url.searchParams.delete('filters');
            window.history.pushState({}, '', url.toString());
        }
        
        if (isSignedIn) {
            saveServerFilters([]);
        }
    }, [isSignedIn]);

    const setFilters = useCallback((filters: string[]) => {
        const normalized = Array.from(new Set(
            filters.map(f => f.trim().toLowerCase()).filter(Boolean)
        )).slice(0, MAX_FILTERS);
        
        setActiveFilters(normalized);
        setFilterSource('local');
        debouncedSave(normalized);
        
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (normalized.length > 0) {
                url.searchParams.set('filters', normalized.join(','));
            } else {
                url.searchParams.delete('filters');
            }
            window.history.pushState({}, '', url.toString());
        }
    }, [debouncedSave]);

    const applyFilters = useCallback(async (filters: string[]) => {
        const normalized = Array.from(new Set(
            filters.map(f => f.trim().toLowerCase()).filter(Boolean)
        )).slice(0, MAX_FILTERS);
        
        setActiveFilters(normalized);
        setFilterSource('local');
        
        saveToLocalStorage(normalized);
        
        if (isSignedIn) {
            setIsSaving(true);
            await saveServerFilters(normalized);
            setIsSaving(false);
        }
        
        const url = new URL(window.location.href);
        if (normalized.length > 0) {
            url.searchParams.set('filters', normalized.join(','));
        } else {
            url.searchParams.delete('filters');
        }
        window.history.pushState({}, '', url.toString());
    }, [isSignedIn]);

    const checkJobMatch = useCallback((job: Job, filters: string[]) => {
        return checkJobMatchFields(job, filters);
    }, []);

    const value = useMemo(() => ({
        activeFilters,
        filterSource,
        isLoading,
        isSaving,
        addFilter,
        removeFilter,
        clearFilters,
        setFilters,
        applyFilters,
        jobMatchesFilters,
        checkJobMatch
    }), [
        activeFilters,
        filterSource,
        isLoading,
        isSaving,
        addFilter,
        removeFilter,
        clearFilters,
        setFilters,
        applyFilters,
        checkJobMatch
    ]);

    return (
        <FilterContext.Provider value={value}>
            {children}
        </FilterContext.Provider>
    );
}

export function useFilters() {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error('useFilters must be used within a FilterProvider');
    }
    return context;
}

export function useFilteredJobs(jobs: import('@/types').Job[]) {
    const { activeFilters, jobMatchesFilters: matchesFilters } = useFilters();
    
    return useMemo(() => {
        if (activeFilters.length === 0) return jobs;
        
        return jobs.filter(job => {
            const searchableText = [
                job.title,
                job.company,
                job.location,
                job.job_description_plain,
                job.raw_text_summary,
                job.normalized_text
            ].filter(Boolean).join(' ').toLowerCase();
            
            return matchesFilters(searchableText, activeFilters);
        });
    }, [jobs, activeFilters, matchesFilters]);
}
