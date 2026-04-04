export type AdminUserSegment = 'New' | 'Power' | 'At Risk' | 'Dormant'

export interface AdminChartPoint {
  date: string
  count: number
}

export interface AdminWeeklyChartPoint {
  week: string
  count: number
}

export interface AdminDashboardStats {
  totalUsers: number
  totalJobs: number
  totalReviews: number
  totalResumesGenerated: number
  newThisWeek: number
  dormantCount: number
  avgHealthScore: number | null
  dailySignups: AdminChartPoint[]
  weeklySignups: AdminWeeklyChartPoint[]
}

export interface AdminUserResumeLink {
  id: string
  filename: string
  createdAt: string | null
  isDefault: boolean
  previewUrl: string
  downloadUrl: string
}

export interface AdminLinkedInDocumentLink {
  id: string
  filename: string
  createdAt: string | null
  previewUrl: string
}

export interface AdminUserActivityHeatmapCell {
  date: string
  count: number
  intensity: 0 | 1 | 2 | 3 | 4
}

export interface AdminUserOnboardingAnswer {
  id: string
  stepKey: string
  questionLabel: string
  answer: string
  updatedAt: string | null
}

export interface AdminUserSummary {
  id: string
  name: string
  email: string
  accessRole: string
  avatarUrl: string | null
  joinedAt: string | null
  joinedLabel: string
  lastActiveAt: string | null
  lastActiveLabel: string
  onboardingStatus: string
  segment: AdminUserSegment
  healthScore: number
  dbProfileExists: boolean
  applications: number
  resumes: number
  tailoredResumes: number
  coverLetters: number
  interviews: number
  searches7d: number
  interactions7d: number
  activeDays7d: number
  defaultResume: AdminUserResumeLink | null
}

export interface AdminUserActivityItem {
  id: string
  label: string
  detail: string
  timestamp: string | null
  timestampLabel: string
  type:
    | 'application'
    | 'resume'
    | 'tailored-resume'
    | 'cover-letter'
    | 'search'
    | 'interaction'
    | 'interview'
    | 'profile'
}

export interface AdminUserDetail extends AdminUserSummary {
  firstName: string | null
  lastName: string | null
  lastSignInAt: string | null
  lastSignInLabel: string
  onboardingCurrentStep: number | null
  onboardingStartedAt: string | null
  onboardingCompletedAt: string | null
  searches30d: number
  interactions30d: number
  applications7d: number
  coverLetters7d: number
  interviews7d: number
  freshJobLimit: number | null
  excludedKeywords: string[]
  onboardingAnswersCount: number
  currentStreak: number
  longestStreak: number
  activeDays30d: number
  activeDays90d: number
  documentsCount: number
  activityHeatmap: AdminUserActivityHeatmapCell[]
  linkedInProfiles: AdminLinkedInDocumentLink[]
  onboardingAnswers: AdminUserOnboardingAnswer[]
  resumesList: AdminUserResumeLink[]
  recentActivity: AdminUserActivityItem[]
}

export interface AdminUsersResponse {
  users: AdminUserSummary[]
}

export interface AdminUserResponse {
  user: AdminUserDetail
}

export interface AdminJobSummary {
  id: string
  title: string
  company: string
  location: string
  postedAt: string | null
  postedLabel: string
  source: string
  discoveredFrom: string
  sourceUrl: string
  status: string
  applications: number
  resumeGenerations: number
  coverLetters: number
  saves: number
  postedByName: string | null
  descriptionLength: number
  adminCurationStatus: string
}

export interface AdminJobsResponse {
  jobs: AdminJobSummary[]
}

export interface AdminInterviewSummary {
  id: string
  title: string
  company: string
  location: string
  postedByName: string
  postedAt: string
  postedLabel: string
  helpfulYes: number | null
  helpfulNo: number | null
  helpfulTracked: boolean
  status: string
  isFlagged: boolean
  moderationNotes: string | null
  lastEditedByName: string | null
}

export interface AdminInterviewsResponse {
  interviews: AdminInterviewSummary[]
}

export interface AdminCompanySummary {
  id: string
  name: string
  domain: string | null
  logoUrl: string | null
  logoFetched: boolean
  jobCount: number
  updatedAt: string | null
}

export interface AdminCompanyDetail extends AdminCompanySummary {
  hasPracticeQuestions: boolean
  createdAt: string | null
}

export interface AdminCompaniesResponse {
  companies: AdminCompanySummary[]
}

export interface AdminCompanyResponse {
  company: AdminCompanyDetail
}
