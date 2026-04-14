import type { Job } from '@/types';
import type { OnboardingAnswerRecord } from '@/lib/onboarding';
import type { JobFunctionValue } from '@/lib/onboarding';

/**
 * Compute a 0-100 preference score for a job based on the user's onboarding answers.
 *
 * Weights:
 *   - job_function  30pts: 3-signal taxonomy scorer (exact match, keyword expansion, skills overlap)
 *   - regions       25pts: region labels in job location
 *   - role_types    20pts: employment type match
 *   - work_style    15pts: remote/onsite/hybrid/flexible
 *   - career_levels 10pts: seniority keywords in job title
 *
 * Returns Math.min(100, Math.max(0, score)).
 */
export function computePreferenceScore(
  job: Job,
  answersByKey: Record<string, OnboardingAnswerRecord>
): number {
  let score = 0;

  score += scoreJobFunction(job, answersByKey);
  score += scoreRegions(job, answersByKey);
  score += scoreRoleTypes(job, answersByKey);
  score += scoreWorkStyle(job, answersByKey);
  score += scoreCareerLevels(job, answersByKey);

  return Math.min(100, Math.max(0, score));
}

/**
 * Hard-reject a job before scoring. Returns true if the job should be excluded
 * from the For You tab entirely (not just scored lower).
 *
 * Currently checks: role_types preference vs job.jobType mismatch.
 */
export function isHardRejected(
  job: Job,
  answersByKey: Record<string, OnboardingAnswerRecord>
): boolean {
  const roleTypesAnswer = answersByKey['role_types'];
  if (!roleTypesAnswer || job.jobType == null) return false;

  const selected = toStringArray(roleTypesAnswer.value);
  if (selected.length === 0) return false;

  const mapped = selected.map((v) => ROLE_TYPE_MAP[v] ?? v);
  return !mapped.includes(job.jobType);
}

// ─── job_function scorer (30pts max, floor −10) ───────────────────────────────

function scoreJobFunction(
  job: Job,
  answersByKey: Record<string, OnboardingAnswerRecord>
): number {
  const answer = answersByKey['job_function'];
  if (!answer) return 0;

  const jfv = answer.value as JobFunctionValue | null;
  if (!jfv || (!jfv.roles?.length && !jfv.subcategories?.length && !jfv.industries?.length)) {
    return 0;
  }

  let pts = 0;

  pts += scoreExactTaxonomy(job, jfv);       // 0–15
  pts += scoreKeywordExpansion(job, jfv);    // 0–10
  pts += scoreSkillsOverlap(job, jfv);       // 0–5

  // Penalties (career-level and field mismatch)
  const careerLevels = toStringArray(answersByKey['career_levels']?.value);
  pts += applyPenalties(job, jfv, careerLevels);

  return Math.max(-10, Math.min(30, pts));
}

/**
 * Sub-signal 1 — Exact taxonomy match (0–15 pts).
 * First match wins within this sub-signal.
 */
function scoreExactTaxonomy(job: Job, jfv: JobFunctionValue): number {
  const titleLower = (job.title ?? '').toLowerCase();
  const descLower = (job.job_description_plain ?? '').toLowerCase();

  // Check role titles: exact match in title → 15pts
  for (const role of (jfv.roles ?? [])) {
    if (titleLower.includes(role.toLowerCase())) return 15;
  }

  // Check role titles: found in description → 8pts
  for (const role of (jfv.roles ?? [])) {
    if (descLower.includes(role.toLowerCase())) return 8;
  }

  // Check subcategory label keywords in job title → 5pts
  for (const sub of (jfv.subcategories ?? [])) {
    const subWords = sub.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
    if (subWords.some((w) => w.length > 3 && titleLower.includes(w))) return 5;
  }

  return 0;
}

/**
 * Sub-signal 2 — Keyword expansion / semantic (0–10 pts).
 *
 * Embedding upgrade path: when a real embedding model is active,
 * replace the body of this function with cosine similarity logic.
 * The function signature and 0–10 point value must remain identical.
 */
