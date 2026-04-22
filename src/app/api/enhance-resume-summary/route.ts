import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getJobById } from '@/lib/db';
import { callLLM } from '@/lib/resume-generation/utils';

const MAX_SUMMARY_CHARS = 1200;
const MAX_KEYWORDS = 40;

type EnhanceSummaryContext = {
    jobTitle?: string;
    company?: string | null;
    keywords?: {
        matched?: string[];
        missing?: string[];
        autoAdded?: string[];
        matchedCritical?: string[];
        missingCritical?: string[];
    };
};

function compactList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === 'string')
        .map(item => item.trim())
        .filter(Boolean)
        .slice(0, MAX_KEYWORDS);
}

function cleanSummary(text: string): string {
    return text
        .replace(/```(?:json)?/g, '')
        .replace(/^["']|["']$/g, '')
        .trim();
}

export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const jobId = typeof body.jobId === 'string' ? body.jobId : '';
        const summary = typeof body.summary === 'string' ? body.summary.trim() : '';
        const context = (body.context || {}) as EnhanceSummaryContext;

        if (!jobId || !summary) {
            return NextResponse.json({ error: 'Missing job or summary text.' }, { status: 400 });
        }

        const job = await getJobById(userId, jobId);
        if (!job) {
            return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
        }

        const keywords = context.keywords || {};
        const compactJobContext = {
            role: context.jobTitle || job.title,
            company: context.company ?? job.company,
            criticalKeywords: [
                ...compactList(keywords.matchedCritical),
                ...compactList(keywords.missingCritical),
            ].slice(0, MAX_KEYWORDS),
            missingKeywords: compactList(keywords.missing),
            matchedKeywords: compactList(keywords.matched),
            generatedKeywords: compactList(keywords.autoAdded),
        };

        const systemPrompt = `
You are an expert resume summary editor for ATS-focused tailored resumes.
Rewrite exactly one professional summary using the compact job context.

Rules:
- Return JSON only: {"summary":"..."}.
- Preserve the candidate's underlying claims; do not invent experience, employers, tools, credentials, metrics, or outcomes.
- Keep it concise: 2-3 polished sentences, 45-75 words when possible.
- Improve clarity, role alignment, keyword coverage, and professional confidence.
- Do not mention ATS, job descriptions, or keywords directly.
- Prefer role-relevant keywords naturally, especially critical and missing keywords, only where truthful.
        `.trim();

        const userPrompt = `
CURRENT PROFESSIONAL SUMMARY:
${summary.slice(0, MAX_SUMMARY_CHARS)}

COMPACT JOB CONTEXT:
${JSON.stringify(compactJobContext, null, 2)}

Rewrite the current professional summary into a stronger tailored resume summary.
        `.trim();

        const model = process.env.LLM_MODEL || 'gpt-4o-mini';
        const raw = await callLLM(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            { model, temperature: 0.35, max_tokens: 260, jsonMode: true }
        );

        let enhancedSummary = '';
        try {
            const parsed = JSON.parse(raw.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim());
            enhancedSummary = typeof parsed.summary === 'string' ? parsed.summary : '';
        } catch {
            enhancedSummary = raw;
        }

        const cleaned = cleanSummary(enhancedSummary);
        if (!cleaned) {
            return NextResponse.json({ error: 'The AI response was empty.' }, { status: 502 });
        }

        return NextResponse.json({ summary: cleaned });
    } catch (error) {
        console.error('[enhance-resume-summary] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to enhance summary.' },
            { status: 500 }
        );
    }
}
