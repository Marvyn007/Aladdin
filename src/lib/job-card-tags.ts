import type { Job } from '@/types';

export type JobCardTagKind =
    | 'season'
    | 'program'
    | 'schedule'
    | 'experience'
    | 'compensation'
    | 'location'
    | 'workplace';

export interface JobCardTag {
    kind: JobCardTagKind;
    slug: string;
    label: string;
}

export interface JobCardTagInput {
    title: string;
    location?: string | null;
    location_display?: string | null;
    job_description_plain?: string | null;
    raw_text_summary?: string | null;
    salaryMin?: number | null;
    salaryMax?: number | null;
    salaryCurrency?: string | null;
    jobType?: Job['jobType'];
    isRemote?: boolean;
    experienceLevel?: Job['experienceLevel'];
}

const TAG_ORDER: Record<JobCardTagKind, number> = {
    season: 10,
    program: 20,
    schedule: 30,
    experience: 40,
    compensation: 50,
    location: 60,
    workplace: 70,
};

const PROGRAM_PATTERNS: Array<{ slug: string; label: string; regex: RegExp }> = [
    { slug: 'internship', label: 'Internship', regex: /\b(?:internship|intern)\b/i },
    { slug: 'co-op', label: 'Co-op', regex: /\bco[- ]?op\b/i },
    { slug: 'apprenticeship', label: 'Apprenticeship', regex: /\b(?:apprenticeship|apprentice)\b/i },
    { slug: 'fellowship', label: 'Fellowship', regex: /\b(?:fellowship|fellow)\b/i },
];

const SCHEDULE_PATTERNS: Array<{ slug: string; label: string; regex: RegExp }> = [
    { slug: 'full-time', label: 'Full-time', regex: /\bfull[-\s]?time\b/i },
    { slug: 'part-time', label: 'Part-time', regex: /\bpart[-\s]?time\b/i },
    { slug: 'temporary', label: 'Temporary', regex: /\b(?:temporary|temp)\b/i },
];

const EXPERIENCE_PATTERNS: Array<{ slug: string; label: string; regex: RegExp }> = [
    { slug: 'new-grad', label: 'New Grad', regex: /\bnew[-\s]?grad(?:uate)?\b/i },
    { slug: 'entry-level', label: 'Entry Level', regex: /\bentry[-\s]?level\b/i },
    { slug: 'junior', label: 'Junior', regex: /\bjunior\b/i },
    { slug: 'mid-level', label: 'Mid Level', regex: /\bmid[-\s]?level\b|\bintermediate\b/i },
    { slug: 'senior', label: 'Senior', regex: /\bsenior\b|\bsr\.?\b/i },
    { slug: 'staff', label: 'Staff', regex: /\bstaff\b/i },
    { slug: 'principal', label: 'Principal', regex: /\bprincipal\b/i },
    { slug: 'lead', label: 'Lead', regex: /\b(?:lead\s+[a-z]|[a-z]+\s+lead|manager|director|head of)\b/i },
];

const WORKPLACE_PATTERNS = {
    hybrid: [
        /\bhybrid\b/i,
        /\b[1-4]\s+days?\s+(?:a|per)\s+week\b[^.!?\n]{0,40}\bin (?:the )?(?:office|person)\b/i,
        /\bin[-\s]?office\b[^.!?\n]{0,40}\bremote\b/i,
        /\bremote\b[^.!?\n]{0,40}\bin[-\s]?office\b/i,
    ],
    inPerson: [
        /\bin[-\s]?person\b/i,
        /\bon[-\s]?site\b/i,
        /\bonsite\b/i,
        /\boffice[-\s]?based\b/i,
    ],
    remote: [
        /\bremote\b/i,
        /\bwork from home\b/i,
        /\btelecommut(?:e|ing)\b/i,
        /\bdistributed team\b/i,
        /\bwork anywhere\b/i,
    ],
};

const SEASON_WITH_YEAR_PATTERNS = [
    /\b(spring|summer|fall|autumn|winter)\s+(20\d{2})\b/i,
    /\b(20\d{2})\s+(spring|summer|fall|autumn|winter)\b/i,
];

const SEASON_PROGRAM_PATTERN =
    /\b(spring|summer|fall|autumn|winter)\b(?=[^.]{0,32}\b(?:internship|intern|co[- ]?op|apprenticeship|fellowship|program)\b)/i;

