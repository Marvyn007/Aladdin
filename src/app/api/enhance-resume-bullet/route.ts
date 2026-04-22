import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { getJobById } from '@/lib/db';
import { callLLM } from '@/lib/resume-generation/utils';

const MAX_BULLET_CHARS = 700;
const MAX_KEYWORDS = 40;

type EnhanceContext = {
    jobTitle?: string;
    company?: string | null;
    sectionTitle?: string;
    sectionType?: string;
    itemTitle?: string;
    itemSubtitle?: string;
    technologies?: string;
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

function cleanBullet(text: string): string {
    return text
        .replace(/```(?:json)?/g, '')
        .replace(/^\s*[-*•]\s*/, '')
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
        const bulletText = typeof body.bulletText === 'string' ? body.bulletText.trim() : '';
        const context = (body.context || {}) as EnhanceContext;

        if (!jobId || !bulletText) {
            return NextResponse.json({ error: 'Missing job or bullet text.' }, { status: 400 });
        }

        const job = await getJobById(userId, jobId);
        if (!job) {
            return NextResponse.json({ error: 'Job not found.' }, { status: 404 });
        }

        const keywords = context.keywords || {};
        const compactJobContext = {
            role: context.jobTitle || job.title,
            company: context.company ?? job.company,
            section: context.sectionTitle,
            entry: [context.itemTitle, context.itemSubtitle].filter(Boolean).join(' | '),
            technologies: context.technologies,
            criticalKeywords: [
                ...compactList(keywords.matchedCritical),
                ...compactList(keywords.missingCritical),
            ].slice(0, MAX_KEYWORDS),
            missingKeywords: compactList(keywords.missing),
            matchedKeywords: compactList(keywords.matched),
            generatedKeywords: compactList(keywords.autoAdded),
        };

        const systemPrompt = `
You are an expert resume bullet editor for ATS-focused tailored resumes.
Rewrite exactly one resume bullet using the compact job context.

Rules:
- Return JSON only: {"bullet":"..."}.
- Preserve the candidate's underlying claim; do not invent employers, projects, tools, credentials, metrics, or outcomes.
- Improve action verb, clarity, keyword alignment, and impact.
- If the original has a metric, keep it. If no metric exists, do not fabricate one.
- Keep it one bullet, 18-32 words when possible.
- Do not start with a bullet symbol.
- Do not mention ATS, job descriptions, or keywords directly.
- Prefer role-relevant keywords naturally, especially critical and missing keywords, only where truthful.
        `.trim();

        const userPrompt = `
CURRENT BULLET:
${bulletText.slice(0, MAX_BULLET_CHARS)}

COMPACT JOB CONTEXT:
${JSON.stringify(compactJobContext, null, 2)}

Rewrite the current bullet into a stronger resume bullet.
        `.trim();

        const model = process.env.LLM_MODEL || 'gpt-4o-mini';
        const raw = await callLLM(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            { model, temperature: 0.35, max_tokens: 220, jsonMode: true }
        );

        let bullet = '';
        try {
            const parsed = JSON.parse(raw.replace(/```(?:json)?\s*([\s\S]*?)```/, '$1').trim());
            bullet = typeof parsed.bullet === 'string' ? parsed.bullet : '';
        } catch {
            bullet = raw;
        }

        const cleaned = cleanBullet(bullet);
        if (!cleaned) {
            return NextResponse.json({ error: 'The AI response was empty.' }, { status: 502 });
        }

        return NextResponse.json({ bullet: cleaned });
    } catch (error) {
        console.error('[enhance-resume-bullet] Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to enhance bullet.' },
            { status: 500 }
        );
    }
}
