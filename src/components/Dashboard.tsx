'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { JobList } from '@/components/layout/JobList';
import { JobDetail } from '@/components/layout/JobDetail';
import dynamic from 'next/dynamic';

const JobsMap = dynamic(() => import('@/components/layout/JobsMap'), {
    ssr: false,
    loading: () => <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#666' }}>Loading Map...</div>
});
import { InterviewExperiencesView } from '@/components/layout/InterviewExperiencesView';
import { ReferralsView } from '@/components/layout/ReferralsView';
import { InterviewExperienceDetailView } from '@/components/layout/InterviewExperienceDetailView';
import { PracticeView } from '@/components/layout/PracticeView';
import { UpgradePlans } from '@/components/upgrade/UpgradePlans';
import { CompanyQuestionsTable } from '@/components/layout/CompanyQuestionsTable';
import { CoverLetterModal } from '@/components/modals/CoverLetterModal';
import { CoverLetterSetupModal } from '@/components/modals/CoverLetterSetupModal';
import { TailoredResumeEditor } from '@/components/resume-editor/TailoredResumeEditor';
import { ResumeSelector } from '@/components/modals/ResumeSelector';
import { LinkedInSelector } from '@/components/modals/LinkedInSelector';
import { ParsingProgress, useParsingProgress } from '@/components/resume-editor/ParsingProgress';
import { ImportJobModal } from '@/components/modals/ImportJobModal';
import { ImportJobSelectionModal } from '@/components/modals/ImportJobSelectionModal';
import { ManualImportModal } from '@/components/modals/ManualImportModal';
import { FilterModal } from '@/components/modals/FilterModal';
import { AuthModal } from '@/components/modals/AuthModal';
import { useStore, useStoreActions } from '@/store/useStore';
import { useResumeGeneration } from '@/contexts/ResumeGenerationContext';
import { useSubscription } from '@/hooks/useSubscription';
import { LiteUpgradeModal } from '@/components/subscription/LiteUpgradeModal';
import { LimitReachedModal } from '@/components/subscription/LimitReachedModal';
import { CaptainLimitModal } from '@/components/subscription/CaptainLimitModal';
import type { UsageFeature } from '@/lib/subscription/tier-config';
import { announcePriorityModalOpening, usePriorityModalCleanup } from '@/lib/priority-modal';
import { useAuth } from '@clerk/nextjs';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Job, Application, ApplicationColumn } from '@/types';
import { toPlainText } from '@/lib/plain-text';
import {
    getCachedApplications,
    setCachedApplications,
    isApplicationsCacheStale,
    invalidateApplicationsCache,
} from '@/lib/application-cache';
import {
    DndContext,
    DragOverlay,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragStartEvent,
    DragEndEvent,
    useDroppable,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const COLUMNS: ApplicationColumn[] = [
    'Applied',
    'Got OA',
    'Interview R1',
    'Interview R2',
    'Interview R3',
    'Interview R4',
    'Got Offer',
];

// Hook to detect narrow layout (<= 1200px)
function useNarrowLayout() {
    const [isNarrow, setIsNarrow] = useState(false);

    useEffect(() => {
        const checkWidth = () => {
            setIsNarrow(window.innerWidth <= 1200);
        };
        // Initial check
        checkWidth();
        window.addEventListener('resize', checkWidth);
        return () => window.removeEventListener('resize', checkWidth);
    }, []);

    return isNarrow;
}

interface ApplicationWithJob extends Application {
    job?: Job;
}

// Draggable job card component for Kanban
function DraggableJobCard({
    application,
    onDelete,
}: {
    application: ApplicationWithJob;
    onDelete: (id: string) => void;
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: application.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={{
                ...style,
                padding: '12px',
                marginBottom: '8px',
                cursor: 'grab',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                touchAction: 'none',
            }}
            {...attributes}
            {...listeners}
            className="card"
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {application.job?.company || 'Unknown Company'}
                    </h4>
                    <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {application.job?.title || 'Unknown Position'}
                    </p>
                    {application.job?.location && (
                        <p style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                            {application.job.location}
                        </p>
                    )}
                </div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onDelete(application.id);
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    style={{
                        padding: '4px',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-tertiary)',
                        cursor: 'pointer',
                        borderRadius: '4px',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.color = 'var(--error)'}
                    onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-tertiary)'}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                {application.job?.source_url && (
                    <a
                        href={application.job.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                        }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                            <polyline points="15 3 21 3 21 9" />
                            <line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        View Job
                    </a>
                )}

                {application.job?.company && (
                    <Link
                        href={`/interview-experiences/${encodeURIComponent(application.job.company)}`}
                        onClick={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            transition: 'color 0.2s',
                            opacity: 0.9,
                        }}
                        onMouseOver={(e) => { e.currentTarget.style.color = 'var(--accent-hover)'; e.currentTarget.style.textDecoration = 'underline'; }}
                        onMouseOut={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.textDecoration = 'none'; }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 00-3-3.87" />
                            <path d="M16 3.13a4 4 0 010 7.75" />
                        </svg>
                        Interview Experiences
                    </Link>
                )}
            </div>
        </div>
    );
}