function scoreKeywordExpansion(job: Job, jfv: JobFunctionValue): number {
  const text = `${job.title ?? ''} ${job.job_description_plain ?? ''}`.toLowerCase();
  const jobSkills = (job.skills ?? []).map((s) => s.toLowerCase());

  const keywords = new Set<string>();
  for (const sub of (jfv.subcategories ?? [])) {
    const expanded = SUBCATEGORY_KEYWORDS[sub] ?? [];
    for (const kw of expanded) keywords.add(kw.toLowerCase());
  }

  if (keywords.size === 0) return 0;

  let hits = 0;
  for (const kw of keywords) {
    if (text.includes(kw) || jobSkills.some((s) => s.includes(kw))) {
      hits++;
    }
  }

  if (hits >= 3) return 10;
  if (hits >= 1) return 5;
  return 0;
}

/**
 * Sub-signal 3 — Skills overlap (0–5 pts).
 * 1 pt per matched implied skill, max 5 pts.
 */
function scoreSkillsOverlap(job: Job, jfv: JobFunctionValue): number {
  const jobSkills = (job.skills ?? []).map((s) => s.toLowerCase());
  if (jobSkills.length === 0) return 0;

  let pts = 0;
  for (const role of (jfv.roles ?? [])) {
    const implied = (ROLE_IMPLIED_SKILLS[role] ?? []).map((s) => s.toLowerCase());
    for (const skill of implied) {
      if (jobSkills.some((js) => js.includes(skill) || skill.includes(js))) {
        pts++;
        if (pts >= 5) return 5;
      }
    }
  }

  return pts;
}

/**
 * Penalties: seniority mismatch and industry field mismatch.
 * Returns a negative number (or 0).
 */
function applyPenalties(
  job: Job,
  jfv: JobFunctionValue,
  careerLevels: string[]
): number {
  const titleLower = (job.title ?? '').toLowerCase();
  const descLower = (job.job_description_plain ?? '').toLowerCase();
  let penalty = 0;

  // Seniority mismatch
  const isSeniorJob = /\b(senior|staff|principal|director)\b/i.test(job.title ?? '');
  const isJuniorJob = /\b(junior|entry.?level|intern)\b/i.test(job.title ?? '');

  if (careerLevels.includes('early_career') && isSeniorJob) penalty -= 8;
  if (careerLevels.includes('executive_leadership') && isJuniorJob) penalty -= 8;

  // Industry field mismatch: none of the user's selected industries match the job
  if ((jfv.industries ?? []).length > 0) {
    const combinedText = `${titleLower} ${descLower}`;
    const anyMatch = (jfv.industries ?? []).some((industry) => {
      const broadKeywords = INDUSTRY_BROAD_KEYWORDS[industry] ?? [];
      return broadKeywords.some((kw) => combinedText.includes(kw.toLowerCase()));
    });
    if (!anyMatch) penalty -= 5;
  }

  return penalty;
}

// ─── regions (25pts) ─────────────────────────────────────────────────────────

function scoreRegions(job: Job, answersByKey: Record<string, OnboardingAnswerRecord>): number {
  const answer = answersByKey['regions'];
  if (!answer) return 0;

  const selected = toStringArray(answer.value);
  const locationLower = (job.location ?? '').toLowerCase();

  const matched = selected.some((value) => {
    if (value === 'remote_worldwide') {
      return locationLower.includes('remote');
    }
    const keyword = value.replace(/_/g, ' ').trim();
    return keyword.length > 0 && locationLower.includes(keyword);
  });

  return matched ? 25 : 0;
}

// ─── role_types (20pts) ───────────────────────────────────────────────────────

const ROLE_TYPE_MAP: Record<string, string> = {
  full_time: 'fulltime',
  part_time: 'parttime',
  contract: 'contract',
  internship: 'internship',
  freelance: 'contract',
  apprenticeship: 'parttime',
};

