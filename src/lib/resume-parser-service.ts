/**
 * Resume Parser Service — Canonical Parsing Engine
 *
 * Converts uploaded resume files (PDF / text) into the CanonicalParsedResume
 * schema with per-field confidence scores. Provides helpers for contact
 * extraction, date normalization, skill inference, and validation.
 */

import type { CanonicalParsedResume } from '@/types';
import { RESUME_PARSER_CANONICAL_PROMPT } from './resume-parser-prompt';
import { routeAICall, routeMultimodalCall } from './ai-router';

// pdf-parse doesn't have proper ESM exports
const pdfParse = require('pdf-parse');

// ============================================================================
// CONSTANTS
// ============================================================================

const MIN_RESUME_LENGTH = 200;

/**
 * Whitelist of common tech skills for inference from text.
 * Kept lowercase for matching; original casing is preserved on output.
 */
const SKILL_WHITELIST: Record<string, string> = {
    javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python',
    java: 'Java', 'c++': 'C++', 'c#': 'C#', go: 'Go', rust: 'Rust',
    ruby: 'Ruby', php: 'PHP', swift: 'Swift', kotlin: 'Kotlin', scala: 'Scala',
    r: 'R', matlab: 'MATLAB', sql: 'SQL', html: 'HTML', css: 'CSS',
    react: 'React', angular: 'Angular', vue: 'Vue', 'vue.js': 'Vue.js',
    'next.js': 'Next.js', nextjs: 'Next.js', 'node.js': 'Node.js',
    nodejs: 'Node.js', express: 'Express', django: 'Django', flask: 'Flask',
    spring: 'Spring', 'spring boot': 'Spring Boot', rails: 'Rails',
    'ruby on rails': 'Ruby on Rails', fastapi: 'FastAPI', svelte: 'Svelte',
    tailwind: 'Tailwind CSS', bootstrap: 'Bootstrap', jquery: 'jQuery',
    docker: 'Docker', kubernetes: 'Kubernetes', aws: 'AWS', azure: 'Azure',
    gcp: 'GCP', 'google cloud': 'Google Cloud', git: 'Git', github: 'GitHub',
    gitlab: 'GitLab', jenkins: 'Jenkins', terraform: 'Terraform',
    ansible: 'Ansible', 'ci/cd': 'CI/CD', linux: 'Linux', nginx: 'Nginx',
    apache: 'Apache', vercel: 'Vercel', netlify: 'Netlify', heroku: 'Heroku',
    postgresql: 'PostgreSQL', postgres: 'PostgreSQL', mysql: 'MySQL',
    mongodb: 'MongoDB', redis: 'Redis', elasticsearch: 'Elasticsearch',
    dynamodb: 'DynamoDB', firebase: 'Firebase', supabase: 'Supabase',
    sqlite: 'SQLite', graphql: 'GraphQL', 'rest api': 'REST API',
    restful: 'RESTful', grpc: 'gRPC', websocket: 'WebSocket',
    microservices: 'Microservices', agile: 'Agile', scrum: 'Scrum',
    jira: 'Jira', figma: 'Figma', photoshop: 'Photoshop',
    tensorflow: 'TensorFlow', pytorch: 'PyTorch', pandas: 'Pandas',
    numpy: 'NumPy', scikit: 'scikit-learn', opencv: 'OpenCV',
    hadoop: 'Hadoop', spark: 'Spark', kafka: 'Kafka', rabbitmq: 'RabbitMQ',
    prisma: 'Prisma', sequelize: 'Sequelize', mongoose: 'Mongoose',
    jest: 'Jest', mocha: 'Mocha', pytest: 'pytest', cypress: 'Cypress',
    selenium: 'Selenium', webpack: 'Webpack', vite: 'Vite', babel: 'Babel',
};

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Main entry: parse a resume file buffer into the canonical schema.
 *
 * @param fileBuffer - Raw file contents (PDF or plain text)
 * @param mimeType  - MIME type of the file ('application/pdf', 'text/plain', etc.)
 * @returns CanonicalParsedResume with confidence scores
 */
