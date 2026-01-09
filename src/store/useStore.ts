// Global state management with Zustand

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Job, Resume, LinkedInProfile, Application, FilterState } from '@/types';

interface AppState {
    // Theme
    theme: 'light' | 'dark';

    // Jobs
    jobs: Job[];
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

    // UI State
    sidebarOpen: boolean;
    activeModal: 'cover-letter' | 'resume-selector' | 'linkedin-selector' | 'import-job' | null;

    // Actions
    setTheme: (theme: 'light' | 'dark') => void;
    toggleTheme: () => void;
    setJobs: (jobs: Job[]) => void;
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
    setActiveModal: (modal: AppState['activeModal']) => void;
}

export const useStore = create<AppState>()(
    persist(
        (set) => ({
            // Initial state
            theme: 'light',
            jobs: [],
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
            sidebarOpen: true,
            activeModal: null,

            // Actions
            setTheme: (theme) => set({ theme }),

            toggleTheme: () => set((state) => ({
                theme: state.theme === 'light' ? 'dark' : 'light'
            })),

            setJobs: (jobs) => set({ jobs }),

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
                set((state) => ({ filters: { ...state.filters, ...filters } })),

            setFreshLimit: (limit) => set({ freshLimit: limit }),

            toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

            setActiveModal: (modal) => set({ activeModal: modal }),
        }),
        {
            name: 'job-hunt-vibe-storage',
            partialize: (state) => ({
                theme: state.theme,
                freshLimit: state.freshLimit,
                sidebarOpen: state.sidebarOpen,
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
