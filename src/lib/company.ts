import { getDbType } from './db';
import { getPostgresPool } from './postgres';
import { getSupabaseClient } from './supabase';
import { getSQLiteDB } from './sqlite';

const CACHE_TTL_HOURS = 24;
const CACHE_TTL_MS = CACHE_TTL_HOURS * 60 * 60 * 1000;

const PROVIDER_PATTERNS = [/logo\.dev/i, /logo\.clearbit\.com/i];
const metadataCache = new Map<string, CompanyLogoResolution | null>();

export interface CompanySuggestion {
    id: string;
    name: string;
    domain: string;
    logo_url: string | null;
}

export type LogoConfidence = 'metadata' | 'manifest' | 'favicon' | 'provider' | 'none';
export type LogoSource =
    | 'cache'
    | 'mask-icon'
    | 'apple-touch-icon'
    | 'og-image'
    | 'twitter-image'
    | 'manifest'
    | 'favicon'
    | 'brand-override'
    | 'provider:logo.dev'
    | 'provider:clearbit'
    | 'provider:google'
    | 'fallback'
    | 'none';

export interface CompanyLogoResolution {
    name: string | null;
    domain: string | null;
    logoUrl: string | null;
    source: LogoSource;
    confidence: LogoConfidence;
    fetched: boolean;
}

export interface EnsureCompanyProfileInput {
    name: string | null;
    domain?: string | null;
    websiteUrl?: string | null;
    forceRefresh?: boolean;
}

interface LogoCandidate {
    domain: string | null;
    logoUrl: string;
    source: LogoSource;
    confidence: LogoConfidence;
}

interface SaveCompanyOptions {
    forceUpdate?: boolean;
    allowProviderFallback?: boolean;
}

/**
 * Validates if a logo URL is a real image and not a fallback lettermark.
 */
export function isValidLogoUrl(url: string | null, options?: { allowProviderFallback?: boolean }): boolean {
    if (!url) return false;
    const lower = url.toLowerCase();

    // Block Brandfetch fallback/lettermark URLs
    if (lower.includes('fallback/lettermark') || lower.includes('/lettermark/')) {
        return false;
    }

    const allowProviderFallback = options?.allowProviderFallback ?? true;
    if (!allowProviderFallback) {
        if (PROVIDER_PATTERNS.some((pattern) => pattern.test(lower))) {
            return false;
        }
    }

    return true;
}

// Logo resolution utility
export async function getCompanyLogoUrl(companyName: string | null, companyDomain: string | null, forceRefresh: boolean = false): Promise<string | null> {
    if (!companyName && !companyDomain) return null;
    try {
        const resolution = await ensureCompanyProfile({
            name: companyName,
            domain: companyDomain,
            forceRefresh,
        });
        return resolution.logoUrl;
    } catch (error) {
        console.error('[Company] Error fetching company logo', error);
        return null;
    }
}

const CONFIDENCE_RANK: Record<LogoConfidence, number> = {
    none: 0,
    provider: 1,
    favicon: 2,
    manifest: 3,
    metadata: 4,
};

function inferConfidenceFromUrl(url: string | null): LogoConfidence {
    if (!url) return 'none';
    const lower = url.toLowerCase();
    if (PROVIDER_PATTERNS.some((pattern) => pattern.test(lower))) return 'provider';
    if (lower.includes('manifest')) return 'manifest';
    if (lower.includes('.ico') || lower.includes('favicon')) return 'favicon';
    return 'metadata';
}

function shouldPersistCandidate(existing: LogoConfidence, candidate: LogoConfidence): boolean {
    return CONFIDENCE_RANK[candidate] >= CONFIDENCE_RANK[existing];
}

function isStaleTimestamp(timestamp?: string | Date | null): boolean {
    if (!timestamp) return true;
    const parsed = new Date(timestamp);
    if (Number.isNaN(parsed.getTime())) return true;
    return Date.now() - parsed.getTime() > CACHE_TTL_MS;
}

function normalizeDomainInput(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed) return null;

    try {
        const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
        const resolved = new URL(withProtocol);
        return resolved.hostname.replace(/^www\./i, '').toLowerCase();
    } catch {
        const fallback = trimmed.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '').toLowerCase();
        return fallback || null;
    }
}

