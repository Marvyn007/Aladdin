/**
 * Given field metadata and the cached profile, returns the value to fill
 * or null if no match (LLM should answer).
 *
 * @param {{ label: string, placeholder: string, name: string, ariaLabel: string }} fieldMeta
 * @param {{ user: object, onboardingAnswers: Array, userContext: object }} profile
 * @returns {string|null}
 */
export function matchFieldToProfile(fieldMeta, profile) {
  const text = buildFieldText(fieldMeta);
  const { user, onboardingAnswers, userContext = {} } = profile;

  // 1. Direct user table fields (highest accuracy)
  if (matches(text, ['first name', 'firstname', 'first_name', 'given name'])) return user?.firstName ?? null;
  if (matches(text, ['last name', 'lastname', 'last_name', 'surname', 'family name'])) return user?.lastName ?? null;
  if (matches(text, ['email', 'e-mail', 'email address'])) return user?.email ?? null;

  // 2. Check canonical and learned UserContext values first
  const customContextAnswer = matchUserContext(text, userContext);
  if (customContextAnswer) {
    return customContextAnswer;
  }

  // 3. Known ATS field patterns for common personal info
  const getAA = (key) => {
    if (typeof userContext[key] === 'string' && userContext[key].trim()) {
      return userContext[key];
    }
    return onboardingAnswers?.find(a => a.questionKey === key)?.answerText ?? null;
  };

  if (isPhoneCountryCodeFieldText(text)) return getAA('aa_phone_country_code');
  if (matches(text, ['phone', 'mobile', 'telephone', 'cell'])) return getAA('aa_phone');
  if (matches(text, ['linkedin', 'linkedin url', 'linkedin profile', 'urls[LinkedIn]'])) return getAA('aa_linkedin_url');
  if (matches(text, ['github', 'github url', 'github profile', 'urls[GitHub]'])) return getAA('aa_github_url');
  if (matches(text, ['portfolio', 'website', 'personal site', 'portfolio url', 'urls[Portfolio]'])) return getAA('aa_portfolio_url');
  if (matches(text, ['twitter', 'x.com'])) return getAA('aa_twitter_url');

  // ── "Get hired" Yes/No defaults — checked BEFORE generic location/field lookups
  //    because labels like "Are you a national of the COUNTRY..." would otherwise
  //    match the generic 'country' → aa_country check and return null.
  // ── Work eligibility / authorization ─────────────────────────────────────
  if (matches(text, ['authorized to work', 'legally authorized', 'work authorization'])) return 'Yes';
  if (matches(text, ['right to work', 'eligible to work', 'permitted to work'])) return 'Yes';
  if (matches(text, ['national of', 'citizen of', 'residing in this country'])) return 'Yes';
  if (matches(text, ['sponsorship', 'require visa', 'need sponsorship', 'visa sponsorship required'])) return 'No';

  // ── Relocation / scheduling / availability ────────────────────────────────
  if (matches(text, ['willing to relocate', 'open to relocat', 'relocation'])) return 'Yes';
  if (matches(text, ['willing to travel', 'open to travel', 'travel required'])) return 'Yes';
  if (matches(text, ['available to work', 'available to start', 'ready to start'])) return 'Yes';
  if (matches(text, ['work full time', 'full-time', 'full time basis'])) return 'Yes';
  if (matches(text, ['work on-site', 'work onsite', 'work in office', 'in-office', 'on site'])) return 'Yes';
  if (matches(text, ['accommodate'])) return 'Yes';

  // ── Pre-employment screening ──────────────────────────────────────────────
  if (matches(text, ['background check', 'background screening', 'criminal check'])) return 'Yes';
  if (matches(text, ['drug test', 'drug screen', 'substance test'])) return 'Yes';

  // ── Location ──────────────────────────────────────────────────────────────
  if (matches(text, ['street', 'address', 'line 1'])) return getAA('aa_address');
  if (matches(text, ['city', 'town'])) return getAA('aa_city');
  if (matches(text, ['state', 'province', 'region'])) return getAA('aa_state');
  if (matches(text, ['zip', 'postal', 'postal code', 'zip code'])) return getAA('aa_zip');
  if (matches(text, ['country']) && !isPhoneCountryCodeFieldText(text)) return getAA('aa_country');

  // Experience / Education
  if (matches(text, ['current title', 'job title', 'current position', 'most recent title', 'org_title'])) return getAA('aa_current_title');
  if (matches(text, ['current company', 'current employer', 'org', 'organization'])) return getAA('aa_current_company');
  if (matches(text, ['years of experience', 'years experience', 'how many years'])) return getAA('aa_years_experience');
  if (matches(text, ['education', 'degree', 'highest degree', 'educational background'])) return getAA('aa_education_level');

  // ── EEO / demographic fields (radio groups & selects) ────────────────────
  if (matches(text, ['gender'])) return getAA('aa_gender');
  if (matches(text, ['pronoun'])) return getAA('aa_pronouns');
  if (matches(text, ['ethnicity', 'race']) && !matches(text, ['hispanic'])) return getAA('aa_ethnicity');
  if (matches(text, ['hispanic', 'latino'])) return getAA('aa_hispanic');
  if (matches(text, ['veteran'])) return getAA('aa_veteran_status');
  if (matches(text, ['disability'])) return getAA('aa_disability');
  if (matches(text, ['lgbtq', 'sexual orientation'])) return getAA('aa_lgbtq');
  if (matches(text, ['clearance'])) return getAA('aa_clearance');

  return null; // Not matched — send to LLM
}