function scoreRoleTypes(job: Job, answersByKey: Record<string, OnboardingAnswerRecord>): number {
  const answer = answersByKey['role_types'];
  if (!answer || job.jobType == null) return 0;

  const selected = toStringArray(answer.value);
  const matched = selected.some((value) => {
    const mapped = ROLE_TYPE_MAP[value] ?? value;
    return mapped === job.jobType;
  });

  return matched ? 20 : 0;
}

// ─── work_style (15pts) ───────────────────────────────────────────────────────

function scoreWorkStyle(job: Job, answersByKey: Record<string, OnboardingAnswerRecord>): number {
  const answer = answersByKey['work_style'];
  if (!answer) return 0;

  const style = toSingleString(answer.value);

  if (style === 'flexible') return 15;
  if (style === 'remote' && job.isRemote === true) return 15;
  if (style === 'onsite' && job.isRemote === false) return 15;
  if (style === 'hybrid') {
    const locationLower = (job.location ?? '').toLowerCase();
    if (locationLower.includes('hybrid')) return 15;
  }

  return 0;
}

// ─── career_levels (10pts) ────────────────────────────────────────────────────

const LEVEL_KEYWORDS: Record<string, string[]> = {
  early_career: ['junior', 'entry', 'intern', 'associate'],
  mid_level: ['mid', ' ii', ' iii'],
  senior_manager: ['senior', 'staff', 'lead', 'principal', 'manager'],
  executive_leadership: ['director', 'vp', 'head', 'chief', 'executive'],
};

function scoreCareerLevels(job: Job, answersByKey: Record<string, OnboardingAnswerRecord>): number {
  const answer = answersByKey['career_levels'];
  if (!answer) return 0;

  const selected = toStringArray(answer.value);
  const titleLower = (job.title ?? '').toLowerCase();

  const matched = selected.some((level) => {
    const keywords = LEVEL_KEYWORDS[level] ?? [];
    return keywords.some((kw) => titleLower.includes(kw));
  });

  return matched ? 10 : 0;
}

// ─── Static maps ─────────────────────────────────────────────────────────────

