import type { Job } from '@/types';
import type { OnboardingAnswerRecord } from '@/lib/onboarding';

/**
 * Compute a 0-100 preference score for a job based on the user's onboarding answers.
 *
 * Weights:
 *   - work_areas   30pts: role family keywords in job title
 *   - regions      25pts: region labels in job location
 *   - role_types   20pts: employment type match
 *   - work_style   15pts: remote/onsite/hybrid/flexible
 *   - career_levels 10pts: seniority keywords in job title
 *
 * Returns Math.min(100, Math.max(0, score)).
 */
export function computePreferenceScore(
  job: Job,
  answersByKey: Record<string, OnboardingAnswerRecord>
): number {
  let score = 0;

  // ─── work_areas (30pts) ───────────────────────────────────────────────────
  const workAreasAnswer = answersByKey['work_areas'];
  if (workAreasAnswer) {
    const selected = toStringArray(workAreasAnswer.value);
    const titleLower = (job.title ?? '').toLowerCase();
    const matched = selected.some((value) => {
      // Convert value to keyword: underscores→spaces, drop trailing "engineer"
      const keyword = value
        .replace(/_/g, ' ')
        .replace(/\s+engineer$/, '')
        .trim();
      return keyword.length > 0 && titleLower.includes(keyword);
    });
    if (matched) score += 30;
  }

  // ─── regions (25pts) ─────────────────────────────────────────────────────
  const regionsAnswer = answersByKey['regions'];
  if (regionsAnswer) {
    const selected = toStringArray(regionsAnswer.value);
    const locationLower = (job.location ?? '').toLowerCase();
    const matched = selected.some((value) => {
      if (value === 'remote_worldwide') {
        return locationLower.includes('remote');
      }
      const keyword = value.replace(/_/g, ' ').trim();
      return keyword.length > 0 && locationLower.includes(keyword);
    });
    if (matched) score += 25;
  }

  // ─── role_types (20pts) ───────────────────────────────────────────────────
  const roleTypesAnswer = answersByKey['role_types'];
  if (roleTypesAnswer && job.jobType != null) {
    const selected = toStringArray(roleTypesAnswer.value);
    const roleTypeMap: Record<string, string> = {
      full_time: 'fulltime',
      part_time: 'parttime',
      contract: 'contract',
      internship: 'internship',
      freelance: 'contract',
      apprenticeship: 'parttime',
    };
    const matched = selected.some((value) => {
      const mapped = roleTypeMap[value] ?? value;
      return mapped === job.jobType;
    });
    if (matched) score += 20;
  }

  // ─── work_style (15pts) ───────────────────────────────────────────────────
  const workStyleAnswer = answersByKey['work_style'];
  if (workStyleAnswer) {
    const style = toSingleString(workStyleAnswer.value);
    if (style === 'flexible') {
      score += 15;
    } else if (style === 'remote' && job.isRemote === true) {
      score += 15;
    } else if (style === 'onsite' && job.isRemote === false) {
      score += 15;
    } else if (style === 'hybrid') {
      const locationLower = (job.location ?? '').toLowerCase();
      if (locationLower.includes('hybrid')) {
        score += 15;
      }
    }
  }

  // ─── career_levels (10pts) ────────────────────────────────────────────────
  const careerLevelsAnswer = answersByKey['career_levels'];
  if (careerLevelsAnswer) {
    const selected = toStringArray(careerLevelsAnswer.value);
    const titleLower = (job.title ?? '').toLowerCase();
    const levelKeywords: Record<string, string[]> = {
      early_career: ['junior', 'entry', 'intern', 'associate'],
      mid_level: ['mid', ' ii', ' iii'],
      senior_manager: ['senior', 'staff', 'lead', 'principal', 'manager'],
      executive_leadership: ['director', 'vp', 'head', 'chief', 'executive'],
    };
    const matched = selected.some((level) => {
      const keywords = levelKeywords[level] ?? [];
      return keywords.some((kw) => titleLower.includes(kw));
    });
    if (matched) score += 10;
  }

  return Math.min(100, Math.max(0, score));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function toSingleString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  return null;
}
