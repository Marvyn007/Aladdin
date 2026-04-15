export type OnboardingStepId = 1 | 2 | 3;

export type OnboardingQuestionType = 'multi_select' | 'single_select' | 'file' | 'text' | 'job_function';

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

// ─── Job Function Taxonomy ────────────────────────────────────────────────────

export interface JobFunctionValue {
  industries: string[]
  subcategories: string[]
  roles: string[]
}

export interface JobFunctionSubcategory {
  label: string
  roles: string[]
}

export interface JobFunctionCategory {
  industry: string
  subcategories: JobFunctionSubcategory[]
}

export const JOB_FUNCTION_TAXONOMY: JobFunctionCategory[] = [
  {
    industry: 'Software/Internet/AI',
    subcategories: [
      { label: 'Backend Engineering', roles: ['Backend Engineer', 'Full Stack Engineer', 'Python Engineer', 'Java Engineer', 'C/C++ Engineer', '.Net Engineer', 'Golang Engineer', 'Salesforce Developer', 'Blockchain Engineer'] },
      { label: 'Data & Analytics', roles: ['Data Analyst', 'Data Scientist', 'Data Engineer', 'Business/BI Analyst', 'Power BI Developer', 'ETL Developer', 'Data Warehouse Engineer'] },
      { label: 'Machine Learning & AI', roles: ['Machine Learning Engineer', 'AI Engineer', 'Machine Learning/AI Researcher', 'Machine Learning - Deep Learning', 'LLM Engineer', 'Machine Learning - Model Training and Inference', 'Machine Learning - Computer Vision', 'Machine Learning - Operations (ML Ops)', 'Machine Learning - Search System', 'Machine Learning - Infrastructure', 'Data Annotation/AI Tutor', 'Machine Learning - Ads'] },
      { label: 'Frontend/Mobile/Game', roles: ['Frontend Software Engineer', 'React Developer', 'UI/UX Developer', 'Android Developer', 'Game Developer', 'iOS/Swift Developer', 'Flutter Developer', 'Unity Developer', 'Unreal Engine Developer', 'AR/VR Developer'] },
      { label: 'System Reliability & Security', roles: ['DevOps', 'Cyber Security Analyst', 'Cyber Security Engineer', 'Cloud Security Engineer', 'Systems Engineer', 'Network Security Engineer', 'Network Engineer', 'Site Reliability Engineer (SRE)', 'SoC Analyst'] },
      { label: 'Technical Support', roles: ['IT Support Specialist', 'Help Desk Technician/Desktop Support Technician', 'Database Administrator', 'System Administrator', 'Network Support Specialist', 'Salesforce Administrator'] },
      { label: 'Testing', roles: ['Software Testing/Quality Assurance Engineer', 'Automation Test Engineer', 'QA Manager'] },
      { label: 'Project Management', roles: ['Project/Program Manager', 'Technical Project Manager', 'Scrum Master'] },
      { label: 'Technical Leadership', roles: ['Engineering Manager', 'Software Architect', 'Engineering Director/VP', 'CTO'] },
      { label: 'Technical Sales', roles: ['Solutions Architect/Forward Deployed Engineer', 'Sales Engineer', 'Technical Writing', 'Developer Relations', 'Technical Account Manager'] },
    ],
  },
  {
    industry: 'Consulting',
    subcategories: [
      { label: 'IT Consulting', roles: ['Business Analyst', 'Data Consultant', 'IT Consultant', 'Cyber Security Consultant'] },
      { label: 'Business Strategy & Management Consulting', roles: ['Business Strategy Consultant', 'Market Research Analyst', 'Operations Consultant', 'Change Management Consultant'] },
      { label: 'Financial Advisory', roles: ['Financial Consultant', 'Risk Management Consultant', 'Mergers & Acquisitions (M&A) Consultant'] },
    ],
  },
  {
    industry: 'Marketing',
    subcategories: [
      { label: 'SEO and Content Marketing', roles: ['Content Marketing/Strategy', 'Social Media Management', 'SEO', 'Copywriter'] },
      { label: 'Brand and Communications Marketing', roles: ['Brand Manager', 'Public Relations', 'Event Marketing Specialist', 'Community Manager'] },
      { label: 'Growth Marketing', roles: ['Growth Marketing', 'Performance Marketing', 'Advertising Specialist'] },
      { label: 'Product Marketing', roles: ['Product Marketing'] },
      { label: 'Lifecycle and Email Marketing', roles: ['Email Marketing', 'Lifecycle Marketing'] },
    ],
  },
  {
    industry: 'Finance',
    subcategories: [
      { label: 'Investment/Financing', roles: ['Financial Analyst', 'Risk Analyst', 'Quantitative Analyst/Researcher', 'Equity Analyst', 'Portfolio Manager', 'Asset Manager', 'Investment Manager', 'Securities Trader'] },
      { label: 'Banking', roles: ['Credit Analyst', 'Investment Banker', 'Commercial Banker', 'Loan Officer'] },
      { label: 'VC/PE', roles: ['Investment Analyst/Associate', 'Portfolio Operations Manager', 'Investor Relations Manager', 'Investment Director/VP', 'Investment Partner', 'Fundraising Manager'] },
      { label: 'Corporate Finance', roles: ['Corporate Finance Analyst', 'Treasury'] },
      { label: 'Insurance', roles: ['Underwriter', 'Actuary'] },
    ],
  },
  {
    industry: 'Product',
    subcategories: [
      { label: 'Product Management', roles: ['Product Manager', 'Product Analyst', 'Technical Product Manager', 'AI Product Manager', 'Product Manager - B2B/SaaS', 'Product Manager - Consumer Software', 'Product Manager - Hardware/Robotics/IoT', 'Game Designer'] },
    ],
  },
  {
    industry: 'Healthcare',
    subcategories: [
      { label: 'Healthcare IT', roles: ['Healthcare Data Analyst', 'Healthcare Data Scientist', 'Healthcare IT Specialist', 'EHR System Administrator'] },
      { label: 'Clinical', roles: ['Clinical Research Associate', 'Pharmacist', 'Nurse', 'Physician', 'Medical Laboratory Technician'] },
      { label: 'Health Administration', roles: ['Health Administrator', 'Medical Billing Specialist', 'Health Policy Analyst'] },
      { label: 'Biotech & Pharma', roles: ['Biotech Researcher', 'Regulatory Affairs Specialist', 'Drug Safety Associate', 'Clinical Data Manager'] },
    ],
  },
  {
    industry: 'Electrical Engineering',
    subcategories: [
      { label: 'Hardware & Embedded Systems', roles: ['Hardware Engineer', 'Embedded Systems Engineer', 'FPGA Engineer', 'PCB Designer', 'Firmware Engineer'] },
      { label: 'Power & Energy Systems', roles: ['Power Systems Engineer', 'Electrical Design Engineer', 'Control Systems Engineer'] },
      { label: 'RF & Communications', roles: ['RF Engineer', 'Signal Processing Engineer', 'Antenna Engineer'] },
    ],
  },
  {
    industry: 'HR/Admin/Legal',
    subcategories: [
      { label: 'Human Resources', roles: ['HR Generalist', 'Recruiter', 'HR Business Partner', 'Compensation & Benefits Specialist', 'Talent Acquisition Manager'] },
      { label: 'Administration', roles: ['Office Manager', 'Executive Assistant', 'Operations Coordinator', 'Administrative Assistant'] },
      { label: 'Legal', roles: ['Paralegal', 'Corporate Attorney', 'Contract Manager', 'Compliance Officer', 'Legal Analyst'] },
    ],
  },
  {
    industry: 'Sales',
    subcategories: [
      { label: 'B2B Sales', roles: ['Account Executive', 'Sales Development Representative (SDR)', 'Business Development Manager', 'Enterprise Account Manager', 'Channel Sales Manager'] },
      { label: 'B2C Sales', roles: ['Retail Sales Associate', 'Inside Sales Representative', 'Field Sales Representative'] },
      { label: 'Sales Leadership', roles: ['Sales Manager', 'VP of Sales', 'Chief Revenue Officer (CRO)', 'Revenue Operations Manager'] },
    ],
  },
  {
    industry: 'Production/Manufacturing',
    subcategories: [
      { label: 'Manufacturing Engineering', roles: ['Manufacturing Engineer', 'Process Engineer', 'Quality Engineer', 'Industrial Engineer', 'Production Planner'] },
      { label: 'Operations', roles: ['Plant Manager', 'Operations Manager', 'Maintenance Technician', 'Lean/Six Sigma Specialist'] },
      { label: 'Robotics & Automation', roles: ['Robotics Engineer', 'Automation Engineer', 'Controls Engineer', 'PLC Programmer'] },
    ],
  },
  {
    industry: 'Customer Service',
    subcategories: [
      { label: 'Support', roles: ['Customer Support Specialist', 'Customer Success Manager', 'Technical Support Engineer', 'Support Team Lead'] },
      { label: 'Customer Experience', roles: ['Customer Experience Manager', 'CX Analyst', 'Voice of Customer Specialist'] },
    ],
  },
  {
    industry: 'Creative & Design',
    subcategories: [
      { label: 'UX/UI Design', roles: ['UX Designer', 'UI Designer', 'Product Designer', 'Interaction Designer', 'UX Researcher'] },
      { label: 'Graphic & Visual Design', roles: ['Graphic Designer', 'Visual Designer', 'Motion Designer', 'Illustrator', 'Brand Designer'] },
      { label: 'Content & Media', roles: ['Video Producer', 'Photographer', 'Content Creator', 'Creative Director', 'Art Director'] },
    ],
  },
  {
    industry: 'Logistics/Supply Chain',
    subcategories: [
      { label: 'Supply Chain', roles: ['Supply Chain Analyst', 'Supply Chain Manager', 'Procurement Specialist', 'Inventory Manager', 'Demand Planner'] },
      { label: 'Logistics & Distribution', roles: ['Logistics Coordinator', 'Warehouse Manager', 'Transportation Manager', 'Fleet Manager', 'Import/Export Specialist'] },
    ],
  },
  {
    industry: 'Public Sector',
    subcategories: [
      { label: 'Government & Policy', roles: ['Policy Analyst', 'Government Program Manager', 'Public Affairs Specialist', 'Legislative Assistant'] },
      { label: 'Non-profit', roles: ['Program Director', 'Grants Manager', 'Community Outreach Coordinator', 'Development Officer'] },
      { label: 'Defense & Intelligence', roles: ['Intelligence Analyst', 'Defense Contractor', 'Cybersecurity Analyst (Government)'] },
    ],
  },
  {
    industry: 'Legal Services',
    subcategories: [
      { label: 'Law Practice', roles: ['Associate Attorney', 'Partner', 'Litigation Attorney', 'Transactional Attorney', 'IP Attorney'] },
      { label: 'Legal Operations', roles: ['Legal Operations Analyst', 'eDiscovery Specialist', 'Contract Administrator'] },
    ],
  },
  {
    industry: 'Education',
    subcategories: [
      { label: 'Teaching & Instruction', roles: ['Teacher', 'Professor', 'Instructor', 'Curriculum Developer', 'Special Education Teacher'] },
      { label: 'EdTech', roles: ['Instructional Designer', 'Learning Experience Designer', 'EdTech Product Manager', 'E-Learning Developer'] },
      { label: 'Academic Administration', roles: ['Academic Advisor', 'Admissions Officer', 'Registrar', 'Dean of Students'] },
    ],
  },
  {
    industry: 'Accounting',
    subcategories: [
      { label: 'Public Accounting', roles: ['Auditor', 'Tax Accountant', 'CPA', 'Forensic Accountant'] },
      { label: 'Corporate Accounting', roles: ['Staff Accountant', 'Controller', 'CFO', 'Accounts Payable/Receivable Specialist', 'Payroll Specialist'] },
    ],
  },
  {
    industry: 'Real Estate/Architecture',
    subcategories: [
      { label: 'Real Estate', roles: ['Real Estate Agent', 'Property Manager', 'Real Estate Analyst', 'Real Estate Developer', 'Leasing Consultant'] },
      { label: 'Architecture & Construction', roles: ['Architect', 'Civil Engineer', 'Structural Engineer', 'Construction Manager', 'Interior Designer'] },
    ],
  },
  {
    industry: 'Energy/Environmental',
    subcategories: [
      { label: 'Renewable Energy', roles: ['Solar Engineer', 'Wind Energy Technician', 'Energy Storage Engineer', 'Sustainability Manager'] },
      { label: 'Oil & Gas', roles: ['Petroleum Engineer', 'Geologist', 'Drilling Engineer', 'Reservoir Engineer'] },
      { label: 'Environmental', roles: ['Environmental Scientist', 'Environmental Engineer', 'EHS Specialist', 'Climate Policy Analyst'] },
    ],
  },
]