const SUBCATEGORY_KEYWORDS: Record<string, string[]> = {
  'Backend Engineering': ['REST', 'API', 'Python', 'Node.js', 'backend', 'microservices', 'Django', 'FastAPI', 'Spring Boot', 'Golang', 'Kotlin', 'Java', 'database', 'PostgreSQL', 'MySQL'],
  'Data & Analytics': ['SQL', 'ETL', 'data pipeline', 'analytics', 'Tableau', 'Power BI', 'dbt', 'Spark', 'Airflow', 'BigQuery', 'Redshift', 'data warehouse', 'Looker'],
  'Machine Learning & AI': ['machine learning', 'deep learning', 'neural network', 'PyTorch', 'TensorFlow', 'LLM', 'NLP', 'computer vision', 'MLOps', 'model training', 'inference', 'embeddings', 'transformer'],
  'Frontend/Mobile/Game': ['React', 'Vue', 'Angular', 'TypeScript', 'frontend', 'mobile', 'iOS', 'Android', 'Flutter', 'Swift', 'Kotlin', 'Unity', 'Unreal', 'CSS', 'HTML'],
  'System Reliability & Security': ['DevOps', 'SRE', 'Kubernetes', 'Docker', 'CI/CD', 'infrastructure', 'AWS', 'GCP', 'Azure', 'security', 'penetration', 'network', 'firewall', 'IaC', 'Terraform'],
  'Technical Support': ['helpdesk', 'support', 'Salesforce Admin', 'JIRA', 'ticketing', 'SLA', 'incident', 'system administrator', 'network support'],
  'Testing': ['QA', 'quality assurance', 'test automation', 'Selenium', 'Cypress', 'Jest', 'pytest', 'test plan', 'bug report', 'regression'],
  'Project Management': ['scrum', 'agile', 'sprint', 'roadmap', 'stakeholder', 'program manager', 'project plan', 'JIRA', 'kanban'],
  'Technical Leadership': ['engineering manager', 'tech lead', 'architecture', 'mentoring', 'hiring', 'team lead', 'CTO', 'director of engineering'],
  'Technical Sales': ['solutions architect', 'presales', 'demo', 'technical account', 'developer relations', 'SDK', 'API integration', 'sales engineer'],
  'IT Consulting': ['consulting', 'client engagement', 'IT advisory', 'business analysis', 'requirements gathering'],
  'Business Strategy & Management Consulting': ['strategy consulting', 'management consulting', 'market research', 'change management', 'operations consulting'],
  'Financial Advisory': ['financial advisory', 'M&A', 'mergers acquisitions', 'due diligence', 'risk consulting'],
  'SEO and Content Marketing': ['SEO', 'content strategy', 'social media', 'blog', 'copywriting', 'content marketing', 'inbound'],
  'Brand and Communications Marketing': ['brand management', 'PR', 'public relations', 'press release', 'event marketing'],
  'Growth Marketing': ['growth hacking', 'performance marketing', 'paid ads', 'Google Ads', 'Meta Ads', 'conversion'],
  'Product Marketing': ['product marketing', 'go-to-market', 'GTM', 'positioning', 'messaging'],
  'Lifecycle and Email Marketing': ['email marketing', 'HubSpot', 'Marketo', 'Klaviyo', 'lifecycle', 'CRM marketing', 'drip campaign'],
  'Investment/Financing': ['financial modeling', 'valuation', 'equity research', 'portfolio management', 'asset management', 'trading', 'quant'],
  'Banking': ['banking', 'credit analysis', 'loan', 'commercial bank', 'investment bank'],
  'VC/PE': ['venture capital', 'private equity', 'portfolio company', 'term sheet', 'fundraising', 'LP'],
  'Corporate Finance': ['corporate finance', 'treasury', 'FP&A', 'financial planning'],
  'Insurance': ['underwriting', 'actuarial', 'insurance', 'risk assessment', 'claims'],
  'Product Management': ['product manager', 'roadmap', 'user stories', 'backlog', 'product strategy', 'OKR', 'A/B test', 'PRD'],
  'Healthcare IT': ['EHR', 'EMR', 'HL7', 'FHIR', 'healthcare data', 'HIPAA', 'clinical informatics'],
  'Clinical': ['clinical', 'patient care', 'nursing', 'pharmacy', 'physician', 'medical'],
  'Health Administration': ['healthcare administration', 'medical billing', 'health policy', 'hospital management'],
  'Biotech & Pharma': ['biotech', 'pharma', 'clinical trial', 'regulatory affairs', 'FDA', 'drug discovery'],
  'Hardware & Embedded Systems': ['embedded', 'FPGA', 'PCB', 'firmware', 'microcontroller', 'hardware design', 'RTOS', 'C/C++'],
  'Power & Energy Systems': ['power systems', 'electrical design', 'control systems', 'PLC', 'SCADA'],
  'RF & Communications': ['RF', 'signal processing', 'antenna', 'wireless', 'telecommunications', '5G'],
  'Human Resources': ['HR', 'recruiting', 'talent acquisition', 'performance management', 'HRIS', 'onboarding'],
  'Administration': ['office management', 'executive assistant', 'administrative', 'scheduling', 'coordination'],
  'Legal': ['paralegal', 'contract review', 'compliance', 'legal research', 'litigation', 'corporate law'],
  'B2B Sales': ['B2B', 'SaaS sales', 'enterprise sales', 'account executive', 'SDR', 'BDR', 'quota', 'pipeline'],
  'B2C Sales': ['retail sales', 'inside sales', 'field sales', 'direct sales'],
  'Sales Leadership': ['sales manager', 'VP sales', 'revenue operations', 'RevOps', 'CRO', 'sales strategy'],
  'Manufacturing Engineering': ['manufacturing', 'process engineering', 'quality control', 'lean', 'six sigma', 'production'],
  'Operations': ['plant manager', 'operations management', 'maintenance', 'ERP', 'supply chain ops'],
  'Robotics & Automation': ['robotics', 'automation', 'PLC programming', 'SCADA', 'motion control', 'ROS'],
  'Support': ['customer support', 'customer success', 'technical support', 'help desk', 'Zendesk', 'Intercom'],
  'Customer Experience': ['customer experience', 'CX', 'NPS', 'voice of customer', 'CSAT'],
  'UX/UI Design': ['UX', 'UI', 'Figma', 'user research', 'wireframe', 'prototype', 'design system', 'usability'],
  'Graphic & Visual Design': ['graphic design', 'Illustrator', 'Photoshop', 'brand design', 'motion graphics', 'visual design'],
  'Content & Media': ['video production', 'photography', 'creative director', 'art director', 'content creation'],
  'Supply Chain': ['supply chain', 'procurement', 'demand planning', 'inventory', 'vendor management'],
  'Logistics & Distribution': ['logistics', 'warehouse', 'transportation', 'fleet management', 'import export', 'freight'],
  'Government & Policy': ['policy analysis', 'government', 'public administration', 'legislative', 'federal'],
  'Non-profit': ['nonprofit', 'NGO', 'grants', 'community outreach', 'fundraising'],
  'Defense & Intelligence': ['intelligence analysis', 'clearance', 'defense', 'DoD', 'cybersecurity government'],
  'Law Practice': ['attorney', 'litigation', 'transactional', 'legal counsel', 'bar admission'],
  'Legal Operations': ['legal operations', 'eDiscovery', 'contract management', 'CLM'],
  'Teaching & Instruction': ['teaching', 'curriculum', 'K-12', 'higher education', 'classroom', 'instruction'],
  'EdTech': ['instructional design', 'e-learning', 'LMS', 'SCORM', 'learning experience'],
  'Academic Administration': ['academic advising', 'admissions', 'registrar', 'student affairs'],
  'Public Accounting': ['audit', 'CPA', 'tax', 'assurance', 'public accounting', 'forensic accounting'],
  'Corporate Accounting': ['staff accountant', 'controller', 'accounts payable', 'accounts receivable', 'payroll', 'GAAP'],
  'Real Estate': ['real estate', 'property management', 'leasing', 'real estate analysis', 'CRE'],
  'Architecture & Construction': ['architect', 'structural engineer', 'civil engineering', 'construction management', 'AutoCAD', 'BIM'],
  'Renewable Energy': ['solar', 'wind energy', 'energy storage', 'sustainability', 'clean energy', 'ESG'],
  'Oil & Gas': ['petroleum', 'drilling', 'reservoir', 'upstream', 'geologist', 'oil gas'],
  'Environmental': ['environmental science', 'EHS', 'environmental engineer', 'climate', 'remediation'],
};

