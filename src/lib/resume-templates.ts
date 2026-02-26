/**
 * Resume Templates
 * Provides Classic and Modern template rendering for the two-panel editor
 */

import type { TailoredResumeData, ResumeSection, ResumeSectionItem } from '@/types';

// Template CSS for Classic style - BLACK & WHITE ONLY
export const CLASSIC_TEMPLATE_CSS = `
html, body {
  margin: 0;
  padding: 0;
  min-height: auto;
}

.resume-classic {
  font-family: var(--resume-font-family, 'Times New Roman', Georgia, serif);
  font-size: var(--resume-font-size, 11pt);
  color: #000;
  width: 8.5in;
  margin: 0 auto;
  padding: var(--resume-margin-top, 0.5in) var(--resume-margin-right, 0.5in) var(--resume-margin-bottom, 0.5in) var(--resume-margin-left, 0.5in);
  background: #fff;
  line-height: 1.3;
  box-sizing: border-box;
}

.resume-classic section {
  page-break-inside: avoid;
  page-break-after: auto;
}

.resume-classic header {
  text-align: center;
  border-bottom: 1px solid #000;
  padding-bottom: 8px;
  margin-bottom: 12px;
}

.resume-classic header h1 {
  font-size: 18pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin: 0 0 4px 0;
  color: #000;
}

.resume-classic .contact {
  font-size: 10pt;
  color: #000;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.resume-classic .contact-separator {
  margin: 0 2px;
}

.resume-classic .contact a {
  color: #000;
  text-decoration: none;
}

.resume-classic .contact a:hover {
  text-decoration: underline;
}

.resume-classic section {
  margin-bottom: 10px;
}

.resume-classic section h2 {
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  border-bottom: 1px solid #000;
  padding-bottom: 8px;
  margin-bottom: 6px;
  color: #000;
}

.resume-classic .entry {
  margin-bottom: 8px;
}

.resume-classic .entry-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.resume-classic .entry-title {
  font-weight: 600;
  font-size: var(--resume-font-size, 11pt);
}

.resume-classic .entry-subtitle {
  font-style: italic;
  color: #333;
}

.resume-classic .entry-dates {
  font-size: 10pt;
  color: #333;
}

.resume-classic .entry-location {
  font-size: 10pt;
  color: #333;
}

.resume-classic .entry-tech {
  font-style: italic;
  font-size: 10pt;
  color: #333;
  margin-top: 2px;
}

.resume-classic ul {
  margin: 3px 0 0 0;
  padding-left: 16px;
}

.resume-classic li {
  margin-bottom: 2px;
}

.resume-classic .suggested-bullet {
  background: #f5f5f5;
  border-left: 2px solid #666;
  padding-left: 6px;
  margin-left: -8px;
}

.resume-classic .skills-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  font-size: var(--resume-font-size, 11pt);
}

.resume-classic .skills-label {
  font-weight: 600;
}

.resume-classic .link {
  color: #000;
  text-decoration: underline;
}
`;

// Template CSS for Modern style
export const MODERN_TEMPLATE_CSS = `
html, body {
  margin: 0;
  padding: 0;
  min-height: auto;
}

.resume-modern {
  font-family: var(--resume-font-family, 'Inter', 'Segoe UI', sans-serif);
  font-size: var(--resume-font-size, 11px);
  color: #1f2937;
  width: 8.5in;
  margin: 0 auto;
  padding: var(--resume-margin-top, 0.5in) var(--resume-margin-right, 0.5in) var(--resume-margin-bottom, 0.5in) var(--resume-margin-left, 0.5in);
  background: #fff;
  line-height: 1.5;
  box-sizing: border-box;
}

.resume-modern section {
  page-break-inside: avoid;
  page-break-after: auto;
}

.resume-modern header {
  margin-bottom: 20px;
}

.resume-modern header h1 {
  font-size: 28px;
  font-weight: 700;
  color: var(--resume-accent, #2563eb);
  margin: 0 0 8px 0;
}

.resume-modern .contact {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 11px;
  color: #6b7280;
}

.resume-modern .contact a {
  color: var(--resume-accent, #2563eb);
  text-decoration: none;
}

.resume-modern section {
  margin-bottom: 16px;
}

.resume-modern section h2 {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--resume-accent, #2563eb);
  border-left: 3px solid var(--resume-accent, #2563eb);
  padding-left: 8px;
  margin-bottom: 16px;
}

.resume-modern .entry {
  margin-bottom: 12px;
  padding-left: 8px;
  border-left: 2px solid #e5e7eb;
}

.resume-modern .entry-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.resume-modern .entry-title {
  font-weight: 600;
  color: #111827;
}

.resume-modern .entry-subtitle {
  color: #6b7280;
}

.resume-modern .entry-dates {
  font-size: 10px;
  color: #9ca3af;
  background: #f3f4f6;
  padding: 2px 6px;
  border-radius: 4px;
}

.resume-modern .entry-tech {
  font-size: 9px;
  color: var(--resume-accent, #2563eb);
  margin-top: 4px;
}

.resume-modern ul {
  margin: 6px 0 0 0;
  padding-left: 16px;
}

.resume-modern li {
  margin-bottom: 3px;
  color: #374151;
}

.resume-modern .suggested-bullet {
  background: #fef3c7;
  border-radius: 4px;
  padding: 2px 6px;
  margin-left: -6px;
}

.resume-modern .skills-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.resume-modern .skill-category {
  background: #f3f4f6;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 10px;
}

.resume-modern .skill-category strong {
  color: var(--resume-accent, #2563eb);
}

.resume-modern .link {
  color: var(--resume-accent, #2563eb);
  text-decoration: none;
}
`;

