import { notFound, redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getJobById, getTailoredResumeByUserJob } from '@/lib/db';
import { splitTailoredResumePayload } from '@/lib/tailored-resume-bundle';
import { FullPageResumeEditor } from '@/components/resume-editor/FullPageResumeEditor';
import { ResumeNotFoundShell } from '@/components/resume-editor/ResumeNotFoundShell';

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
        return <ResumeNotFoundShell jobTitle={job.title} company={job.company} />;
    }

    // Parsing saved JSON data
    let resumeData = savedResume.resumeData;
    let keywordsData = savedResume.keywordsData;
    if (typeof resumeData === 'string') resumeData = JSON.parse(resumeData);
    if (typeof keywordsData === 'string') keywordsData = JSON.parse(keywordsData);

    const { full, onePage } = splitTailoredResumePayload(resumeData);

    return (
        <FullPageResumeEditor
            jobId={job.id}
            jobTitle={job.title}
            company={job.company}
            initialFull={full}
            initialOnePage={onePage}
            initialKeywords={keywordsData}
            jobDescription={job.job_description_plain ?? job.normalized_text ?? null}
        />
    );
}
