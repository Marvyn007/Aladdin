/**
 * Apply Pilot — user-provided answers for US ATS screening forms.
 * Empty string on a field means "not specified"; the agent uses employer-friendly defaults
 * per system prompt unless the user chose a value.
 */
export interface ApplyPilotProfilePayload {
  phoneCountryCode:     string;
  phoneNational:        string;
  linkedinUrl:          string;
  githubUrl:              string;
  portfolioUrl:           string;
  otherWebsiteUrl:        string;
  twitterUrl:             string;
  addressLine1:           string;
  city:                   string;
  state:                  string;
  zipCode:                string;
  country:                string;
  willingToRelocate:      string;
  openToRemote:           string;
  sponsorshipRequired:    string;
  authorizedToWorkUs:     string;
  gender:                 string;
  pronouns:               string;
  race:                   string;
  hispanicLatino:         string;
  veteranStatus:          string;
  disabilityStatus:       string;
  governmentClearance:    string;
  currentJobTitle:        string;
  currentEmployer:        string;
  yearsExperienceRange:   string;
  expectedSalary:         string;
  noticePeriod:           string;
  earliestStartDate:      string;
}

export const EMPTY_APPLY_PILOT_PAYLOAD: ApplyPilotProfilePayload = {
  phoneCountryCode:     '',
  phoneNational:        '',
  linkedinUrl:          '',
  githubUrl:              '',
  portfolioUrl:           '',
  otherWebsiteUrl:        '',
  twitterUrl:             '',
  addressLine1:           '',
  city:                   '',
  state:                  '',
  zipCode:                '',
  country:                '',
  willingToRelocate:      '',
  openToRemote:           '',
  sponsorshipRequired:    '',
  authorizedToWorkUs:     '',
  gender:                 '',
  pronouns:               '',
  race:                   '',
  hispanicLatino:         '',
  veteranStatus:          '',
  disabilityStatus:       '',
  governmentClearance:    '',
  currentJobTitle:        '',
  currentEmployer:        '',
  yearsExperienceRange:   '',
  expectedSalary:         '',
  noticePeriod:           '',
  earliestStartDate:      '',
};

export const YES_NO_UNSPECIFIED = [
  { value: '', label: 'Agent decides' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'prefer_not', label: 'Prefer not to say' },
] as const;

export const PHONE_COUNTRY_CODES = [
  { value: '+1', label: '+1 (US / CA)' },
  { value: '+44', label: '+44 (UK)' },
  { value: '+91', label: '+91 (IN)' },
  { value: '+86', label: '+86 (CN)' },
  { value: '+49', label: '+49 (DE)' },
  { value: '+33', label: '+33 (FR)' },
  { value: '+61', label: '+61 (AU)' },
  { value: '+81', label: '+81 (JP)' },
  { value: '+82', label: '+82 (KR)' },
  { value: '+65', label: '+65 (SG)' },
  { value: '+52', label: '+52 (MX)' },
  { value: '+55', label: '+55 (BR)' },
  { value: '+971', label: '+971 (AE)' },
  { value: '+972', label: '+972 (IL)' },
  { value: '+353', label: '+353 (IE)' },
  { value: '+31', label: '+31 (NL)' },
  { value: '+46', label: '+46 (SE)' },
  { value: '+47', label: '+47 (NO)' },
  { value: '+48', label: '+48 (PL)' },
  { value: '+34', label: '+34 (ES)' },
  { value: '+39', label: '+39 (IT)' },
  { value: '+7', label: '+7 (RU/KZ)' },
  { value: '+380', label: '+380 (UA)' },
  { value: '+20', label: '+20 (EG)' },
  { value: '+27', label: '+27 (ZA)' },
  { value: '+234', label: '+234 (NG)' },
  { value: '+254', label: '+254 (KE)' },
] as const;

export const US_STATES = [
  { value: '', label: '— Select —' },
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' }, { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' }, { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' }, { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' }, { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' }, { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' }, { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' }, { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' }, { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
] as const;

export const COUNTRIES = [
  { value: '', label: '— Select —' },
  { value: 'United States', label: 'United States' },
  { value: 'Canada', label: 'Canada' },
  { value: 'United Kingdom', label: 'United Kingdom' },
  { value: 'India', label: 'India' },
  { value: 'Germany', label: 'Germany' },
  { value: 'France', label: 'France' },
  { value: 'Mexico', label: 'Mexico' },
  { value: 'Brazil', label: 'Brazil' },
  { value: 'Other', label: 'Other' },
] as const;