export function extractJobCardTags(job: JobCardTagInput): JobCardTag[] {
    const tags = new Map<JobCardTagKind, JobCardTag>();
    const titleText = normalizeWhitespace(job.title || '');
    const descriptionText = normalizeWhitespace(job.job_description_plain || job.raw_text_summary || '');
    const combinedText = normalizeWhitespace(`${titleText} ${descriptionText}`);
    const locationSource = normalizeWhitespace(`${job.location_display || ''} ${job.location || ''}`);

    const seasonTag = detectSeasonTag(combinedText);
    if (seasonTag) tags.set('season', seasonTag);

    const programTag = detectProgramTag(job, titleText, combinedText);
    if (programTag) tags.set('program', programTag);

    const scheduleTag = detectScheduleTag(job, titleText, combinedText);
    if (scheduleTag) tags.set('schedule', scheduleTag);

    const experienceTag = detectExperienceTag(job, titleText);
    if (experienceTag) tags.set('experience', experienceTag);

    const compensationTag = detectCompensationTag(job, combinedText);
    if (compensationTag) tags.set('compensation', compensationTag);

    const locationTag = detectLocationTag(job.location_display || job.location || null);
    if (locationTag) tags.set('location', locationTag);

    const workplaceTag = detectWorkplaceTag(job, `${locationSource} ${combinedText}`.trim());
    if (workplaceTag) tags.set('workplace', workplaceTag);

    return Array.from(tags.values()).sort((a, b) => TAG_ORDER[a.kind] - TAG_ORDER[b.kind]);
}

function detectSeasonTag(text: string): JobCardTag | null {
    for (const pattern of SEASON_WITH_YEAR_PATTERNS) {
        const match = text.match(pattern);
        if (!match) continue;

        if (pattern === SEASON_WITH_YEAR_PATTERNS[0]) {
            return makeTag('season', `${normalizeSeason(match[1]).toLowerCase()}-${match[2]}`, `${normalizeSeason(match[1])} ${match[2]}`);
        }

        return makeTag('season', `${normalizeSeason(match[2]).toLowerCase()}-${match[1]}`, `${normalizeSeason(match[2])} ${match[1]}`);
    }

    const seasonOnly = text.match(SEASON_PROGRAM_PATTERN);
    if (!seasonOnly) return null;

    const season = normalizeSeason(seasonOnly[1]);
    return makeTag('season', season.toLowerCase(), season);
}

function detectProgramTag(job: JobCardTagInput, titleText: string, combinedText: string): JobCardTag | null {
    if (job.jobType === 'internship') {
        return makeTag('program', 'internship', 'Internship');
    }

    for (const pattern of PROGRAM_PATTERNS) {
        if (pattern.regex.test(titleText)) {
            return makeTag('program', pattern.slug, pattern.label);
        }
    }

    for (const pattern of PROGRAM_PATTERNS) {
        if (pattern.regex.test(combinedText)) {
            return makeTag('program', pattern.slug, pattern.label);
        }
    }

    return null;
}

function detectScheduleTag(job: JobCardTagInput, titleText: string, combinedText: string): JobCardTag | null {
    if (job.jobType === 'fulltime') {
        return makeTag('schedule', 'full-time', 'Full-time');
    }
    if (job.jobType === 'parttime') {
        return makeTag('schedule', 'part-time', 'Part-time');
    }
    if (job.jobType === 'contract') {
        return makeTag('schedule', 'contract', 'Contract');
    }

    for (const pattern of SCHEDULE_PATTERNS) {
        if (pattern.regex.test(titleText) || pattern.regex.test(combinedText)) {
            return makeTag('schedule', pattern.slug, pattern.label);
        }
    }

    const titleContractPattern = /\b(?:contract|contractor|freelance)\b/i;
    if (titleContractPattern.test(titleText)) {
        return makeTag('schedule', 'contract', 'Contract');
    }

    const descriptionContractPatterns = [
        /\b(?:contractor|freelance)\b/i,
        /\b(?:contract|contractor|freelance)\b(?=[^.!?\n]{0,28}\b(?:role|position|opportunity|basis|engagement|assignment|employment)\b)/i,
        /\b\d{1,2}[-\s]?month contract\b/i,
    ];

    if (matchesPattern(combinedText, descriptionContractPatterns)) {
        return makeTag('schedule', 'contract', 'Contract');
    }

    return null;
}

