import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';
import { callLLM } from '@/lib/resume-generation/utils';
import { parsedResumeJsonToAgentText } from '@/lib/auto-apply/parsed-resume-for-agent';

export const dynamic = 'force-dynamic';

/**
 * POST (PAT auth): Generate an LLM answer for an unknown form field.
 *
 * Request body:
 * {
 *   fieldLabel:      string    — the form field label/question text
 *   options?:        string[]  — available choices (for select/radio)
 *   jobTitle?:       string
 *   company?:        string
 *   jobDescription?: string
 * }
 *
 * Response: { answer: string, confidence: "high" | "low" }
 */
export async function POST(request: NextRequest) {
  const pat = await validateExtensionPat(request);
  if (!pat) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = pat;
  const body = await request.json().catch(() => ({}));

  const fieldLabel: string   = body?.fieldLabel    ?? '';
  const options:    string[] = Array.isArray(body?.options) ? body.options : [];
  const jobTitle:   string   = body?.jobTitle       ?? '';
  const company:    string   = body?.company        ?? '';
  const jobDesc:    string   = body?.jobDescription ?? '';

  if (!fieldLabel) {
    return NextResponse.json({ error: 'fieldLabel is required' }, { status: 400 });
  }

  const resume = await prisma.resume.findFirst({
    where:   { userId, archivedAt: null },
    orderBy: { uploadAt: 'desc' },
    select:  { parsedJson: true },
  });

  let resumeSummary = '';
  if (resume?.parsedJson && typeof resume.parsedJson === 'object') {
    resumeSummary = parsedResumeJsonToAgentText(resume.parsedJson).slice(0, 2000);
  }

  const optionsList = options.length
    ? `\nAvailable options:\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
    : '';

  const systemPrompt =
    'You are completing a job application form on behalf of the candidate. ' +
    'Always pick the option most likely to advance the candidate. ' +
    'Reply with ONLY the exact answer text — no explanation, no quotes, no punctuation around the answer.';

  const userMessage =
    `Job: ${jobTitle || 'unknown'} at ${company || 'unknown company'}\n` +
    (jobDesc ? `Job description (excerpt): ${jobDesc.slice(0, 800)}\n` : '') +
    `\nResume summary:\n${resumeSummary}\n` +
    `\nForm field: "${fieldLabel}"${optionsList}\n` +
    `\nWhat is the best answer for this field?`;

  try {
    const answer = await callLLM(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      { max_tokens: 120, temperature: 0.1 }
    );

    return NextResponse.json({
      answer:     answer.trim(),
      confidence: options.length ? 'high' : 'low',
    });
  } catch (err) {
    console.error('[extension/answer]', err);
    return NextResponse.json(
      { error: 'Could not generate an answer. Please try again.' },
      { status: 500 }
    );
  }
}
