import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
    try {
        // Group by companyName and count questions
        const groups = await prisma.companyLeetCodeQuestion.groupBy({
            by: ['companyName'],
            _count: {
                questionId: true
            },
            orderBy: {
                _count: {
                    questionId: 'desc'
                }
            }
        });

        // Try to look up logos from the companies table
        // The companies table may store the formatted name (e.g. "Goldman Sachs")
        // while companyName here is the slug (e.g. "goldman-sachs")
        const companyNames = groups.map(g => g.companyName);
        
        // Query companies table for matching logos - both by slug and formatted name  
        const dbCompanies = await prisma.company.findMany({
            where: {
                OR: [
                    { name: { in: companyNames, mode: 'insensitive' } },
                    // Also try formatted names
                    { name: { in: companyNames.map(n => 
                        n.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                    ), mode: 'insensitive' } }
                ]
            },
            select: {
                name: true,
                logoUrl: true,
                domain: true
            }
        });

        // Build a lookup map (lowercase -> logo)
        const logoMap = new Map<string, { logoUrl: string | null; domain: string | null }>();
        for (const c of dbCompanies) {
            logoMap.set(c.name.toLowerCase(), { logoUrl: c.logoUrl, domain: c.domain });
            // Also map the slug form
            logoMap.set(c.name.toLowerCase().replace(/\s+/g, '-'), { logoUrl: c.logoUrl, domain: c.domain });
        }

        const companyDomainOverrides: Record<string, string> = {
            'google': 'google.com',
            'amazon': 'amazon.com',
            'meta': 'meta.com',
            'facebook': 'facebook.com',
            'uber-eats': 'ubereats.com',
            'uber': 'uber.com',
            'apple': 'apple.com',
            'microsoft': 'microsoft.com',
            'netflix': 'netflix.com',
            'linkedin': 'linkedin.com',
            'bloomberg': 'bloomberg.com',
            'tiktok': 'tiktok.com',
            'bytedance': 'bytedance.com'
        };

        const PUB_KEY = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN || 'pk_By0CIs75Tsy8K9CqV4sT7w';

        // Map to a cleaner format with logo URL
        const companies = groups.map(group => {
            const slug = group.companyName.toLowerCase();
            const match = logoMap.get(slug);
            
            // Apply Manual Override if known
            let domain = match?.domain || null;
            let logoUrl = match?.logoUrl || null;

            if (companyDomainOverrides[slug]) {
                domain = companyDomainOverrides[slug];
                logoUrl = `https://img.logo.dev/${domain}?token=${PUB_KEY}&size=128`;
            }

            return {
                name: group.companyName,
                questionCount: group._count.questionId,
                logoUrl: logoUrl,
                domain: domain
            };
        });

        return NextResponse.json(companies);
    } catch (error: any) {
        console.error('Error fetching practice companies:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
