// src/lib/auto-apply/match-field.ts
// TypeScript port of extension/src/utils/fieldMatcher.js

export interface FieldMeta {
  label?:       string;
  placeholder?: string;
  name?:        string;
  ariaLabel?:   string;
}

export interface OnboardingAnswer {
  questionKey: string;
  answerText:  string | null;
}

export interface ProfileContext {
  user: {
    firstName?: string | null;
    lastName?:  string | null;
    email?:     string | null;
  };
  onboardingAnswers: OnboardingAnswer[];
  userContext:       Record<string, unknown>;
  resumeSummary:     string;
  /** Target job for tailoring (optional) */
  jobPack?: {
    title:       string;
    company:     string | null;
    description: string;
  };
  /** Human-readable block for the agent system prompt */
  applyPilotNarrative?: string;
  /** Same Apply Pilot answers as JSON (authoritative for exact values in the agent prompt). */
  applyPilotAnswersJson?: string;
}

function buildText(f: FieldMeta): string {
  return [f.label, f.placeholder, f.name, f.ariaLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function matches(text: string, patterns: string[]): boolean {
  return patterns.some(p => text.includes(p.toLowerCase()));
}

function getAA(key: string, profile: ProfileContext): string | null {
  const ctx = profile.userContext;
  if (typeof ctx[key] === 'string' && (ctx[key] as string).trim()) {
    return (ctx[key] as string).trim();
  }
  return profile.onboardingAnswers.find(a => a.questionKey === key)?.answerText ?? null;
}

function isPhoneCountryCode(text: string): boolean {
  return matches(text, ['country code', 'calling code', 'dial code', 'dialing code', 'isd', 'idd']) ||
    (text.includes('code') && matches(text, ['phone', 'mobile', 'cell', 'tel']));
}

/**
 * Deterministic field→profile match.
 * Returns the string value to fill, or null (LLM should answer).
 */
export function matchFieldToProfile(
  fieldMeta: FieldMeta,
  profile: ProfileContext
): string | null {
  const text = buildText(fieldMeta);

  // 1. Direct user table fields
  if (matches(text, ['first name', 'firstname', 'first_name', 'given name'])) return profile.user.firstName ?? null;
  if (matches(text, ['last name', 'lastname', 'last_name', 'surname', 'family name'])) return profile.user.lastName ?? null;
  if (matches(text, ['email', 'e-mail', 'email address'])) return profile.user.email ?? null;

  // 2. userContext custom learned entries
  for (const [key, value] of Object.entries(profile.userContext)) {
    if (key.startsWith('aa_custom_') && value && typeof value === 'object') {
      const v = value as { questionLabel?: string; value?: string };
      if (v.questionLabel && typeof v.value === 'string' && matches(text, [v.questionLabel])) {
        return v.value;
      }
      continue;
    }
    if (key.startsWith('aa_')) continue;
    if (typeof value === 'string' && matches(text, [key])) return value;
  }

  // 3. Known ATS field patterns
  if (isPhoneCountryCode(text))                                    return getAA('aa_phone_country_code', profile);
  if (matches(text, ['phone', 'mobile', 'telephone', 'cell']))     return getAA('aa_phone', profile);
  if (matches(text, ['linkedin']))                                  return getAA('aa_linkedin_url', profile);
  if (matches(text, ['github']))                                    return getAA('aa_github_url', profile);
  if (matches(text, ['portfolio', 'personal site']))               return getAA('aa_portfolio_url', profile);
  if (matches(text, ['twitter', 'x.com']))                         return getAA('aa_twitter_url', profile);

  // 4. Work eligibility — user Apply Pilot first, then positive defaults
  if (matches(text, ['authorized to work', 'legally authorized', 'work authorization'])) {
    return getAA('aa_authorized_us', profile) ?? 'Yes';
  }
  if (matches(text, ['right to work', 'eligible to work', 'permitted to work'])) {
    return getAA('aa_authorized_us', profile) ?? 'Yes';
  }
  if (matches(text, ['national of', 'citizen of'])) return 'Yes';
  if (matches(text, ['sponsorship', 'require visa', 'need sponsorship', 'visa sponsorship'])) {
    return getAA('aa_sponsorship_needed', profile) ?? 'No';
  }

  // 5. Relocation / availability / screening
  if (matches(text, ['willing to relocate', 'open to relocat', 'relocation'])) {
    return getAA('aa_willing_relocate', profile) ?? 'Yes';
  }
  if (matches(text, ['open to remote', 'remote work', 'hybrid'])) {
    return getAA('aa_open_to_remote', profile) ?? 'Yes';
  }
  if (matches(text, ['willing to travel', 'open to travel'])) return 'Yes';
  if (matches(text, ['background check', 'background screening'])) return 'Yes';
  if (matches(text, ['drug test', 'drug screen'])) return 'Yes';

  // 6. Location
  if (matches(text, ['street', 'address line 1']))                            return getAA('aa_address', profile);
  if (matches(text, ['city', 'town']))                                         return getAA('aa_city', profile);
  if (matches(text, ['state', 'province', 'region']))                          return getAA('aa_state', profile);
  if (matches(text, ['zip', 'postal']))                                         return getAA('aa_zip', profile);
  if (matches(text, ['country']) && !isPhoneCountryCode(text))                 return getAA('aa_country', profile);

  // 7. Work history & comp
  if (matches(text, ['current title', 'job title', 'most recent title']))      return getAA('aa_current_title', profile);
  if (matches(text, ['current company', 'current employer']))                   return getAA('aa_current_company', profile);
  if (matches(text, ['years of experience', 'years experience']))               return getAA('aa_years_experience', profile);
  if (matches(text, ['expected salary', 'salary expectation', 'compensation expectation', 'desired salary'])) {
    return getAA('aa_expected_salary', profile);
  }
  if (matches(text, ['notice period', 'availability', 'when can you start'])) {
    return getAA('aa_notice_period', profile) ?? getAA('aa_earliest_start', profile);
  }
  if (matches(text, ['start date', 'earliest start'])) return getAA('aa_earliest_start', profile);

  // 8. EEO / demographic
  if (matches(text, ['gender']))                                                 return getAA('aa_gender', profile);
  if (matches(text, ['pronoun']))                                                return getAA('aa_pronouns', profile);
  if (matches(text, ['ethnicity', 'race']) && !matches(text, ['hispanic']))     return getAA('aa_ethnicity', profile);
  if (matches(text, ['hispanic', 'latino']))                                     return getAA('aa_hispanic', profile);
  if (matches(text, ['veteran']))                                                return getAA('aa_veteran_status', profile);
  if (matches(text, ['disability']))                                             return getAA('aa_disability', profile);
  if (matches(text, ['clearance']))                                              return getAA('aa_clearance', profile);

  return null;
}
