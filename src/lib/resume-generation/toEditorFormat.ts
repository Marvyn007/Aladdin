// src/lib/resume-generation/toEditorFormat.ts
import { v4 as uuidv4 } from 'uuid';
import type { DynamicParsedResume } from './types';
import type { TailoredResumeData } from '@/types';
import { DEFAULT_RESUME_DESIGN } from '@/types';

export function toEditorFormat(
  parsed: DynamicParsedResume,
  opts: { jobId?: string; jobTitle?: string } = {}
): TailoredResumeData {
  const mappedSections = (parsed.sections ?? []).map((sec) => ({
    id: uuidv4(),
    type: sec.name.toLowerCase().replace(/[^a-z]/g, ''),
    title: sec.name,
    items: (sec.entries ?? []).map((entry) => {
      const bullets = (entry.bullets ?? []).map((b, i) => {
        const suggestion = entry.bulletSuggestions?.[i];
        return {
          id: uuidv4(),
          text: b,
          suggestion: suggestion ? suggestion.hint : undefined,
        };
      });
      return {
        id: uuidv4(),
        title: entry.title ?? '',
        subtitle: entry.subtitle ?? '',
        location: entry.location ?? '',
        dates:
          entry.startDate && entry.endDate
            ? `${entry.startDate} - ${entry.endDate}`
            : entry.startDate ?? '',
        bullets,
        jdAnchors: entry.jdAnchors,
      };
    }),
  }));

  if (!mappedSections.some((s) => s.type === 'skills')) {
    mappedSections.push({ id: uuidv4(), type: 'skills', title: 'Skills', items: [] });
  }

  const skillsRecord: Record<string, string[]> = Array.isArray(parsed.skills)
    ? { Skills: parsed.skills as string[] }
    : (parsed.skills as unknown as Record<string, string[]>) ?? {};

  return {
    id: uuidv4(),
    contact: {
      name: parsed.basics?.name ?? '',
      email: parsed.basics?.email ?? '',
      phone: parsed.basics?.phone ?? '',
      linkedin: parsed.basics?.linkedin ?? '',
      location: parsed.basics?.location ?? '',
      github: parsed.basics?.website ? [parsed.basics.website] : [],
    },
    summary: parsed.summary ?? '',
    sections: mappedSections,
    skills: skillsRecord,
    design: DEFAULT_RESUME_DESIGN,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...(opts.jobId ? { jobId: opts.jobId } : {}),
    ...(opts.jobTitle ? { jobTitle: opts.jobTitle } : {}),
  };
}
