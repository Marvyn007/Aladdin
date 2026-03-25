export type OnboardingStepId = 1 | 2;

export type OnboardingQuestionType = 'multi_select' | 'single_select' | 'file' | 'text';

export interface OnboardingOption {
  value: string;
  label: string;
  description?: string;
}

export interface OnboardingQuestion {
  key: string;
  step: OnboardingStepId;
  order: number;
  title: string;
  description: string;
  type: OnboardingQuestionType;
  required: boolean;
  rationale: string;
  options?: readonly OnboardingOption[];
  placeholder?: string;
  helperText?: string;
}

export interface OnboardingAnswerRecord {
  questionKey: string;
  step: OnboardingStepId;
  order: number;
  type: OnboardingQuestionType;
  title: string;
  value: unknown;
  answerText: string | null;
  updatedAt?: string | null;
}

const ROLE_AREAS: OnboardingOption[] = [
  { value: 'machine_learning_engineer', label: 'Machine Learning Engineer' },
  { value: 'research_scientist', label: 'Research Scientist' },
  { value: 'software_engineer', label: 'Software Engineer' },
  { value: 'frontend_engineer', label: 'Frontend Engineer' },
  { value: 'backend_engineer', label: 'Backend Engineer' },
  { value: 'full_stack_engineer', label: 'Full-Stack Engineer' },
  { value: 'data_scientist', label: 'Data Scientist' },
  { value: 'data_engineer', label: 'Data Engineer' },
  { value: 'product_manager', label: 'Product Manager' },
  { value: 'product_designer', label: 'Product Designer' },
  { value: 'ux_researcher', label: 'UX Researcher' },
  { value: 'devops_engineer', label: 'DevOps / SRE' },
  { value: 'security_engineer', label: 'Security Engineer' },
  { value: 'mobile_engineer', label: 'Mobile Engineer' },
  { value: 'qa_engineer', label: 'QA / Automation' },
  { value: 'technical_program_manager', label: 'Technical Program Manager' },
  { value: 'solution_architect', label: 'Solution Architect' },
  { value: 'it_support', label: 'IT / Support' },
];

const CAREER_LEVELS: OnboardingOption[] = [
  { value: 'early_career', label: 'Early career (0-2 years)' },
  { value: 'mid_level', label: 'Mid-level (3-5 years)' },
  { value: 'senior_manager', label: 'Senior / Manager (6+ years)' },
  { value: 'executive_leadership', label: 'Executive / Leadership (10+ years)' },
];

const ROLE_TYPES: OnboardingOption[] = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'apprenticeship', label: 'Apprenticeship' },
];

const REGIONS: OnboardingOption[] = [
  { value: 'united_states', label: 'United States' },
  { value: 'canada', label: 'Canada' },
  { value: 'australia', label: 'Australia' },
  { value: 'singapore', label: 'Singapore' },
  { value: 'india', label: 'India' },
  { value: 'china', label: 'China' },
  { value: 'united_kingdom', label: 'United Kingdom' },
  { value: 'ireland', label: 'Ireland' },
  { value: 'europe', label: 'Europe' },
  { value: 'remote_worldwide', label: 'Remote worldwide' },
  { value: 'other', label: 'Other' },
];

const WORK_STYLES: OnboardingOption[] = [
  { value: 'onsite', label: 'Onsite' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'remote', label: 'Remote' },
  { value: 'flexible', label: "Doesn't matter" },
];

const VISA_SUPPORT: OnboardingOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'flexible', label: "Doesn't matter" },
];

const ALERT_FREQUENCY: OnboardingOption[] = [
  { value: 'instant', label: 'Instant alerts' },
  { value: 'daily', label: 'Daily digest' },
  { value: 'weekly', label: 'Weekly digest' },
];

const CHALLENGES: OnboardingOption[] = [
  { value: 'few_openings', label: 'Few suitable openings' },
  { value: 'skills_mismatch', label: 'Skills mismatch' },
  { value: 'interview_performance', label: 'Interview performance' },
  { value: 'salary_negotiations', label: 'Salary negotiations' },
  { value: 'strong_competition', label: 'Strong competition' },
  { value: 'resume_needs_work', label: 'Resume needs work' },
  { value: 'need_referrals', label: 'Need referrals / network' },
  { value: 'visa_constraints', label: 'Visa constraints' },
  { value: 'portfolio_needs_work', label: 'Portfolio needs work' },
];