// ─── Static constants ─────────────────────────────────────────────────────────

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
    key: 'job_function',
    step: 1,
    order: 1,
    title: 'Job function',
    description: '',
    type: 'job_function',
    required: true,
    rationale: 'Structured taxonomy selection gives precise scoring signals across industry, subcategory, and role title.',
  },
  {
    key: 'career_levels',
    step: 1,
    order: 2,
    title: 'Career level',
    description: '',
    type: 'multi_select',
    required: true,
    rationale: 'Level fit affects which job descriptions, comp bands, and interview loops we recommend.',
    options: CAREER_LEVELS,
  },
  {
    key: 'role_types',
    step: 1,
    order: 3,
    title: 'Open for',
    description: '',
    type: 'multi_select',
    required: true,
    rationale: 'Employment type is a hard filter for many candidates and a common source of dead-end alerts.',
    options: ROLE_TYPES,
  },
  {
    key: 'regions',
    step: 1,
    order: 4,
    title: 'Regions',
    description: '',
    type: 'multi_select',
    required: true,
    rationale: 'Geography is one of the strongest filters for job relevance and legal eligibility.',
    options: REGIONS,
  },
  {
    key: 'work_style',
    step: 1,
    order: 5,
    title: 'Work setting',
    description: '',
    type: 'single_select',
    required: true,
    rationale: 'Onsite, hybrid, and remote searches behave very differently, so this should be explicit.',
    options: WORK_STYLES,
  },
  {
    key: 'visa_sponsorship',
    step: 1,
    order: 6,
    title: 'Visa sponsorship / H1B',
    description: '',
    type: 'single_select',
    required: true,
    rationale: 'Work authorization is a high-signal constraint and should be treated as a hard filter.',
    options: VISA_SUPPORT,
  },
  {
    key: 'resume_upload',
    step: 2,
    order: 9,
    title: 'Upload your resume',
    description: '',
    type: 'file',
    required: false,
    rationale: 'A resume import gives us the fastest path to relevant skills, seniority, and history.',
  },
  {
    key: 'linkedin_pdf',
    step: 2,
    order: 11,
    title: 'Upload your LinkedIn profile PDF',
    description: '',
    type: 'file',
    required: false,
    rationale: 'Supplements resume data with LinkedIn work history for better skill inference.',
  },
];

export const ONBOARDING_STEP_META: Record<OnboardingStepId, { title: string; subtitle: string }> = {
  1: {
    title: 'About you',
    subtitle: 'The core profile that shapes your job matches.'
  },
  2: {
    title: 'Uploads',
    subtitle: 'Resume + optional LinkedIn for sharper matching.'
  },
  3: {
    title: 'Additional preferences',
    subtitle: 'Constraints, alerting, and a few high-signal extras.'
  },
};

export function getOnboardingQuestion(key: string): OnboardingQuestion | undefined {
  return ONBOARDING_QUESTIONS.find((question) => question.key === key);
}

export function getOnboardingQuestionsByStep(
  step: OnboardingStepId,
  opts?: { excludeKeys?: readonly string[] }
): OnboardingQuestion[] {
  const exclude = new Set(opts?.excludeKeys ?? []);
  return ONBOARDING_QUESTIONS
    .filter((question) => question.step === step && !exclude.has(question.key))
    .sort((a, b) => a.order - b.order);
}
