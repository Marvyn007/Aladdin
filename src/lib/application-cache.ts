/**
 * Application Cache Service
 * 
 * Session-based caching for applications only.
 * Uses sessionStorage for session-based persistence (clears on browser close).
 */

import type { Application } from '@/types';

// Cache keys
export const ApplicationCacheKeys = {
    APPLICATIONS: 'aladdin_applications_cache',
    APPLICATIONS_META: 'aladdin_applications_meta',
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

interface ApplicationsCache {
    applications: Application[];
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
        console.warn('[ApplicationCache] Storage quota exceeded, clearing old cache');
        try {
            sessionStorage.removeItem(ApplicationCacheKeys.APPLICATIONS);
            sessionStorage.removeItem(ApplicationCacheKeys.APPLICATIONS_META);
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
// APPLICATIONS CACHE
// ============================================

/**
 * Get cached applications if available
 */
export function getCachedApplications(): ApplicationsCache | null {
    const appsJson = safeGetItem(ApplicationCacheKeys.APPLICATIONS);
    const metaJson = safeGetItem(ApplicationCacheKeys.APPLICATIONS_META);

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

    safeSetItem(ApplicationCacheKeys.APPLICATIONS, JSON.stringify(applications));
    safeSetItem(ApplicationCacheKeys.APPLICATIONS_META, JSON.stringify(meta));
}

/**
 * Invalidate (clear) the applications cache
 */
export function invalidateApplicationsCache(): void {
    safeRemoveItem(ApplicationCacheKeys.APPLICATIONS);
    safeRemoveItem(ApplicationCacheKeys.APPLICATIONS_META);
}

/**
 * Check if applications cache is stale
 */
export function isApplicationsCacheStale(meta?: CacheMeta | null): boolean {
    if (!meta) return true;
    return Date.now() - meta.timestamp > STALE_THRESHOLD_MS;
}
