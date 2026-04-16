import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';
import { getS3Client } from '@/lib/s3';

export const dynamic = 'force-dynamic';

async function fetchS3AsBase64(s3Key: string): Promise<string | null> {
  const client = getS3Client();
  if (!client) return null;
  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  if (!bucket) return null;
  try {
    const { Body } = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: s3Key })
    );
    if (!Body) return null;
    const bytes = await Body.transformToByteArray();
    return Buffer.from(bytes).toString('base64');
  } catch {
    return null;
  }
}

/**
 * GET (PAT auth): return resume or cover letter as base64 PDF.
 * Query param: type = "resume" | "coverLetter"
 *
 * Response: { pdfBase64: string, mimeType: string, filename: string }
 */
export async function GET(request: NextRequest) {
  const pat = await validateExtensionPat(request);
  if (!pat) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = pat;
  const type = new URL(request.url).searchParams.get('type') ?? 'resume';

  if (type === 'resume') {
    const resume = await prisma.resume.findFirst({
      where:   { userId, archivedAt: null },
      orderBy: { uploadAt: 'desc' },
      select:  { filename: true, s3Key: true, fileData: true },
    });

    if (!resume) {
      return NextResponse.json({ error: 'No resume found. Please upload a resume in your Aladdin account settings first.' }, { status: 404 });
    }

    let pdfBase64: string | null = null;

    if (resume.fileData) {
      pdfBase64 = Buffer.from(resume.fileData).toString('base64');
    } else if (resume.s3Key) {
      pdfBase64 = await fetchS3AsBase64(resume.s3Key);
    }

    if (!pdfBase64) {
      return NextResponse.json({ error: 'Resume file not available.' }, { status: 404 });
    }

    return NextResponse.json({
      pdfBase64,
      mimeType: 'application/pdf',
      filename: resume.filename ?? 'resume.pdf',
    });
  }

  if (type === 'coverLetter') {
    const cl = await prisma.coverLetter.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      select:  { s3Key: true },
    });

    if (!cl?.s3Key) {
      return NextResponse.json({ error: 'No cover letter found.' }, { status: 404 });
    }

    const pdfBase64 = await fetchS3AsBase64(cl.s3Key);
    if (!pdfBase64) {
      return NextResponse.json({ error: 'Cover letter file not available.' }, { status: 404 });
    }

    return NextResponse.json({
      pdfBase64,
      mimeType: 'application/pdf',
      filename: 'cover-letter.pdf',
    });
  }

  return NextResponse.json({ error: `Unknown document type: ${type}` }, { status: 400 });
}
