import type { ApplyPilotProfilePayload } from '@/lib/apply-pilot-profile/types';

/** Map yes|no|prefer_not to ATS-friendly strings */
function yn(p: string): string {
  if (p === 'yes') return 'Yes';
  if (p === 'no') return 'No';
  if (p === 'prefer_not') return 'Prefer not to say';
  return '';
}

/**
 * Flatten Apply Pilot payload into `ProfileContext.userContext` keys consumed by `matchFieldToProfile`.
 */
export function applyPilotPayloadToUserContext(p: ApplyPilotProfilePayload): Record<string, string> {
  const out: Record<string, string> = {};
  const set = (k: string, v: string) => {
    if (v.trim()) out[k] = v.trim();
  };

  set('aa_phone_country_code', p.phoneCountryCode);
  set('aa_phone', p.phoneNational.trim());
  set('aa_preferred_name', p.preferredName);
  set('aa_name_suffix', p.nameSuffix);
  set('aa_date_of_birth', p.dateOfBirth);
  set('aa_linkedin_url', p.linkedinUrl);
  set('aa_github_url', p.githubUrl);
  set('aa_portfolio_url', p.portfolioUrl);
  if (p.otherWebsiteUrl.trim()) set('aa_other_website', p.otherWebsiteUrl);
  set('aa_twitter_url', p.twitterUrl);
  set('aa_address', p.addressLine1);
  set('aa_address_line2', p.addressLine2);
  set('aa_address_line3', p.addressLine3);
  set('aa_city', p.city);
  set('aa_state', p.state);
  set('aa_zip', p.zipCode);
  set('aa_country', p.country);
  const wr = yn(p.willingToRelocate);
  if (wr) set('aa_willing_relocate', wr);
  const orm = yn(p.openToRemote);
  if (orm) set('aa_open_to_remote', orm);
  const sp = yn(p.sponsorshipRequired);
  if (sp) set('aa_sponsorship_needed', sp);
  const auth = yn(p.authorizedToWorkUs);
  if (auth) set('aa_authorized_us', auth);
  const authCa = yn(p.authorizedToWorkCanada);
  if (authCa) set('aa_authorized_canada', authCa);
  const authUk = yn(p.authorizedToWorkUk);
  if (authUk) set('aa_authorized_uk', authUk);
  set('aa_gender', p.gender);
  set('aa_pronouns', p.pronouns);
  if (p.lgbtqIdentity.trim()) set('aa_lgbtq', p.lgbtqIdentity);
  set('aa_ethnicity', p.race);
  set('aa_hispanic', p.hispanicLatino);
  set('aa_veteran_status', p.veteranStatus);
  set('aa_disability', p.disabilityStatus);
  set('aa_clearance', p.governmentClearance);
  set('aa_current_title', p.currentJobTitle);
  set('aa_current_company', p.currentEmployer);
  set('aa_years_experience', p.yearsExperienceRange);
  set('aa_expected_salary', p.expectedSalary);
  set('aa_notice_period', p.noticePeriod);
  set('aa_earliest_start', p.earliestStartDate);
  return out;
}
