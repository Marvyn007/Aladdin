import { NextResponse } from 'next/server';
import { getCompanyLogoUrl, fetchWithTimeout, CompanySuggestion, searchCompaniesInDb, saveCompanyToDb, isValidLogoUrl } from '@/lib/company';

// In-memory rate limiting and simple caching for Autocomplete
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 30;
const ipHits = new Map<string, { count: number; resetTime: number }>();
const autocompleteCache = new Map<string, { data: CompanySuggestion[]; expiry: number }>();

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const record = ipHits.get(ip);

    if (!record || now > record.resetTime) {
        ipHits.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return false;
    }

    record.count += 1;
    return record.count > MAX_REQUESTS;
}

export async function GET(req: Request) {
    // 1. Check Rate Limit
    const ip = req.headers.get('x-forwarded-for') || 'unknown';
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('query');

    if (!query || query.trim().length < 2) {
        return NextResponse.json([]);
    }

    const normalizedQuery = query.trim().toLowerCase();

    // 2. Check In-Memory Cache (5 minute TTL for autocomplete suggestions of a specific query)
    const cached = autocompleteCache.get(normalizedQuery);
    if (cached && Date.now() < cached.expiry) {
        return NextResponse.json(cached.data);
    }

    try {
        let results: CompanySuggestion[] = [];

        // 3. Search local persistent database first
        const dbCompanies = await searchCompaniesInDb(normalizedQuery);
        if (dbCompanies.length > 0) {
            results = dbCompanies;
        } else {
            // 4. Fallback to Brandfetch Search API if not found natively
            const res = await fetchWithTimeout(
                `https://api.brandfetch.io/v2/search/${encodeURIComponent(normalizedQuery)}`,
                { headers: { 'Accept': 'application/json' } },
                2500
            );

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    // Start logo resolution in the background for each result
                    // We return the suggestions immediately with whatever logo we have (or null)
                    results = data.slice(0, 7).map(item => {
                        const name = item.name || item.domain || normalizedQuery;
                        const domainGuess = item.domain || `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

                        // Kick off background resolution
                        // Capture the promise but don't await it to keep response instant
                        (async () => {
                            try {
                                const final_logo = await getCompanyLogoUrl(name, domainGuess);
                                await saveCompanyToDb(name, domainGuess, final_logo);
                            } catch (e) {
                                console.error('[Background Logo Resolution] failed:', e);
                            }
                        })();

                        return {
                            id: item.brandId || Math.random().toString(36).substring(7),
                            name,
                            domain: domainGuess,
                            logo_url: item.icon || null // Use Brandfetch icon immediately for better UI experience
                        };
                    });
                }
            } else {
                console.warn('[Company Autocomplete] Brandfetch returned non-OK status:', res.status);
            }
        }

        // Caching
        if (results.length > 0) {
            autocompleteCache.set(normalizedQuery, {
                data: results,
                expiry: Date.now() + 5 * 60 * 1000
            });
        }

        return NextResponse.json(results);
    } catch (e: any) {
        console.error('[Company API] autocomplete error:', e);
        return NextResponse.json([]);
    }
}