const ROLE_IMPLIED_SKILLS: Record<string, string[]> = {
  'Backend Engineer': ['Python', 'Java', 'REST', 'API', 'SQL', 'PostgreSQL', 'Docker'],
  'Full Stack Engineer': ['React', 'Node.js', 'TypeScript', 'REST', 'SQL', 'Docker'],
  'Python Engineer': ['Python', 'Django', 'FastAPI', 'Flask', 'SQL', 'REST'],
  'Java Engineer': ['Java', 'Spring Boot', 'Maven', 'SQL', 'REST'],
  'C/C++ Engineer': ['C++', 'C', 'CMake', 'Linux', 'RTOS'],
  'Golang Engineer': ['Go', 'Golang', 'gRPC', 'REST', 'Docker'],
  'Frontend Software Engineer': ['React', 'TypeScript', 'CSS', 'HTML', 'JavaScript', 'Webpack'],
  'React Developer': ['React', 'TypeScript', 'Redux', 'CSS', 'JavaScript'],
  'Machine Learning Engineer': ['Python', 'PyTorch', 'TensorFlow', 'scikit-learn', 'Jupyter', 'SQL'],
  'AI Engineer': ['Python', 'LLM', 'OpenAI', 'LangChain', 'embeddings', 'PyTorch'],
  'LLM Engineer': ['Python', 'LangChain', 'OpenAI', 'HuggingFace', 'embeddings', 'fine-tuning'],
  'Data Scientist': ['Python', 'R', 'SQL', 'pandas', 'scikit-learn', 'statistics', 'Tableau'],
  'Data Engineer': ['Python', 'SQL', 'Spark', 'Airflow', 'dbt', 'Kafka', 'Hadoop'],
  'Data Analyst': ['SQL', 'Excel', 'Tableau', 'Power BI', 'Python', 'statistics'],
  'DevOps': ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Terraform', 'Linux', 'Jenkins'],
  'Site Reliability Engineer (SRE)': ['Kubernetes', 'AWS', 'Prometheus', 'Grafana', 'Python', 'Go'],
  'Cyber Security Engineer': ['SIEM', 'firewall', 'penetration testing', 'network security', 'vulnerability'],
  'Product Manager': ['roadmap', 'user stories', 'Jira', 'analytics', 'A/B testing', 'PRD'],
  'iOS/Swift Developer': ['Swift', 'Xcode', 'UIKit', 'SwiftUI', 'CocoaPods'],
  'Android Developer': ['Android', 'Kotlin', 'Java', 'Android Studio', 'Jetpack Compose'],
  'UX Designer': ['Figma', 'Sketch', 'user research', 'wireframing', 'prototyping', 'usability testing'],
  'Product Designer': ['Figma', 'design system', 'user research', 'prototyping', 'interaction design'],
};