function detectExperienceTag(job: JobCardTagInput, titleText: string): JobCardTag | null {
    const earlyCareerTitleRegex = /\b(?:intern(?:ship)?|co[- ]?op|apprentice(?:ship)?|fellowship|new[-\s]?grad|entry[-\s]?level)\b/i;
    const isEarlyCareerRole = job.jobType === 'internship' || earlyCareerTitleRegex.test(titleText);
    if (isEarlyCareerRole) {
        return null;
    }

    for (const pattern of EXPERIENCE_PATTERNS) {
        if (pattern.regex.test(titleText)) {
            return makeTag('experience', pattern.slug, pattern.label);
        }
    }

    if (job.experienceLevel) {
        const structured = {
            entry: makeTag('experience', 'entry-level', 'Entry Level'),
            mid: makeTag('experience', 'mid-level', 'Mid Level'),
            senior: makeTag('experience', 'senior', 'Senior'),
            lead: makeTag('experience', 'lead', 'Lead'),
        }[job.experienceLevel];

        if (structured) return structured;
    }

    return null;
}

function detectCompensationTag(_job: JobCardTagInput, text: string): JobCardTag | null {
    const textSalary = extractCompensationLowerBoundFromText(text);
    if (textSalary) {
        return makeTag('compensation', 'compensation', textSalary);
    }

    return null;
}

function extractCompensationLowerBoundFromText(text: string): string | null {
    const context = '(?:salary|compensation|pay(?:\\s+range|\\s+rate)?|hourly\\s+rate|annual\\s+salary|base\\s+salary|base\\s+pay|wage)';
    const rangePattern = new RegExp(`${context}[^\\$\\u00A3\\u20AC\\u00A5\\u20B9\\d]{0,24}(USD|EUR|GBP|CAD|AUD|JPY|INR)?\\s*([\\$\\u00A3\\u20AC\\u00A5\\u20B9])?\\s*(\\d[\\d,.]*(?:\\.\\d+)?k?)\\s*(?:-|to|\\u2013|\\u2014)\\s*(USD|EUR|GBP|CAD|AUD|JPY|INR)?\\s*([\\$\\u00A3\\u20AC\\u00A5\\u20B9])?\\s*(\\d[\\d,.]*(?:\\.\\d+)?k?)(?:\\s*(?:\\/\\s*|per\\s+|a\\s+|an\\s+)(hour|hr|year|yr|month|mo|week|wk))?`, 'i');
    const singlePattern = new RegExp(`${context}[^\\$\\u00A3\\u20AC\\u00A5\\u20B9\\d]{0,24}(USD|EUR|GBP|CAD|AUD|JPY|INR)?\\s*([\\$\\u00A3\\u20AC\\u00A5\\u20B9])?\\s*(\\d[\\d,.]*(?:\\.\\d+)?k?)(?:\\s*(?:\\/\\s*|per\\s+|a\\s+|an\\s+)(hour|hr|year|yr|month|mo|week|wk))?`, 'i');

    const rangeMatch = text.match(rangePattern);
    if (rangeMatch) {
        const hasExplicitCurrencyMarker = Boolean(rangeMatch[1] || rangeMatch[2] || rangeMatch[4] || rangeMatch[5]);
        if (!hasExplicitCurrencyMarker) return null;

        const value = parseNumericToken(rangeMatch[3]);
        if (typeof value !== 'number') return null;
        const currency = normalizeCurrencyCode(rangeMatch[1] || rangeMatch[4] || null);
        const symbol = rangeMatch[2] || rangeMatch[5] || getCurrencySymbol(currency);
        const unit = normalizeUnit(rangeMatch[7] || null);
        const unitSuffix = unit ? `/${unit}` : '';
        return `${symbol}${formatMoneyValue(value)}${unitSuffix}`;
    }

    const singleMatch = text.match(singlePattern);
    if (singleMatch) {
        const hasExplicitCurrencyMarker = Boolean(singleMatch[1] || singleMatch[2]);
        if (!hasExplicitCurrencyMarker) return null;

        const value = parseNumericToken(singleMatch[3]);
        if (typeof value !== 'number') return null;
        const currency = normalizeCurrencyCode(singleMatch[1] || null);
        const symbol = singleMatch[2] || getCurrencySymbol(currency);
        const unit = normalizeUnit(singleMatch[4] || null);
        const unitSuffix = unit ? `/${unit}` : '';
        return `${symbol}${formatMoneyValue(value)}${unitSuffix}`;
    }

    return null;
}