/** EEOC-style race (voluntary) */
export const RACE_OPTIONS = [
  { value: '', label: '— Unset / agent —' },
  { value: 'American Indian or Alaska Native', label: 'American Indian or Alaska Native' },
  { value: 'Asian', label: 'Asian' },
  { value: 'Black or African American', label: 'Black or African American' },
  { value: 'Native Hawaiian or Other Pacific Islander', label: 'Native Hawaiian or Other Pacific Islander' },
  { value: 'White', label: 'White' },
  { value: 'Two or more races', label: 'Two or more races' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
] as const;

export const HISPANIC_OPTIONS = [
  { value: '', label: '— Unset / agent —' },
  { value: 'Yes', label: 'Yes, Hispanic or Latino' },
  { value: 'No', label: 'No, not Hispanic or Latino' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
] as const;

export const GENDER_OPTIONS = [
  { value: '', label: '— Prefer not to say —' },
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
  { value: 'Decline to self-identify', label: 'Decline to self-identify' },
] as const;

export const PRONOUN_OPTIONS = [
  { value: '', label: '— Optional —' },
  { value: 'he/him', label: 'he/him' },
  { value: 'she/her', label: 'she/her' },
  { value: 'they/them', label: 'they/them' },
  { value: 'Prefer not to say', label: 'Prefer not to say' },
] as const;

export const VETERAN_OPTIONS = [
  { value: '', label: '— Prefer not to say —' },
  { value: 'Not a veteran', label: 'I am not a protected veteran' },
  { value: 'Protected veteran', label: 'I am a protected veteran' },
  { value: 'Prefer not to say', label: 'Prefer not to answer' },
] as const;

export const DISABILITY_OPTIONS = [
  { value: '', label: '— Prefer not to say —' },
  { value: 'Yes', label: 'Yes, I have a disability (or history)' },
  { value: 'No', label: 'No, I do not have a disability' },
  { value: 'Prefer not to say', label: 'Prefer not to answer' },
] as const;

export const CLEARANCE_OPTIONS = [
  { value: '', label: '— Not applicable / none —' },
  { value: 'None', label: 'None' },
  { value: 'Public Trust', label: 'Public Trust' },
  { value: 'Confidential', label: 'Confidential' },
  { value: 'Secret', label: 'Secret' },
  { value: 'Top Secret', label: 'Top Secret' },
  { value: 'TS/SCI', label: 'TS/SCI' },
] as const;

export const YEARS_EXPERIENCE_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: '0-1', label: '0–1 years' },
  { value: '2-3', label: '2–3 years' },
  { value: '4-5', label: '4–5 years' },
  { value: '6-9', label: '6–9 years' },
  { value: '10+', label: '10+ years' },
] as const;

export const NOTICE_PERIOD_OPTIONS = [
  { value: '', label: '— Select —' },
  { value: 'Immediate', label: 'Immediately available' },
  { value: '2 weeks', label: '2 weeks' },
  { value: '1 month', label: '1 month' },
  { value: '2 months', label: '2 months' },
  { value: '3+ months', label: '3+ months' },
] as const;

/** Normalize yes|no|prefer_not|'' to display value for forms */
export function ynToLabel(v: string): string {
  if (v === 'yes') return 'Yes';
  if (v === 'no') return 'No';
  if (v === 'prefer_not') return 'Prefer not to say';
  return '';
}

export function parseApplyPilotPayload(raw: unknown): ApplyPilotProfilePayload {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_APPLY_PILOT_PAYLOAD };
  const o = raw as Record<string, unknown>;
  const str = (k: keyof ApplyPilotProfilePayload) =>
    typeof o[k] === 'string' ? o[k] as string : '';
  return {
    phoneCountryCode:     str('phoneCountryCode'),
    phoneNational:        str('phoneNational'),
    linkedinUrl:          str('linkedinUrl'),
    githubUrl:              str('githubUrl'),
    portfolioUrl:           str('portfolioUrl'),
    otherWebsiteUrl:        str('otherWebsiteUrl'),
    twitterUrl:             str('twitterUrl'),
    addressLine1:           str('addressLine1'),
    city:                   str('city'),
    state:                  str('state'),
    zipCode:                str('zipCode'),
    country:                str('country'),
    willingToRelocate:      str('willingToRelocate'),
    openToRemote:           str('openToRemote'),
    sponsorshipRequired:    str('sponsorshipRequired'),
    authorizedToWorkUs:     str('authorizedToWorkUs'),
    gender:                 str('gender'),
    pronouns:               str('pronouns'),
    race:                   str('race'),
    hispanicLatino:         str('hispanicLatino'),
    veteranStatus:          str('veteranStatus'),
    disabilityStatus:       str('disabilityStatus'),
    governmentClearance:    str('governmentClearance'),
    currentJobTitle:        str('currentJobTitle'),
    currentEmployer:        str('currentEmployer'),
    yearsExperienceRange:   str('yearsExperienceRange'),
    expectedSalary:         str('expectedSalary'),
    noticePeriod:           str('noticePeriod'),
    earliestStartDate:      str('earliestStartDate'),
  };
}
