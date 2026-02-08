/**
 * API Route: GET /api/job-sources-status
 * Returns status of all job source adapters (now disabled)
 */

import { NextResponse } from 'next/server';

export async function GET() {
    const adzunaEnabled = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_API_KEY);

    return NextResponse.json({
        summary: adzunaEnabled
            ? 'Only Adzuna job fetching is enabled. Click "Find Jobs" to fetch.'
            : 'Adzuna not configured. Configure ADZUNA_APP_ID and ADZUNA_API_KEY to enable job fetching.',
        canFetchJobs: adzunaEnabled,
        adapters: [
            {
                name: 'Adzuna',
                enabled: adzunaEnabled,
                requiredEnvVars: ['ADZUNA_APP_ID', 'ADZUNA_API_KEY'],
                docsUrl: 'https://developer.adzuna.com/',
            },
            {
                name: 'RapidAPI (JSearch)',
                enabled: false,
                requiredEnvVars: ['RAPIDAPI_KEY'],
                docsUrl: 'https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch',
            },
            {
                name: 'Jooble',
                enabled: false,
                requiredEnvVars: ['JOOBLE_KEY'],
                docsUrl: 'https://jooble.org/api/about',
            },
            {
                name: 'SerpAPI (Google Jobs)',
                enabled: false,
                requiredEnvVars: ['SERPAPI_KEY'],
                docsUrl: 'https://serpapi.com/',
            },
            {
                name: 'USAJobs',
                enabled: false,
                requiredEnvVars: ['USAJOBS_API_KEY'],
                docsUrl: 'https://developer.usajobs.gov/',
            },
        ]
    });
}
