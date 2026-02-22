// Global state management with Zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { Job, Resume, LinkedInProfile, Application, FilterState } from '@/types';

interface AppState {
    // Theme
    theme: 'light' | 'dark';
    themeId: string; // ID from predefined themes

    // Jobs
    jobs: Job[];
    jobStatus: import('@/types').JobStatus;
    selectedJob: Job | null;
    isLoadingJobs: boolean;
    lastUpdated: string | null;

    // Resumes
    resumes: Resume[];
    defaultResume: Resume | null;

    // LinkedIn
    linkedInProfile: LinkedInProfile | null;

    // Applications (Kanban)
    applications: Application[];

    // Filters
    filters: FilterState;
    freshLimit: number;
    excludedKeywords?: string[];

    // Search State
    searchMode: boolean;
    searchQuery: string;
    searchResults: Job[];
    searchSuggestions: string[];

    // Pagination & Sorting
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
    sorting: {
        by: 'time' | 'imported' | 'score' | 'relevance';
        dir: 'asc' | 'desc';
    };

    // UI State
    sidebarOpen: boolean;
    viewMode: 'list' | 'map';
    activeModal: 'cover-letter' | 'resume-selector' | 'linkedin-selector' | 'import-job' | 'import-job-selection' | 'import-job-manual' | 'import-job-auto' | null;

    // Actions
    setTheme: (theme: 'light' | 'dark') => void;
    toggleTheme: () => void;
    setThemeId: (id: string) => void;
    setJobs: (jobs: Job[]) => void;
    setJobStatus: (status: import('@/types').JobStatus) => void;
    setSelectedJob: (job: Job | null) => void;
    setIsLoadingJobs: (loading: boolean) => void;
    setLastUpdated: (time: string | null) => void;
    setResumes: (resumes: Resume[]) => void;
    setDefaultResume: (resume: Resume | null) => void;
    setLinkedInProfile: (profile: LinkedInProfile | null) => void;
    setApplications: (applications: Application[]) => void;
    addApplication: (application: Application) => void;
    updateApplication: (id: string, updates: Partial<Application>) => void;
    removeApplication: (id: string) => void;
    addImportedJob: (job: Job) => void;
    setFilters: (filters: Partial<FilterState>) => void;
    setFreshLimit: (limit: number) => void;
    toggleSidebar: () => void;
    setViewMode: (mode: 'list' | 'map') => void;
    setActiveModal: (modal: AppState['activeModal']) => void;
    toggleJobStatus: (jobId: string, status: import('@/types').JobStatus) => Promise<void>;

    // Settings
    loadSettings: () => Promise<void>;
    updateExcludedKeywords: (keywords: string[]) => Promise<void>;
    updateThemeId: (id: string) => Promise<void>; // Deprecated: Use saveThemeSettings
    saveThemeSettings: (mode: 'light' | 'dark', themeId: string) => Promise<void>;
    resetTheme: () => void;

    // Pagination & Sorting Actions
    setPagination: (pagination: Partial<AppState['pagination']>) => void;

    setSorting: (sorting: Partial<AppState['sorting']>) => void;

    // Search Actions
    enterSearchMode: (query: string) => void;
    exitSearchMode: () => void;
    setSearchQuery: (query: string) => void;
    performServerSearch: (query: string, page?: number) => Promise<void>;
    clearSearchResults: () => void;

    // Cookie Persistence
    initializeFilters: () => void;
}

const COOKIES_KEY = 'job_filter_tags';

