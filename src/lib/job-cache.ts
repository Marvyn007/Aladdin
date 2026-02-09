/**
 * Job Cache Service
 * 
 * LinkedIn-style Stale-While-Revalidate caching for jobs, applications, and map pins.
 * Uses sessionStorage for session-based persistence (clears on browser close).
 */

import type { Job, Application } from '@/types';

// Cache keys
export const JobCacheKeys = {
    JOBS: 'aladdin_jobs_cache',
    JOBS_META: 'aladdin_jobs_meta',
    APPLICATIONS: 'aladdin_applications_cache',
    APPLICATIONS_META: 'aladdin_applications_meta',
    MAP_PINS: 'aladdin_map_pins_cache',
    MAP_PINS_META: 'aladdin_map_pins_meta',
} as const;

// Cache metadata structure
interface CacheMeta {
    timestamp: number;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    lastUpdated?: string | null;
}

interface JobsCache {
    jobs: Job[];
    meta: CacheMeta;
}

interface ApplicationsCache {
    applications: Application[];
    meta: CacheMeta;
}

interface MapPinsCache {
    features: any[];
    meta: CacheMeta;
}

// Default stale threshold: 5 minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

/**
 * Check if sessionStorage is available (handles SSR and private browsing)
 */
function isStorageAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const test = '__storage_test__';
        sessionStorage.setItem(test, test);
        sessionStorage.removeItem(test);
        return true;
    } catch {
        return false;
    }
}

/**
 * Safely get item from sessionStorage
 */
function safeGetItem(key: string): string | null {
    if (!isStorageAvailable()) return null;
    try {
        return sessionStorage.getItem(key);
    } catch {
        return null;
    }
}

/**
 * Safely set item in sessionStorage
 */
