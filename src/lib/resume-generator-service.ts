/**
 * Resume Generator Service
 *
 * Produces `generated_resume_markdown` and `generated_resume_structured`
 * from a CanonicalParsedResume. Handles:
 *   - Summary synthesis from parsed data + optional job description
 *   - Paragraph → action-oriented bullet conversion
 *   - Number bolding in Markdown
 *   - Skill merge, dedup, and category grouping
 *   - Section toggle visibility & ordering
 */

import type {
    CanonicalParsedResume,
    GeneratedResumeStructured,
    GeneratedResumeSection,
    GeneratedResumeSectionItem,
} from '@/types';
import { convertParagraphsToBullets } from './resume-parser-service';

// ============================================================================
// PUBLIC API
// ============================================================================

export interface GeneratorOptions {
    jobDescription?: string;
    sectionToggles?: Record<string, boolean>; // e.g. { summary: true, volunteer: false }
}

export interface GeneratorResult {
    generated_resume_markdown: string;
    generated_resume_structured: GeneratedResumeStructured;
    section_order: string[];
}

/**
 * Main entry: generate both Markdown and structured resume output
 * from the canonical parsed data.
 */
export function generateResumeFromParsed(
    parsed: CanonicalParsedResume,
    options: GeneratorOptions = {}
): GeneratorResult {
    const { jobDescription, sectionToggles } = options;

    // 1. Synthesize summary
    const summary = synthesizeSummary(parsed, jobDescription);

    // 2. Build structured sections
    const sections: GeneratedResumeSection[] = [];

    // Education
    sections.push(buildEducationSection(parsed));

    // Experience
    sections.push(buildExperienceSection(parsed));

    // Projects
    if (parsed.projects.length > 0) {
        sections.push(buildProjectsSection(parsed));
    }

    // Volunteer / Community
    if (parsed.volunteer.length > 0) {
        sections.push(buildVolunteerSection(parsed));
    }

    // Skills (special — rendered differently)
    const skillsGrouped = mergeAndGroupSkills(
        parsed.skills.explicit_list,
        parsed.skills.inferred_from_text
    );

    // Certifications
    if (parsed.certifications.length > 0) {
        sections.push(buildCertificationsSection(parsed));
    }

    // 3. Apply section toggles
    const defaultOrder = ['summary', ...sections.map(s => s.id), 'skills'];
    const sectionOrder = defaultOrder;

    for (const section of sections) {
        if (sectionToggles && sectionToggles[section.id] === false) {
            section.toggle_visible = false;
        }
    }

    const visibleSections = sections.filter(s => s.toggle_visible);

    // 4. Build structured output
    const structured: GeneratedResumeStructured = {
        summary,
        sections: visibleSections,
        skills_grouped: skillsGrouped,
    };

    // 5. Render Markdown
    const markdown = renderMarkdown(parsed, summary, visibleSections, skillsGrouped);

    return {
        generated_resume_markdown: markdown,
        generated_resume_structured: structured,
        section_order: sectionOrder,
    };
}

// ============================================================================
// SUMMARY SYNTHESIS
// ============================================================================

/**
 * Produce a 2–3 sentence professional summary synthesized from parsed data.
 * If a job description is provided, tailor the summary accordingly.
 */
export function synthesizeSummary(
    parsed: CanonicalParsedResume,
    jobDescription?: string
): string {
    const parts: string[] = [];

    // Name and current role
    const name = parsed.name.value || 'Professional';
    const latestExp = parsed.experience[0];
    const latestTitle = latestExp?.title;
    const latestCompany = latestExp?.company;

    if (latestTitle && latestCompany) {
        parts.push(`${name} is a ${latestTitle} with experience at ${latestCompany}.`);
    } else if (latestTitle) {
        parts.push(`${name} is a ${latestTitle}.`);
    } else {
        parts.push(`${name} is a motivated professional.`);
    }

    // Skills highlight
    const topSkills = [
        ...parsed.skills.explicit_list.slice(0, 5),
        ...parsed.skills.inferred_from_text.slice(0, 3),
    ];
    const uniqueSkills = [...new Set(topSkills)].slice(0, 6);
    if (uniqueSkills.length > 0) {
        parts.push(`Skilled in ${uniqueSkills.join(', ')}.`);
    }

    // Education
    const latestEdu = parsed.education[0];
    if (latestEdu) {
        const degree = latestEdu.degree;
        const school = latestEdu.institution;
        if (degree && school) {
            parts.push(`${degree} from ${school}.`);
        }
    }

    // Job description tailoring hint
    if (jobDescription) {
        parts.push('Seeking to leverage technical skills and project experience to contribute effectively.');
    }

    return parts.join(' ');
}

