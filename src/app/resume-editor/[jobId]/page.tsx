import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getJobById, getTailoredResumeByUserJob } from '@/lib/db';
import { FullPageResumeEditor } from '@/components/resume-editor/FullPageResumeEditor';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default async function ResumeEditorPage(props: { params: Promise<{ jobId: string }> }) {
    const params = await props.params;
    const { userId } = await auth();

    if (!userId) {
        redirect('/');
    }

    const { jobId } = params;

    const job = await getJobById(userId, jobId);
    if (!job) {
        notFound();
    }

    const savedResume = await getTailoredResumeByUserJob(userId, jobId);

    if (!savedResume) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-center p-6">
                <main className="max-w-md w-full bg-white rounded-xl shadow-lg border border-slate-200 p-8">
                    <h1 className="text-2xl font-bold text-slate-900 mb-4">Resume Not Found</h1>
                    <p className="text-slate-600 mb-8 leading-relaxed">
                        We couldn't find a tailored resume for this specific role: <strong>{job.title} at {job.company || 'Unknown'}</strong>.
                    </p>
                    <p className="text-slate-500 mb-8 text-sm">
                        Please go back to the job dashboard and click the "Parse & Edit Resume" button to generate your tailored resume first.
                    </p>
                    <Link href="/" className="btn btn-primary w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium">
                        <ChevronLeft size={18} /> Return to Dashboard
                    </Link>
                </main>
            </div>
        );
    }

    // Parsing saved JSON data
    let resumeData = savedResume.resumeData;
    let keywordsData = savedResume.keywordsData;
    if (typeof resumeData === 'string') resumeData = JSON.parse(resumeData);
    if (typeof keywordsData === 'string') keywordsData = JSON.parse(keywordsData);

    return (
        <FullPageResumeEditor
            jobId={job.id}
            jobTitle={job.title}
            company={job.company}
            initialResumeData={resumeData}
            initialKeywords={keywordsData}
        />
    );
}
