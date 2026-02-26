import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDefaultResume } from '@/lib/db';
import { getS3Client } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { parseResumeFromPdfStrict } from '@/lib/gemini-strict';
import { parseJdStrictPipeline } from '@/lib/gemini-jd-strict';
import { parseLiStrictPipeline } from '@/lib/gemini-li-strict';
import { mergeProfilesStrict } from '@/lib/gemini-merge-strict';
import { orchestrateResumePipeline, OrchestrationInput } from '@/lib/resume-orchestrator-strict';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

function getYearsOfExp(resumeJson: any): number {
    try {
        if (!resumeJson.experience || resumeJson.experience.length === 0) return 0;
        const years: number[] = [];
        for (const exp of resumeJson.experience) {
            const startStr = exp.start_date;
            const endStr = exp.end_date === 'Present' ? new Date().getFullYear().toString() : exp.end_date;
            const startYr = parseInt(startStr.replace(/[^0-9]/g, '').slice(-4));
            const endYr = parseInt(endStr.replace(/[^0-9]/g, '').slice(-4));
            if (!isNaN(startYr) && !isNaN(endYr)) {
                years.push(endYr - startYr);
            }
        }
        return years.reduce((a, b) => a + b, 0);
    } catch {
        return 3;
    }
}

export async function POST(req: Request) {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { jobId, jobDescription, linkedinProfileUrl, linkedinData } = body;

    if (!jobDescription) {
        return NextResponse.json({ success: false, error: 'Job description is required.' }, { status: 400 });
    }

    const stream = new ReadableStream({
        start(controller) {
            const encoder = new TextEncoder();
            let streamEnded = false;

            function safeClose() {
                if (!streamEnded) {
                    streamEnded = true;
                    try { controller.close(); } catch (e) { }
                }
            }

            function sendEvent(event: string, data: any) {
                if (streamEnded) return;
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\n`));
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                } catch (e) {
                    streamEnded = true;
                }
            }

            (async () => {
                let fileBuffer: Buffer | null = null;
                let resumeJson: any = null;
                let liJson: any = null;
                let jdJson: any = null;

                try {
                    // Stage 1: Load Resume PDF & OCR
                    sendEvent('stage', { stageId: 'stage1_resume-load', title: 'Loading Resume', description: 'Downloading and extracting text from your PDF resume' });

                    const resume = await getDefaultResume(userId);
                    if (!resume?.s3_key) {
                        sendEvent('error', { status: 'error', message: 'No default resume uploaded. Please upload a resume first.', debug_path: '/tmp/resume_tasks' });
                        safeClose();
                        return;
                    }

                    sendEvent('log', { stageId: 'stage1_resume-load', log: 'Finding your resume in our secure storage...' });

                    const s3Key = resume.s3_key;

                    try {
                        const s3 = getS3Client();
                        if (!s3) throw new Error("S3 Client not configured");
                        const getCommand = new GetObjectCommand({
                            Bucket: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || '',
                            Key: s3Key,
                        });
                        const s3Response = await s3.send(getCommand);
                        if (!s3Response.Body) throw new Error("Empty body from S3.");
                        const byteArray = await s3Response.Body.transformToByteArray();
                        fileBuffer = Buffer.from(byteArray);
                    } catch (e: any) {
                        sendEvent('error', { status: 'error', message: 'Failed to retrieve resume PDF from storage.', debug_path: '/tmp/resume_tasks' });
                        safeClose();
                        return;
                    }

                    sendEvent('log', { stageId: 'stage1_resume-load', log: `Successfully loaded your ${(fileBuffer.length / 1024).toFixed(0)}KB resume.` });
                    sendEvent('log', { stageId: 'stage1_resume-load', log: 'Reading the text from your PDF...' });
                    sendEvent('complete', { stageId: 'stage1_resume-load' });

                    // Stage 2: Parse Resume to Strict JSON
                    sendEvent('stage', { stageId: 'stage2_resume-parse', title: 'Parsing Resume', description: 'Converting resume to structured JSON format' });
                    sendEvent('log', { stageId: 'stage2_resume-parse', log: 'Identifying key details like your name and contact info...' });

                    const resumeParseResult = await parseResumeFromPdfStrict(fileBuffer);

                    if (!resumeParseResult.success || !resumeParseResult.data) {
                        const errorMsg = resumeParseResult.failedTests?.length > 0
                            ? `Resume extraction failed: ${resumeParseResult.failedTests[0]}`
                            : 'Resume extraction failed. Please ensure your PDF is readable.';
                        sendEvent('error', { status: 'error', message: errorMsg, details: resumeParseResult.failedTests, debug_path: '/tmp/resume_tasks' });
                        safeClose();
                        return;
                    }

                    sendEvent('log', { stageId: 'stage2_resume-parse', log: `Hi ${resumeParseResult.data.basics?.name || 'there'}! I've found your professional history.` });
                    sendEvent('log', { stageId: 'stage2_resume-parse', log: `Successfully extracted ${resumeParseResult.data.experience?.length || 0} roles and ${resumeParseResult.data.education?.length || 0} educational milestones.` });
                    sendEvent('complete', { stageId: 'stage2_resume-parse' });

                    resumeJson = resumeParseResult.data;

                    // Stage 3: LinkedIn Parse (Optional)
                    if (linkedinProfileUrl || linkedinData) {
                        sendEvent('stage', { stageId: 'stage3_linkedin-parse', title: 'Parsing LinkedIn', description: 'Extracting information from LinkedIn profile' });
                        sendEvent('log', { stageId: 'stage3_linkedin-parse', log: 'Looking into your LinkedIn profile for extra details...' });

                        try {
                            let liInput: string | Buffer = linkedinData || '';

                            if (typeof liInput === 'string' && liInput.startsWith('data:')) {
                                const base64Data = liInput.split(',')[1];
                                liInput = Buffer.from(base64Data, 'base64');
                            }

                            const liParseResult = await parseLiStrictPipeline(liInput);

                            if (liParseResult.success && liParseResult.data) {
                                liJson = liParseResult.data;
                                sendEvent('log', { stageId: 'stage3_linkedin-parse', log: `Great! Found your profile for ${liJson.profile?.full_name || 'you'} on LinkedIn.` });
                            } else {
                                sendEvent('log', { stageId: 'stage3_linkedin-parse', log: 'LinkedIn parsing had issues, continuing with resume only' });
                            }
                        } catch (liError: any) {
                            sendEvent('log', { stageId: 'stage3_linkedin-parse', log: `LinkedIn parsing skipped: ${liError.message}` });
                        }
                        sendEvent('complete', { stageId: 'stage3_linkedin-parse' });
                    } else {
                        sendEvent('stage', { stageId: 'stage3_linkedin-parse', title: 'Parsing LinkedIn', description: 'Skipped - no LinkedIn data provided' });
                        sendEvent('log', { stageId: 'stage3_linkedin-parse', log: 'No LinkedIn data - skipping' });
                        sendEvent('complete', { stageId: 'stage3_linkedin-parse' });
                    }

                    // Stage 4: Parse Job Description
                    sendEvent('stage', { stageId: 'stage4_jd-parse', title: 'Analyzing Job Description', description: 'Extracting requirements and keywords from JD' });
                    sendEvent('log', { stageId: 'stage4_jd-parse', log: 'Identifying what the company is looking for in this role...' });

                    const jdParseResult = await parseJdStrictPipeline(jobDescription);

                    if (!jdParseResult.success || !jdParseResult.data) {
                        const errorMsg = jdParseResult.failedTests?.length > 0
                            ? `Job Description extraction failed: ${jdParseResult.failedTests[0]}`
                            : 'Job Description extraction failed.';
                        sendEvent('error', { status: 'error', message: errorMsg, details: jdParseResult.failedTests, debug_path: '/tmp/resume_tasks' });
                        safeClose();
                        return;
                    }

                    sendEvent('log', { stageId: 'stage4_jd-parse', log: `Found ${jdParseResult.data.skills?.length || 0} important skills requested by the employer.` });
                    sendEvent('log', { stageId: 'stage4_jd-parse', log: `Got a good handle on the qualifications and responsibilities.` });
                    sendEvent('complete', { stageId: 'stage4_jd-parse' });

                    jdJson = jdParseResult.data;

                    // Stage 5: Merge and Tailor
                    sendEvent('stage', { stageId: 'stage5_merge-tailor', title: 'Merging Profiles', description: 'Combining resume, LinkedIn, and job data' });
                    sendEvent('log', { stageId: 'stage5_merge-tailor', log: 'Matching your unique strengths with the job requirements...' });

                    const mergeResult = mergeProfilesStrict(resumeJson, jdJson, liJson);
                    if (!mergeResult.success || !mergeResult.candidate_profile) {
                        const errorMsg = mergeResult.failedTests?.length > 0
                            ? `Merge failed: ${mergeResult.failedTests[0]}`
                            : 'Failed to merge resume with job description.';
                        sendEvent('error', { status: 'error', message: errorMsg, details: mergeResult.failedTests, debug_path: '/tmp/resume_tasks' });
                        safeClose();
                        return;
                    }

                    sendEvent('log', { stageId: 'stage5_merge-tailor', log: 'Successfully aligned your profile with the target role.' });
                    sendEvent('log', { stageId: 'stage5_merge-tailor', log: liJson ? 'Combined your resume and LinkedIn experience.' : 'Focused on your core resume highlights.' });
                    sendEvent('complete', { stageId: 'stage5_merge-tailor' });

                    const mergedProfile = mergeResult.candidate_profile;
                    const yearsExp = getYearsOfExp(resumeJson);

                    // Stage 6: Generate Tailored Resume
                    sendEvent('stage', { stageId: 'stage6_export', title: 'Generating Resume', description: 'Creating optimized resume content for the role' });
                    sendEvent('log', { stageId: 'stage6_export', log: 'Polishing your new tailored resume...' });

                    const reqId = randomUUID();
                    const orchestrateInput: OrchestrationInput = {
                        userId,
                        reqId,
                        candidate_profile: mergedProfile,
                        jd_json: jdJson,
                        years_experience: yearsExp,
                        file_size_bytes: fileBuffer?.length || 0
                    };

                    const finalResult = await orchestrateResumePipeline(orchestrateInput);

                    if (!finalResult.success) {
                        sendEvent('error', { message: finalResult.error || 'Failed to generate tailored resume.', debug_path: `/tmp/resume_tasks/${reqId}` });
                        safeClose();
                        return;
                    }

                    sendEvent('log', { stageId: 'stage6_export', log: 'Your tailored resume content is ready!' });
                    sendEvent('log', { stageId: 'stage6_export', log: 'Applying finishing touches and checking for quality...' });
                    sendEvent('complete', { stageId: 'stage6_export' });

                    // Persist compose_response.json to /tmp/resume_tasks/<reqId>/
                    const composeResponsePath = `/tmp/resume_tasks/${reqId}`;
                    try {
                        fs.mkdirSync(composeResponsePath, { recursive: true });
                        const composeResponseData = {
                            final_markdown: finalResult.final_markdown,
                            final_resume_json: finalResult.final_resume_json,
                            rescored_profile: finalResult.rescored_profile,
                            explanation: finalResult.explanation,
                            needs_user_confirmation: finalResult.needs_user_confirmation,
                            parsed_jd: jdJson,
                            parsed_resume: resumeJson,
                            parsed_linkedin: liJson,
                            structured_data: finalResult.structured_data,
                            raw_ai_logs: finalResult.raw_ai_logs
                        };
                        fs.writeFileSync(
                            path.join(composeResponsePath, 'compose_response.json'),
                            JSON.stringify(composeResponseData, null, 2)
                        );
                        console.log(`[SERVER] Persisted compose_response.json to ${composeResponsePath}`);
                    } catch (fsErr) {
                        console.error('[SERVER] Failed to persist compose_response.json:', fsErr);
                    }

                    // Send final result with FULL structured data
                    console.log('[SERVER] Sending done event with final_resume_json');
                    console.log('[SERVER] Final payload keys:', Object.keys(finalResult.final_resume_json || {}));
                    console.log('[SERVER] Final payload size:', JSON.stringify(finalResult.final_resume_json || {}).length);
                    
                    sendEvent('done', {
                        status: 'success',
                        final_resume_json: finalResult.final_resume_json,
                        parsed_resume: resumeJson,
                        parsed_jd: jdJson,
                        compose_response_path: composeResponsePath
                    });
                    safeClose();

                } catch (error: any) {
                    console.error('Stream Error:', error);
                    try {
                        sendEvent('error', { status: 'error', message: error.message || 'Internal server error', debug_path: '/tmp/resume_tasks' });
                    } catch (e) { }
                    safeClose();
                }
            })();
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
