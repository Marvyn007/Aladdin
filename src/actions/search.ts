'use server';

import { prisma } from '@/lib/prisma';

export interface SearchSuggestions {
    history: string[];
    jobs: string[];
}

export async function getSearchSuggestions(query: string): Promise<SearchSuggestions> {
    if (!query || query.length < 2) {
        return { history: [], jobs: [] };
    }

    const lowerQuery = query.toLowerCase();

    try {
        // 1. Fetch common searches (aggregate from SearchHistory)
        // Prisma doesn't support generic groupBy well for this without raw query or in-app aggregation if high volume,
        // but for now let's try a distinct find or raw query if needed. 
        // Simplified approach: Find recent distinct search queries matching the input.
        // For "Most Common", we'd ideally want a groupBy count, but let's stick to simple recent matching for now to ensure speed/compatibility
        // unless we use groupBy. 

        // Let's use groupBy to get the most popular searches starting with the query
        const commonSearches = await prisma.searchHistory.groupBy({
            by: ['queryText'],
            where: {
                queryText: {
                    contains: lowerQuery,
                    mode: 'insensitive'
                }
            },
            _count: {
                queryText: true
            },
            orderBy: {
                _count: {
                    queryText: 'desc'
                }
            },
            take: 3
        });

        const historySuggestions = commonSearches.map(item => item.queryText);


        // 2. Fetch Job Matches (Title & Company)
        const jobs = await prisma.job.findMany({
            where: {
                OR: [
                    { title: { contains: lowerQuery, mode: 'insensitive' } },
                    { company: { contains: lowerQuery, mode: 'insensitive' } },
                ],
            },
            select: {
                title: true,
                company: true,
            },
            distinct: ['title', 'company'],
            take: 5,
        });

        // Extract and deduplicate
        const jobSuggestions = Array.from(new Set(
            jobs.flatMap(job => [job.title, job.company])
                .filter((text): text is string =>
                    !!text && text.toLowerCase().includes(lowerQuery)
                )
        )).slice(0, 5);

        return {
            history: historySuggestions,
            jobs: jobSuggestions
        };

    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        return { history: [], jobs: [] };
    }
}
