export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  plan: "Free" | "Pro" | "Premium";
  segment: "New" | "Power" | "At Risk" | "Dormant";
  onboarding: "Complete" | "Missing Resume" | "Needs Preferences";
  resumes: number;
  applications: number;
  coverLetters: number;
  interviews: number;
  lastActive: string;
  consent: "Full" | "Limited";
  healthScore: number;
  focus: string;
};

export type AdminJobRecord = {
  id: string;
  title: string;
  company: string;
  source: string;
  location: string;
  qualityScore: number;
  applications: number;
  resumeRuns: number;
  coverLetters: number;
  saves: number;
  status: "Healthy" | "Review" | "Stale";
  owner: string;
};

export type AdminInterviewRecord = {
  id: string;
  title: string;
  company: string;
  usefulVotes: number;
  reportCount: number;
  reviewState: "Approved" | "Needs Review" | "Escalated";
  reviewer: string;
  submittedAt: string;
  summary: string;
};

export const adminUsers: AdminUserRecord[] = [
  {
    id: "u_104",
    name: "Marvin Chaudhary",
    email: "marvin@example.com",
    plan: "Premium",
    segment: "Power",
    onboarding: "Complete",
    resumes: 6,
    applications: 28,
    coverLetters: 19,
    interviews: 5,
    lastActive: "2 hours ago",
    consent: "Full",
    healthScore: 94,
    focus: "Full-stack roles",
  },
  {
    id: "u_118",
    name: "Sarah Johnson",
    email: "sarah@example.com",
    plan: "Pro",
    segment: "Power",
    onboarding: "Complete",
    resumes: 4,
    applications: 17,
    coverLetters: 9,
    interviews: 3,
    lastActive: "Today",
    consent: "Full",
    healthScore: 88,
    focus: "Platform engineering",
  },
  {
    id: "u_093",
    name: "Mike Chen",
    email: "mike@example.com",
    plan: "Free",
    segment: "At Risk",
    onboarding: "Needs Preferences",
    resumes: 1,
    applications: 4,
    coverLetters: 1,
    interviews: 0,
    lastActive: "6 days ago",
    consent: "Limited",
    healthScore: 42,
    focus: "Frontend roles",
  },
  {
    id: "u_122",
    name: "Emily Davis",
    email: "emily@example.com",
    plan: "Pro",
    segment: "New",
    onboarding: "Missing Resume",
    resumes: 0,
    applications: 0,
    coverLetters: 0,
    interviews: 0,
    lastActive: "1 day ago",
    consent: "Full",
    healthScore: 57,
    focus: "Data-adjacent SWE",
  },
  {
    id: "u_135",
    name: "James Wilson",
    email: "james@example.com",
    plan: "Premium",
    segment: "Dormant",
    onboarding: "Complete",
    resumes: 7,
    applications: 11,
    coverLetters: 6,
    interviews: 2,
    lastActive: "12 days ago",
    consent: "Full",
    healthScore: 51,
    focus: "Backend roles",
  },
  {
    id: "u_141",
    name: "Olivia Martin",
    email: "olivia@example.com",
    plan: "Free",
    segment: "New",
    onboarding: "Complete",
    resumes: 2,
    applications: 3,
    coverLetters: 2,
    interviews: 1,
    lastActive: "5 hours ago",
    consent: "Limited",
    healthScore: 73,
    focus: "New-grad programs",
  },
];

export const adminJobs: AdminJobRecord[] = [
  {
    id: "j_301",
    title: "Frontend Engineer",
    company: "Stripe",
    source: "Greenhouse",
    location: "Remote",
    qualityScore: 93,
    applications: 56,
    resumeRuns: 44,
    coverLetters: 31,
    saves: 81,
    status: "Healthy",
    owner: "Growth ops",
  },
  {
    id: "j_287",
    title: "Backend Developer",
    company: "Ramp",
    source: "Lever",
    location: "New York, NY",
    qualityScore: 88,
    applications: 34,
    resumeRuns: 21,
    coverLetters: 14,
    saves: 53,
    status: "Healthy",
    owner: "Matching",
  },
  {
    id: "j_244",
    title: "Platform Engineer",
    company: "Notion",
    source: "Greenhouse",
    location: "San Francisco, CA",
    qualityScore: 61,
    applications: 19,
    resumeRuns: 12,
    coverLetters: 9,
    saves: 27,
    status: "Review",
    owner: "Moderation",
  },
  {
    id: "j_199",
    title: "Software Engineer I",
    company: "Mercury",
    source: "Workday",
    location: "Remote",
    qualityScore: 48,
    applications: 11,
    resumeRuns: 5,
    coverLetters: 2,
    saves: 14,
    status: "Stale",
    owner: "Sourcing",
  },
  {
    id: "j_173",
    title: "Full Stack Engineer",
    company: "Vercel",
    source: "Lever",
    location: "Hybrid",
    qualityScore: 90,
    applications: 39,
    resumeRuns: 24,
    coverLetters: 17,
    saves: 62,
    status: "Healthy",
    owner: "Growth ops",
  },
];

export const adminInterviews: AdminInterviewRecord[] = [
  {
    id: "i_41",
    title: "Google SWE Phone Screen",
    company: "Google",
    usefulVotes: 120,
    reportCount: 1,
    reviewState: "Approved",
    reviewer: "Jamie",
    submittedAt: "Mar 24",
    summary: "Strong candidate prep notes with clear rubric references.",
  },
  {
    id: "i_38",
    title: "Meta Product Infra Loop",
    company: "Meta",
    usefulVotes: 86,
    reportCount: 4,
    reviewState: "Needs Review",
    reviewer: "Avery",
    submittedAt: "Mar 22",
    summary: "Useful detail, but some compensation claims need verification.",
  },
  {
    id: "i_35",
    title: "Stripe Backend Onsite",
    company: "Stripe",
    usefulVotes: 152,
    reportCount: 7,
    reviewState: "Escalated",
    reviewer: "Morgan",
    submittedAt: "Mar 20",
    summary: "High engagement, but flagged for interview leakage concerns.",
  },
  {
    id: "i_29",
    title: "Datadog New Grad OA",
    company: "Datadog",
    usefulVotes: 64,
    reportCount: 0,
    reviewState: "Approved",
    reviewer: "Jamie",
    submittedAt: "Mar 18",
    summary: "Compact, structured, and aligned with user voting patterns.",
  },
];

export const growthSeries = [
  { week: "W1", activeUsers: 128, resumes: 74, applications: 41 },
  { week: "W2", activeUsers: 146, resumes: 88, applications: 52 },
  { week: "W3", activeUsers: 167, resumes: 103, applications: 63 },
  { week: "W4", activeUsers: 181, resumes: 111, applications: 70 },
  { week: "W5", activeUsers: 194, resumes: 122, applications: 81 },
  { week: "W6", activeUsers: 214, resumes: 135, applications: 95 },
  { week: "W7", activeUsers: 226, resumes: 141, applications: 102 },
  { week: "W8", activeUsers: 240, resumes: 156, applications: 114 },
];

export const adminSignals = [
  {
    title: "Preference gaps detected",
    detail: "12 new users skipped compensation, commute, or seniority preferences this week.",
    tone: "Watch activation",
  },
  {
    title: "Resume generation uptrend",
    detail: "Tailored resume runs are up 23% after the latest onboarding refinements.",
    tone: "Promote template A",
  },
  {
    title: "Source quality drift",
    detail: "Workday listings are trending lower on fit score and freshness.",
    tone: "Tighten ingest rules",
  },
];

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