interface CompanyDbRow {
    name: string;
    domain: string | null;
    logo_url: string | null;
    logo_fetched: boolean;
    updated_at: string | Date | null;
}

async function loadCompanyProfile(name: string | null, domain: string | null): Promise<CompanyDbRow | null> {
    const dbType = getDbType();
    const normalizedName = name?.trim() || null;
    const normalizedDomain = normalizeDomainInput(domain);

    try {
        if (normalizedName) {
            if (dbType === 'postgres') {
                const pool = getPostgresPool();
                const result = await pool.query(
                    `SELECT name, domain, logo_url, logo_fetched, updated_at FROM companies WHERE name = $1 LIMIT 1`,
                    [normalizedName]
                );
                if (result.rows.length > 0) return result.rows[0];
            } else if (dbType === 'supabase') {
                const client = getSupabaseClient();
                const { data } = await client
                    .from('companies')
                    .select('name,domain,logo_url,logo_fetched,updated_at')
                    .eq('name', normalizedName)
                    .maybeSingle();
                if (data) return data as CompanyDbRow;
            } else {
                const db = getSQLiteDB();
                const row = db
                    .prepare(`SELECT name, domain, logo_url, logo_fetched, updated_at FROM companies WHERE name = ? LIMIT 1`)
                    .get(normalizedName) as CompanyDbRow | undefined;
                if (row) return row;
            }
        }

        if (normalizedDomain) {
            if (dbType === 'postgres') {
                const pool = getPostgresPool();
                const result = await pool.query(
                    `SELECT name, domain, logo_url, logo_fetched, updated_at FROM companies WHERE domain = $1 LIMIT 1`,
                    [normalizedDomain]
                );
                if (result.rows.length > 0) return result.rows[0];
            } else if (dbType === 'supabase') {
                const client = getSupabaseClient();
                const { data } = await client
                    .from('companies')
                    .select('name,domain,logo_url,logo_fetched,updated_at')
                    .eq('domain', normalizedDomain)
                    .maybeSingle();
                if (data) return data as CompanyDbRow;
            } else {
                const db = getSQLiteDB();
                const row = db
                    .prepare(`SELECT name, domain, logo_url, logo_fetched, updated_at FROM companies WHERE domain = ? LIMIT 1`)
                    .get(normalizedDomain) as CompanyDbRow | undefined;
                if (row) return row;
            }
        }
    } catch (error) {
        console.error('[Company] Error loading company profile from DB', error);
    }

    return null;
}

function createResolutionFromRow(row: CompanyDbRow, overrideName: string | null): CompanyLogoResolution {
    return {
        name: overrideName || row.name,
        domain: row.domain,
        logoUrl: row.logo_url,
        source: row.logo_url ? 'cache' : 'none',
        confidence: inferConfidenceFromUrl(row.logo_url),
        fetched: Boolean(row.logo_fetched),
    };
}

export async function ensureCompanyProfile(input: EnsureCompanyProfileInput): Promise<CompanyLogoResolution> {
    const normalizedName = input.name?.trim() || null;
    const normalizedDomain = normalizeDomainInput(input.domain ?? input.websiteUrl ?? null);
    const fallbackDomain = normalizedDomain || (normalizedName ? guessDomain(normalizedName) : null);
    const existingRow = await loadCompanyProfile(normalizedName, normalizedDomain);
    const cachedResolution = existingRow ? createResolutionFromRow(existingRow, normalizedName) : null;

    const needsRefresh =
        input.forceRefresh ||
        !existingRow ||
        !existingRow.logo_fetched ||
        !existingRow.logo_url ||
        isStaleTimestamp(existingRow.updated_at);

    if (!needsRefresh && cachedResolution) {
        return cachedResolution;
    }

    const fetchDomain = existingRow?.domain || fallbackDomain;
    const candidate = fetchDomain ? await resolveLogoCandidate(normalizedName, fetchDomain) : null;
    if (!candidate) {
        if (cachedResolution) {
            return cachedResolution;
        }
        return {
            name: normalizedName,
            domain: fetchDomain,
            logoUrl: null,
            source: 'none',
            confidence: 'none',
            fetched: false,
        };
    }

    const resolution: CompanyLogoResolution = {
        name: normalizedName,
        domain: candidate.domain || fetchDomain,
        logoUrl: candidate.logoUrl,
        source: candidate.source,
        confidence: candidate.confidence,
        fetched: true,
    };

    if (candidate.logoUrl && normalizedName) {
        const existingConfidence = cachedResolution ? cachedResolution.confidence : 'none';
        const shouldSave = input.forceRefresh || shouldPersistCandidate(existingConfidence, candidate.confidence);
        if (shouldSave) {
            await saveCompanyToDb(normalizedName, resolution.domain, resolution.logoUrl, {
                forceUpdate: Boolean(input.forceRefresh),
            });
        }
    }

    return resolution;
}

