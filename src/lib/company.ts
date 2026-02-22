import { getDbType } from './db';
import { getPostgresPool } from './postgres';
import { getSupabaseClient } from './supabase';
import { getSQLiteDB } from './sqlite';

const CACHE_TTL_HOURS = 24;

export interface CompanySuggestion {
    id: string;
    name: string;
    domain: string;
    logo_url: string | null;
}

/**
 * Validates if a logo URL is a real image and not a fallback lettermark.
 */
export function isValidLogoUrl(url: string | null): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();

    // Block Brandfetch fallback/lettermark URLs
    if (lower.includes('fallback/lettermark') || lower.includes('/lettermark/')) {
        return false;
    }

    // Basic image extension check or common patterns can go here
    return true;
}

// Logo resolution utility
export async function getCompanyLogoUrl(companyName: string | null, companyDomain: string | null, forceRefresh: boolean = false): Promise<string | null> {
    if (!companyName && !companyDomain) return null;

    // We can search the cache if we have the domain or name
    const cacheKey = companyDomain || companyName!;

    if (!forceRefresh) {
        // Try to find an existing non-expired logo in the jobs table
        const cachedUrl = await getCachedLogoUrl(companyName, companyDomain);
        if (cachedUrl !== undefined) {
            return cachedUrl; // Returns string or null if we explicitly cached a failure recently
        }
    }

    try {
        const logoUrl = await resolveProviderLogo(companyName, companyDomain);

        // Cache the result (even if null, indicating failure to find logo, to prevent retrying)
        // For simplicity, we only explicitly cache via `logo_cached_at` when saving jobs,
        // but for dynamic resolution like this, we'll try to update an existing job record if one matches.

        // Return resolved URL
        return logoUrl;
    } catch (e) {
        console.error('[Company] Error resolving logo:', e);
        return null;
    }
}

async function getCachedLogoUrl(companyName: string | null, companyDomain: string | null): Promise<string | null | undefined> {
    const dbType = getDbType();

    try {
        if (dbType === 'postgres') {
            const pool = getPostgresPool();
            if (companyName) {
                const res = await pool.query(
                    `SELECT logo_url, logo_fetched FROM companies WHERE name ILIKE $1 LIMIT 1`,
                    [companyName]
                );
                if (res.rows.length > 0) {
                    const row = res.rows[0];
                    return row.logo_fetched ? row.logo_url : undefined;
                }
            }
        } else if (dbType === 'supabase') {
            const client = getSupabaseClient();
            if (companyName) {
                const { data } = await client
                    .from('companies')
                    .select('logo_url, logo_fetched')
                    .ilike('name', companyName)
                    .maybeSingle();
                if (data) {
                    return data.logo_fetched ? data.logo_url : undefined;
                }
            }
        } else {
            const db = getSQLiteDB();
            if (companyName) {
                const row = db.prepare(
                    `SELECT logo_url, logo_fetched FROM companies WHERE name LIKE ? LIMIT 1`
                ).get(companyName) as { logo_url: string | null; logo_fetched: number };
                if (row) {
                    return row.logo_fetched ? row.logo_url : undefined;
                }
            }
        }
    } catch (e) {
        console.error('[Company] Error checking company cache:', e);
    }

    return undefined; // Cache miss
}

// Known high-quality logo overrides for common brands that often fail or return poor quality
const BRAND_OVERRIDES: Record<string, string> = {
    'visa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Visa_2021.svg/1200px-Visa_2021.svg.png',
    'mastercard': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png',
    'american express': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/1200px-American_Express_logo_%282018%29.svg.png',
    'amazon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1024px-Amazon_logo.svg.png',
};

