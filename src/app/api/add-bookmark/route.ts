// API Route: POST /api/add-bookmark
// Receive bookmarklet data and add as a candidate job

import { NextRequest, NextResponse } from 'next/server';
import { insertJob } from '@/lib/db';
import { normalizeText, validateJobCriteria } from '@/lib/job-utils';
import { auth, currentUser } from '@clerk/nextjs/server';

interface BookmarkPayload {
    title: string;
    url: string;
    selectedText: string;
    timestamp?: string;
}

// Extract job information from page content
function extractJobInfo(title: string, text: string, url: string): {
    title: string;
    company: string | null;
    location: string | null;
    description: string;
} {
    // Try to extract company from common patterns
    let company: string | null = null;
    let location: string | null = null;
    let jobTitle = title;

    // Pattern: "Job Title at Company"
    const atMatch = title.match(/^(.+?)\s+at\s+(.+?)(?:\s*[-–|]|$)/i);
    if (atMatch) {
        jobTitle = atMatch[1].trim();
        company = atMatch[2].trim();
    }

    // Pattern: "Job Title - Company"
    const dashMatch = title.match(/^(.+?)\s*[-–|]\s*(.+?)(?:\s*[-–|]|$)/i);
    if (!company && dashMatch) {
        jobTitle = dashMatch[1].trim();
        company = dashMatch[2].trim();
    }

    // Try to extract location from text
    const locationPatterns = [
        /(?:location|located in|based in)[:\s]+([^,\n]+(?:,\s*[A-Z]{2})?)/i,
        /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/,
        /(remote|hybrid|on-site|onsite)/i,
    ];

    for (const pattern of locationPatterns) {
        const match = text.match(pattern);
        if (match) {
            location = match[1].trim();
            break;
        }
    }

    // Clean up title
    jobTitle = jobTitle
        .replace(/\s*[-–|].*$/, '') // Remove trailing separators
        .replace(/\s+/g, ' ')
        .trim();

    return {
        title: jobTitle || title,
        company,
        location,
        description: text,
    };
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload: BookmarkPayload = await request.json();

        if (!payload.title || !payload.url) {
            return NextResponse.json(
                { error: 'Title and URL are required' },
                { status: 400 }
            );
        }

        // Extract job information
        const text = payload.selectedText || payload.title;
        const jobInfo = extractJobInfo(payload.title, text, payload.url);

        // Validate job criteria
        const validation = validateJobCriteria(
            jobInfo.title,
            jobInfo.description,
            jobInfo.location
        );

        if (!validation.valid) {
            return NextResponse.json(
                {
                    error: 'Job does not meet criteria',
                    reason: validation.reason,
                    // Still return extracted info for debugging
                    extracted: jobInfo
                },
                { status: 400 }
            );
        }

        // Normalize text for storage
        const normalizedText = normalizeText(jobInfo.description);

        // Insert job
        const user = await currentUser();
        const posterDetails = user ? {
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl
        } : undefined;

        try {
            const job = await insertJob(userId, {
                title: jobInfo.title,
                company: jobInfo.company,
                location: jobInfo.location,
                source_url: payload.url,
                posted_at: null, // Bookmarked jobs don't have reliable posted date
                normalized_text: normalizedText,
                raw_text_summary: jobInfo.description.slice(0, 1000), // First 1000 chars
            }, posterDetails);

            return NextResponse.json({
                success: true,
                job: {
                    id: job.id,
                    title: job.title,
                    company: job.company,
                    location: job.location,
                    source_url: job.source_url,
                },
            });
        } catch (error) {
            if ((error as Error).message === 'Duplicate job detected') {
                return NextResponse.json(
                    { error: 'This job has already been added' },
                    { status: 409 }
                );
            }
            throw error;
        }
    } catch (error) {
        console.error('Error adding bookmark:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to add bookmark' },
            { status: 500 }
        );
    }
}