// Helper to set cookie
const setTagsCookie = (tags: string[]) => {
    if (typeof document === 'undefined') return;
    const value = JSON.stringify(tags);
    const date = new Date();
    date.setTime(date.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
    document.cookie = `${COOKIES_KEY}=${encodeURIComponent(value)}; expires=${date.toUTCString()}; path=/`;
};

// Helper to get cookie
const getTagsCookie = (): string[] => {
    if (typeof document === 'undefined') return [];
    try {
        const matches = document.cookie.match(new RegExp(
            "(?:^|; )" + COOKIES_KEY.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"
        ));
        return matches ? JSON.parse(decodeURIComponent(matches[1])) : [];
    } catch (e) {
        console.error('Failed to parse tags cookie', e);
        return [];
    }
};

export const useStore = create<AppState>()(
    persist(
        (set, get) => ({
            // Initial state
            theme: 'light',
            themeId: 'aladdin',
            jobs: [],
            jobStatus: 'fresh',
            selectedJob: null,
            isLoadingJobs: false,
            lastUpdated: null,
            resumes: [],
            defaultResume: null,
            linkedInProfile: null,
            applications: [],
            filters: {
                location: '',
                remoteOnly: false,
                techTags: [],
            },
            freshLimit: 300,

            excludedKeywords: [],

            // Initial Search State
            searchMode: false,
            searchQuery: '',
            searchResults: [],
            searchSuggestions: [],

            // Initial Pagination & Sorting
            pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
            sorting: { by: 'relevance', dir: 'desc' },

            sidebarOpen: true,
            viewMode: 'list',
            activeModal: null,

            // Actions
            setTheme: (theme) => set({ theme }),
            setThemeId: (id) => set({ themeId: id }),

            toggleTheme: () => set((state) => ({
                theme: state.theme === 'light' ? 'dark' : 'light'
            })),


            setJobs: (jobs) => set({ jobs }),

            setJobStatus: (status) => set({ jobStatus: status }),

            setSelectedJob: (job) => set({ selectedJob: job }),

            setIsLoadingJobs: (loading) => set({ isLoadingJobs: loading }),

            setLastUpdated: (time) => set({ lastUpdated: time }),

            setResumes: (resumes) => set({ resumes }),

            setDefaultResume: (resume) => set({ defaultResume: resume }),

            setLinkedInProfile: (profile) => set({ linkedInProfile: profile }),

            setApplications: (applications) => set({ applications }),

            addApplication: (application) =>
                set((state) => ({ applications: [...state.applications, application] })),

            updateApplication: (id, updates) =>
                set((state) => ({
                    applications: state.applications.map((app) =>
                        app.id === id ? { ...app, ...updates } : app
                    ),
                })),

            removeApplication: (id) =>
                set((state) => ({
                    applications: state.applications.filter((app) => app.id !== id),
                })),

            addImportedJob: (job) =>
                set((state) => ({
                    jobs: [job, ...state.jobs],
                })),

            setFilters: (filters) =>
                set((state) => {
                    const newFilters = { ...state.filters, ...filters };
                    // Persist tags to cookie if they changed
                    if (filters.techTags) {
                        setTagsCookie(newFilters.techTags);
                    }
                    return { filters: newFilters };
                }),

            setFreshLimit: (limit) => set({ freshLimit: limit }),

            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

            setViewMode: (mode) => set({ viewMode: mode }),

            setActiveModal: (modal) => set({ activeModal: modal }),

            toggleJobStatus: async (jobId, status) => {
                // Optimistic update
                set((state) => ({
                    jobs: state.jobs.map(j => j.id === jobId ? { ...j, status } : j),
                    selectedJob: state.selectedJob?.id === jobId ? { ...state.selectedJob, status } : state.selectedJob
                }));

                // Call server action
                try {
                    const { toggleJobStatusAction } = await import('@/lib/actions');
                    await toggleJobStatusAction(jobId, status);
                } catch (e) {
                    // Revert? For now assume success or reload.
                }
            },

            loadSettings: async () => {
                console.log('[DEBUG-THEME] loadSettings called');
                try {
                    console.log('[DEBUG-THEME] Fetching settings from API...');
                    const res = await fetch('/api/settings');

                    if (!res.ok) {
                        throw new Error(`API Error: ${res.status}`);
                    }

                    const settings = await res.json();
                    console.log('[DEBUG-THEME] loadSettings response received:', settings);

                    // Apply theme preferences if they exist
                    if (settings.themePreferences) {
                        const currentTheme = get().theme;
                        const currentThemeId = get().themeId;

                        // Only update if different to avoid unnecessary re-renders
                        if (settings.themePreferences.themeId && settings.themePreferences.themeId !== currentThemeId) {
                            console.log(`[DEBUG-THEME] Applying new themeId: ${settings.themePreferences.themeId} (was ${currentThemeId})`);
                            set({ themeId: settings.themePreferences.themeId });
                        }

                        if (settings.themePreferences.mode && settings.themePreferences.mode !== currentTheme) {
                            console.log(`[DEBUG-THEME] Applying new theme mode: ${settings.themePreferences.mode} (was ${currentTheme})`);
                            set({ theme: settings.themePreferences.mode });
                        }
                    } else {
                        console.log('[DEBUG-THEME] No themePreferences found in settings, keeping local state');
                    }

                    set({
                        freshLimit: settings.freshLimit || 300,
                        excludedKeywords: settings.excludedKeywords || [],
                    });
                } catch (e) {
                    console.error('[DEBUG-THEME] Failed to load settings, using local fallback', e);
                    // On failure, we implicitly trust the persisted local state
                }
            },

            updateExcludedKeywords: async (keywords) => {
                // Update local state immediately (optimistic update)
                set({ excludedKeywords: keywords });

                // Persist to database
                try {
                    await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ excludedKeywords: keywords })
                    });
                } catch (e) {
                    console.error('Failed to save keywords', e);
                }
            },

            updateThemeId: async (id) => {
                set({ themeId: id });
                try {
                    await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            themePreferences: { themeId: id } // backwards compat structure
                        })
                    });
                } catch (e) {
                    console.error('Failed to save theme', e);
                }
            },

            saveThemeSettings: async (mode, themeId) => {
                console.log('[DEBUG-THEME] saveThemeSettings calling API:', { mode, themeId });

                // Optimistic update
                set({ theme: mode, themeId: themeId });
                console.log('[DEBUG-THEME] Optimistically updated local state');

                try {
                    await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            themePreferences: { mode, themeId }
                        })
                    });
                    console.log('[DEBUG-THEME] saveThemeSettings API success');
                } catch (e) {
                    console.error('[DEBUG-THEME] Failed to save theme settings', e);
                    // We knowingly leave the optimistic update in place + console error
                    // A "Toast.error" here would be ideal in a full implementation
                    throw e;
                }
            },

            resetTheme: () => {
                console.log('[DEBUG-THEME] resetTheme called - reverting to default');
                set({ theme: 'light', themeId: 'aladdin' });
            },

            setPagination: (pagination) =>
                set((state) => ({
                    pagination: { ...state.pagination, ...pagination }
                })),

            setSorting: (sorting) =>
                set((state) => ({
                    sorting: { ...state.sorting, ...sorting }
                })),

            initializeFilters: () => {
                const tags = getTagsCookie();
                if (tags.length > 0) {
                    set((state) => ({
                        filters: { ...state.filters, techTags: tags }
                    }));
                }
            },

            // Search Implementation - Weighted Scoring System
            enterSearchMode: (query) => {
                const trimmedQuery = query.trim().toLowerCase();
                if (!trimmedQuery) {
                    set({ searchMode: false, searchQuery: '', searchResults: [] });
                    return;
                }

                const allJobs = get().jobs;
                const searchTerms = trimmedQuery.split(/\s+/).filter(t => t.length > 1);

                // Helper to score a job
                const calculateScore = (job: any): number => {
                    let score = 0;
                    const title = (job.title || '').toLowerCase();
                    const company = (job.company || '').toLowerCase();
                    const location = (job.location || '').toLowerCase();
                    const description = (job.description || '').toLowerCase();
                    const summary = (job.raw_text_summary || '').toLowerCase();

                    // 1. Exact Phrase Matches
                    // Title
                    if (title === trimmedQuery) score += 10000;
                    else if (title.includes(trimmedQuery)) score += 5000;

                    // Company
                    if (company === trimmedQuery) score += 4000;
                    else if (company.includes(trimmedQuery)) score += 2000;

                    // Location
                    if (location === trimmedQuery) score += 3000;
                    else if (location.includes(trimmedQuery)) score += 1500;

                    // Description/Summary (phrase)
                    if (description.includes(trimmedQuery) || summary.includes(trimmedQuery)) {
                        score += 500;
                    }

                    // 2. Individual Keyword Matches
                    let termMatches = 0;
                    for (const term of searchTerms) {
                        let termMatched = false;
                        if (title.includes(term)) {
                            score += 100;
                            termMatched = true;
                        }
                        if (company.includes(term)) {
                            score += 50;
                            termMatched = true;
                        }
                        if (location.includes(term)) {
                            score += 50;
                            termMatched = true;
                        }
                        if (description.includes(term) || summary.includes(term)) {
                            score += 10;
                            termMatched = true;
                        }
                        if (termMatched) termMatches++;
                    }

                    // Bonus for matching all terms
                    if (termMatches === searchTerms.length) score += 200;

                    return score;
                };

                const scoredJobs = allJobs
                    .map(job => ({ job, score: calculateScore(job) }))
                    .filter(item => item.score > 0)
                    .sort((a, b) => {
                        // Primary Sort: Score DESC
                        if (b.score !== a.score) return b.score - a.score;

                        // Secondary Sort: Date Posted DESC (Newest first)
                        const dateA = new Date(a.job.posted_at || 0).getTime();
                        const dateB = new Date(b.job.posted_at || 0).getTime();
                        return dateB - dateA;
                    })
                    .map(item => item.job);

                set({
                    searchMode: true,
                    searchQuery: query,
                    searchResults: scoredJobs,
                    pagination: {
                        ...get().pagination,
                        page: 1,
                        total: scoredJobs.length,
                        totalPages: Math.ceil(scoredJobs.length / get().pagination.limit)
                    }
                });
            },

            exitSearchMode: () => {
                // Return to full listing with default pagination (limit 50, page 1)
                const allJobs = get().jobs;
                const defaultLimit = 50;

                set({
                    searchMode: false,
                    searchQuery: '',
                    searchResults: [],
                    pagination: {
                        ...get().pagination,
                        page: 1,
                        limit: defaultLimit,
                        total: allJobs.length,
                        totalPages: Math.ceil(allJobs.length / defaultLimit)
                    }
                });
            },

            setSearchQuery: (query) => set({ searchQuery: query }),

            performServerSearch: async (query, page = 1) => {
                const trimmedQuery = query.trim();
                if (!trimmedQuery) {
                    set({ searchMode: false, searchQuery: '', searchResults: [] });
                    return;
                }

                set({ isLoadingJobs: true, searchMode: true, searchQuery: query });

                try {
                    const response = await fetch('/api/search/jobs', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: trimmedQuery,
                            page,
                            limit: 50,
                        }),
                    });

                    if (!response.ok) {
                        throw new Error('Search request failed');
                    }

                    const data = await response.json();

                    set({
                        searchResults: data.jobs || [],
                        pagination: {
                            ...get().pagination,
                            page: data.pagination?.page || page,
                            total: data.pagination?.total || 0,
                            totalPages: data.pagination?.totalPages || 1,
                        },
                    });
                } catch (error) {
                    console.error('[Search] Server search failed:', error);
                    // Fallback to client-side search
                    get().enterSearchMode(query);
                } finally {
                    set({ isLoadingJobs: false });
                }
            },

            clearSearchResults: () => {
                set({
                    searchMode: false,
                    searchQuery: '',
                    searchResults: [],
                });
            },
        }),
        {
            name: 'job-hunt-vibe-storage-v2', // Bump version to invalidate old cache including stale jobs
            partialize: (state) => ({
                theme: state.theme,
                themeId: state.themeId,
                freshLimit: state.freshLimit,
                sidebarOpen: state.sidebarOpen,
                viewMode: state.viewMode,
            }),
        }
    )
);

// Selector hooks
export const useJobs = () => useStore((state) => state.jobs);
export const useSelectedJob = () => useStore((state) => state.selectedJob);
export const useApplications = () => useStore((state) => state.applications);
export const useFilters = () => useStore((state) => state.filters);
export const useTheme = () => useStore((state) => state.theme);
// Export new hook with shallow comparison to prevent SSR snapshot errors
export const useStoreActions = () => useStore(
    useShallow((state) => ({
        loadSettings: state.loadSettings,
        updateExcludedKeywords: state.updateExcludedKeywords,
        updateThemeId: state.updateThemeId,
        saveThemeSettings: state.saveThemeSettings,
        resetTheme: state.resetTheme,
        setThemeId: state.setThemeId,
        setFilters: state.setFilters,
        setJobStatus: state.setJobStatus,
        setPagination: state.setPagination,
        setSorting: state.setSorting,
        initializeFilters: state.initializeFilters,
        // Search Actions
        enterSearchMode: state.enterSearchMode,
        exitSearchMode: state.exitSearchMode,
        setSearchQuery: state.setSearchQuery,
        performServerSearch: state.performServerSearch,
        clearSearchResults: state.clearSearchResults,
        toggleJobStatus: state.toggleJobStatus
    }))
);
