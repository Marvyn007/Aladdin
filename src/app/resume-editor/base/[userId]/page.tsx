import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { getDefaultResume } from '@/lib/db';
import { BaseResumeEditor } from '@/components/resume-editor/BaseResumeEditor';

export default async function BaseResumeEditorPage(
    props: { params: Promise<{ userId: string }> }
) {
    const params = await props.params;
    const { userId } = await auth();

    // Guard: authenticated user must match URL param
    if (!userId || userId !== params.userId) {
        redirect('/');
    }

    const resume = await getDefaultResume(userId);

    // Guard: must have a default resume with an S3 key
    if (!resume?.s3_key) {
        redirect('/');
    }

    return (
        <BaseResumeEditor
            s3Key={resume.s3_key}
            resumeFilename={resume.filename}
        />
    );
}