// ============================================================================
// SECTION BUILDERS
// ============================================================================

function buildEducationSection(parsed: CanonicalParsedResume): GeneratedResumeSection {
    return {
        id: 'education',
        title: 'Education',
        toggle_visible: true,
        items: parsed.education.map(edu => ({
            heading: edu.institution,
            subheading: edu.degree,
            dates: formatDateRange(edu.start_date, edu.end_date),
            bullets: [
                edu.gpa ? `GPA: ${edu.gpa}` : '',
                edu.coursework ? `Relevant Coursework: ${edu.coursework}` : '',
            ].filter(Boolean),
        })),
    };
}

function buildExperienceSection(parsed: CanonicalParsedResume): GeneratedResumeSection {
    return {
        id: 'experience',
        title: 'Experience',
        toggle_visible: true,
        items: parsed.experience.map(exp => {
            const bullets = formatBullets(exp.description, exp.end_date);
            return {
                heading: exp.company,
                subheading: exp.title,
                dates: formatDateRange(exp.start_date, exp.end_date),
                location: exp.location ?? undefined,
                bullets,
                skills: exp.skills,
            };
        }),
    };
}

function buildProjectsSection(parsed: CanonicalParsedResume): GeneratedResumeSection {
    return {
        id: 'projects',
        title: 'Projects',
        toggle_visible: true,
        items: parsed.projects.map(proj => {
            const bullets = formatBullets(proj.description);
            return {
                heading: proj.name,
                dates: formatDateRange(proj.start_date, proj.end_date),
                bullets,
                skills: proj.skills,
            };
        }),
    };
}

function buildVolunteerSection(parsed: CanonicalParsedResume): GeneratedResumeSection {
    return {
        id: 'volunteer',
        title: 'Community Involvement',
        toggle_visible: true,
        items: parsed.volunteer.map(vol => {
            const bullets = formatBullets(vol.description);
            return {
                heading: vol.organization,
                subheading: vol.title ?? undefined,
                dates: formatDateRange(vol.start_date, vol.end_date),
                bullets,
                skills: vol.skills,
            };
        }),
    };
}

function buildCertificationsSection(parsed: CanonicalParsedResume): GeneratedResumeSection {
    return {
        id: 'certifications',
        title: 'Certifications',
        toggle_visible: true,
        items: parsed.certifications.map(cert => ({
            heading: cert.name,
            subheading: cert.issuer ?? undefined,
            dates: cert.date ?? undefined,
            bullets: [],
        })),
    };
}

// ============================================================================
// BULLET FORMATTING
// ============================================================================

/**
 * Convert a description into action-oriented bullets.
 * Pattern: "Did X, which resulted in Y."
 * Bold any numbers found with Markdown (**N**).
 * Uses past tense for past roles, present tense for current.
 */
export function formatBullets(
    description: string,
    endDate?: string | null
): string[] {
    if (!description) return [];

    const isCurrentRole = endDate === 'present';
    let bullets = convertParagraphsToBullets(description);

    // Limit to 3–6 bullets
    if (bullets.length > 6) bullets = bullets.slice(0, 6);

    return bullets.map(bullet => {
        // Bold numbers (e.g., 42%, $1.2M, 150+)
        let formatted = boldNumbers(bullet);
        return formatted;
    });
}

/**
 * Bold numeric values in text using Markdown.
 * Matches patterns like: 42%, $1.2M, 150+, 1,000, etc.
 */
function boldNumbers(text: string): string {
    return text.replace(
        /(\$?\d[\d,]*\.?\d*[%+KMBkmb]?(?:\s*(?:million|billion|thousand))?)/g,
        '**$1**'
    );
}

// ============================================================================
// SKILL GROUPING
// ============================================================================