// Droppable Kanban column component
function DroppableColumn({
    column,
    applications,
    onDelete,
}: {
    column: ApplicationColumn;
    applications: ApplicationWithJob[];
    onDelete: (id: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: column,
    });

    const columnApps = applications.filter((app) => app.column_name === column);

    return (
        <div
            style={{
                flex: 1,
                minWidth: '180px',
                maxWidth: '220px',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--background-secondary)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                border: isOver ? '2px solid var(--accent)' : '2px solid transparent',
                transition: 'border-color 0.2s',
            }}
        >
            <div
                style={{
                    padding: '12px 14px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}
            >
                <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {column}
                </h3>
                <span
                    style={{
                        fontSize: '11px',
                        fontWeight: 500,
                        padding: '2px 6px',
                        background: 'var(--surface)',
                        borderRadius: '999px',
                        color: 'var(--text-secondary)',
                    }}
                >
                    {columnApps.length}
                </span>
            </div>

            <div
                ref={setNodeRef}
                style={{
                    flex: 1,
                    padding: '10px',
                    overflowY: 'auto',
                    minHeight: '150px',
                    background: isOver ? 'rgba(var(--accent-rgb), 0.05)' : 'transparent',
                }}
            >
                <SortableContext
                    items={columnApps.map((app) => app.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {columnApps.length === 0 ? (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                height: '80px',
                                color: isOver ? 'var(--accent)' : 'var(--text-muted)',
                                fontSize: '11px',
                                border: '2px dashed var(--border)',
                                borderRadius: 'var(--radius-md)',
                            }}
                        >
                            Drop here
                        </div>
                    ) : (
                        columnApps.map((app) => (
                            <DraggableJobCard
                                key={app.id}
                                application={app}
                                onDelete={onDelete}
                            />
                        ))
                    )}
                </SortableContext>
            </div>
        </div>
    );
}

interface DashboardProps {
    defaultActiveView?: 'jobs' | 'tracker' | 'referrals' | 'interview-experiences' | 'practice' | 'upgrade';
    defaultJobMode?: 'list' | 'map';
    selectedCompany?: string; // New prop for detail view
}

export function Dashboard({
    defaultActiveView = 'jobs',
    defaultJobMode = 'list',
    selectedCompany
}: DashboardProps) {
    const getPlainTextJobDescription = (job: Job | null | undefined): string =>
        toPlainText(
            job?.job_description_plain ||
            job?.raw_text_summary ||
            job?.normalized_text ||
            job?.raw_description_html ||
            ((job as Job & { rawDescriptionHtml?: string } | null | undefined)?.rawDescriptionHtml ?? '')
        );

    const {
        jobs,
        setJobs,
        selectedJob,
        setSelectedJob,
        isLoadingJobs,
        setIsLoadingJobs,
        setLastUpdated,
        freshLimit,
        activeModal,
        setActiveModal,
        pagination,
        sorting,
        jobStatus,
        viewMode,
        setViewMode,
    } = useStore();
    const { setPagination, setSorting, toggleJobStatus, setCachedJobs, clearJobCache } = useStoreActions();

    const { isSignedIn, isLoaded: isAuthLoaded, userId } = useAuth();
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const {
        openModal: openResumeModal,
        blockedBy: resumeBlockedBy,
        clearBlockedBy: clearResumeBlockedBy,
        cancelGeneration: cancelResumeGeneration,
    } = useResumeGeneration();
    const sub = useSubscription();

    // Derive active state mainly from props/URL
    const isJobBoard = defaultActiveView === 'jobs';
    const isTracker = defaultActiveView === 'tracker';
    const isReferrals = defaultActiveView === 'referrals';
    const isInterviewExperiences = defaultActiveView === 'interview-experiences';
    const isPracticeView = defaultActiveView === 'practice';
    const isUpgrade = defaultActiveView === 'upgrade';
    const isMapMode = defaultJobMode === 'map';

    // We keep these for internal logic, but they should sync with props
    const [activeView, setActiveView] = useState<
        'jobs' | 'tracker' | 'referrals' | 'interview-experiences' | 'practice' | 'upgrade'
    >(defaultActiveView ?? 'jobs');
    const [applicationStatus, setApplicationStatus] = useState<Record<string, 'none' | 'applied' | 'loading'>>({});
    const [applications, setApplications] = useState<ApplicationWithJob[]>([]);

    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedMapJob, setSelectedMapJob] = useState<Job | null>(null); // State for Map Overlay

    // For You tab state
    const [recommendedJobs, setRecommendedJobs] = useState<Job[]>([]);
    const [recommendedStatus, setRecommendedStatus] = useState<'idle' | 'loading' | 'ready' | 'pending'>('idle');
    const [recommendedMessage, setRecommendedMessage] = useState<string | null>(null);

    // Mobile responsive state
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isMobileJobDetailVisible, setIsMobileJobDetailVisible] = useState(false);
    const isNarrowLayout = useNarrowLayout();

    // Auth Modal State
    const [authModalOpen, setAuthModalOpen] = useState(false);
    const [authMessage, setAuthMessage] = useState('');

    const [coverLetterSetupModal, setCoverLetterSetupModal] = useState<{
        isOpen: boolean;
        jobId: string | null;
        jobTitle: string;
        company: string | null;
        jobUrl: string | null;
        initialDescription: string;
    }>({
        isOpen: false,
        jobId: null,
        jobTitle: '',
        company: null,
        jobUrl: null,
        initialDescription: '',
    });

    const [gateModal, setGateModal] = useState<{ type: 'lite' | 'limit'; feature: UsageFeature; resetDate: string | null } | null>(null);

    const [coverLetterModal, setCoverLetterModal] = useState<{
        isOpen: boolean;
        jobId: string | null;
        coverLetterId: string | undefined;
        html: string;
        text: string;
        highlights: string[];
        jobTitle: string;
        company: string | null;
        error: string | null;
        isGenerating: boolean;
    }>({
        isOpen: false,
        jobId: null,
        coverLetterId: undefined,
        html: '',
        text: '',
        highlights: [],
        jobTitle: '',
        company: null,
        error: null,
        isGenerating: false,
    });

    const [coverLetterProgress, setCoverLetterProgress] = useState<{
        stages: { id: string; title: string; description: string; logs: string[]; status: 'pending' | 'running' | 'completed' | 'failed' }[];
        currentStageIndex: number;
    }>({
        stages: [
            { id: 'stage1_load-job', title: 'Loading Job', description: 'Fetching job details from database', logs: [], status: 'pending' },
            { id: 'stage2_load-resume', title: 'Loading Resume', description: 'Downloading your resume from storage', logs: [], status: 'pending' },
            { id: 'stage3_parse-resume', title: 'Analyzing Resume', description: 'Extracting and structuring your experience', logs: [], status: 'pending' },
            { id: 'stage4_load-linkedin', title: 'Checking LinkedIn', description: 'Looking for LinkedIn profile to enhance your profile', logs: [], status: 'pending' },
            { id: 'stage5_master-profile', title: 'Building Profile', description: 'Merging your resume and LinkedIn data', logs: [], status: 'pending' },
            { id: 'stage6_generate-coverletter', title: 'Writing Cover Letter', description: 'Crafting a personalized cover letter', logs: [], status: 'pending' },
            { id: 'stage7_save', title: 'Saving', description: 'Saving your cover letter', logs: [], status: 'pending' },
        ],
        currentStageIndex: 0,
    });
    const [isScoring, setIsScoring] = useState(false);
    const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
    const coverLetterAbortRef = useRef<AbortController | null>(null);

    const closeNonPriorityModals = useCallback(() => {
        coverLetterAbortRef.current?.abort();
        coverLetterAbortRef.current = null;
        setAuthModalOpen(false);
        setCoverLetterSetupModal(prev => ({ ...prev, isOpen: false }));
        setCoverLetterModal(prev => ({ ...prev, isOpen: false, isGenerating: false }));
        setActiveModal(null);
        setIsFilterModalOpen(false);
        setGateModal(null);
        clearResumeBlockedBy();
        cancelResumeGeneration();
    }, [cancelResumeGeneration, clearResumeBlockedBy, setActiveModal]);

    usePriorityModalCleanup(closeNonPriorityModals);

    const showGateModal = useCallback((modal: { type: 'lite' | 'limit'; feature: UsageFeature; resetDate: string | null }) => {
        announcePriorityModalOpening();
        closeNonPriorityModals();
        setGateModal(modal);
    }, [closeNonPriorityModals]);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        })
    );

    // Sync viewMode with prop and manage route consistency
    useEffect(() => {
        // Only set if different to avoid redundant updates
        if (viewMode !== defaultJobMode && defaultActiveView === 'jobs') {
            setViewMode(defaultJobMode);
        }
    }, [defaultJobMode, defaultActiveView, setViewMode, viewMode]);

    // Set initial active view
    useEffect(() => {
        setActiveView(defaultActiveView);
    }, [defaultActiveView]);

    // Handle default tab on login (Legacy but kept for consistency, logic updated)
    useEffect(() => {
        if (isSignedIn) {
            // We respect the route's defaultView instead of forcing 'list' here
            // But ensure state matches
            setActiveView(defaultActiveView);
            if (defaultActiveView === 'jobs') {
                setViewMode(defaultJobMode);
            }
        }
    }, [isSignedIn, setViewMode, defaultActiveView, defaultJobMode]);


    // Initialize from URL on mount
    useEffect(() => {
        if (!isAuthLoaded) return;
        if (defaultActiveView === 'upgrade') return;

        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '25', 10);
        const sortBy = searchParams.get('sort_by') as any || 'time';
        const sortDir = searchParams.get('sort_dir') as any || 'desc';

        setPagination({ page, limit });
        setSorting({ by: sortBy, dir: sortDir });

        // Initial fetch handled by the dependency effect below
    }, [isAuthLoaded, setPagination, setSorting, searchParams, defaultActiveView]);

    // Track if initial load has completed
    const hasInitializedRef = React.useRef(false);
    const prevPaginationRef = React.useRef({ page: pagination.page, limit: pagination.limit });
    const prevSortingRef = React.useRef({ by: sorting.by, dir: sorting.dir });
    const prevStatusRef = React.useRef(jobStatus);

    // Sync state to URL and Load Jobs - only when page/limit/sorting ACTUALLY changes
    useEffect(() => {
        if (!isAuthLoaded) return;
        if (defaultActiveView === 'upgrade') return;

        // Skip if nothing actually changed (prevents loops from setPagination({ total, totalPages }))
        const paginationChanged =
            prevPaginationRef.current.page !== pagination.page ||
            prevPaginationRef.current.limit !== pagination.limit;
        const sortingChanged =
            prevSortingRef.current.by !== sorting.by ||
            prevSortingRef.current.dir !== sorting.dir;
        const statusChanged = prevStatusRef.current !== jobStatus;

        // Update refs
        prevPaginationRef.current = { page: pagination.page, limit: pagination.limit };
        prevSortingRef.current = { by: sorting.by, dir: sorting.dir };
        prevStatusRef.current = jobStatus;

        // Only proceed if this is initial load OR if page/limit/sorting changed
        if (!hasInitializedRef.current || paginationChanged || sortingChanged || statusChanged) {
            // Prevent API calls if in search mode (client-side only)
            if (useStore.getState().searchMode) {
                // But we need to update URL to reflect page change if desired?
                // Actually URL params usually drive the backend state.
                // If we are in "in-memory search" mode, maybe strictly ignoring URL updates or suppressing fetch is best.
                // We still might want to update URL params for consistency?
                // Let's just Return early to stop the Fetch.
                // But if we return, we don't update URL.
                // Let's Update URL but NOT fetch.
            }

            // Sort order changed — cached pages are now in wrong order
            if (sortingChanged) {
                clearJobCache();
            }

            hasInitializedRef.current = true;

            // Update URL
            const params = new URLSearchParams(searchParams.toString());
            if (pagination.page > 1) params.set('page', pagination.page.toString());
            else params.delete('page');

            // Limit is always 50, do not set in URL
            params.delete('limit');

            if (sorting.by !== 'time') params.set('sort_by', sorting.by);
            else params.delete('sort_by');

            if (sorting.dir !== 'desc') params.set('sort_dir', sorting.dir);
            else params.delete('sort_dir');

            // Only replace if changed
            if (params.toString() !== searchParams.toString()) {
                router.replace(`${pathname}?${params.toString()}`);
            }

            // Perform fetch unless in search mode
            if (jobStatus === 'recommended') {
                loadRecommendedJobs();
            } else if (!useStore.getState().searchMode) {
                loadJobsRef.current?.(false);
            } else {
                // If in search mode, do we need to trigger anything?
                // Pagination state is already updated in store.
                // JobList will re-render and slice correctly.
            }

            if (isSignedIn && !useStore.getState().searchMode) {
                loadApplications();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAuthLoaded, isSignedIn, pagination.page, pagination.limit, sorting.by, sorting.dir, jobStatus, defaultActiveView]);

    useEffect(() => {
        useStore.getState().initializeFilters();
    }, []);

    // Stable ref for loadJobs to avoid stale closures
    const loadJobsRef = useRef<((rescore: boolean) => Promise<void>) | null>(null);

    const loadJobs = async (rescore: boolean = false) => {
        const { page, limit } = useStore.getState().pagination;
        const { by, dir } = useStore.getState().sorting;
        const status = useStore.getState().jobStatus;
        const cacheKey = `${status}:${page}`;

        // Cache hit — serve from memory, skip DB call
        const cached = useStore.getState().jobCache.get(cacheKey);
        if (cached) {
            setJobs(cached.jobs);
            setPagination(cached.pagination);
            return;
        }

        setIsLoadingJobs(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                sort_by: by,
                sort_dir: dir,
                status: status
            });

            // Always fetch public jobs - all jobs are globally visible
            const res = await fetch(`/api/jobs?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                let loadedJobs = data.jobs || [];

                // Defensive client-side check to guarantee strictly sorted listing on the frontend
                if (by === 'time') {
                    loadedJobs.sort((a: Job, b: Job) => {
                        const timeA = new Date(a.posted_at || 0).getTime();
                        const timeB = new Date(b.posted_at || 0).getTime();
                        return dir === 'desc' ? timeB - timeA : timeA - timeB;
                    });
                }

                const paginationUpdate = { total: data.total, totalPages: data.totalPages };
                setJobs(loadedJobs);
                setPagination(paginationUpdate);
                setLastUpdated(data.lastUpdated);

                // Write to cache after successful fetch
                setCachedJobs(cacheKey, {
                    jobs: loadedJobs,
                    pagination: { ...useStore.getState().pagination, ...paginationUpdate },
                });
            } else {
                console.error("Failed to fetch jobs");
                // Do not write to cache on error
            }
        } catch (error) {
            console.error('Error loading jobs:', error);
            // Do not write to cache on error
        } finally {
            setIsLoadingJobs(false);
        }
    };

    // Keep ref updated
    loadJobsRef.current = loadJobs;

    const loadRecommendedJobs = async () => {
        setRecommendedStatus('loading');
        try {
            const res = await fetch('/api/jobs/recommended');
            if (res.ok) {
                const data = await res.json();
                setRecommendedJobs(data.jobs ?? []);
                setRecommendedStatus(data.status === 'pending' ? 'pending' : 'ready');
                setRecommendedMessage(data.message ?? null);
            }
        } catch (err) {
            console.error('Error loading recommended jobs:', err);
            setRecommendedStatus('idle');
        }
    };

    // Background Smart-Polling (Every 20 minutes)
    useEffect(() => {
        const POLLING_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes
        const interval = setInterval(async () => {
            const state = useStore.getState();
            
            // Only poll if on first page, sorting by time desc, fresh status, and not searching
            if (
                state.pagination.page === 1 && 
                state.sorting.by === 'time' && 
                state.sorting.dir === 'desc' && 
                state.jobStatus === 'fresh' && 
                !state.searchMode
            ) {
                try {
                    const params = new URLSearchParams({
                        page: '1',
                        limit: '50',
                        sort_by: 'time',
                        sort_dir: 'desc',
                        status: 'fresh'
                    });
                    
                    const res = await fetch(`/api/jobs?${params.toString()}`);
                    if (res.ok) {
                        const data = await res.json();
                        const newJobsList = data.jobs || [];
                        
                        if (newJobsList.length > 0) {
                            const existingJobs = useStore.getState().jobs;
                            const existingHash = new Set(existingJobs.map((j: Job) => j.id));
                            const freshAdditions = newJobsList.filter((j: Job) => !existingHash.has(j.id));
                            
                            if (freshAdditions.length > 0) {
                                // Add to top of list seamlessly without reloading
                                const combined = [...freshAdditions, ...existingJobs];
                                
                                // Strict Final Check to guarantee sorting on the frontend
                                combined.sort((a: Job, b: Job) => {
                                    const timeA = new Date(a.posted_at || 0).getTime();
                                    const timeB = new Date(b.posted_at || 0).getTime();
                                    return timeB - timeA;
                                });
                                
                                useStore.getState().setJobs(combined);
                                useStore.getState().setLastUpdated(data.lastUpdated);
                                // Keep the cache in sync with the polled result
                                useStore.getState().setCachedJobs('fresh:1', {
                                    jobs: combined,
                                    pagination: useStore.getState().pagination,
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('Background polling failed:', error);
                }
            }
        }, POLLING_INTERVAL_MS);

        return () => clearInterval(interval);
    }, []);

    const loadApplications = async () => {
        if (!isSignedIn) return;

        // Cache-first: Check if we have cached applications
        const cached = getCachedApplications();
        if (cached) {
            // Show cached data immediately
            const statusMap: Record<string, 'none' | 'applied' | 'loading'> = {};
            cached.applications.forEach((app: any) => {
                statusMap[app.job_id] = 'applied';
            });
            setApplicationStatus(statusMap);
            setApplications(cached.applications);

            // Refetch in background if stale
            if (isApplicationsCacheStale(cached.meta)) {
                fetchApplicationsInBackground();
            }
            return;
        }

        // No cache, fetch from server
        await fetchApplicationsFromServer();
    };

    // Helper to fetch applications from server and update cache
    const fetchApplicationsFromServer = async () => {
        try {
            const res = await fetch('/api/application');
            const data = await res.json();
            const statusMap: Record<string, 'none' | 'applied' | 'loading'> = {};

            const appsWithJobs = await Promise.all(
                (data.applications || []).map(async (app: Application) => {
                    statusMap[app.job_id] = 'applied';
                    try {
                        const jobRes = await fetch(`/api/job/${app.job_id}`);
                        const jobData = await jobRes.json();
                        return { ...app, job: jobData.job };
                    } catch {
                        return app;
                    }
                })
            );

            setApplicationStatus(statusMap);
            setApplications(appsWithJobs);

            // Update cache
            setCachedApplications(appsWithJobs);
        } catch (error) {
            console.error('Error loading applications:', error);
        }
    };

    // Background fetch for applications (no loading state)
    const fetchApplicationsInBackground = async () => {
        try {
            await fetchApplicationsFromServer();
        } catch (error) {
            console.error('Background applications refresh failed:', error);
        }
    };



    const handleFindNow = useCallback(async () => {
        setIsLoadingJobs(true);
        try {
            if (isSignedIn) {
                await fetch('/api/run-finder', { method: 'POST' });
                loadJobs(true);
            } else {
                window.location.reload();
            }
        } catch (e) {
            console.error('Find now failed:', e);
            setIsLoadingJobs(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [freshLimit, isSignedIn]);

    const handleJobClick = (job: Job) => {
        setSelectedJob(job);
        setIsMobileJobDetailVisible(true);
    };

    const handleMobileBack = () => {
        setIsMobileJobDetailVisible(false);
        // Also clear selected job if in narrow layout to return to list
        if (isNarrowLayout) {
            setSelectedJob(null);
        }
    };

    const handleCloseMobileSidebar = () => {
        setIsMobileSidebarOpen(false);
    };

    const handleJobUpdate = (updatedJob: Job) => {
        // Update the jobs list in store
        setJobs(jobs.map(j => j.id === updatedJob.id ? { ...j, ...updatedJob } : j));
        // Update selected job
        if (selectedJob?.id === updatedJob.id) {
            setSelectedJob({ ...selectedJob, ...updatedJob });
        }
    };

    const handleDeleteJob = async (jobId: string) => {
        if (!isSignedIn) {
            setAuthMessage('Sign in to manage jobs.');
            setAuthModalOpen(true);
            return;
        }
        if (!confirm('Are you sure you want to PERMANENTLY delete this job? This cannot be undone.')) return;

        try {
            const res = await fetch(`/api/job/${jobId}`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
            });

            if (res.ok) {
                setJobs(jobs.filter(j => j.id !== jobId));
                if (selectedJob?.id === jobId) setSelectedJob(null);
            } else {
                const data = await res.json();
                alert(`Failed to delete job: ${data.error}`);
            }
        } catch (e) {
            console.error('Delete failed', e);
            alert('Delete failed');
        }
    };

    const handleApply = async (jobId: string) => {
        if (!isSignedIn) {
            // Just redirect to source url for public users
            const job = jobs.find(j => j.id === jobId) || selectedJob;
            if (job?.source_url) {
                window.open(job.source_url, '_blank');
            } else {
                setAuthMessage('Sign in to track applications.');
                setAuthModalOpen(true);
            }
            return;
        }

        if (applicationStatus[jobId] === 'applied') return;

        setApplicationStatus(prev => ({ ...prev, [jobId]: 'loading' }));

        try {
            const res = await fetch('/api/application', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_id: jobId }),
            });

            if (res.ok) {
                setApplicationStatus(prev => ({ ...prev, [jobId]: 'applied' }));
                // Remove from fresh jobs
                setJobs(jobs.filter(j => j.id !== jobId));
                if (selectedJob?.id === jobId) setSelectedJob(null);
                invalidateApplicationsCache(); // Clear stale cache
                loadApplications();
            } else {
                setApplicationStatus(prev => ({ ...prev, [jobId]: 'none' }));
                const data = await res.json();
                if (data.error !== 'Application already exists for this job') {
                    alert(data.error || 'Failed to mark as applied');
                } else {
                    setApplicationStatus(prev => ({ ...prev, [jobId]: 'applied' }));
                }
            }
        } catch (error) {
            console.error('Error applying:', error);
            setApplicationStatus(prev => ({ ...prev, [jobId]: 'none' }));
        }
    };



    const handleGenerateCoverLetter = async (jobId: string, queue: boolean = false) => {
        if (!isSignedIn) {
            setAuthMessage('Sign in to generate cover letters.');
            setAuthModalOpen(true);
            return;
        }

        const job = jobs.find(j => j.id === jobId) || (selectedJob?.id === jobId ? selectedJob : null);
        if (!job) return;
        const plainDescription = getPlainTextJobDescription(job);

        if (queue) {
            handleConfirmGenerateCoverLetter(jobId, plainDescription, true);
        } else {
            setCoverLetterSetupModal({
                isOpen: true,
                jobId,
                jobTitle: job.title,
                company: job.company,
                jobUrl: job.source_url,
                initialDescription: plainDescription
            });
        }
    };

    const handleConfirmGenerateCoverLetter = async (jobId: string, jobDescription: string, queue: boolean = false) => {
        if (!isSignedIn) return;
        if (!sub.isLoading && sub.planType === 'LITE') {
            showGateModal({ type: 'lite', feature: 'coverLettersGenerated', resetDate: null });
            return;
        }
        if (!sub.isLoading && sub.usage.coverLettersGenerated >= sub.limits.coverLettersGenerated) {
            showGateModal({ type: 'limit', feature: 'coverLettersGenerated', resetDate: sub.currentPeriodEnd });
            return;
        }
        const job = jobs.find(j => j.id === jobId) || (selectedJob?.id === jobId ? selectedJob : null);
        const normalizedJobDescription = toPlainText(jobDescription || getPlainTextJobDescription(job));

        if (queue) {
            try {
                const res = await fetch('/api/generate-cover-letter', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        job_id: jobId,
                        queue: true,
                        job_description: normalizedJobDescription
                    }),
                });
                const data = await res.json();
                if (res.status === 403) {
                    showGateModal({
                        type: data.error === 'UNAUTHORIZED' ? 'lite' : 'limit',
                        feature: 'coverLettersGenerated',
                        resetDate: data.resetDate ?? null,
                    });
                    return;
                }
                if (data.success) {
                    alert("Cover letter generation queued successfully.");
                } else {
                    alert(data.error || "Failed to queue cover letter");
                }
            } catch (err) {
                console.error("Queue error:", err);
                alert("Failed to queue cover letter");
            }
            return;
        }

        setCoverLetterModal(prev => ({
            ...prev,
            isOpen: true,
            jobId,
            isGenerating: true,
            error: null,
            html: '',
            text: '',
            jobTitle: job?.title || prev.jobTitle,
            company: job?.company || prev.company,
        }));

        setCoverLetterProgress(prev => ({
            ...prev,
            stages: [
                { id: 'stage1_load-job', title: 'Loading Job', description: 'Fetching job details from database', logs: ['Initializing...'], status: 'running' as const },
                { id: 'stage2_load-resume', title: 'Loading Resume', description: 'Downloading your resume from storage', logs: [], status: 'pending' as const },
                { id: 'stage3_parse-resume', title: 'Analyzing Resume', description: 'Extracting and structuring your experience', logs: [], status: 'pending' as const },
                { id: 'stage4_load-linkedin', title: 'Checking LinkedIn', description: 'Looking for LinkedIn profile to enhance your profile', logs: [], status: 'pending' as const },
                { id: 'stage5_master-profile', title: 'Building Profile', description: 'Merging your resume and LinkedIn data', logs: [], status: 'pending' as const },
                { id: 'stage6_generate-coverletter', title: 'Writing Cover Letter', description: 'Crafting a personalized cover letter', logs: [], status: 'pending' as const },
                { id: 'stage7_save', title: 'Saving', description: 'Saving your cover letter', logs: [], status: 'pending' as const },
            ],
            currentStageIndex: 0,
        }));

        let controller: AbortController | null = null;
        try {
            coverLetterAbortRef.current?.abort();
            controller = new AbortController();
            coverLetterAbortRef.current = controller;
            const response = await fetch('/api/generate-cover-letter-stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_id: jobId,
                    job_description: normalizedJobDescription
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({})) as { error?: string; message?: string; resetDate?: string };
                if (response.status === 403) {
                    setCoverLetterModal(prev => ({ ...prev, isOpen: false, isGenerating: false }));
                    showGateModal({
                        type: errData.error === 'UNAUTHORIZED' ? 'lite' : 'limit',
                        feature: 'coverLettersGenerated',
                        resetDate: errData.resetDate ?? null,
                    });
                    return;
                }
                throw new Error(errData.message || `Server error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error('Failed to read response stream');

            const decoder = new TextDecoder();
            let buffer = '';
            let currentEvent = 'message';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed) { currentEvent = 'message'; continue; }
                    if (trimmed.startsWith('event: ')) { currentEvent = trimmed.slice(7).trim(); continue; }
                    
                    if (trimmed.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmed.slice(6));
                            const eventType = currentEvent;

                            if (eventType === 'stage') {
                                setCoverLetterProgress(prev => {
                                    const stageIdx = prev.stages.findIndex(s => s.id === data.stageId);
                                    if (stageIdx === -1) return prev;
                                    const newStages = [...prev.stages];
                                    newStages[stageIdx] = { ...newStages[stageIdx], status: 'running', description: data.name || newStages[stageIdx].description };
                                    return { ...prev, stages: newStages, currentStageIndex: stageIdx };
                                });
                            } else if (eventType === 'log') {
                                setCoverLetterProgress(prev => {
                                    const stageIdx = prev.stages.findIndex(s => s.id === data.stageId);
                                    if (stageIdx === -1) return prev;
                                    const newStages = [...prev.stages];
                                    newStages[stageIdx] = { ...newStages[stageIdx], logs: [...newStages[stageIdx].logs, data.log] };
                                    return { ...prev, stages: newStages };
                                });
                            } else if (eventType === 'complete') {
                                setCoverLetterProgress(prev => {
                                    const stageIdx = prev.stages.findIndex(s => s.id === data.stageId);
                                    if (stageIdx === -1) return prev;
                                    const newStages = [...prev.stages];
                                    newStages[stageIdx] = { ...newStages[stageIdx], status: 'completed' };
                                    return { ...prev, stages: newStages };
                                });
                            } else if (eventType === 'done') {
                                if (data.status === 'success') {
                                    setCoverLetterModal(prev => ({
                                        ...prev,
                                        isOpen: true,
                                        isGenerating: false,
                                        html: data.coverLetter.content_html || '',
                                        text: data.coverLetter.content_text || '',
                                        coverLetterId: data.coverLetter.id,
                                        error: null,
                                    }));
                                } else {
                                    throw new Error(data.message || 'Generation failed');
                                }
                            } else if (eventType === 'error') {
                                throw new Error(data.message || 'Generation failed');
                            }
                        } catch (e) {
                            console.error('SSE parse error:', e);
                        }
                    }
                }
            }

            setCoverLetterProgress(prev => ({
                ...prev,
                stages: prev.stages.map(s => ({ ...s, status: 'completed' as const })),
            }));

        } catch (error: any) {
            if (error?.name === 'AbortError') {
                return;
            }
            console.error('Error generating cover letter:', error);
            setCoverLetterProgress(prev => ({
                ...prev,
                stages: prev.stages.map(s => ({ ...s, status: 'completed' as const })),
            }));
            setCoverLetterModal(prev => ({
                ...prev,
                isOpen: true,
                isGenerating: false,
                error: error.message || 'Failed to communicate with server. Please try again.',
            }));
        } finally {
            if (coverLetterAbortRef.current === controller) {
                coverLetterAbortRef.current = null;
            }
        }
    };

    const handleGenerateTailoredResume = async (jobId: string) => {
        if (!isSignedIn) {
            setAuthMessage('Sign in to create tailored resumes.');
            setAuthModalOpen(true);
            return;
        }

        const job = jobs.find(j => j.id === jobId) || (selectedJob?.id === jobId ? selectedJob : null);

        if (!job) return;

        // Check if there's already a saved tailored resume for this job
        try {
            const res = await fetch(`/api/tailored-resume?jobId=${jobId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.exists) {
                    router.push(`/resume-editor/${jobId}`);
                    return;
                }
            }
        } catch (error) {
            console.error('Error checking for existing tailored resume:', error);
        }

        openResumeModal({
            jobId,
            jobTitle: job.title,
            company: job.company,
            jobDescription: getPlainTextJobDescription(job),
            jobUrl: job.source_url ?? undefined,
            linkedinProfileUrl: undefined,
            linkedinData: undefined,
        });
    };

    // Kanban drag handlers
    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        if (!isSignedIn) return;

        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeApp = applications.find((app) => app.id === active.id);
        if (!activeApp) return;

        // Determine target column
        let newColumn: ApplicationColumn | null = null;

        // Check if dropped on a column directly
        if (COLUMNS.includes(over.id as ApplicationColumn)) {
            newColumn = over.id as ApplicationColumn;
        } else {
            // Dropped on another card - find that card's column
            const overApp = applications.find((app) => app.id === over.id);
            if (overApp) {
                newColumn = overApp.column_name;
            }
        }

        if (!newColumn || activeApp.column_name === newColumn) return;

        // Optimistically update UI
        setApplications((prev) =>
            prev.map((app) =>
                app.id === active.id ? { ...app, column_name: newColumn! } : app
            )
        );

        // Update in database
        try {
            await fetch('/api/application', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    application_id: active.id,
                    column_name: newColumn,
                }),
            });
        } catch (error) {
            console.error('Error updating application:', error);
            loadApplications();
        }
    };

    const handleDeleteApplication = async (applicationId: string) => {
        if (!isSignedIn) return;
        if (!confirm('Are you sure you want to delete this application?')) return;

        setApplications((prev) => prev.filter((app) => app.id !== applicationId));

        try {
            await fetch(`/api/application?id=${applicationId}`, {
                method: 'DELETE',
            });
        } catch (error) {
            console.error('Error deleting application:', error);
            loadApplications();
        }
    };

    const handleScoreJobs = async () => {
        if (!isSignedIn) {
            setAuthMessage('Sign in to run scoring.');
            setAuthModalOpen(true);
            return;
        }
        setIsScoring(true);
        try {
            const res = await fetch('/api/score-jobs', { method: 'POST' });
            const data = await res.json();
            
            if (data.scored && data.scored.length > 0) {
                // Reload jobs to get updated scores
                await loadJobs(false);
                
                // Show success with score info
                const avgScore = data.summary?.avgScore || 0;
                const scoredCount = data.scored.length;
                alert(`Scored ${scoredCount} jobs! Average score: ${avgScore}`);
            } else if (data.message && data.message.includes('No jobs')) {
                alert(data.message);
            } else if (data.errors && data.errors.length > 0) {
                alert('Scoring errors: ' + data.errors.join(', '));
            } else {
                alert('No jobs were scored. ' + (data.message || ''));
            }
        } catch (err) {
            alert('Scoring error: ' + (err instanceof Error ? err.message : String(err)));
        } finally {
            setIsScoring(false);
        }
    };

    const handleOpenFilter = () => {
        setIsFilterModalOpen(true);
    };

    const activeApplication = activeId
        ? applications.find((app) => app.id === activeId)
        : null;

    return (
        <div className="app-container">
            {/* Auth Modal */}
            <AuthModal
                isOpen={authModalOpen}
                onClose={() => setAuthModalOpen(false)}
            />

            {/* Left sidebar */}
            <Sidebar
                onFindNow={handleFindNow}
                isLoading={isLoadingJobs}
                onScoreJobs={handleScoreJobs}
                onImportJob={() => setActiveModal('import-job')}
                onFilter={handleOpenFilter}
                isScoring={isScoring}
                isFiltering={false}
                isMobileOpen={isMobileSidebarOpen}
                onCloseMobile={handleCloseMobileSidebar}
            />

            {/* Main Content Area */}
            <div className="main-content">

                {/* Mobile Header (Visible < 900px) */}
                <div className="mobile-header">
                    <button
                        className="hamburger-btn"
                        onClick={() => setIsMobileSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="3" y1="6" x2="21" y2="6" />
                            <line x1="3" y1="12" x2="21" y2="12" />
                            <line x1="3" y1="18" x2="21" y2="18" />
                        </svg>
                    </button>
                    <div className="mobile-header-title">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/aladdin-logo.png" alt="Aladdin" className="mobile-header-logo" />
                        <span>Aladdin</span>
                    </div>
                    {/* Spacer to balance hamburger */}
                    <div style={{ width: 44 }}></div>
                </div>

                {/* View Toggle Tabs */}
                <div className="view-tabs">
                    <Link
                        href="/"
                        className={`view-tab ${isJobBoard && !isMapMode ? 'active' : ''}`}
                        data-tour-id="tour-job-listings"
                    >
                        Job Listings
                    </Link>
                    <Link
                        href="/application-tracker"
                        className={`view-tab ${isTracker ? 'active' : ''}`}
                        style={{ position: 'relative', opacity: !isSignedIn ? 0.65 : 1 }}
                        data-tour-id="tour-tracker-tab"
                    >
                        Application Tracker {isSignedIn && `(${applications.length})`}
                        {!isSignedIn && <span style={{ marginLeft: 6, opacity: 0.5 }}>🔒</span>}
                    </Link>
                    <Link
                        href="/find-referrals"
                        className={`view-tab ${isReferrals ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: !isSignedIn ? 0.65 : 1 }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        Referrals
                        {!isSignedIn && <span style={{ marginLeft: 6, opacity: 0.5 }}>🔒</span>}
                    </Link>
                    <Link
                        href="/jobs-map"
                        className={`view-tab ${isJobBoard && isMapMode ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: !isSignedIn ? 0.65 : 1 }}
                        data-tour-id="tour-map-tab"
                    >
                        <MapIcon size={14} />
                        Jobs Map
                        {!isSignedIn && <span style={{ marginLeft: 6, opacity: 0.5 }}>🔒</span>}
                    </Link>
                    <Link
                        href="/interview-experiences"
                        className={`view-tab ${isInterviewExperiences ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        data-tour-id="tour-interviews-tab"
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"></path></svg>
                        Interview Experiences
                    </Link>
                    <Link
                        href="/practice"
                        className={`view-tab ${isPracticeView ? 'active' : ''}`}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                        data-tour-id="tour-practice-tab"
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                            src="/practice.gif" 
                            alt="Practice" 
                            width={16} 
                            height={16} 
                            className="practice-icon"
                        />
                        Practice
                    </Link>
                </div>

                {/* Content based on active view */}
                {isJobBoard && (
                    <div className="content-area" style={{ height: isMapMode ? 'calc(100vh - 60px)' : undefined }}>
                        {/* Auth overlay for unauthenticated users on Map */}
                        {isMapMode && !isSignedIn && (
                            <AuthModal
                                isOpen={true}
                                onClose={() => router.push('/')}
                            />
                        )}
                        {isMapMode ? (
                            <div style={{ position: 'relative', height: '100%', width: '100%' }}>
                                <JobsMap
                                    onJobClick={(jobId: string) => {
                                        const job = jobs.find(j => j.id === jobId);
                                        if (job) handleJobClick(job);
                                    }}
                                    onJobOpen={(jobId: string) => {
                                        const job = jobs.find(j => j.id === jobId);
                                        if (job) {
                                            setSelectedMapJob(job);
                                        } else {
                                            // Fallback: If job not in current list (pagination?), we might need to fetch it.
                                            // For now, we unfortunately can't show details if not loaded.
                                            // TODO: Implementing single job fetch would be better.
                                            console.warn("Job not found in current list:", jobId);
                                        }
                                    }}
                                    onJobSave={(jobId: string) => {
                                        // Toggle save status
                                        // We need the current status. The map might not know it, but the store does.
                                        // Actually toggleJobStatus calculates new status if we pass 'saved'/'fresh'?
                                        // No, toggleJobStatus(id, newStatus).
                                        // We need to find the job to know current status.
                                        const job = jobs.find(j => j.id === jobId);
                                        const currentStatus = job?.status || 'fresh'; // Default to fresh if unknown
                                        toggleJobStatus(jobId, currentStatus === 'saved' ? 'fresh' : 'saved');
                                    }}
                                    onBack={() => {
                                        router.push('/');
                                    }}
                                />

                                {/* Map Detail Overlay */}
                                {selectedMapJob && (
                                    <div
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            right: 0, // Align right usually
                                            width: isNarrowLayout ? '100%' : '50%', // Full width on mobile, half on desktop? Or maybe fixed width?
                                            maxWidth: '600px',
                                            height: '100%',
                                            background: 'var(--background)',
                                            zIndex: 1000,
                                            borderLeft: '1px solid var(--border)',
                                            boxShadow: '-4px 0 16px rgba(0,0,0,0.1)',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                                            <JobDetail
                                                job={selectedMapJob}
                                                onApply={handleApply}
                                                onGenerateCoverLetter={handleGenerateCoverLetter}
                                                onGenerateTailoredResume={handleGenerateTailoredResume}
                                                applicationStatus={applicationStatus[selectedMapJob.id] || 'none'}
                                                isMobileVisible={true} // Always visible in this overlay
                                                onBack={() => setSelectedMapJob(null)} // Close overlay
                                                isAuthenticated={isSignedIn || false}
                                                currentUserId={userId || null}
                                                onJobUpdate={handleJobUpdate}
                                            />
                                        </div>
                                        {/* Close button handled by JobDetail's onBack or custom X? 
                                            JobDetail has a mobile back button. 
                                            For desktop, JobDetail doesn't usually show a close button unless isMobileVisible?
                                            Actually JobDetail only shows Back button if onBack is provided.
                                            So passing onBack will show the "Back to Jobs" (or similar) button.
                                            We might want a specific "X" if the design calls for it.
                                            The user asked for: "X" on top right.
                                            JobDetail likely needs to support closing or we overlay an X.
                                            Let's overlay a dedicated Close button if JobDetail implementation doesn't fit perfectly.
                                            But JobDetail header is sticky.
                                            Let's try passing onBack first.
                                        */}
                                        {!isNarrowLayout && (
                                            <button
                                                onClick={() => setSelectedMapJob(null)}
                                                style={{
                                                    position: 'absolute',
                                                    top: '12px',
                                                    right: '20px',
                                                    zIndex: 20,
                                                    background: 'rgba(255,255,255,0.8)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '50%',
                                                    width: '32px',
                                                    height: '32px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    color: 'var(--text-primary)',
                                                    backdropFilter: 'blur(4px)'
                                                }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Show Job List (Unified for Public/Private) */}
                                <div style={{
                                    display: (isNarrowLayout && selectedJob) ? 'none' : 'block',
                                    width: isNarrowLayout ? '100%' : undefined,
                                    height: '100%'
                                }}>
                                    <JobList
                                        onJobClick={handleJobClick}
                                        recommendedJobs={recommendedJobs}
                                        recommendedStatus={recommendedStatus}
                                        recommendedMessage={recommendedMessage}
                                    />
                                </div>

                                <div style={{
                                    display: (isNarrowLayout && !selectedJob) ? 'none' : 'block',
                                    flex: 1,
                                    // In narrow mode, ensure it takes full width
                                    width: isNarrowLayout ? '100%' : undefined
                                }}>
                                    <JobDetail
                                        job={selectedJob}
                                        onApply={handleApply}
                                        onGenerateCoverLetter={handleGenerateCoverLetter}
                                        onGenerateTailoredResume={handleGenerateTailoredResume}
                                        applicationStatus={selectedJob ? (applicationStatus[selectedJob.id] || 'none') : 'none'}
                                        isMobileVisible={isMobileJobDetailVisible}
                                        onBack={isNarrowLayout ? handleMobileBack : undefined}
                                        isAuthenticated={isSignedIn || false}
                                        currentUserId={userId || null}
                                        onJobUpdate={handleJobUpdate}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                )}

                {isTracker && (
                    <div className="tracker-container" style={{ position: 'relative' }}>
                        {/* Auth overlay for unauthenticated users on tracker */}
                        {!isSignedIn && (
                            <AuthModal
                                isOpen={true}
                                onClose={() => router.push('/')}
                            />
                        )}

                        <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        >
                            <div className="kanban-columns">
                                {COLUMNS.map((column) => (
                                    <DroppableColumn
                                        key={column}
                                        column={column}
                                        applications={applications}
                                        onDelete={handleDeleteApplication}
                                    />
                                ))}
                            </div>

                            <DragOverlay>
                                {activeApplication && (
                                    <div
                                        className="card"
                                        style={{
                                            padding: '12px',
                                            background: 'var(--surface)',
                                            border: '2px solid var(--accent)',
                                            borderRadius: 'var(--radius-md)',
                                            boxShadow: 'var(--shadow-lg)',
                                            cursor: 'grabbing',
                                            width: '200px',
                                        }}
                                    >
                                        <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                                            {activeApplication.job?.company || 'Unknown Company'}
                                        </h4>
                                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            {activeApplication.job?.title || 'Unknown Position'}
                                        </p>
                                    </div>
                                )}
                            </DragOverlay>
                        </DndContext>
                    </div>
                )}

                {isReferrals && (
                    isSignedIn
                        ? <ReferralsView />
                        : <AuthModal isOpen={true} onClose={() => router.push('/')} />
                )}

                {isInterviewExperiences && (
                    selectedCompany ? (
                        <InterviewExperienceDetailView companyName={selectedCompany} />
                    ) : (
                        <InterviewExperiencesView />
                    )
                )}

                {isPracticeView && (
                    selectedCompany ? (
                        <CompanyQuestionsTable companyName={selectedCompany} />
                    ) : (
                        <PracticeView />
                    )
                )}

                {isUpgrade && (
                    <div className="content-area content-area--pricing">
                        <UpgradePlans />
                    </div>
                )}
            </div>

            {/* Cover Letter Setup Modal */}
            <CoverLetterSetupModal
                isOpen={coverLetterSetupModal.isOpen}
                onClose={() => setCoverLetterSetupModal(prev => ({ ...prev, isOpen: false }))}
                onGenerate={(description) => handleConfirmGenerateCoverLetter(coverLetterSetupModal.jobId!, description)}
                jobTitle={coverLetterSetupModal.jobTitle}
                company={coverLetterSetupModal.company}
                jobUrl={coverLetterSetupModal.jobUrl}
                initialDescription={coverLetterSetupModal.initialDescription}
            />

            {/* Cover Letter Modal */}
            <CoverLetterModal
                isOpen={coverLetterModal.isOpen}
                onClose={() => setCoverLetterModal(prev => ({ ...prev, isOpen: false }))}
                coverLetterHtml={coverLetterModal.html}
                coverLetterText={coverLetterModal.text}

                jobTitle={coverLetterModal.jobTitle}
                company={coverLetterModal.company}

                // New Props
                coverLetterId={coverLetterModal.coverLetterId}
                error={coverLetterModal.error}
                isGenerating={coverLetterModal.isGenerating}
                onRegenerate={() => handleConfirmGenerateCoverLetter(coverLetterModal.jobId!, coverLetterSetupModal.initialDescription || '')} // Retry with same desc
                onQueue={() => activeId && handleGenerateCoverLetter(activeId, true)}
                progressStages={coverLetterProgress.stages}
                progressCurrentStage={coverLetterProgress.currentStageIndex}
            />

            {/* Modals */}
            {activeModal === 'import-job-selection' && (
                <ImportJobSelectionModal
                    onClose={() => setActiveModal(null)}
                    onSelect={(flow) => {
                        if (flow === 'manual') setActiveModal('import-job-manual');
                        else setActiveModal('import-job-auto');
                    }}
                />
            )}
            {activeModal === 'import-job-manual' && (
                <ManualImportModal
                    onClose={() => setActiveModal(null)}
                    onImportSuccess={() => loadJobs(true)}
                />
            )}
            {activeModal === 'import-job-auto' && (
                <ImportJobModal
                    onClose={() => setActiveModal(null)}
                    onImportSuccess={() => loadJobs(true)}
                />
            )}

            {/* Tailored Resume Editor — state managed by ResumeGenerationContext */}
            <TailoredResumeEditor />

            {/* Resume Selector Modal */}
            {activeModal === 'resume-selector' && (
                <ResumeSelector
                    onClose={() => setActiveModal(null)}
                />
            )}

            {/* LinkedIn Selector Modal */}
            {activeModal === 'linkedin-selector' && (
                <LinkedInSelector
                    onClose={() => setActiveModal(null)}
                />
            )}

            {/* Filter Modal */}
            <FilterModal
                isOpen={isFilterModalOpen}
                onClose={() => setIsFilterModalOpen(false)}
            />

            {/* Cover letter gate modals */}
            <LiteUpgradeModal
                open={gateModal?.type === 'lite'}
                onClose={() => setGateModal(null)}
            />
            {sub.planType === 'CAPTAIN' ? (
                <CaptainLimitModal
                    open={gateModal?.type === 'limit'}
                    onClose={() => setGateModal(null)}
                    resetDate={gateModal?.resetDate ?? null}
                />
            ) : (
                <LimitReachedModal
                    open={gateModal?.type === 'limit'}
                    onClose={() => setGateModal(null)}
                    feature={gateModal?.feature ?? 'coverLettersGenerated'}
                    resetDate={gateModal?.resetDate ?? null}
                />
            )}

            {/* Resume generation gate modals */}
            <LiteUpgradeModal
                open={resumeBlockedBy?.reason === 'UNAUTHORIZED'}
                onClose={clearResumeBlockedBy}
            />
            {sub.planType === 'CAPTAIN' ? (
                <CaptainLimitModal
                    open={resumeBlockedBy?.reason === 'LIMIT_REACHED'}
                    onClose={clearResumeBlockedBy}
                    resetDate={resumeBlockedBy?.resetDate ?? null}
                />
            ) : (
                <LimitReachedModal
                    open={resumeBlockedBy?.reason === 'LIMIT_REACHED'}
                    onClose={clearResumeBlockedBy}
                    feature={resumeBlockedBy?.feature ?? 'resumesGenerated'}
                    resetDate={resumeBlockedBy?.resetDate ?? null}
                />
            )}
        </div>
    );
}