async function resolveProviderLogo(companyName: string | null, companyDomain: string | null): Promise<string | null> {
    const provider = process.env.LOGO_PROVIDER || 'logo.dev';

    if (provider === 'none') {
        return null;
    }

    // 0. Check for hardcoded overrides
    if (companyName) {
        const lowerName = companyName.toLowerCase().trim();
        for (const [brand, url] of Object.entries(BRAND_OVERRIDES)) {
            if (lowerName === brand || lowerName.includes(brand)) {
                return url;
            }
        }
    }

    // 1. Attempt Logo.dev if configured
    if (provider === 'logo.dev' && process.env.LOGO_API_KEY) {
        // Clean target: if it's a domain, use it; otherwise, guess it
        const cleanDomain = companyDomain || guessDomain(companyName);
        if (cleanDomain) {
            try {
                const logoDevUrl = `https://img.logo.dev/${encodeURIComponent(cleanDomain)}?token=${process.env.LOGO_API_KEY}&size=120`;
                // Verify the logo exists/resolves to something real before returning
                const check = await fetchWithTimeout(logoDevUrl, { method: 'HEAD' }, 1500);
                if (check.ok) {
                    return logoDevUrl;
                }
            } catch (e) {
                console.warn('[Company] logo.dev check failed', e);
            }
        }
    }

    // 2. Scraping metadata from the website
    const targetDomain = companyDomain || guessDomain(companyName);
    if (targetDomain) {
        const scrapedLogo = await scrapeLogoFromWebsite(targetDomain);
        if (scrapedLogo) return scrapedLogo;
    }

    // 3. Fallback: Search scraping (Simulated "Google Logo Search")
    // If we have a name but no logo, we try to find one via a search API if available, 
    // or higher-quality public sources.
    if (companyName) {
        try {
            // Priority: Clearbit (public API, good for common companies)
            const cleanDomain = targetDomain || guessDomain(companyName);
            if (cleanDomain) {
                const clearbitUrl = `https://logo.clearbit.com/${cleanDomain}`;
                const check = await fetchWithTimeout(clearbitUrl, { method: 'HEAD' }, 1000);
                if (check.ok) return clearbitUrl;
            }
        } catch (e) { }
    }

    // 4. Direct Favicon request (Google S2)
    if (targetDomain) {
        const domainStr = targetDomain.replace(/^https?:\/\//, '').split('/')[0];
        try {
            const googleFaviconUrl = `https://s2.googleusercontent.com/s2/favicons?domain=${domainStr}&sz=128`;
            const check = await fetchWithTimeout(googleFaviconUrl, { method: 'HEAD' }, 1000);
            if (check.ok) {
                return googleFaviconUrl;
            }
        } catch (e) { }
    }

    return null;
}

/**
 * Guesses a domain from a company name.
 */
function guessDomain(companyName: string | null): string | null {
    if (!companyName) return null;
    const clean = companyName.toLowerCase().trim()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '');
    if (!clean) return null;
    return clean + '.com';
}

/**
 * Fetches the website and attempts to extract a logo from manifest/meta tags.
 */
