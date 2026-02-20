import { NextResponse } from 'next/server';
import { generateEnhancedTailoredResume } from '@/lib/enhanced-tailored-resume-service';
import { renderResumeHtml } from '@/lib/resume-templates';

export const runtime = 'nodejs';

// Sample Job Description (Frontend focus)
const SAMPLE_JOB_DESCRIPTION = `
Senior Frontend Engineer

We are looking for a Senior Frontend Engineer to join our team.
Required Skills:
- Deep experience with React, Next.js, and TypeScript.
- Proficiency in Tailwind CSS and styling.
- Experience with state management (Zustand, Redux).
- Knowledge of testing frameworks (Vitest, Jest, Playwright).
- Ability to optimize performance and SEO.
- Experience with Supabase or Firebase.
- Familiarity with CI/CD and deployment (Vercel).
- Strong communication and leadership skills.

Responsibilities:
- Build scalable web applications.
- Mentor junior developers.
- Collaborate with product and design teams.
`;

export async function POST(req: Request) {
    try {
        const userId = 'debug-user';
        const jobId = 'debug-job-id';

        // 1. Run Generation
        const result = await generateEnhancedTailoredResume(
            jobId,
            userId,
            SAMPLE_JOB_DESCRIPTION,
        );

        if (!result.success || !result.resume) {
            return NextResponse.json({
                success: false,
                error: result.error || 'Generation failed',
            });
        }

        const resume = result.resume;
        const keywords = result.keywords;

        // 2. Verify ATS Score
        const atsScore = keywords?.atsScore?.raw || 0;
        const passedAts = atsScore >= 95;

        // 3. Verify specific keywords in content
        // Helper to check if text exists in resume string
        const resumeHtml = renderResumeHtml(resume);
        const resumeText = resumeHtml.replace(/<[^>]+>/g, ' ').toLowerCase();

        const checks = [
            { term: 'react', found: resumeText.includes('react') },
            { term: 'next.js', found: resumeText.includes('next.js') },
            { term: 'typescript', found: resumeText.includes('typescript') },
            { term: 'tailwind', found: resumeText.includes('tailwind') },
            { term: 'supabase', found: resumeText.includes('supabase') },
        ];

        // 4. Removed hardcoded contact check (was Marvin specific)
        // Instead check if any contact info exists
        const contactCheck = !!resume.contact.email || !!resume.contact.phone;

        // 5. Check SVG Icon in HTML (rough check)
        const hasSvgIcon = resumeHtml.includes('<svg') && resumeHtml.includes('path d="M18 13v6');

        return NextResponse.json({
            success: true,
            report: {
                atsScore,
                passedAts,
                checks,
                contactCheck,
                hasSvgIcon,
                resumeId: resume.id,
                keywordsMatch: keywords?.matched.slice(0, 10), // Show top 10
            }
        });

    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
}
