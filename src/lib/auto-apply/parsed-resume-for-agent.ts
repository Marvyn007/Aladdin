import type { ParsedResume } from '@/types';

/**
 * Turn stored `Resume.parsedJson` into dense plain text for the apply agent.
 * Supports legacy `ParsedResume` and loose objects (e.g. `summary` at root).
 */
export function parsedResumeJsonToAgentText(raw: unknown, maxLen = 14_000): string {
  if (!raw || typeof raw !== 'object') return '';
  const j = raw as Record<string, unknown>;

  if (typeof j.summary === 'string' && j.summary.trim()) {
    const rest = formatStructuredResume(j as unknown as Partial<ParsedResume>);
    const combined = `Summary:\n${j.summary.trim()}\n\n${rest}`.trim();
    return combined.length > maxLen ? `${combined.slice(0, maxLen)}\n…(truncated)` : combined;
  }

  const out = formatStructuredResume(j as unknown as Partial<ParsedResume>);
  return out.length > maxLen ? `${out.slice(0, maxLen)}\n…(truncated)` : out;
}

function formatStructuredResume(r: Partial<ParsedResume>): string {
  const lines: string[] = [];

  const name = r.name ?? '';
  const email = r.email ?? r.contact?.email ?? '';
  const loc = r.location ?? r.contact?.location ?? '';
  const phone = r.contact?.phone ?? '';
  const li = r.contact?.linkedin ?? '';
  const contactBits = [name, email, loc, phone, li].map((x) => String(x).trim()).filter(Boolean);
  if (contactBits.length) lines.push(`Contact: ${contactBits.join(' · ')}`);

  if (typeof r.total_experience_years === 'number') {
    lines.push(`Total experience (years): ${r.total_experience_years}`);
  }

  if (Array.isArray(r.roles) && r.roles.length) {
    lines.push('Experience:');
    for (const role of r.roles) {
      const dates = [role.start, role.end].filter(Boolean).join(' – ');
      lines.push(`- ${role.title} @ ${role.company}${dates ? ` (${dates})` : ''}`);
      if (role.description?.trim()) {
        for (const line of role.description.split('\n').map((l) => l.trim()).filter(Boolean)) {
          lines.push(`  ${line}`);
        }
      }
    }
  }

  if (Array.isArray(r.education) && r.education.length) {
    lines.push('Education:');
    for (const e of r.education) {
      lines.push(`- ${e.degree}, ${e.school} (${[e.start, e.end].filter(Boolean).join(' – ')})`);
      if (e.notes?.trim()) lines.push(`  ${e.notes.trim()}`);
    }
  }

  if (Array.isArray(r.skills) && r.skills.length) {
    const skillStr = r.skills.map((s) => (s.years != null ? `${s.name} (${s.years}y)` : s.name)).join(', ');
    lines.push(`Skills: ${skillStr}`);
  }

  const toolLike = [r.tools, r.frameworks, r.languages].flat().filter(Boolean) as string[];
  if (toolLike.length) lines.push(`Tools / languages / frameworks: ${[...new Set(toolLike)].join(', ')}`);

  if (Array.isArray(r.projects) && r.projects.length) {
    lines.push('Projects:');
    for (const p of r.projects) {
      lines.push(`- ${p.title}${p.link ? ` (${p.link})` : ''}`);
      if (p.description?.trim()) lines.push(`  ${p.description.trim()}`);
      if (p.tech?.length) lines.push(`  Tech: ${p.tech.join(', ')}`);
    }
  }

  if (Array.isArray(r.certifications) && r.certifications.length) {
    lines.push(`Certifications: ${r.certifications.join('; ')}`);
  }

  if (Array.isArray(r.open_to) && r.open_to.length) {
    lines.push(`Open to: ${r.open_to.join(', ')}`);
  }

  return lines.filter(Boolean).join('\n');
}
