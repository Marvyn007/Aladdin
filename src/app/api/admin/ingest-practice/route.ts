import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
// Use the Git Trees API with recursive flag to get ALL directories in one call
const GITHUB_TREE_URL = 'https://api.github.com/repos/snehasishroy/leetcode-companywise-interview-questions/git/trees/master?recursive=1';
const RAW_BASE_URL = 'https://raw.githubusercontent.com/snehasishroy/leetcode-companywise-interview-questions/master/';

// Helper to parse CSV row safely
function parseCSVRow(row: string) {
    // Format: ID,URL,Title,Difficulty,Acceptance %,Frequency %
    // Split by comma, but ignore commas inside double quotes
    const matches = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
    if (!matches || matches.length < 6) {
        // Fallback for lines that might be malformed or missing fields at the end
        if (matches.length >= 4) {
             while (matches.length < 6) matches.push("");
        } else {
             return null;
        }
    }

    const [id, url, title, difficulty, acceptance, frequency] = matches.map(m => (m || "").replace(/^"|"$/g, '').trim());

    return {
        number: parseInt(id),
        url,
        title,
        difficulty,
        acceptanceRate: acceptance ? parseFloat(acceptance.replace('%', '')) : null,
        frequency: frequency ? parseFloat(frequency.replace('%', '')) : null
    };
}

// Format company name for display (e.g., "goldman-sachs" -> "Goldman Sachs")
function formatCompanyName(slug: string): string {
    return slug
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}


export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const companyFilter = searchParams.get('company');
    // Support pagination: ?page=1&batchSize=50 to avoid HTTP timeouts
    const page = parseInt(searchParams.get('page') || '0');
    const batchSize = parseInt(searchParams.get('batchSize') || '0');

    try {
        console.log('Fetching full repository tree from GitHub...');
        
        const treeResponse = await fetch(GITHUB_TREE_URL, {
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Aladdin-App'
            }
        });

        if (!treeResponse.ok) {
            throw new Error(`Failed to fetch repo tree: ${treeResponse.statusText}`);
        }

        const treeData = await treeResponse.json();
        
        // Extract unique top-level directory names that contain an all.csv file
        const companiesWithCsv = new Set<string>();
        for (const item of treeData.tree) {
            if (item.type === 'blob' && item.path.endsWith('/all.csv')) {
                const companyName = item.path.split('/')[0];
                if (!companyName.startsWith('.')) {
                    companiesWithCsv.add(companyName);
                }
            }
        }

        const allCompanies = Array.from(companiesWithCsv).sort();
        console.log(`Found ${allCompanies.length} companies with all.csv files.`);

        let targetCompanies = companyFilter 
            ? allCompanies.filter((c: string) => c.toLowerCase() === companyFilter.toLowerCase())
            : allCompanies;

        // Apply pagination if specified
        if (batchSize > 0) {
            const start = page * batchSize;
            targetCompanies = targetCompanies.slice(start, start + batchSize);
            console.log(`Processing batch: page=${page}, batchSize=${batchSize}, companies ${start}-${start + targetCompanies.length}`);
        }

        let totalQuestions = 0;
        let processedCompanies = 0;
        let failedCompanies = 0;

        for (const company of targetCompanies) {
            console.log(`[${processedCompanies + failedCompanies + 1}/${targetCompanies.length}] Processing: ${company}...`);
            const csvUrl = `${RAW_BASE_URL}${encodeURIComponent(company)}/all.csv`;
            
            try {
                const csvResponse = await fetch(csvUrl);
                if (!csvResponse.ok) {
                    console.error(`Failed to fetch CSV for ${company}: ${csvResponse.statusText}`);
                    failedCompanies++;
                    continue;
                }

                const csvText = await csvResponse.text();
                const rows = csvText.replace(/\r/g, '').split('\n').slice(1); // Skip header

                for (const row of rows) {
                    if (!row.trim()) continue;

                    const data = parseCSVRow(row);
                    if (!data) continue;

                    // 1. Upsert Question
                    const question = await prisma.leetCodeQuestion.upsert({
                        where: { number: data.number },
                        update: {
                            title: data.title,
                            url: data.url,
                            difficulty: data.difficulty,
                            acceptanceRate: isNaN(data.acceptanceRate as number) ? null : data.acceptanceRate,
                            isPremium: false 
                        },
                        create: {
                            number: data.number,
                            title: data.title,
                            url: data.url,
                            difficulty: data.difficulty,
                            acceptanceRate: isNaN(data.acceptanceRate as number) ? null : data.acceptanceRate,
                            isPremium: false
                        }
                    });

                    // 2. Link to Company
                    await prisma.companyLeetCodeQuestion.upsert({
                        where: {
                            companyName_questionId: {
                                companyName: company,
                                questionId: question.id
                            }
                        },
                        update: {
                            frequency: isNaN(data.frequency as number) ? null : data.frequency
                        },
                        create: {
                            companyName: company,
                            questionId: question.id,
                            frequency: isNaN(data.frequency as number) ? null : data.frequency
                        }
                    });

                    totalQuestions++;
                }

                // 3. Create or update company record link
                const formattedName = formatCompanyName(company);
                const domain = `${company.replace(/-/g, '')}.com`;
                
                try {
                    // Use raw SQL via Prisma for upsert into companies table
                    // We DO NOT fetch or update logo fields here.
                    await prisma.$executeRawUnsafe(`
                        INSERT INTO companies (id, name, domain, logo_fetched, has_practice_questions, created_at, updated_at)
                        VALUES (gen_random_uuid(), $1, $2, false, true, NOW(), NOW())
                        ON CONFLICT (name) DO UPDATE SET
                            has_practice_questions = true,
                            updated_at = NOW()
                    `, formattedName, domain);
                } catch (companyErr) {
                    console.warn(`Could not save company "${company}" to companies table:`, companyErr);
                }

                processedCompanies++;
            } catch (err) {
                console.error(`Error processing ${company}:`, err);
                failedCompanies++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${processedCompanies} companies and ${totalQuestions} question-company entries. ${failedCompanies} companies failed.`,
            companiesProcessed: processedCompanies,
            companiesFailed: failedCompanies,
            totalEntries: totalQuestions,
            totalCompaniesFound: allCompanies.length,
            ...(batchSize > 0 ? { page, batchSize, hasMore: (page + 1) * batchSize < allCompanies.length } : {})
        });

    } catch (error: any) {
        console.error('Ingestion error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
