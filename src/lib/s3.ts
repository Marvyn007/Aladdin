import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client: S3Client | null = null;

export function getS3Client() {
  if (s3Client) return s3Client;

  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!region || !accessKeyId || !secretAccessKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing AWS credentials in production environment');
    }
    console.warn('Missing AWS credentials. S3 operations will fail.');
    return null;
  }

  s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3Client;
}

export async function uploadFileToS3(
  buffer: Buffer,
  key: string,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  const client = getS3Client();
  if (!client) {
    throw new Error('S3 client not initialized - missing credentials');
  }

  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Missing AWS_S3_BUCKET or S3_BUCKET_NAME environment variable');
  }

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  // Return the S3 key - this is what we store in DB
  return key;
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
  const client = getS3Client();
  if (!client) {
    throw new Error('S3 client not initialized - missing credentials');
  }

  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error('Missing AWS_S3_BUCKET or S3_BUCKET_NAME environment variable');
  }

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return await getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteFileFromS3(key: string): Promise<void> {
  const client = getS3Client();
  if (!client) return;

  const bucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET_NAME;
  if (!bucket) return;

  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await client.send(command);
}

// Helper for constructing keys
export function generateS3Key(prefix: string, filename: string): string {
  const timestamp = Date.now();
  const cleanFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${prefix}/${timestamp}-${cleanFilename}`;
}
