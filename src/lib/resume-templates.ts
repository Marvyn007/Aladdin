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
  font-family: 'Aptos', 'Aptos Body', 'Open Sans', 'Segoe UI', sans-serif;
  font-size: var(--resume-font-size, 10.5pt);
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
  letter-spacing: 0px;
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
  font-size: 13pt;
  font-weight: 700;
  border-bottom: 1px solid #000;
  padding-bottom: 4px;
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
  font-weight: 700;
  font-size: var(--resume-font-size, 10.5pt);
}

.resume-classic .entry-subtitle {
  font-style: normal;
  font-weight: 700;
  color: #000;
}

.resume-classic .entry-dates {
  font-size: 10.5pt;
  color: #000;
}

.resume-classic .entry-location {
  font-size: 10.5pt;
  color: #000;
}

.resume-classic .entry-tech {
  font-style: normal;
  font-weight: 700;
  font-size: 10.5pt;
  color: #000;
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

function parseMarkdown(text: string): string {
  if (!text) return '';
  // Since we use strict JSON parsing, the string primitive arrives with exactly two asterisks `**` around bold words.
  // There is no need to handle escaped backslashes since JSON.parse evaluates them into standard string format.
  return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

function renderEntry(item: ResumeSectionItem, template: 'classic' | 'modern'): string {
  const visibleBullets = (item.bullets ?? []).filter(b => b.visible !== false);
  const bulletsHtml = visibleBullets.map(b =>
    `<li class="${b.isSuggested ? 'suggested-bullet' : ''}">${b.isSuggested ? '<span style="color: #f59e0b;">●</span> ' : ''}${parseMarkdown(b.text)}</li>`
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
        <span class="entry-title">${parseMarkdown(item.title)}</span>
        ${linkIconHtml}
        ${item.subtitle ? ` — <span class="entry-subtitle">${parseMarkdown(item.subtitle)}</span>` : ''}
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
  if (!skills) return '';

  if (template === 'modern') {
    // Flatten for modern
    const allSkills: string[] = [];
    if (typeof skills === 'object') {
      for (const [, values] of Object.entries(skills)) {
        if (Array.isArray(values)) allSkills.push(...values);
      }
    }
    const uniqueSkills = [...new Set(allSkills)];
    const skillsString = uniqueSkills.join(', ');

    if (!skillsString) return '';

    return `
<section>
  <h2>TECHNICAL SKILLS</h2>
  <div style="font-size: var(--resume-font-size, 11px); color: #374151;">
    ${skillsString}
  </div>
</section>
    `;
  }

  // Classic - Categorized layout
  let skillsHtml = '';
  if (skills && typeof skills === 'object' && !Array.isArray(skills)) {
     const entries = Object.entries(skills);
     if (entries.length === 0) return '';
     
     skillsHtml = entries.map(([category, items]) => {
         if (!items || !Array.isArray(items) || items.length === 0) return '';
         return `<div style="margin-bottom: 4px;"><strong>${category}:</strong> ${items.join(', ')}</div>`;
     }).join('');
  } else if (Array.isArray(skills) && skills.length > 0) {
     skillsHtml = `<div>${skills.join(', ')}</div>`;
  }

  if (!skillsHtml) return '';

  return `
<section>
  <h2>Skills</h2>
  <div style="padding-left: 0; line-height: 1.4;">
    ${skillsHtml}
  </div>
</section>
  `;
}

/**
 * Render resume HTML using the Classic template
 */
export function renderClassicTemplate(data: TailoredResumeData): string {
  const { contact, sections, skills, design } = data;

  // Filter out hidden sections (visible !== false means show by default, only hide when explicitly set to false)
  const visibleSections = sections.filter(section => section.visible !== false);

  const sectionsHtml = visibleSections.map(section => {
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

  // Filter out hidden sections
  const visibleSections = sections.filter(section => section.visible !== false);

  const sectionsHtml = visibleSections.map(section => {
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
      <span>${contact.phone}</span>
      <a href="mailto:${contact.email}">${contact.email}</a>
      ${(contact.github || []).map(g => `<a href="https://${g}" target="_blank">${g}</a>`).join('')}
      ${contact.linkedin ? `<a href="https://${contact.linkedin}" target="_blank">LinkedIn</a>` : ''}
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

  const isLeadership = section.title?.toLowerCase().includes('leadership') || section.type.toLowerCase().includes('leadership');

  // If leadership, render as CSV
  if (isLeadership) {
    const allLeadershipText: string[] = [];
    section.items.forEach(item => {
      // Collect titles and bullets
      if (item.title) allLeadershipText.push(item.title);
      if (item.bullets) {
        item.bullets.forEach(b => allLeadershipText.push(b.text));
      }
    });
    
    const csvString = parseMarkdown([...new Set(allLeadershipText)].join(', '));
    
    return `
<section>
  <h2>${titleMap[section.type] || section.title.toUpperCase()}</h2>
  <div style="font-size: var(--resume-font-size, 11px); color: #374151; line-height: 1.4;">
    ${csvString}
  </div>
</section>
  `;
  }

  const visibleItems = section.items.filter(item => item.visible !== false);
  const entriesHtml = visibleItems.map(item => renderEntry(item, template)).join('');

  return `
<section>
  <h2>${titleMap[section.type] || section.title.toUpperCase()}</h2>
  ${entriesHtml}
</section>
  `;
}

// ============================================================================
// EXECUTIVE TEMPLATE — Inspired by Charles Bloomberg resume
// Top accent bar, clean professional layout, serif headings
// ============================================================================

export const EXECUTIVE_TEMPLATE_CSS = `
html, body { margin: 0; padding: 0; min-height: auto; }

.resume-executive {
  font-family: var(--resume-font-family, 'Georgia', 'Times New Roman', serif);
  font-size: var(--resume-font-size, 10.5pt);
  color: #1a1a1a;
  width: 8.5in;
  margin: 0 auto;
  padding: 0;
  background: #fff;
  line-height: 1.35;
  box-sizing: border-box;
}

.resume-executive .accent-bar {
  height: 6px;
  background: var(--resume-accent, #1a365d);
  width: 100%;
}

.resume-executive .content-area {
  padding: var(--resume-margin-top, 0.4in) var(--resume-margin-right, 0.6in) var(--resume-margin-bottom, 0.4in) var(--resume-margin-left, 0.6in);
}

.resume-executive header {
  text-align: center;
  margin-bottom: 8px;
  padding-bottom: 10px;
}

.resume-executive header h1 {
  font-size: 22pt;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #111;
  letter-spacing: 0.5px;
}

.resume-executive .contact {
  font-size: 9.5pt;
  color: #444;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 8px;
}

.resume-executive .contact a { color: #444; text-decoration: none; }
.resume-executive .contact a:hover { text-decoration: underline; }

.resume-executive section { margin-bottom: 10px; }

.resume-executive section h2 {
  font-size: 11pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--resume-accent, #1a365d);
  border-bottom: 2px solid var(--resume-accent, #1a365d);
  padding-bottom: 3px;
  margin-bottom: 8px;
}

.resume-executive .entry { margin-bottom: 8px; }
.resume-executive .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
.resume-executive .entry-title { font-weight: 700; font-size: var(--resume-font-size, 10.5pt); }
.resume-executive .entry-subtitle { font-style: italic; color: #333; }
.resume-executive .entry-dates { font-size: 10pt; color: #555; white-space: nowrap; }
.resume-executive .entry-location { font-size: 10pt; color: #555; font-style: italic; }
.resume-executive ul { margin: 3px 0 0 0; padding-left: 16px; }
.resume-executive li { margin-bottom: 2px; }
.resume-executive .skills-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.resume-executive .skills-label { font-weight: 600; }
.resume-executive .link { color: var(--resume-accent, #1a365d); text-decoration: none; }
`;

export function renderExecutiveTemplate(data: TailoredResumeData): string {
  const { contact, sections, skills, design } = data;
  // Filter out hidden sections
  const visibleSections = sections.filter(section => section.visible !== false);
  const sectionsHtml = visibleSections.map(section => {
    if (section.type === 'skills') return renderSkillsSection(skills, 'classic');
    return renderSection(section, 'classic');
  }).join('');

  return `
<div class="resume-executive" style="
  --resume-font-family: ${design.fontFamily};
  --resume-font-size: ${design.fontSize}px;
  --resume-accent: ${design.accentColor};
  --resume-margin-top: ${design.margins.top}in;
  --resume-margin-right: ${design.margins.right}in;
  --resume-margin-bottom: ${design.margins.bottom}in;
  --resume-margin-left: ${design.margins.left}in;
">
  <div class="accent-bar"></div>
  <div class="content-area">
    <header>
      <h1>${contact.name}</h1>
      <div class="contact">
        <span>${contact.phone}</span><span>•</span>
        <a href="mailto:${contact.email}">${contact.email}</a><span>•</span>
        ${(contact.github || []).map(g => `<a href="https://${g}" target="_blank">${g}</a>`).join(' • ')}
        ${contact.linkedin ? `<span>•</span><a href="https://${contact.linkedin}" target="_blank">${contact.linkedin}</a>` : ''}
      </div>
    </header>
    ${sectionsHtml}
  </div>
</div>
  `.trim();
}

// ============================================================================
// PROFESSIONAL TEMPLATE — Sidebar layout inspired by Solutions Consultant resume
// Orange accent sidebar with contact/skills on right, experience on left
// ============================================================================

export const PROFESSIONAL_TEMPLATE_CSS = `
html, body { margin: 0; padding: 0; min-height: auto; }

.resume-professional {
  font-family: var(--resume-font-family, 'Helvetica', 'Arial', sans-serif);
  font-size: var(--resume-font-size, 10.5pt);
  color: #333;
  width: 8.5in;
  margin: 0 auto;
  background: #fff;
  line-height: 1.35;
  box-sizing: border-box;
  display: flex;
  min-height: 11in;
}

.resume-professional .main-col {
  flex: 1;
  padding: var(--resume-margin-top, 0.5in) 0.35in var(--resume-margin-bottom, 0.5in) var(--resume-margin-left, 0.5in);
}

.resume-professional .sidebar {
  width: 2.4in;
  background: #f8f6f4;
  padding: var(--resume-margin-top, 0.5in) 0.3in var(--resume-margin-bottom, 0.5in) 0.3in;
  border-left: 3px solid var(--resume-accent, #d97706);
}

.resume-professional header { margin-bottom: 16px; }
.resume-professional header h1 {
  font-size: 22pt;
  font-weight: 700;
  margin: 0 0 2px 0;
  color: #111;
}
.resume-professional .headline {
  font-size: 10pt;
  color: #666;
  margin-bottom: 12px;
}

.resume-professional section { margin-bottom: 12px; }
.resume-professional section h2 {
  font-size: 10pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--resume-accent, #d97706);
  padding-bottom: 3px;
  border-bottom: 2px solid var(--resume-accent, #d97706);
  margin-bottom: 8px;
}

.resume-professional .sidebar section h2 {
  font-size: 9pt;
  border-bottom: 1px solid var(--resume-accent, #d97706);
}

.resume-professional .entry { margin-bottom: 10px; }
.resume-professional .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
.resume-professional .entry-title { font-weight: 700; color: #111; }
.resume-professional .entry-subtitle { color: #555; font-size: 9.5pt; }
.resume-professional .entry-dates { font-size: 9.5pt; color: #888; font-weight: 600; }
.resume-professional .entry-location { font-size: 9pt; color: #777; }
.resume-professional ul { margin: 3px 0 0 0; padding-left: 14px; }
.resume-professional li { margin-bottom: 2px; font-size: 9.5pt; }

.resume-professional .sidebar-item { margin-bottom: 4px; font-size: 9pt; color: #444; }
.resume-professional .sidebar-item strong { color: #222; }
.resume-professional .sidebar-skills { font-size: 9pt; color: #444; line-height: 1.5; }
.resume-professional .sidebar-skills li { list-style: none; padding-left: 0; margin-bottom: 1px; }
.resume-professional .sidebar-skills ul { padding-left: 0; }
.resume-professional .link { color: var(--resume-accent, #d97706); text-decoration: none; }
`;

export function renderProfessionalTemplate(data: TailoredResumeData): string {
  const { contact, sections, skills, design } = data;

  // Filter out hidden sections
  const visibleSections = sections.filter(section => section.visible !== false);

  // Split sections: skills + education go to sidebar, rest to main
  const mainSections = visibleSections.filter(s => s.type !== 'skills' && s.type !== 'education');
  const eduSections = visibleSections.filter(s => s.type === 'education');

  const mainHtml = mainSections.map(section => renderSection(section, 'classic')).join('');
  const eduHtml = eduSections.map(section => renderSection(section, 'classic')).join('');

  // Render skills for sidebar
  let sidebarSkillsHtml = '';
  if (skills && typeof skills === 'object' && !Array.isArray(skills)) {
    const entries = Object.entries(skills);
    sidebarSkillsHtml = entries.map(([category, items]) => {
      if (!items || !Array.isArray(items) || items.length === 0) return '';
      return `<div style="margin-bottom: 6px;"><strong>${category}:</strong><br/>${items.join(', ')}</div>`;
    }).join('');
  }

  return `
<div class="resume-professional" style="
  --resume-font-family: ${design.fontFamily};
  --resume-font-size: ${design.fontSize}px;
  --resume-accent: ${design.accentColor};
  --resume-margin-top: ${design.margins.top}in;
  --resume-margin-right: ${design.margins.right}in;
  --resume-margin-bottom: ${design.margins.bottom}in;
  --resume-margin-left: ${design.margins.left}in;
">
  <div class="main-col">
    <header>
      <h1>${contact.name}</h1>
      ${data.summary ? `<div class="headline">${data.summary.substring(0, 120)}${data.summary.length > 120 ? '...' : ''}</div>` : ''}
    </header>
    ${mainHtml}
  </div>
  <div class="sidebar">
    <section>
      <h2>Contact</h2>
      <div class="sidebar-item">${contact.location || ''}</div>
      <div class="sidebar-item">${contact.phone}</div>
      <div class="sidebar-item"><a href="mailto:${contact.email}" class="link">${contact.email}</a></div>
      ${contact.linkedin ? `<div class="sidebar-item"><a href="https://${contact.linkedin}" target="_blank" class="link">${contact.linkedin}</a></div>` : ''}
      ${(contact.github || []).map(g => `<div class="sidebar-item"><a href="https://${g}" target="_blank" class="link">${g}</a></div>`).join('')}
    </section>
    ${sidebarSkillsHtml ? `<section><h2>Skills</h2><div class="sidebar-skills">${sidebarSkillsHtml}</div></section>` : ''}
    ${eduHtml}
  </div>
</div>
  `.trim();
}

// ============================================================================
// MINIMAL TEMPLATE — Clean, airy layout with thin dividers
// Inspired by Catherine Varns resume style
// ============================================================================

export const MINIMAL_TEMPLATE_CSS = `
html, body { margin: 0; padding: 0; min-height: auto; }

.resume-minimal {
  font-family: var(--resume-font-family, 'Arial', 'Helvetica', sans-serif);
  font-size: var(--resume-font-size, 10.5pt);
  color: #222;
  width: 8.5in;
  margin: 0 auto;
  padding: var(--resume-margin-top, 0.5in) var(--resume-margin-right, 0.6in) var(--resume-margin-bottom, 0.5in) var(--resume-margin-left, 0.6in);
  background: #fff;
  line-height: 1.4;
  box-sizing: border-box;
}

.resume-minimal header {
  text-align: center;
  margin-bottom: 6px;
}

.resume-minimal header h1 {
  font-size: 20pt;
  font-weight: 700;
  margin: 0 0 6px 0;
  color: #111;
  letter-spacing: 0.3px;
}

.resume-minimal .subtitle {
  font-size: 9.5pt;
  color: #555;
  margin-bottom: 8px;
  line-height: 1.5;
}

.resume-minimal .contact {
  font-size: 9pt;
  color: #444;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #ddd;
  margin-bottom: 12px;
}

.resume-minimal .contact a { color: #444; text-decoration: none; }
.resume-minimal .contact a:hover { text-decoration: underline; }

.resume-minimal section { margin-bottom: 10px; }
.resume-minimal section h2 {
  font-size: 10pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: #111;
  padding: 4px 0;
  border-top: 1px solid #bbb;
  border-bottom: 1px solid #bbb;
  margin-bottom: 8px;
  text-align: left;
}

.resume-minimal .entry { margin-bottom: 8px; }
.resume-minimal .entry-header { display: flex; justify-content: space-between; align-items: baseline; }
.resume-minimal .entry-title { font-weight: 700; color: #111; }
.resume-minimal .entry-subtitle { color: #444; }
.resume-minimal .entry-dates { font-size: 9.5pt; color: #666; white-space: nowrap; }
.resume-minimal .entry-location { font-size: 9.5pt; color: #666; }
.resume-minimal ul { margin: 3px 0 0 0; padding-left: 16px; }
.resume-minimal li { margin-bottom: 2px; }
.resume-minimal .skills-grid { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; }
.resume-minimal .skills-label { font-weight: 600; }
.resume-minimal .link { color: #333; text-decoration: underline; }
`;

export function renderMinimalTemplate(data: TailoredResumeData): string {
  const { contact, sections, skills, design } = data;
  // Filter out hidden sections
  const visibleSections = sections.filter(section => section.visible !== false);
  const sectionsHtml = visibleSections.map(section => {
    if (section.type === 'skills') return renderSkillsSection(skills, 'classic');
    return renderSection(section, 'classic');
  }).join('');

  return `
<div class="resume-minimal" style="
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
    ${data.summary ? `<div class="subtitle">${data.summary.substring(0, 200)}${data.summary.length > 200 ? '...' : ''}</div>` : ''}
    <div class="contact">
      <span>${contact.location || ''}</span>
      <a href="mailto:${contact.email}">${contact.email}</a>
      <span>${contact.phone}</span>
      ${(contact.github || []).map(g => `<a href="https://${g}" target="_blank">${g}</a>`).join('')}
      ${contact.linkedin ? `<a href="https://${contact.linkedin}" target="_blank">${contact.linkedin}</a>` : ''}
    </div>
  </header>
  ${sectionsHtml}
</div>
  `.trim();
}

// ============================================================================
// TEMPLATE METADATA — For the template picker UI
// ============================================================================

export const TEMPLATE_META = [
  {
    id: 'classic' as const,
    name: 'Classic',
    description: 'Traditional black & white layout with serif headings and clean lines. Proven ATS-compatible format.',
    tags: ['ATS Friendly', 'Professional', 'Traditional'],
    defaultFont: "'Times New Roman', Georgia, serif",
    defaultAccent: '#000000',
  },
  {
    id: 'modern' as const,
    name: 'Modern',
    description: 'Contemporary design with accent colors, modern typography, and left-border section styling.',
    tags: ['Modern', 'Colorful', 'Creative'],
    defaultFont: "'Inter', 'Segoe UI', sans-serif",
    defaultAccent: '#2563eb',
  },
  {
    id: 'executive' as const,
    name: 'Executive',
    description: 'Polished layout with a top accent bar, centered header, and uppercase section headings. Great for senior roles.',
    tags: ['Executive', 'ATS Friendly', 'Senior'],
    defaultFont: "Georgia, serif",
    defaultAccent: '#1a365d',
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    description: 'Two-column layout with a sidebar for contact & skills. Modern and space-efficient.',
    tags: ['Sidebar', 'Two-Column', 'Modern'],
    defaultFont: "'Helvetica', 'Arial', sans-serif",
    defaultAccent: '#d97706',
  },
  {
    id: 'minimal' as const,
    name: 'Minimal',
    description: 'Clean, uncluttered design with thin dividers and centered header. Lets content speak for itself.',
    tags: ['Minimal', 'Clean', 'ATS Friendly'],
    defaultFont: "'Arial', 'Helvetica', sans-serif",
    defaultAccent: '#111827',
  },
];

// ============================================================================
// TEMPLATE CSS MAP — For looking up CSS by template ID
// ============================================================================

export const TEMPLATE_CSS_MAP: Record<string, string> = {
  classic: CLASSIC_TEMPLATE_CSS,
  modern: MODERN_TEMPLATE_CSS,
  executive: EXECUTIVE_TEMPLATE_CSS,
  professional: PROFESSIONAL_TEMPLATE_CSS,
  minimal: MINIMAL_TEMPLATE_CSS,
};

/**
 * Main render function - picks template based on design settings
 */
export function renderResumeHtml(data: TailoredResumeData): string {
  const template = data.design.template || 'classic';
  const css = TEMPLATE_CSS_MAP[template] || CLASSIC_TEMPLATE_CSS;
  
  let html: string;
  switch (template) {
    case 'modern':
      html = renderModernTemplate(data);
      break;
    case 'executive':
      html = renderExecutiveTemplate(data);
      break;
    case 'professional':
      html = renderProfessionalTemplate(data);
      break;
    case 'minimal':
      html = renderMinimalTemplate(data);
      break;
    default:
      html = renderClassicTemplate(data);
  }

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

