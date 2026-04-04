export interface TourStep {
  id: string;
  dataId: string;
  text: string;
  aladdinSide: 'left' | 'right';
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'search',
    dataId: 'tour-search',
    text: 'Start here! Use keyword search to find jobs by title, company, or skill. Try searching "Frontend Engineer" or "Python Intern" — Aladdin fetches matching jobs instantly.',
    aladdinSide: 'left',
  },
  {
    id: 'import-job',
    dataId: 'tour-import-job',
    text: "Can't find a job in the list? Import it yourself! Paste the company's actual job page URL for automatic import, or fill in the details manually. Note: use the company's job page link — not a LinkedIn or Indeed link.",
    aladdinSide: 'left',
  },
  {
    id: 'resume-section',
    dataId: 'tour-resume-section',
    text: "Upload your resume here and mark one as Default — that's what Aladdin uses to tailor your applications. You can also upload one LinkedIn profile PDF to boost your job matches.",
    aladdinSide: 'left',
  },
  {
    id: 'job-listings',
    dataId: 'tour-job-listings',
    text: 'This is where all your jobs live. Click any job card to unlock powerful features: generate a tailored resume in seconds and craft a state-of-the-art cover letter with AI.',
    aladdinSide: 'right',
  },
  {
    id: 'tracker-tab',
    dataId: 'tour-tracker-tab',
    text: "Track every job you've applied to here. Applying to jobs builds your streak! Check your profile (bottom-left) to see your streak, daily apply counts, and an activity heatmap.",
    aladdinSide: 'left',
  },
  {
    id: 'map-tab',
    dataId: 'tour-map-tab',
    text: 'Visualize where jobs are located on an interactive map — perfect for filtering by city or region and finding roles near you.',
    aladdinSide: 'left',
  },
  {
    id: 'interviews-tab',
    dataId: 'tour-interviews-tab',
    text: 'Read real interview experiences shared by other users. Know exactly what to expect before you walk into your next interview.',
    aladdinSide: 'left',
  },
  {
    id: 'practice-tab',
    dataId: 'tour-practice-tab',
    text: 'Practice company-specific coding questions before your interview. Designed for Computer Science and similar majors — level up your coding game and walk in prepared!',
    aladdinSide: 'left',
  },
];