async function resolveLogoCandidate(companyName: string | null, targetDomain: string): Promise<LogoCandidate | null> {
    const normalizedDomain = normalizeDomainInput(targetDomain) || targetDomain;
    if (!normalizedDomain) return null;

    const cached = metadataCache.get(normalizedDomain);
    if (cached && cached.logoUrl) {
        return {
            domain: cached.domain,
            logoUrl: cached.logoUrl!,
            source: cached.source,
            confidence: cached.confidence,
        };
    }

    const scrapedCandidate = await scrapeLogoFromWebsite(normalizedDomain);
    if (scrapedCandidate) {
        metadataCache.set(normalizedDomain, {
            name: null,
            domain: scrapedCandidate.domain,
            logoUrl: scrapedCandidate.logoUrl,
            source: scrapedCandidate.source,
            confidence: scrapedCandidate.confidence,
            fetched: true,
        });
        return scrapedCandidate;
    }

    const providerCandidate = await resolveProviderLogo(companyName, normalizedDomain);
    if (providerCandidate) {
        return providerCandidate;
    }

    return null;
}

// Known high-quality logo overrides for common brands that often fail or return poor quality
const BRAND_OVERRIDES: Record<string, string> = {
    'visa': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/Visa_2021.svg/1200px-Visa_2021.svg.png',
    'mastercard': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2a/Mastercard-logo.svg/1280px-Mastercard-logo.svg.png',
    'american express': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/American_Express_logo_%282018%29.svg/1200px-American_Express_logo_%282018%29.svg.png',
    'amazon': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Amazon_logo.svg/1024px-Amazon_logo.svg.png',
};

/**
 * Calls logo.dev's search API (requires secret key) to find the canonical
 * domain and logo for a company by name. Returns null if not found or unconfigured.
 */
async function searchLogoDevByName(companyName: string): Promise<{ domain: string; logoUrl: string } | null> {
    const secretKey = process.env.LOGO_DEV_SECRET_KEY;
    if (!secretKey) return null;
    try {
        const res = await fetchWithTimeout(
            `https://api.logo.dev/search?q=${encodeURIComponent(companyName)}`,
            { headers: { Authorization: `Bearer ${secretKey}` } },
            3000,
        );
        if (!res.ok) return null;
        const data = (await res.json()) as Array<{ name: string; domain: string; logo_url?: string }>;
        if (!Array.isArray(data) || data.length === 0) return null;
        const hit = data[0];
        if (!hit.domain) return null;
        // Build CDN URL using publishable key (falls back to secret key stripped to pk_ equiv)
        const pubKey = process.env.LOGO_API_KEY || process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || secretKey;
        const logoUrl = hit.logo_url || `https://img.logo.dev/${hit.domain}?token=${pubKey}&size=128`;
        return { domain: hit.domain, logoUrl };
    } catch {
        return null;
    }
}