function matches(text, patterns) {
  const t = text.toLowerCase();
  return patterns.some(p => t.includes(p.toLowerCase()));
}

function matchUserContext(text, userContext) {
  for (const [key, value] of Object.entries(userContext ?? {})) {
    if (key.startsWith('aa_custom_') && value && typeof value === 'object') {
      const questionLabel = value.questionLabel ?? '';
      const answerValue = value.value ?? '';
      if (questionLabel && typeof answerValue === 'string' && matches(text, [questionLabel])) {
        return answerValue;
      }
      continue;
    }

    if (key.startsWith('aa_')) {
      continue;
    }

    if (typeof value === 'string' && matches(text, [key])) {
      return value;
    }
  }

  return null;
}

function buildFieldText(fieldMeta) {
  return [fieldMeta.label, fieldMeta.placeholder, fieldMeta.name, fieldMeta.ariaLabel]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Labels / names that mean phone dial prefix — checked before generic "phone" or "country". */
const PHONE_COUNTRY_CODE_PATTERNS = [
  'country code',
  'calling code',
  'dial code',
  'dialing code',
  'international code',
  'intl code',
  'phone country',
  'mobile country',
  'telephone country',
  'isd',
  'idd',
  'countrycallingcode',
  'phoneprefix',
  'country_prefix',
];

function isPhoneCountryCodeFieldText(text) {
  const t = text.toLowerCase();
  if (matches(t, PHONE_COUNTRY_CODE_PATTERNS)) return true;
  if (t.includes('code') && (t.includes('phone') || t.includes('mobile') || t.includes('cell') || t.includes('tel')))
    return true;
  return false;
}

function getAAField(profile, key) {
  const { onboardingAnswers = [], userContext = {} } = profile || {};
  if (typeof userContext[key] === 'string' && userContext[key].trim()) return userContext[key].trim();
  const row = onboardingAnswers.find((a) => a.questionKey === key);
  return row?.answerText?.trim() || null;
}

/**
 * Best-effort school / university name from profile (onboarding, userContext, resume JSON).
 * @param {object} profile
 * @returns {string|null}
 */
export function extractSchoolNameFromProfile(profile) {
  if (!profile) return null;
  const { onboardingAnswers = [], userContext = {}, resume } = profile;

  for (const a of onboardingAnswers) {
    const ql = (a.questionLabel || '').toLowerCase();
    const qk = (a.questionKey || '').toLowerCase();
    if (
      /(university|college|school|institution)/.test(ql) ||
      /(university|school|college|institution)/.test(qk)
    ) {
      const t = a.answerText?.trim();
      if (t) return t;
    }
  }

  for (const [k, value] of Object.entries(userContext || {})) {
    if (typeof value !== 'string' || !value.trim()) continue;
    if (/(university|school|college|institution)/i.test(k)) return value.trim();
  }

  const pj = resume?.parsedJson;
  if (pj && typeof pj === 'object') {
    const ed = pj.education ?? pj.educations;
    if (Array.isArray(ed) && ed.length) {
      const e0 = ed[0];
      if (e0 && typeof e0 === 'object') {
        const name =
          e0.institution ?? e0.school ?? e0.university ?? e0.name ?? e0.schoolName;
        if (typeof name === 'string' && name.trim()) return name.trim();
      }
    }
  }

  return null;
}

/**
 * Extra profile-derived hints for <select> fields when label match alone did not map (e.g. university list).
 * @returns {string|null}
 */
export function inferSelectHintFromProfile(fieldMeta, profile) {
  if (!profile) return null;
  const text = buildFieldText(fieldMeta);

  if (isPhoneCountryCodeFieldText(text)) {
    const v = getAAField(profile, 'aa_phone_country_code');
    if (v) return v;
  }

  const school = extractSchoolNameFromProfile(profile);
  if (school && matches(text, ['university', 'college', 'school', 'institution', 'enrolled', 'campus'])) {
    return school;
  }

  if (matches(text, ['gender'])) return getAAField(profile, 'aa_gender');
  if (matches(text, ['pronoun'])) return getAAField(profile, 'aa_pronouns');
  if (matches(text, ['ethnicity', 'race']) && !matches(text, ['hispanic'])) {
    return getAAField(profile, 'aa_ethnicity');
  }
  if (matches(text, ['hispanic', 'latino'])) return getAAField(profile, 'aa_hispanic');
  if (matches(text, ['veteran'])) return getAAField(profile, 'aa_veteran_status');
  if (matches(text, ['disability'])) return getAAField(profile, 'aa_disability');
  if (matches(text, ['lgbtq', 'sexual orientation'])) return getAAField(profile, 'aa_lgbtq');
  if (matches(text, ['education level', 'highest degree', 'degree level'])) {
    return getAAField(profile, 'aa_education_level');
  }
  if (matches(text, ['citizenship country', 'country of citizenship'])) {
    return getAAField(profile, 'aa_citizenship_country');
  }
  if (matches(text, ['country']) && matches(text, ['citizen'])) {
    return getAAField(profile, 'aa_citizenship_country');
  }
  if (matches(text, ['willing to relocate', 'relocation'])) {
    return getAAField(profile, 'aa_willing_to_relocate');
  }
  if (matches(text, ['clearance'])) return getAAField(profile, 'aa_clearance');

  return null;
}