function safeSetItem(key: string, value: string): boolean {
    if (!isStorageAvailable()) return false;
    try {
        sessionStorage.setItem(key, value);
        return true;
    } catch (e) {
        // Handle quota exceeded
        console.warn('[JobCache] Storage quota exceeded, clearing old cache');
        try {
            // Clear all our cache keys and retry
            Object.values(JobCacheKeys).forEach(k => sessionStorage.removeItem(k));
            sessionStorage.setItem(key, value);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Safely remove item from sessionStorage
 */
function safeRemoveItem(key: string): void {
    if (!isStorageAvailable()) return;
    try {
        sessionStorage.removeItem(key);
    } catch {
        // Ignore errors
    }
}

// ============================================
// JOBS CACHE
// ============================================

/**
 * Get cached jobs if available
 */
export function getCachedJobs(): JobsCache | null {
    const jobsJson = safeGetItem(JobCacheKeys.JOBS);
    const metaJson = safeGetItem(JobCacheKeys.JOBS_META);

    if (!jobsJson || !metaJson) return null;

    try {
        const jobs = JSON.parse(jobsJson) as Job[];
        const meta = JSON.parse(metaJson) as CacheMeta;
        return { jobs, meta };
    } catch {
        // Invalid cache, clear it
        invalidateJobsCache();
        return null;
    }
}

/**
 * Cache jobs with metadata
 */
export function setCachedJobs(
    jobs: Job[],
    pagination: { page: number; limit: number; total: number; totalPages: number },
    lastUpdated?: string | null
): void {
    const meta: CacheMeta = {
        timestamp: Date.now(),
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        lastUpdated,
    };

    safeSetItem(JobCacheKeys.JOBS, JSON.stringify(jobs));
    safeSetItem(JobCacheKeys.JOBS_META, JSON.stringify(meta));
}

/**
 * Append jobs from a new page to the existing cache
 */
export function appendCachedJobs(
    newJobs: Job[],
    page: number,
    pagination: { limit: number; total: number; totalPages: number },
    lastUpdated?: string | null
): void {
    const existing = getCachedJobs();
    const existingJobs = existing?.jobs || [];

    // Create a Set of existing job IDs for deduplication
    const existingIds = new Set(existingJobs.map(j => j.id));

    // Filter out duplicates from new jobs
    const uniqueNewJobs = newJobs.filter(j => !existingIds.has(j.id));

    // Combine and update cache
    const combinedJobs = [...existingJobs, ...uniqueNewJobs];

    const meta: CacheMeta = {
        timestamp: Date.now(),
        page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        lastUpdated,
    };

    safeSetItem(JobCacheKeys.JOBS, JSON.stringify(combinedJobs));
    safeSetItem(JobCacheKeys.JOBS_META, JSON.stringify(meta));
}

/**
 * Invalidate (clear) the jobs cache
 */
export function invalidateJobsCache(): void {
    safeRemoveItem(JobCacheKeys.JOBS);
    safeRemoveItem(JobCacheKeys.JOBS_META);
}

/**
 * Check if jobs cache is stale (older than threshold)
 */
export function isJobsCacheStale(meta?: CacheMeta | null): boolean {
    if (!meta) return true;
    return Date.now() - meta.timestamp > STALE_THRESHOLD_MS;
}

/**
 * Get jobs for a specific page from cache (if available)
 */
export function getCachedJobsForPage(page: number, limit: number = 50): Job[] | null {
    const cached = getCachedJobs();
    if (!cached) return null;

    const start = (page - 1) * limit;
    const end = start + limit;

    // Check if we have enough jobs cached for this page
    if (cached.jobs.length >= end || page === cached.meta.totalPages) {
        return cached.jobs.slice(start, end);
    }

    return null; // Page not in cache
}

// ============================================
// APPLICATIONS CACHE
// ============================================

/**
 * Get cached applications if available
 */
export function getCachedApplications(): ApplicationsCache | null {
    const appsJson = safeGetItem(JobCacheKeys.APPLICATIONS);
    const metaJson = safeGetItem(JobCacheKeys.APPLICATIONS_META);

    if (!appsJson || !metaJson) return null;

    try {
        const applications = JSON.parse(appsJson) as Application[];
        const meta = JSON.parse(metaJson) as CacheMeta;
        return { applications, meta };
    } catch {
        invalidateApplicationsCache();
        return null;
    }
}

/**
 * Cache applications with metadata
 */
export function setCachedApplications(applications: Application[]): void {
    const meta: CacheMeta = {
        timestamp: Date.now(),
        page: 1,
        limit: applications.length,
        total: applications.length,
        totalPages: 1,
    };

    safeSetItem(JobCacheKeys.APPLICATIONS, JSON.stringify(applications));
    safeSetItem(JobCacheKeys.APPLICATIONS_META, JSON.stringify(meta));
}

/**
 * Invalidate (clear) the applications cache
 */
export function invalidateApplicationsCache(): void {
    safeRemoveItem(JobCacheKeys.APPLICATIONS);
    safeRemoveItem(JobCacheKeys.APPLICATIONS_META);
}

/**
 * Check if applications cache is stale
 */
export function isApplicationsCacheStale(meta?: CacheMeta | null): boolean {
    if (!meta) return true;
    return Date.now() - meta.timestamp > STALE_THRESHOLD_MS;
}

// ============================================
// MAP PINS CACHE
// ============================================

/**
 * Get cached map pins if available
 */
export function getCachedMapPins(): MapPinsCache | null {
    const pinsJson = safeGetItem(JobCacheKeys.MAP_PINS);
    const metaJson = safeGetItem(JobCacheKeys.MAP_PINS_META);

    if (!pinsJson || !metaJson) return null;

    try {
        const features = JSON.parse(pinsJson);
        const meta = JSON.parse(metaJson) as CacheMeta;
        return { features, meta };
    } catch {
        invalidateMapPinsCache();
        return null;
    }
}

/**
 * Cache map pins with metadata
 */
export function setCachedMapPins(features: any[]): void {
    const meta: CacheMeta = {
        timestamp: Date.now(),
        page: 1,
        limit: features.length,
        total: features.length,
        totalPages: 1,
    };

    safeSetItem(JobCacheKeys.MAP_PINS, JSON.stringify(features));
    safeSetItem(JobCacheKeys.MAP_PINS_META, JSON.stringify(meta));
}

/**
 * Invalidate (clear) the map pins cache
 */
export function invalidateMapPinsCache(): void {
    safeRemoveItem(JobCacheKeys.MAP_PINS);
    safeRemoveItem(JobCacheKeys.MAP_PINS_META);
}

/**
 * Check if map pins cache is stale
 */
export function isMapPinsCacheStale(meta?: CacheMeta | null): boolean {
    if (!meta) return true;
    return Date.now() - meta.timestamp > STALE_THRESHOLD_MS;
}

// ============================================
// GLOBAL CACHE CONTROL
// ============================================

/**
 * Invalidate ALL caches (useful for sign-out or major data changes)
 */
export function invalidateAllCaches(): void {
    invalidateJobsCache();
    invalidateApplicationsCache();
    invalidateMapPinsCache();
}
