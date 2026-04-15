import type { ApplyPilotProfilePayload } from '@/lib/apply-pilot-profile/types';
import { ynToLabel } from '@/lib/apply-pilot-profile/types';

/** Compact human-readable block for the Stagehand system prompt. */
export function formatApplyPilotNarrative(
  p: ApplyPilotProfilePayload,
  user: { firstName?: string | null; lastName?: string | null; email?: string | null }
): string {
  const lines: string[] = [];
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (name) lines.push(`Legal / display name (Clerk): ${name}`);
  if (user.email) lines.push(`Email: ${user.email}`);
  if (p.phoneCountryCode || p.phoneNational) {
    lines.push(`Phone: ${p.phoneCountryCode} ${p.phoneNational}`.trim());
  }
  if (p.linkedinUrl.trim()) lines.push(`LinkedIn URL: ${p.linkedinUrl.trim()}`);
  if (p.githubUrl.trim()) lines.push(`GitHub URL: ${p.githubUrl.trim()}`);
  if (p.portfolioUrl.trim()) lines.push(`Portfolio / website URL: ${p.portfolioUrl.trim()}`);
  if (p.otherWebsiteUrl.trim()) lines.push(`Other URL: ${p.otherWebsiteUrl.trim()}`);
  if (p.twitterUrl.trim()) lines.push(`Twitter / X URL: ${p.twitterUrl.trim()}`);
  const addr = [p.addressLine1, p.city, p.state, p.zipCode, p.country].filter((x) => x.trim()).join(', ');
  if (addr) lines.push(`Mailing address: ${addr}`);
  const wr = ynToLabel(p.willingToRelocate);
  if (wr) lines.push(`Willing to relocate: ${wr}`);
  const orm = ynToLabel(p.openToRemote);
  if (orm) lines.push(`Open to remote / hybrid: ${orm}`);
  const sp = ynToLabel(p.sponsorshipRequired);
  if (sp) lines.push(`Requires visa sponsorship: ${sp}`);
  const auth = ynToLabel(p.authorizedToWorkUs);
  if (auth) lines.push(`Authorized to work in US: ${auth}`);
  if (p.gender.trim()) lines.push(`Gender (voluntary): ${p.gender}`);
  if (p.pronouns.trim()) lines.push(`Pronouns: ${p.pronouns}`);
  if (p.race.trim()) lines.push(`Race / ethnicity (voluntary): ${p.race}`);
  if (p.hispanicLatino.trim()) lines.push(`Hispanic or Latino (voluntary): ${p.hispanicLatino}`);
  if (p.veteranStatus.trim()) lines.push(`Veteran status (voluntary): ${p.veteranStatus}`);
  if (p.disabilityStatus.trim()) lines.push(`Disability status (voluntary): ${p.disabilityStatus}`);
  if (p.governmentClearance.trim()) lines.push(`Government clearance: ${p.governmentClearance}`);
  if (p.currentJobTitle.trim()) lines.push(`Current job title: ${p.currentJobTitle}`);
  if (p.currentEmployer.trim()) lines.push(`Current employer: ${p.currentEmployer}`);
  if (p.yearsExperienceRange.trim()) lines.push(`Years of experience (band): ${p.yearsExperienceRange}`);
  if (p.expectedSalary.trim()) lines.push(`Expected compensation (user stated): ${p.expectedSalary}`);
  if (p.noticePeriod.trim()) lines.push(`Notice period: ${p.noticePeriod}`);
  if (p.earliestStartDate.trim()) lines.push(`Earliest start / availability: ${p.earliestStartDate}`);

  if (lines.length === 0) {
    return 'No Apply Pilot form fields saved yet — rely on resume summary and job tailoring; use positive defaults per system rules where allowed.';
  }
  return lines.join('\n');
}