export async function parseResumeCanonical(
    fileBuffer: Buffer,
    mimeType: string = 'application/pdf'
): Promise<CanonicalParsedResume> {
    // 1. Extract text from the file
    let resumeText: string;
    if (mimeType === 'application/pdf') {
        resumeText = await extractTextFromPdf(fileBuffer);
    } else {
        // Plain text / rich text — assume the buffer IS the text
        resumeText = fileBuffer.toString('utf-8');
    }

    // 2. Validate minimum length
    validateMinimumLength(resumeText);

    console.log(`[ResumeParser] Extracted ${resumeText.length} chars, sending to AI…`);

    // 3. AI-powered parsing into canonical schema
    let parsed: CanonicalParsedResume;

    // Try multimodal first (direct PDF → AI) if PDF
    if (mimeType === 'application/pdf') {
        try {
            const prompt = [
                RESUME_PARSER_CANONICAL_PROMPT,
                toInlineData(fileBuffer, 'application/pdf'),
            ];
            const text = await routeMultimodalCall(prompt);
            parsed = extractJson<CanonicalParsedResume>(text);
            console.log('[ResumeParser] ✓ Multimodal parsing succeeded');
        } catch (err: any) {
            console.warn('[ResumeParser] Multimodal failed, falling back to text:', err.message);
            parsed = await parseViaText(resumeText);
        }
    } else {
        parsed = await parseViaText(resumeText);
    }

    // 4. Supplement: regex-based contact extraction (fills gaps)
    supplementContacts(parsed, resumeText);

    // 5. Infer skill tokens from the full text
    const inferredSkills = inferSkillTokens(resumeText);
    const existingInferred = new Set(
        (parsed.skills?.inferred_from_text ?? []).map(s => s.toLowerCase())
    );
    for (const skill of inferredSkills) {
        if (!existingInferred.has(skill.toLowerCase())) {
            parsed.skills.inferred_from_text.push(skill);
        }
    }

    // 6. Flag low-confidence fields
    parsed.low_confidence_fields = flagLowConfidenceFields(parsed);

    return parsed;
}

// ============================================================================
// TEXT EXTRACTION
// ============================================================================

async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
        const pdfData = await pdfParse(buffer);
        const text = pdfData.text;
        if (!text || text.trim().length < 50) {
            throw new Error('PDF text extraction returned too little content');
        }
        return text;
    } catch (err: any) {
        throw new Error(`PARSE_FAILED: PDF text extraction failed — ${err.message}`);
    }
}

// ============================================================================
// AI PARSING
// ============================================================================

async function parseViaText(resumeText: string): Promise<CanonicalParsedResume> {
    const prompt = `${RESUME_PARSER_CANONICAL_PROMPT}\n\nResume text:\n${resumeText}`;
    const text = await routeAICall(prompt);
    console.log('[ResumeParser] ✓ Text-based parsing succeeded');
    return extractJson<CanonicalParsedResume>(text);
}

/** Convert Buffer to inline data part for multimodal calls. */
function toInlineData(buffer: Buffer, mimeType: string) {
    return {
        inlineData: {
            data: buffer.toString('base64'),
            mimeType,
        },
    };
}

/** Extract JSON from AI text response (handles markdown code blocks). */
function extractJson<T>(text: string): T {
    let cleaned = text.trim();

    // Strip markdown code fences
    if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    }

    try {
        return JSON.parse(cleaned) as T;
    } catch {
        // Try to find JSON object in the text
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]) as T;
        }
        throw new Error('PARSE_FAILED: Could not extract JSON from AI response');
    }
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Throws if the resume text is below the minimum length threshold.
 */
export function validateMinimumLength(text: string): void {
    if (!text || text.trim().length < MIN_RESUME_LENGTH) {
        throw new Error(
            'TOO_SHORT: Resume appears too short. Please provide more details or upload a longer document.'
        );
    }
}