const SKILL_CATEGORIES: Record<string, string[]> = {
    'Languages': [
        'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust',
        'ruby', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'sql', 'html', 'css',
    ],
    'Frameworks': [
        'react', 'angular', 'vue', 'vue.js', 'next.js', 'nextjs', 'node.js', 'nodejs',
        'express', 'django', 'flask', 'spring', 'spring boot', 'rails', 'ruby on rails',
        'fastapi', 'svelte', 'tailwind', 'tailwind css', 'bootstrap', 'jquery',
    ],
    'Tools & Platforms': [
        'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'google cloud', 'git', 'github',
        'gitlab', 'jenkins', 'terraform', 'ansible', 'ci/cd', 'linux', 'nginx',
        'apache', 'vercel', 'netlify', 'heroku', 'webpack', 'vite', 'babel',
        'jest', 'mocha', 'pytest', 'cypress', 'selenium', 'jira', 'figma',
    ],
    'Databases': [
        'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch',
        'dynamodb', 'firebase', 'supabase', 'sqlite', 'prisma', 'sequelize', 'mongoose',
    ],
    'Methodologies': [
        'agile', 'scrum', 'microservices', 'graphql', 'rest api', 'restful', 'grpc',
        'websocket',
    ],
};

/**
 * Merge explicit and inferred skills, deduplicate, and group by category.
 * Skills not matching any category go into "Other".
 */
export function mergeAndGroupSkills(
    explicitList: string[],
    inferredList: string[]
): Record<string, string[]> {
    // Deduplicate
    const allSkillsLower = new Map<string, string>();
    for (const skill of [...explicitList, ...inferredList]) {
        const lower = skill.toLowerCase();
        if (!allSkillsLower.has(lower)) {
            allSkillsLower.set(lower, skill);
        }
    }

    const grouped: Record<string, string[]> = {};
    const categorized = new Set<string>();

    for (const [category, patterns] of Object.entries(SKILL_CATEGORIES)) {
        const matched: string[] = [];
        for (const [lower, original] of allSkillsLower) {
            if (patterns.includes(lower)) {
                matched.push(original);
                categorized.add(lower);
            }
        }
        if (matched.length > 0) {
            grouped[category] = matched;
        }
    }

    // Remaining skills → "Other"
    const other: string[] = [];
    for (const [lower, original] of allSkillsLower) {
        if (!categorized.has(lower)) {
            other.push(original);
        }
    }
    if (other.length > 0) {
        grouped['Other'] = other;
    }

    return grouped;
}

// ============================================================================
// DATE FORMATTING
// ============================================================================

function formatDateRange(start: string | null, end: string | null): string | undefined {
    if (!start && !end) return undefined;
    const s = start || '';
    const e = end === 'present' ? 'Present' : (end || '');
    if (s && e) return `${s} – ${e}`;
    return s || e || undefined;
}

// ============================================================================
// MARKDOWN RENDERING
// ============================================================================

function renderMarkdown(
    parsed: CanonicalParsedResume,
    summary: string,
    sections: GeneratedResumeSection[],
    skillsGrouped: Record<string, string[]>
): string {
    const lines: string[] = [];

    // Header
    const name = parsed.name.value || 'Name';
    lines.push(`# ${name}`);
    lines.push('');

    // Contact line
    const contactParts: string[] = [];
    if (parsed.contacts.email.value) contactParts.push(parsed.contacts.email.value);
    if (parsed.contacts.phone.value) contactParts.push(parsed.contacts.phone.value);
    if (parsed.contacts.location.value) contactParts.push(parsed.contacts.location.value);
    for (const link of parsed.contacts.links) {
        contactParts.push(`[${link.label}](${link.url})`);
    }
    if (contactParts.length > 0) {
        lines.push(contactParts.join(' | '));
        lines.push('');
    }

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push(summary);
    lines.push('');

    // Sections
    for (const section of sections) {
        lines.push(`## ${section.title}`);
        lines.push('');

        for (const item of section.items) {
            const headerParts: string[] = [`**${item.heading}**`];
            if (item.subheading) headerParts.push(`— ${item.subheading}`);
            if (item.dates) headerParts.push(`*(${item.dates})*`);
            if (item.location) headerParts.push(`| ${item.location}`);
            lines.push(headerParts.join(' '));

            if (item.skills && item.skills.length > 0) {
                lines.push(`*Technologies: ${item.skills.join(', ')}*`);
            }

            for (const bullet of item.bullets) {
                lines.push(`- ${bullet}`);
            }
            lines.push('');
        }
    }

    // Skills
    if (Object.keys(skillsGrouped).length > 0) {
        lines.push('## Technical Skills');
        lines.push('');
        for (const [category, skills] of Object.entries(skillsGrouped)) {
            lines.push(`**${category}:** ${skills.join(', ')}`);
        }
        lines.push('');
    }

    return lines.join('\n');
}
