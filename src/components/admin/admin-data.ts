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
  resumeLinks: string[];
  linkedinUrl: string | null;
  notes: string;
  joinedAt: string;
  timeSpentHours: number;
  weeklySessions: number;
  weeklyActiveDays: number;
  lastSeenAt: string;
  activityHighlights: string[];
};

export type AdminJobRecord = {
  id: string;
  title: string;
  company: string;
  source: string;
  discoveredFrom: string;
  location: string;
  postedAt: string;
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
  notHelpfulVotes: number;
  reportCount: number;
  reviewState: "Approved" | "Needs Review" | "Escalated";
  reviewer: string;
  submittedAt: string;
  postedBy: string;
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
    resumeLinks: ["https://drive.google.com/file/d/mock-resume-marvin-v3", "https://drive.google.com/file/d/mock-resume-marvin-v2"],
    linkedinUrl: "https://linkedin.com/in/marvinchaudhary",
    notes: "Power user. Actively applying to FAANG-adjacent roles. Good candidate for a Premium upsell case study.",
    joinedAt: "Jan 12, 2025",
    timeSpentHours: 18.6,
    weeklySessions: 14,
    weeklyActiveDays: 6,
    lastSeenAt: "Today, 9:42 PM",
    activityHighlights: ["Resume editor 6h 20m", "Job tracker 4h 10m", "Cover letters 2h 35m", "Practice prep 1h 50m"],
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
    resumeLinks: ["https://drive.google.com/file/d/mock-resume-sarah-v2"],
    linkedinUrl: "https://linkedin.com/in/sarahjohnson-eng",
    notes: "Consistent applicant. High ATS match rates. Referred two friends - potential advocate.",
    joinedAt: "Feb 3, 2025",
    timeSpentHours: 12.4,
    weeklySessions: 10,
    weeklyActiveDays: 5,
    lastSeenAt: "Today, 3:14 PM",
    activityHighlights: ["Resume editor 3h 45m", "Saved jobs 2h 15m", "Applications 1h 50m", "Interview prep 1h 5m"],
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
    resumeLinks: ["https://drive.google.com/file/d/mock-resume-mike-v1"],
    linkedinUrl: null,
    notes: "Skipped preference setup. May need onboarding nudge. Check if email bounce.",
    joinedAt: "Mar 5, 2025",
    timeSpentHours: 3.1,
    weeklySessions: 3,
    weeklyActiveDays: 2,
    lastSeenAt: "6 days ago, 11:08 AM",
    activityHighlights: ["Job search 1h 20m", "Profile setup 28m", "Resume upload 12m"],
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
    resumeLinks: [],
    linkedinUrl: "https://linkedin.com/in/emilydavis-swe",
    notes: "No resume yet despite 1 day activity. High intent signal from browsing. Priority nudge candidate.",
    joinedAt: "Mar 28, 2025",
    timeSpentHours: 2.2,
    weeklySessions: 4,
    weeklyActiveDays: 2,
    lastSeenAt: "Yesterday, 8:11 PM",
    activityHighlights: ["Job browsing 1h 5m", "Onboarding 24m", "Profile edit 18m"],
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
    resumeLinks: ["https://drive.google.com/file/d/mock-resume-james-v3", "https://drive.google.com/file/d/mock-resume-james-v1"],
    linkedinUrl: "https://linkedin.com/in/jameswilson-backend",
    notes: "Premium but dormant. Had high activity burst in Jan. Worth a re-engagement email.",
    joinedAt: "Nov 19, 2024",
    timeSpentHours: 8.7,
    weeklySessions: 2,
    weeklyActiveDays: 1,
    lastSeenAt: "12 days ago, 2:40 PM",
    activityHighlights: ["Resume editor 2h 10m", "Applications 1h 55m", "Saved jobs 48m"],
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
    resumeLinks: ["https://drive.google.com/file/d/mock-resume-olivia-v1"],
    linkedinUrl: null,
    notes: "Free tier but surprisingly active. Good upgrade candidate - surface a Pro trial.",
    joinedAt: "Mar 30, 2025",
    timeSpentHours: 4.9,
    weeklySessions: 6,
    weeklyActiveDays: 4,
    lastSeenAt: "Today, 7:03 PM",
    activityHighlights: ["Job search 2h 10m", "Practice prep 54m", "Applications 31m"],
  },
];

export const adminJobs: AdminJobRecord[] = [
  {
    id: "j_301",
    title: "Frontend Engineer",
    company: "Stripe",
    source: "Greenhouse",
    discoveredFrom: "Stripe careers API",
    location: "Remote",
    postedAt: "Apr 1, 2026",
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
    discoveredFrom: "Ramp jobs sync",
    location: "New York, NY",
    postedAt: "Mar 30, 2026",
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
    discoveredFrom: "Notion ATS poller",
    location: "San Francisco, CA",
    postedAt: "Mar 28, 2026",
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
    discoveredFrom: "Workday importer",
    location: "Remote",
    postedAt: "Mar 22, 2026",
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
    discoveredFrom: "Lever ingest",
    location: "Hybrid",
    postedAt: "Apr 2, 2026",
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
    notHelpfulVotes: 8,
    reportCount: 1,
    reviewState: "Approved",
    reviewer: "Jamie",
    submittedAt: "Mar 24",
    postedBy: "Sarah Johnson",
    summary: "Strong candidate prep notes with clear rubric references.",
  },
  {
    id: "i_38",
    title: "Meta Product Infra Loop",
    company: "Meta",
    usefulVotes: 86,
    notHelpfulVotes: 14,
    reportCount: 4,
    reviewState: "Needs Review",
    reviewer: "Avery",
    submittedAt: "Mar 22",
    postedBy: "Mike Chen",
    summary: "Useful detail, but some compensation claims need verification.",
  },
  {
    id: "i_35",
    title: "Stripe Backend Onsite",
    company: "Stripe",
    usefulVotes: 152,
    notHelpfulVotes: 21,
    reportCount: 7,
    reviewState: "Escalated",
    reviewer: "Morgan",
    submittedAt: "Mar 20",
    postedBy: "James Wilson",
    summary: "High engagement, but flagged for interview leakage concerns.",
  },
  {
    id: "i_29",
    title: "Datadog New Grad OA",
    company: "Datadog",
    usefulVotes: 64,
    notHelpfulVotes: 5,
    reportCount: 0,
    reviewState: "Approved",
    reviewer: "Jamie",
    submittedAt: "Mar 18",
    postedBy: "Olivia Martin",
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