export async function resolveProviderLogo(companyName: string | null, targetDomain: string | null): Promise<LogoCandidate | null> {
    const provider = process.env.LOGO_PROVIDER || 'logo.dev';
    if (provider === 'none') return null;

    const normalizedDomain = normalizeDomainInput(targetDomain) || guessDomain(companyName);
    const lowerName = companyName?.toLowerCase().trim() || null;

    if (lowerName) {
        for (const [brand, url] of Object.entries(BRAND_OVERRIDES)) {
            if (lowerName === brand || lowerName.includes(brand)) {
                return {
                    domain: normalizedDomain,
                    logoUrl: url,
                    source: 'brand-override',
                    confidence: 'metadata',
                };
            }
        }
    }

    // logo.dev: try search API first (finds canonical domain by name, most accurate)
    if (provider === 'logo.dev' && companyName) {
        const searchResult = await searchLogoDevByName(companyName);
        if (searchResult) {
            return {
                domain: searchResult.domain,
                logoUrl: searchResult.logoUrl,
                source: 'provider:logo.dev',
                confidence: 'provider',
            };
        }
    }

    // logo.dev: fall back to CDN URL with known/guessed domain
    if (provider === 'logo.dev' && normalizedDomain) {
        const pubKey = process.env.LOGO_API_KEY || process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
        if (pubKey) {
            const logoDevUrl = `https://img.logo.dev/${encodeURIComponent(normalizedDomain)}?token=${pubKey}&size=128`;
            try {
                const check = await fetchWithTimeout(logoDevUrl, { method: 'HEAD' }, 1500);
                if (check.ok) {
                    return {
                        domain: normalizedDomain,
                        logoUrl: logoDevUrl,
                        source: 'provider:logo.dev',
                        confidence: 'provider',
                    };
                }
            } catch (error) {
                console.warn('[Company] logo.dev CDN check failed', error);
            }
        }
    }

    if (lowerName) {
        try {
            const clearbitUrl = normalizedDomain ? `https://logo.clearbit.com/${normalizedDomain}` : `https://logo.clearbit.com/${lowerName.replace(/\s+/g, '')}.com`;
            const check = await fetchWithTimeout(clearbitUrl, { method: 'HEAD' }, 1000);
            if (check.ok) {
                return {
                    domain: normalizedDomain,
                    logoUrl: clearbitUrl,
                    source: 'provider:clearbit',
                    confidence: 'provider',
                };
            }
        } catch {
            // ignore
        }
    }

    if (normalizedDomain) {
        const domainStr = normalizedDomain.replace(/^https?:\/\//, '').split('/')[0];
        try {
            const googleFaviconUrl = `https://s2.googleusercontent.com/s2/favicons?domain=${encodeURIComponent(domainStr)}&sz=128`;
            const check = await fetchWithTimeout(googleFaviconUrl, { method: 'HEAD' }, 1000);
            if (check.ok) {
                return {
                    domain: normalizedDomain,
                    logoUrl: googleFaviconUrl,
                    source: 'provider:google',
                    confidence: 'provider',
                };
            }
        } catch {
            // ignore
        }
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
 * Scrapes the company logo directly from a job provider's job listing page.
 * This is the highest-quality source — the provider embeds the company's
 * own logo asset in the job posting HTML.
 *
 * Supported providers:
 *  - greenhouse: looks for <a class="logo"><img src="..."> in job board HTML
 *  - lever:      looks for <img class="main-header-logo"> or <img alt="*Logo">
 *  - himalayas:  looks for og:image (company-specific on job detail pages)
 *
 * Returns null if the URL is not a recognized provider format or scraping fails.
 */
export async function scrapeLogoFromProviderPage(
    sourceUrl: string,
    source: string,
): Promise<LogoCandidate | null> {
    if (!sourceUrl) return null;

    try {
        const response = await fetchWithTimeout(
            sourceUrl,
            { headers: { 'User-Agent': 'Mozilla/5.0' } },
            5000,
        );
        if (!response.ok) return null;
        const html = await response.text();

        if (source === 'greenhouse') {
            // Greenhouse board pages embed the company logo as an <img> whose src points to
            // recruiting.cdn.greenhouse.io/external_greenhouse_job_boards/logos/...
            // There is NO class="logo" on the anchor — the img just sits inside a plain <a> / <div>.
            // Example:
            //   <img src="https://recruiting.cdn.greenhouse.io/external_greenhouse_job_boards/logos/000/180/original/Everpure_Hex_Pure_Orange.png?..." alt="Everpure Logo" ...>
            const ghCdnMatch = html.match(/src\s*=\s*["'](https?:\/\/recruiting\.cdn\.greenhouse\.io\/external_greenhouse_job_boards\/logos\/[^"'?]+(?:\?[^"']*)?)/i);
            if (ghCdnMatch?.[1]) {
                return { domain: null, logoUrl: ghCdnMatch[1], source: 'og-image', confidence: 'metadata' };
            }
            // Secondary: any img whose alt ends with "Logo" (provider puts alt="<Company> Logo")
            const altLogoMatch = html.match(/<img\b[^>]+\bsrc\s*=\s*["']([^"']+)["'][^>]+\balt\s*=\s*["'][^"']+\s+Logo["']/i)
                ?? html.match(/<img\b[^>]+\balt\s*=\s*["'][^"']+\s+Logo["'][^>]+\bsrc\s*=\s*["']([^"']+)["']/i);
            if (altLogoMatch?.[1] && !altLogoMatch[1].includes('greenhouse.io/images')) {
                return { domain: null, logoUrl: resolveUrl(sourceUrl, altLogoMatch[1]), source: 'og-image', confidence: 'metadata' };
            }
        }

        if (source === 'lever') {
            // Lever job pages embed the logo as <img class="main-header-logo" src="...">
            const leverLogoMatch = html.match(/<img\b[^>]+\bclass\s*=\s*["'][^"']*\bmain-header-logo\b[^"']*["'][^>]+\bsrc\s*=\s*["']([^"']+)["']/i)
                ?? html.match(/<img\b[^>]+\bsrc\s*=\s*["']([^"']+)["'][^>]+\bclass\s*=\s*["'][^"']*\bmain-header-logo\b[^"']*["']/i);
            if (leverLogoMatch?.[1]) {
                return { domain: null, logoUrl: resolveUrl(sourceUrl, leverLogoMatch[1]), source: 'og-image', confidence: 'metadata' };
            }
        }

        // Generic fallback for all providers: og:image on the job detail page.
        // Himalayas, The Muse, Arbeitnow etc. all set company-specific og:images on job pages.
        const ogImage = findMetaContent(html, 'og:image');
        if (ogImage) {
            const resolved = resolveUrl(sourceUrl, ogImage);
            // Filter out og:images that belong to the provider's own branding, not the company.
            const isProviderOwnImage = (
                /himalayas\.app\/(logo|og|static)/i.test(resolved) ||
                /themuse\.com\/(logo|og|static)/i.test(resolved) ||
                /arbeitnow\.com\/(logo|og|static)/i.test(resolved) ||
                /greenhouse\.io\/images/i.test(resolved) ||
                /lever\.co\/(logo|og|static)/i.test(resolved)
            );
            if (!isProviderOwnImage) {
                return { domain: null, logoUrl: resolved, source: 'og-image', confidence: 'metadata' };
            }
        }

        return null;
    } catch {
        return null;
    }
}

export async function scrapeLogoFromWebsite(domain: string): Promise<LogoCandidate | null> {
    const normalizedDomain = domain.startsWith('http') ? domain : `https://${domain}`;
    try {
        const response = await fetchWithTimeout(normalizedDomain, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 4000);
        if (!response.ok) return null;
        const html = await response.text();

        const maskHref = findLinkHref(html, (rel) => rel.includes('mask-icon'));
        if (maskHref) {
            return {
                domain,
                logoUrl: resolveUrl(normalizedDomain, maskHref),
                source: 'mask-icon',
                confidence: 'metadata',
            };
        }

        const appleHref = findLinkHref(html, (rel) => rel.includes('apple-touch-icon'));
        if (appleHref) {
            return {
                domain,
                logoUrl: resolveUrl(normalizedDomain, appleHref),
                source: 'apple-touch-icon',
                confidence: 'metadata',
            };
        }

        const ogImage = findMetaContent(html, 'og:image');
        if (ogImage) {
            return {
                domain,
                logoUrl: resolveUrl(normalizedDomain, ogImage),
                source: 'og-image',
                confidence: 'metadata',
            };
        }

        const twitterImage = findMetaContent(html, 'twitter:image');
        if (twitterImage) {
            return {
                domain,
                logoUrl: resolveUrl(normalizedDomain, twitterImage),
                source: 'twitter-image',
                confidence: 'metadata',
            };
        }

        const manifestHref = findLinkHref(html, (rel) => rel.includes('manifest'));
        if (manifestHref) {
            const manifestUrl = resolveUrl(normalizedDomain, manifestHref);
            const manifestIcon = await fetchManifestIcon(manifestUrl);
            if (manifestIcon) {
                return {
                    domain,
                    logoUrl: manifestIcon,
                    source: 'manifest',
                    confidence: 'manifest',
                };
            }
        }

        const iconHref = findLinkHref(html, (rel) => rel.includes('icon') && !rel.includes('mask-icon') && !rel.includes('apple-touch-icon'));
        if (iconHref) {
            return {
                domain,
                logoUrl: resolveUrl(normalizedDomain, iconHref),
                source: 'favicon',
                confidence: 'favicon',
            };
        }

        return null;
    } catch {
        return null;
    }
}

function findLinkHref(html: string, predicate: (rel: string) => boolean): string | null {
    const matches = html.match(/<link\b[^>]*>/gi) || [];
    for (const match of matches) {
        const relMatch = match.match(/\brel\s*=\s*["']([^"']+)["']/i);
        const hrefMatch = match.match(/\bhref\s*=\s*["']([^"']+)["']/i);
        if (!relMatch || !hrefMatch) continue;
        const relValue = relMatch[1].toLowerCase();
        if (predicate(relValue)) {
            return hrefMatch[1];
        }
    }
    return null;
}

function findMetaContent(html: string, key: string): string | null {
    const regex = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i');
    const match = html.match(regex);
    if (match && match[1]) {
        return match[1];
    }

    const reversedRegex = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i');
    const reversedMatch = html.match(reversedRegex);
    return reversedMatch?.[1] ?? null;
}

async function fetchManifestIcon(manifestUrl: string): Promise<string | null> {
    try {
        const response = await fetchWithTimeout(manifestUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, 3000);
        if (!response.ok) return null;
        const manifest = await response.json();
        if (!Array.isArray(manifest.icons)) return null;
        const sorted = manifest.icons
            .map((icon: any) => ({
                href: icon.src || icon.href || icon.url,
                size: parseManifestSize(icon.sizes),
            }))
            .filter((item: any) => typeof item.href === 'string' && item.href.trim())
            .sort((a: any, b: any) => (b.size || 0) - (a.size || 0));
        if (sorted.length === 0) return null;
        return resolveUrl(manifestUrl, sorted[0].href);
    } catch {
        return null;
    }
}

function parseManifestSize(value: string | undefined): number {
    if (!value) return 0;
    const parts = value.split(/\s+/).filter(Boolean);
    let best = 0;
    for (const part of parts) {
        const [width] = part.split('x');
        const size = Number.parseInt(width, 10);
        if (!Number.isNaN(size) && size > best) {
            best = size;
        }
    }
    return best;
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

export async function saveCompanyToDb(name: string, domain: string | null, logoUrl: string | null, options?: SaveCompanyOptions) {
    const dbType = getDbType();

    // Strict Validation
    const allowProviderFallback = options?.allowProviderFallback ?? true;
    const isValid = isValidLogoUrl(logoUrl, { allowProviderFallback });
    const finalLogo = isValid ? logoUrl : null;
    const isFetched = isValid; // Only mark as fetched if we actually got a valid logo
    const shouldForceUpdate = Boolean(options?.forceUpdate);

    try {
        if (dbType === 'postgres') {
            const pool = getPostgresPool();
            const updateCondition = shouldForceUpdate ? '' : 'WHERE companies.logo_fetched = false';
            await pool.query(`
                INSERT INTO companies (id, name, domain, logo_url, logo_fetched, created_at, updated_at)
                VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW(), NOW())
                ON CONFLICT (name) DO UPDATE SET
                    domain = EXCLUDED.domain,
                    logo_url = EXCLUDED.logo_url,
                    logo_fetched = EXCLUDED.logo_fetched,
                    updated_at = NOW()
                ${updateCondition}
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
            } else if (shouldForceUpdate || (!existing.logo_fetched && isFetched)) {
                await client.from('companies').update({
                    domain,
                    logo_url: finalLogo,
                    logo_fetched: true,
                    updated_at: new Date().toISOString()
                }).eq('id', existing.id);
            }
        } else {
            const db = getSQLiteDB();
            const whereClause = shouldForceUpdate ? '' : 'WHERE companies.logo_fetched = 0';
            db.prepare(`
                INSERT INTO companies (id, name, domain, logo_url, logo_fetched, created_at, updated_at)
                VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'), datetime('now'))
                ON CONFLICT(name) DO UPDATE SET
                    domain = excluded.domain,
                    logo_url = excluded.logo_url,
                    logo_fetched = excluded.logo_fetched,
                    updated_at = datetime('now')
                ${whereClause}
            `).run(name, domain, finalLogo, isFetched ? 1 : 0);
        }
    } catch (e) {
        console.error('[Company] Error saving company to DB:', e);
    }
}