async function scrapeLogoFromWebsite(domain: string): Promise<string | null> {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    try {
        const response = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 3000);
        if (!response.ok) return null;
        const html = await response.text();

        // Priority order: apple-touch-icon > og:image > manifest > icon

        // 1. apple-touch-icon
        const appleIcon = html.match(/<link[^>]+rel=["']apple-touch-icon(?:-precomposed)?["'][^>]+href=["']([^"']+)["']/i) ||
            html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon(?:-precomposed)?["']/i);
        if (appleIcon && appleIcon[1]) return resolveUrl(url, appleIcon[1]);

        // 2. og:image
        const ogImage = html.match(/<meta[^>]+(?:property|name)=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
            html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']og:image["']/i);
        if (ogImage && ogImage[1]) return resolveUrl(url, ogImage[1]);

        // 3. shortcut icon or icon
        const icon = html.match(/<link[^>]+rel=["'](?:shortcut )?icon["'][^>]+href=["']([^"']+)["']/i) ||
            html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'](?:shortcut )?icon["']/i);
        if (icon && icon[1]) return resolveUrl(url, icon[1]);

        // 4. twitter:image
        const twitterImage = html.match(/<meta[^>]+(?:property|name)=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
        if (twitterImage && twitterImage[1]) return resolveUrl(url, twitterImage[1]);

        return null;
    } catch (e) {
        return null;
    }
}

function resolveUrl(baseUrl: string, relativeUrl: string): string {
    try {
        // Handle protocol-relative URLs
        if (relativeUrl.startsWith('//')) {
            const protocol = new URL(baseUrl).protocol;
            return `${protocol}${relativeUrl}`;
        }
        return new URL(relativeUrl, baseUrl).toString();
    } catch (e) {
        return relativeUrl;
    }
}

// Simple fetch wrapper with timeout
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 500): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        throw e;
    }
}

// Database Helpers for Persistent Company Caching
export async function searchCompaniesInDb(query: string): Promise<CompanySuggestion[]> {
    const dbType = getDbType();

    // Safety check
    if (!query || query.trim().length < 2) return [];

    try {
        if (dbType === 'postgres') {
            const pool = getPostgresPool();
            const res = await pool.query(
                `SELECT name, domain, logo_url FROM companies WHERE name ILIKE $1 ORDER BY name ASC LIMIT 7`,
                [`%${query}%`]
            );
            return res.rows.map(r => ({
                id: Math.random().toString(36).substring(7),
                name: r.name,
                domain: r.domain || '',
                logo_url: r.logo_url
            }));
        } else if (dbType === 'supabase') {
            const client = getSupabaseClient();
            const { data } = await client
                .from('companies')
                .select('name, domain, logo_url')
                .ilike('name', `%${query}%`)
                .order('name', { ascending: true })
                .limit(7);

            return (data || []).map(r => ({
                id: Math.random().toString(36).substring(7),
                name: r.name,
                domain: r.domain || '',
                logo_url: r.logo_url
            }));
        } else {
            const db = getSQLiteDB();
            const rows = db.prepare(
                `SELECT name, domain, logo_url FROM companies WHERE name LIKE ? ORDER BY name ASC LIMIT 7`
            ).all(`%${query}%`) as any[];

            return rows.map(r => ({
                id: Math.random().toString(36).substring(7),
                name: r.name,
                domain: r.domain || '',
                logo_url: r.logo_url
            }));
        }
    } catch (e) {
        console.error('[Company] Error searching companies in DB:', e);
        return [];
    }
}

export async function saveCompanyToDb(name: string, domain: string | null, logoUrl: string | null) {
    const dbType = getDbType();

    // Strict Validation
    const isValid = isValidLogoUrl(logoUrl);
    const finalLogo = isValid ? logoUrl : null;
    const isFetched = isValid; // Only mark as fetched if we actually got a valid logo

    try {
        if (dbType === 'postgres') {
            const pool = getPostgresPool();
            await pool.query(`
                INSERT INTO companies (id, name, domain, logo_url, logo_fetched, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (name) DO UPDATE SET
                    domain = EXCLUDED.domain,
                    logo_url = EXCLUDED.logo_url,
                    logo_fetched = EXCLUDED.logo_fetched,
                    updated_at = NOW()
                WHERE companies.logo_fetched = false
            `, [name, domain, finalLogo, isFetched]);
        } else if (dbType === 'supabase') {
            const client = getSupabaseClient();

            // Check first to simulate ON CONFLICT WHERE update logic securely via REST
            const { data: existing } = await client.from('companies').select('id, logo_fetched').eq('name', name).maybeSingle();

            if (!existing) {
                await client.from('companies').insert({
                    name,
                    domain,
                    logo_url: finalLogo,
                    logo_fetched: isFetched
                });
            } else if (!existing.logo_fetched && isFetched) {
                await client.from('companies').update({
                    domain,
                    logo_url: finalLogo,
                    logo_fetched: true,
                    updated_at: new Date().toISOString()
                }).eq('id', existing.id);
            }
        } else {
            const db = getSQLiteDB();
            db.prepare(`
                INSERT INTO companies (id, name, domain, logo_url, logo_fetched, created_at, updated_at)
                VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(name) DO UPDATE SET
                    domain = excluded.domain,
                    logo_url = excluded.logo_url,
                    logo_fetched = excluded.logo_fetched,
                    updated_at = datetime('now')
                WHERE companies.logo_fetched = 0
            `).run(name, domain, finalLogo, isFetched ? 1 : 0);
        }
    } catch (e) {
        console.error('[Company] Error saving company to DB:', e);
    }
}
