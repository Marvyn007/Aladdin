/**
 * User-scoped in-memory cache for parsed resume data.
 *
 * Key: `userId:sessionId`
 * Auto-expires entries after TTL_MS (30 minutes).
 * Call invalidateForUser() when a resume is deleted.
 */

interface CacheEntry {
    data: unknown;
    expiresAt: number;
}

const TTL_MS = 30 * 60 * 1000; // 30 minutes

const cache = new Map<string, CacheEntry>();

function makeKey(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`;
}

/** Remove expired entries (lazy sweep). */
function sweep(): void {
    const now = Date.now();
    for (const [key, entry] of cache) {
        if (entry.expiresAt <= now) {
            cache.delete(key);
        }
    }
}

/**
 * Store parsed resume data in the user-scoped cache.
 */
export function setCachedParse(
    userId: string,
    sessionId: string,
    data: unknown
): void {
    sweep();
    cache.set(makeKey(userId, sessionId), {
        data,
        expiresAt: Date.now() + TTL_MS,
    });
}

/**
 * Retrieve cached parsed data. Returns null if expired or missing.
 */
export function getCachedParse(
    userId: string,
    sessionId: string
): unknown | null {
    const key = makeKey(userId, sessionId);
    const entry = cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

/**
 * Invalidate ALL cached entries for a given user.
 * Must be called when a resume is deleted.
 */
export function invalidateForUser(userId: string): void {
    const prefix = `${userId}:`;
    for (const key of cache.keys()) {
        if (key.startsWith(prefix)) {
            cache.delete(key);
        }
    }
}

/**
 * Clear the entire cache (useful for testing).
 */
export function clearCache(): void {
    cache.clear();
}

/**
 * Get current cache size (for diagnostics).
 */
export function getCacheSize(): number {
    sweep();
    return cache.size;
}
