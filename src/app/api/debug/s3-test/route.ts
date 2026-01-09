import { NextResponse } from 'next/server';
import { getS3Client, uploadFileToS3, generateS3Key } from '@/lib/s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const result: any = {
        env: {
            AWS_S3_BUCKET: process.env.AWS_S3_BUCKET ? 'SET' : 'NOT_SET',
            S3_BUCKET_NAME: process.env.S3_BUCKET_NAME ? 'SET' : 'NOT_SET',
            AWS_REGION: process.env.AWS_REGION ? 'SET' : 'NOT_SET',
            AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID ? 'SET' : 'NOT_SET',
        }
    };

    try {
        const client = getS3Client();
        if (!client) {
            result.s3Status = 'NOT_INITIALIZED';
            return NextResponse.json(result);
        }

        // Try a minimal test upload
        const testKey = generateS3Key('test', 'debug-test.txt');
        const testBuffer = Buffer.from('test content');

        await uploadFileToS3(testBuffer, testKey, 'text/plain');
        result.s3Status = 'SUCCESS';
        result.uploadedKey = testKey;
    } catch (e: any) {
        result.s3Status = 'ERROR';
        result.s3Error = e.message;
    }

    return NextResponse.json(result);
}