const INDUSTRY_BROAD_KEYWORDS: Record<string, string[]> = {
  'Software/Internet/AI': ['software', 'engineer', 'developer', 'programming', 'tech', 'AI', 'data', 'cloud', 'web', 'app', 'platform', 'API', 'SaaS'],
  'Consulting': ['consulting', 'consultant', 'advisory', 'strategy', 'management consulting'],
  'Marketing': ['marketing', 'brand', 'SEO', 'content', 'campaign', 'advertising', 'social media', 'growth'],
  'Finance': ['finance', 'investment', 'banking', 'financial', 'analyst', 'trading', 'VC', 'private equity'],
  'Product': ['product manager', 'product management', 'product strategy', 'PM'],
  'Healthcare': ['healthcare', 'medical', 'clinical', 'health', 'biotech', 'pharma', 'hospital', 'patient'],
  'Electrical Engineering': ['electrical', 'embedded', 'hardware', 'FPGA', 'firmware', 'PCB', 'circuit', 'RF'],
  'HR/Admin/Legal': ['human resources', 'HR', 'recruiting', 'talent', 'administrative', 'legal', 'compliance', 'paralegal'],
  'Sales': ['sales', 'account executive', 'business development', 'revenue', 'quota', 'SDR', 'AE'],
  'Production/Manufacturing': ['manufacturing', 'production', 'assembly', 'quality control', 'lean', 'plant', 'factory'],
  'Customer Service': ['customer support', 'customer success', 'helpdesk', 'service desk', 'Zendesk'],
  'Creative & Design': ['design', 'UX', 'UI', 'graphic', 'visual', 'creative', 'Figma', 'illustration', 'video'],
  'Logistics/Supply Chain': ['supply chain', 'logistics', 'procurement', 'warehouse', 'inventory', 'shipping', 'freight'],
  'Public Sector': ['government', 'public sector', 'policy', 'federal', 'non-profit', 'NGO', 'municipal'],
  'Legal Services': ['attorney', 'law', 'legal', 'litigation', 'counsel', 'paralegal', 'bar'],
  'Education': ['education', 'teaching', 'teacher', 'professor', 'curriculum', 'school', 'university', 'academic'],
  'Accounting': ['accounting', 'accountant', 'audit', 'CPA', 'tax', 'bookkeeping', 'controller'],
  'Real Estate/Architecture': ['real estate', 'architecture', 'construction', 'property', 'civil engineering', 'urban planning'],
  'Energy/Environmental': ['energy', 'solar', 'wind', 'environmental', 'sustainability', 'oil gas', 'petroleum', 'ESG', 'climate'],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function toSingleString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  return null;
}