// ============================================================================
// CONTACT EXTRACTION (regex fallback/supplement)
// ============================================================================

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{2,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}/g;
const URL_RE = /https?:\/\/[^\s,)]+/gi;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:in|pub|company)\/[a-zA-Z0-9\-._~\/]+/gi;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9\-._~]+(?:\/[a-zA-Z0-9\-._~]+)?/gi;

/**
 * Extract contacts from raw text via regex. Returns structured contacts.
 */
export function extractContactsFromText(text: string): {
    emails: string[];
    phones: string[];
    urls: string[];
    linkedins: string[];
    githubs: string[];
} {
    const rawLinkedins = [...new Set(text.match(LINKEDIN_RE) ?? [])];
    const rawGithubs = [...new Set(text.match(GITHUB_RE) ?? [])];
    const rawUrls = [...new Set(text.match(URL_RE) ?? [])];

    // Normalize URLs: prepend https:// if missing
    const normalize = (url: string) => url.startsWith('http') ? url : `https://${url}`;

    return {
        emails: [...new Set(text.match(EMAIL_RE) ?? [])],
        phones: [...new Set(text.match(PHONE_RE) ?? [])].filter(p => p.replace(/\D/g, '').length >= 7),
        urls: rawUrls.map(normalize),
        linkedins: rawLinkedins.map(normalize),
        githubs: rawGithubs.map(normalize),
    };
}

/** Fill any gaps in AI-parsed contacts using regex extraction. */
function supplementContacts(parsed: CanonicalParsedResume, text: string): void {
    // Guard: ensure contacts object exists
    if (!parsed.contacts) {
        (parsed as any).contacts = {
            email: { value: null, confidence: 0 },
            phone: { value: null, confidence: 0 },
            location: { value: null, confidence: 0 },
            links: [],
        };
    }
    if (!parsed.contacts.links) {
        parsed.contacts.links = [];
    }

    const extracted = extractContactsFromText(text);

    // Email
    if (!parsed.contacts.email.value && extracted.emails.length > 0) {
        parsed.contacts.email = { value: extracted.emails[0], confidence: 0.85 };
    }

    // Phone
    if (!parsed.contacts.phone.value && extracted.phones.length > 0) {
        parsed.contacts.phone = { value: extracted.phones[0], confidence: 0.75 };
    }

    // Links — add any LinkedIn/GitHub URLs not already present
    const existingUrls = new Set(parsed.contacts.links.map(l => l.url.toLowerCase()));

    for (const li of extracted.linkedins) {
        const url = li.startsWith('http') ? li : `https://${li}`;
        if (!existingUrls.has(url.toLowerCase())) {
            parsed.contacts.links.push({ label: 'linkedin', url, confidence: 0.9 });
        }
    }
    for (const gh of extracted.githubs) {
        const url = gh.startsWith('http') ? gh : `https://${gh}`;
        if (!existingUrls.has(url.toLowerCase())) {
            parsed.contacts.links.push({ label: 'github', url, confidence: 0.9 });
        }
    }
}

// ============================================================================
// DATE NORMALIZATION
// ============================================================================

const MONTH_MAP: Record<string, string> = {
    jan: '01', january: '01', feb: '02', february: '02',
    mar: '03', march: '03', apr: '04', april: '04',
    may: '05', jun: '06', june: '06', jul: '07', july: '07',
    aug: '08', august: '08', sep: '09', sept: '09', september: '09',
    oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12',
};

/**
 * Normalize a date string to YYYY-MM (or YYYY if month unclear).
 * Returns 'present' for current-role indicators.
 */
