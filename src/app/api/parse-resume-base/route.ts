// src/app/api/parse-resume-base/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { parsePdfToDynamicResume } from '@/lib/resume-generation/parser';
import { getS3Client } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let s3Key: string;
  try {
    const body = await request.json();
    if (!body.s3Key) throw new Error('Missing s3Key');
    s3Key = body.s3Key as string;
  } catch {
    return NextResponse.json({ error: 'Missing s3Key in request body' }, { status: 400 });
  }

  // Fetch PDF from S3
  let pdfBuffer: Buffer;
  try {
    const s3 = getS3Client();
    if (!s3) throw new Error('S3 not configured');
    const cmd = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME || '',
      Key: s3Key,
    });
    const res = await s3.send(cmd);
    if (!res.Body) throw new Error('Empty S3 response');
    const bytes = await res.Body.transformToByteArray();
    pdfBuffer = Buffer.from(bytes);
  } catch (err: unknown) {
    console.error('[parse-resume-base] S3 fetch error:', err);
    return NextResponse.json(
      { error: 'Failed to download resume from storage.' },
      { status: 500 }
    );
  }

  // Parse PDF → structured DynamicParsedResume (LLM text extraction, no content modification)
  try {
    const result = await parsePdfToDynamicResume(pdfBuffer);
    return NextResponse.json({ success: true, data: result.structured });
  } catch (err: unknown) {
    console.error('[parse-resume-base] Parse error:', err);
    return NextResponse.json({ error: 'Failed to parse resume.' }, { status: 500 });
  }
}