// Helper to format dates
function formatDate(dateString: string): string {
  if (!dateString) return '';
  return dateString.split(' - ').map(part => {
    // Handle "null" or missing end date as Present
    if (!part || part.toLowerCase().includes('null') || part.toLowerCase() === 'present') return 'Present';

    // Try to parse YYYY-MM or YYYY
    const match = part.match(/(\d{4})(-(\d{2}))?/);
    if (match) {
      const year = parseInt(match[1]);
      const month = match[3] ? parseInt(match[3]) - 1 : 0; // 0-indexed
      const date = new Date(year, month);
      // If only year, return year. If month, return Month Year
      if (!match[3]) return part; // Keep strict YYYY if that's what it was
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    }
    return part;
  }).join(' - ');
}

function renderEntry(item: ResumeSectionItem, template: 'classic' | 'modern'): string {
  const bulletsHtml = (item.bullets ?? []).map(b =>
    `<li class="${b.isSuggested ? 'suggested-bullet' : ''}">${b.isSuggested ? '⚠️ ' : ''}${b.text}</li>`
  ).join('');

  // Primary link icon (Project style)
  const primaryLink = item.links?.[0];
  const linkIconHtml = primaryLink
    ? `<a href="${primaryLink.url}" target="_blank" style="text-decoration:none; color:inherit; display:inline-block;" title="${primaryLink.label || 'Link'}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left: 4px; vertical-align: middle; opacity: 0.7;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a>`
    : '';

  // Inline technologies (Project style)
  const techInlineHtml = item.technologies
    ? `<span style="font-size: 0.85em; font-style: italic; color: #4b5563; margin-left: 8px; font-family: var(--resume-font-family);">— ${item.technologies}</span>`
    : '';

  const dateDisplay = item.dates ? formatDate(item.dates) : '';

  return `
<div class="entry">
  <div class="entry-header" style="display: flex; justify-content: space-between; align-items: baseline;">
    <div style="flex: 1; margin-right: 16px;">
        <span class="entry-title">${item.title}</span>
        ${linkIconHtml}
        ${item.subtitle ? ` — <span class="entry-subtitle">${item.subtitle}</span>` : ''}
        ${techInlineHtml}
    </div>
    ${dateDisplay ? `<span class="entry-dates" style="white-space: nowrap;">${dateDisplay}</span>` : ''}
  </div>
  ${item.location ? `<div class="entry-location">${item.location}</div>` : ''}
  <ul>${bulletsHtml}</ul>
</div>
  `;
}

function renderSkillsSection(skills: TailoredResumeData['skills'], template: 'classic' | 'modern'): string {
  // Flatten all unique skills from dynamic categories
  const allSkills: string[] = [];
  if (skills && typeof skills === 'object') {
    for (const [, values] of Object.entries(skills)) {
      if (Array.isArray(values)) {
        allSkills.push(...values);
      }
    }
  }

  // Dedup just in case
  const uniqueSkills = [...new Set(allSkills)];
  const skillsString = uniqueSkills.join(', ');

  if (!skillsString) return '';

  if (template === 'modern') {
    return `
<section>
  <h2>TECHNICAL SKILLS</h2>
  <div style="font-size: var(--resume-font-size, 11px); color: #374151;">
    ${skillsString}
  </div>
</section>
    `;
  }

  // Classic
  return `
<section>
  <h2>TECHNICAL SKILLS</h2>
  <div style="padding-left: 0; line-height: 1.4;">
    ${skillsString}
  </div>
</section>
  `;
}

/**
 * Render resume HTML using the Classic template
 */