export function normalizeDate(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const trimmed = raw.trim().toLowerCase();

    if (['present', 'current', 'now', 'ongoing'].includes(trimmed)) {
        return 'present';
    }

    // Already in YYYY-MM format
    if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;

    // YYYY only
    if (/^\d{4}$/.test(trimmed)) return trimmed;

    // "Month YYYY" or "Mon YYYY"
    const monthYear = trimmed.match(/^([a-z]+)\s+(\d{4})$/);
    if (monthYear) {
        const m = MONTH_MAP[monthYear[1]];
        if (m) return `${monthYear[2]}-${m}`;
        return monthYear[2]; // fallback to year only
    }

    // "MM/YYYY" or "MM-YYYY"
    const numMonthYear = trimmed.match(/^(\d{1,2})[/\-](\d{4})$/);
    if (numMonthYear) {
        return `${numMonthYear[2]}-${numMonthYear[1].padStart(2, '0')}`;
    }

    // "YYYY/MM" or "YYYY-MM" with separator
    const yearMonth = trimmed.match(/^(\d{4})[/](\d{1,2})$/);
    if (yearMonth) {
        return `${yearMonth[1]}-${yearMonth[2].padStart(2, '0')}`;
    }

    // Try to extract any 4-digit year
    const yearOnly = trimmed.match(/\d{4}/);
    if (yearOnly) return yearOnly[0];

    return null;
}

// ============================================================================
// SKILL INFERENCE
// ============================================================================

/**
 * Detect tech skill tokens in text using the whitelist + fuzzy matching.
 * Returns an array of properly-cased skill names.
 */
export function inferSkillTokens(text: string): string[] {
    const found = new Set<string>();
    const lower = text.toLowerCase();

    for (const [pattern, canonical] of Object.entries(SKILL_WHITELIST)) {
        // Word boundary match (simple)
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`\\b${escapedPattern}\\b`, 'i');
        if (re.test(lower)) {
            found.add(canonical);
        }
    }

    return Array.from(found);
}

// ============================================================================
// LOW-CONFIDENCE FLAGGING
// ============================================================================

const CRITICAL_THRESHOLD = 0.5;

/**
 * Identifies critical fields (name, email, phone, companies) that have
 * confidence below the threshold. Returns list of field names.
 */
export function flagLowConfidenceFields(parsed: CanonicalParsedResume): string[] {
    const flags: string[] = [];

    if (parsed.name.confidence < CRITICAL_THRESHOLD) flags.push('name');
    if (parsed.contacts.email.confidence < CRITICAL_THRESHOLD) flags.push('email');
    if (parsed.contacts.phone.confidence < CRITICAL_THRESHOLD) flags.push('phone');

    // Check company names in experience
    for (const exp of parsed.experience ?? []) {
        if (exp.confidence < CRITICAL_THRESHOLD) {
            flags.push(`experience:${exp.company || 'unknown'}`);
        }
    }

    return flags;
}

// ============================================================================
// PARAGRAPH → BULLET CONVERSION
// ============================================================================

/**
 * Splits paragraph-form descriptions into action-result bullet points.
 * Looks for sentence boundaries and action verbs.
 */
export function convertParagraphsToBullets(text: string): string[] {
    if (!text) return [];

    // If already bulleted (starts with - or •), split on those
    if (/^[\s]*[-•⁃▪]\s/m.test(text)) {
        return text
            .split(/\n/)
            .map(line => line.replace(/^[\s]*[-•⁃▪]\s*/, '').trim())
            .filter(line => line.length > 0);
    }

    // Split on sentence boundaries
    const sentences = text
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 10);

    if (sentences.length === 0) return [text.trim()];
    return sentences;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

/**
 * Log a parsing event without PII. Masks sensitive fields.
 */
export function logParseEvent(
    userId: string,
    eventType: 'parse_start' | 'parse_success' | 'parse_failed' | 'cache_invalidated',
    details?: Record<string, unknown>
): void {
    const sanitized = { ...details };
    // Mask any PII fields that might have leaked into details
    for (const key of ['email', 'phone', 'name']) {
        if (key in sanitized && typeof sanitized[key] === 'string') {
            sanitized[key] = '***MASKED***';
        }
    }
    console.log(`[ResumeParser:Audit] userId=${userId} event=${eventType}`, sanitized ?? '');
}