function getCurrencySymbol(currency: string | null): string {
    const normalized = (currency || '').toUpperCase();
    const map: Record<string, string> = {
        USD: '$',
        CAD: '$',
        AUD: '$',
        NZD: '$',
        SGD: '$',
        EUR: '\u20AC',
        GBP: '\u00A3',
        JPY: '\u00A5',
        CNY: '\u00A5',
        INR: '\u20B9',
        KRW: '\u20A9',
        RUB: '\u20BD',
        BRL: 'R$',
        MXN: '$',
        CHF: 'CHF ',
        SEK: 'kr ',
        NOK: 'kr ',
        DKK: 'kr ',
        PLN: 'z\u0142 ',
        HKD: 'HK$',
        AED: 'AED ',
        SAR: 'SAR ',
        ZAR: 'R ',
    };
    return map[normalized] || '$';
}

function normalizeCurrencyCode(code: string | null): string | null {
    if (!code) return null;
    return code.toUpperCase();
}

function detectLocationTag(rawLocation: string | null): JobCardTag | null {
    if (!rawLocation) return null;

    const cleaned = normalizeWhitespace(
        rawLocation
            .replace(/^location:\s*/i, '')
            .replace(/\((?:remote|hybrid|in[-\s]?person|on[-\s]?site|onsite)[^)]*\)/gi, '')
            .replace(/\b(?:remote|hybrid|in[-\s]?person|on[-\s]?site|onsite)\b/gi, '')
            .replace(/\boffice\b$/i, '')
            .replace(/[()]/g, ' ')
            .replace(/\s+,/g, ',')
            .replace(/[;|]+/g, ', ')
            .replace(/\s{2,}/g, ' ')
            .replace(/^[,\s-]+|[,\s-]+$/g, '')
    );

    if (!cleaned) return null;
    if (/^(remote|hybrid|in person|on-site|onsite)$/i.test(cleaned)) return null;

    return makeTag('location', 'location', cleaned);
}

function detectWorkplaceTag(job: JobCardTagInput, text: string): JobCardTag | null {
    if (matchesPattern(text, WORKPLACE_PATTERNS.hybrid)) {
        return makeTag('workplace', 'hybrid', 'Hybrid');
    }

    if (matchesPattern(text, WORKPLACE_PATTERNS.inPerson)) {
        return makeTag('workplace', 'in-person', 'In Person');
    }

    if (job.isRemote || matchesPattern(text, WORKPLACE_PATTERNS.remote)) {
        return makeTag('workplace', 'remote', 'Remote');
    }

    return null;
}

type CompensationUnit = 'hr' | 'yr' | 'mo' | 'wk' | null;

function formatMoneyValue(value: number): string {
    const rounded =
        Number.isInteger(value) || value >= 1000
            ? Math.round(value)
            : Math.round(value * 100) / 100;

    return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
        maximumFractionDigits: Number.isInteger(rounded) ? 0 : 2,
    }).format(rounded);
}

function parseNumericToken(value: string): number | null {
    const normalized = value.trim().toLowerCase();
    const multiplier = normalized.endsWith('k') ? 1000 : 1;
    const numeric = Number.parseFloat(normalized.replace(/,/g, '').replace(/k$/, ''));
    if (!Number.isFinite(numeric)) return null;
    return numeric * multiplier;
}

function normalizeUnit(unit: string | null): CompensationUnit {
    if (!unit) return null;

    const normalized = unit.toLowerCase();
    if (normalized === 'hour' || normalized === 'hr') return 'hr';
    if (normalized === 'year' || normalized === 'yr') return 'yr';
    if (normalized === 'month' || normalized === 'mo') return 'mo';
    if (normalized === 'week' || normalized === 'wk') return 'wk';
    return null;
}

function normalizeSeason(value: string): string {
    const season = value.toLowerCase();
    if (season === 'autumn') return 'Fall';
    return season.charAt(0).toUpperCase() + season.slice(1);
}

function matchesPattern(text: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(text));
}

function normalizeWhitespace(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function makeTag(kind: JobCardTagKind, slug: string, label: string): JobCardTag {
    return { kind, slug, label };
}