export const ONBOARDING_QUESTIONS: readonly OnboardingQuestion[] = [
  {
    key: 'work_areas',
    step: 1,
    order: 1,
    title: 'Which role families are you targeting?',
    description: 'Pick the job families that best describe the roles you actually want.',
    type: 'multi_select',
    required: true,
    rationale: 'This gives the matcher a clean career vector instead of a generic keyword cloud.',
    options: ROLE_AREAS,
    helperText: 'You can choose more than one.'
  },
  {
    key: 'career_levels',
    step: 1,
    order: 2,
    title: 'What career levels are you open to?',
    description: 'We will surface jobs that match your current level and any nearby stretch roles.',
    type: 'multi_select',
    required: true,
    rationale: 'Level fit affects which job descriptions, comp bands, and interview loops we recommend.',
    options: CAREER_LEVELS,
    helperText: 'Select all levels that feel realistic.'
  },
  {
    key: 'role_types',
    step: 1,
    order: 3,
    title: 'What kind of role are you open to?',
    description: 'Tell us which employment types should stay in the pool.',
    type: 'multi_select',
    required: true,
    rationale: 'Employment type is a hard filter for many candidates and a common source of dead-end alerts.',
    options: ROLE_TYPES,
    helperText: 'Mix full-time with internship or contract if that is part of your search.'
  },
  {
    key: 'regions',
    step: 1,
    order: 4,
    title: 'Which regions should we prioritize?',
    description: 'Choose the countries or regions where you can realistically interview and work.',
    type: 'multi_select',
    required: true,
    rationale: 'Geography is one of the strongest filters for job relevance and legal eligibility.',
    options: REGIONS,
    helperText: 'Add remote worldwide if you are open to global roles.'
  },
  {
    key: 'work_style',
    step: 1,
    order: 5,
    title: 'How do you want to work?',
    description: 'We will favor the work setting that best matches your day-to-day preference.',
    type: 'single_select',
    required: true,
    rationale: 'Onsite, hybrid, and remote searches behave very differently, so this should be explicit.',
    options: WORK_STYLES,
  },
  {
    key: 'visa_sponsorship',
    step: 2,
    order: 6,
    title: 'Do you need visa sponsorship in any chosen region?',
    description: 'This keeps us from recommending jobs that cannot realistically move forward.',
    type: 'single_select',
    required: true,
    rationale: 'Work authorization is a high-signal constraint and should be treated as a hard filter.',
    options: VISA_SUPPORT,
  },
  {
    key: 'alert_frequency',
    step: 2,
    order: 7,
    title: 'How often should we send job alerts?',
    description: 'Pick the cadence that matches how closely you want to track new opportunities.',
    type: 'single_select',
    required: true,
    rationale: 'Notification cadence influences both engagement and how aggressively we batch new matches.',
    options: ALERT_FREQUENCY,
  },
  {
    key: 'job_search_challenges',
    step: 2,
    order: 8,
    title: 'What is slowing your job search down?',
    description: 'Use this to personalize coaching, ranking, and help content.',
    type: 'multi_select',
    required: true,
    rationale: 'Pain points shape the support layer, not just the matching layer.',
    options: CHALLENGES,
    helperText: 'Select every challenge that feels true.'
  },
  {
    key: 'resume_upload',
    step: 2,
    order: 9,
    title: 'Upload your resume',
    description: 'We will use it to prefill your profile and sharpen recommendations.',
    type: 'file',
    required: false,
    rationale: 'A resume import gives us the fastest path to relevant skills, seniority, and history.',
    helperText: 'PDF files work best.'
  },
  {
    key: 'extra_notes',
    step: 2,
    order: 10,
    title: 'Anything else we should know?',
    description: 'Salary floor, notice period, commute radius, target companies, time zone, or anything unusual.',
    type: 'text',
    required: false,
    rationale: 'A catch-all note helps capture context that does not belong in a rigid option set.',
    placeholder: 'Example: Open to startup or enterprise, need Eastern Time overlap, want at least 2 weeks PTO.',
    helperText: 'This is optional, but it helps a lot.'
  },
  {
    key: 'linkedin_pdf',
    step: 2,
    order: 11,
    title: 'Upload your LinkedIn profile PDF',
    description: 'Optional: upload your LinkedIn profile as a PDF so we can enrich your matches.',
    type: 'file',
    required: false,
    rationale: 'Supplements resume data with LinkedIn work history for better skill inference.',
    helperText: 'PDF only. Click the info icon for download instructions.',
  },
];

export const ONBOARDING_STEP_META: Record<OnboardingStepId, { title: string; subtitle: string }> = {
  1: {
    title: 'About you',
    subtitle: 'The core profile that shapes your job matches.'
  },
  2: {
    title: 'Additional preferences',
    subtitle: 'Constraints, alerting, and a few high-signal extras.'
  }
};

export function getOnboardingQuestion(key: string): OnboardingQuestion | undefined {
  return ONBOARDING_QUESTIONS.find((question) => question.key === key);
}

export function getOnboardingQuestionsByStep(step: OnboardingStepId): OnboardingQuestion[] {
  return ONBOARDING_QUESTIONS.filter((question) => question.step === step).sort((a, b) => a.order - b.order);
}