export function renderClassicTemplate(data: TailoredResumeData): string {
  const { contact, sections, skills, design } = data;

  const sectionsHtml = sections.map(section => {
    if (section.type === 'skills') {
      return renderSkillsSection(skills, 'classic');
    }
    return renderSection(section, 'classic');
  }).join('');

  return `
<div class="resume-classic" style="
  --resume-font-family: ${design.fontFamily};
  --resume-font-size: ${design.fontSize}px;
  --resume-accent: ${design.accentColor};
  --resume-margin-top: ${design.margins.top}in;
  --resume-margin-right: ${design.margins.right}in;
  --resume-margin-bottom: ${design.margins.bottom}in;
  --resume-margin-left: ${design.margins.left}in;
">
  <header>
    <h1>${contact.name}</h1>
    <div class="contact">
      <span>${contact.phone}</span>
      <span>|</span>
      <a href="mailto:${contact.email}">${contact.email}</a>
      <span>|</span>
      ${(contact.github || []).map(g => `<a href="https://${g}" target="_blank">${g}</a>`).join(' | ')}
      <span>|</span>
      <a href="https://${contact.linkedin}" target="_blank">${contact.linkedin}</a>
    </div>
  </header>
  ${sectionsHtml}
</div>
  `.trim();
}

/**
 * Render resume HTML using the Modern template
 */
export function renderModernTemplate(data: TailoredResumeData): string {
  const { contact, sections, skills, design } = data;

  const sectionsHtml = sections.map(section => {
    if (section.type === 'skills') {
      return renderSkillsSection(skills, 'modern');
    }
    return renderSection(section, 'modern');
  }).join('');

  return `
<div class="resume-modern" style="
  --resume-font-family: ${design.fontFamily};
  --resume-font-size: ${design.fontSize}px;
  --resume-accent: ${design.accentColor};
  --resume-margin-top: ${design.margins.top}in;
  --resume-margin-right: ${design.margins.right}in;
  --resume-margin-bottom: ${design.margins.bottom}in;
  --resume-margin-left: ${design.margins.left}in;
">
  <header>
    <h1>${contact.name}</h1>
    <div class="contact">
      <span>📞 ${contact.phone}</span>
      <a href="mailto:${contact.email}">✉️ ${contact.email}</a>
      ${(contact.github || []).map(g => `<a href="https://${g}" target="_blank">🔗 ${g}</a>`).join('')}
      <a href="https://${contact.linkedin}" target="_blank">💼 LinkedIn</a>
    </div>
  </header>
  ${sectionsHtml}
</div>
  `.trim();
}

function renderSection(section: ResumeSection, template: 'classic' | 'modern'): string {
  const titleMap: Record<string, string> = {
    education: 'EDUCATION',
    experience: 'EXPERIENCE',
    projects: 'PROJECTS',
    community: 'COMMUNITY INVOLVEMENT',
    skills: 'TECHNICAL SKILLS',
    volunteer: 'VOLUNTEER ACTIVITIES',
    certifications: 'CERTIFICATIONS',
  };

  const entriesHtml = section.items.map(item => renderEntry(item, template)).join('');

  return `
<section>
  <h2>${titleMap[section.type] || section.title}</h2>
  ${entriesHtml}
</section>
  `;
}

/**
 * Main render function - picks template based on design settings
 */
export function renderResumeHtml(data: TailoredResumeData): string {
  const css = data.design.template === 'modern' ? MODERN_TEMPLATE_CSS : CLASSIC_TEMPLATE_CSS;
  const html = data.design.template === 'modern'
    ? renderModernTemplate(data)
    : renderClassicTemplate(data);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>${css}</style>
</head>
<body>
  ${html}
</body>
</html>
  `.trim();
}

/**
 * Get available font families for the design panel
 */
export const AVAILABLE_FONTS = [
  { label: 'Times New Roman', value: "'Times New Roman', Georgia, serif" },
  { label: 'Georgia', value: "Georgia, serif" },
  { label: 'Arial', value: "Arial, Helvetica, sans-serif" },
  { label: 'Helvetica', value: "Helvetica, Arial, sans-serif" },
  { label: 'Inter', value: "'Inter', 'Segoe UI', sans-serif" },
  { label: 'Roboto', value: "'Roboto', sans-serif" },
  { label: 'Open Sans', value: "'Open Sans', sans-serif" },
];

/**
 * Get available accent colors for the design panel
 */
export const ACCENT_COLORS = [
  { label: 'Navy', value: '#1a365d' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Green', value: '#059669' },
  { label: 'Purple', value: '#7c3aed' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Orange', value: '#ea580c' },
  { label: 'Black', value: '#111827' },
];
