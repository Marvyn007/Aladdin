/**
 * API Route: GET /api/job-sources-status
 * Returns the status of all job source adapters
 */

import { NextResponse } from 'next/server';

// Check which adapters have their API keys configured
function getAdapterStatuses() {
    return [
        {
            name: 'Adzuna',
            enabled: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY),
            requiredEnvVars: ['ADZUNA_APP_ID', 'ADZUNA_API_KEY'],
            docsUrl: 'https://developer.adzuna.com/',
        },
        {
            name: 'RapidAPI (JSearch)',
            enabled: !!process.env.RAPIDAPI_KEY,
            requiredEnvVars: ['RAPIDAPI_KEY'],
            docsUrl: 'https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch',
        },
        {
            name: 'Jooble',
            enabled: !!process.env.JOOBLE_KEY,
            requiredEnvVars: ['JOOBLE_KEY'],
            docsUrl: 'https://jooble.org/api/about',
        },
        {
            name: 'SerpAPI (Google Jobs)',
            enabled: !!process.env.SERPAPI_KEY,
            requiredEnvVars: ['SERPAPI_KEY'],
            docsUrl: 'https://serpapi.com/',
        },
        {
            name: 'USAJobs',
            enabled: !!process.env.USAJOBS_API_KEY,
            requiredEnvVars: ['USAJOBS_API_KEY'],
            docsUrl: 'https://developer.usajobs.gov/',
        },
    ];
}

export async function GET() {
    const adapters = getAdapterStatuses();
    const enabledCount = adapters.filter(a => a.enabled).length;

    return NextResponse.json({
        summary: enabledCount > 0
            ? `${enabledCount} of ${adapters.length} job sources configured`
            : 'No job sources configured - no new jobs will be fetched!',
        canFetchJobs: enabledCount > 0,
        adapters,
    });
}
