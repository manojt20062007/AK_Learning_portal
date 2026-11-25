import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export const R2_FREE_STORAGE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB-month published free allowance

export function isR2Configured(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET_NAME,
  );
}

function getR2Client(): S3Client {
  if (!isR2Configured()) {
    throw new AppError(
      'Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in apps/backend/.env.',
      503,
      'R2_NOT_CONFIGURED',
    );
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function getContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
  if (ext === '.ts') return 'video/mp2t';
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export async function uploadFileToR2(localPath: string, r2Key: string, contentType?: string): Promise<number> {
  const client = getR2Client();
  const stat = await fs.promises.stat(localPath);
  const body = fs.createReadStream(localPath);

  await client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: r2Key,
      Body: body,
      ContentType: contentType ?? getContentType(localPath),
    }),
  );

  return stat.size;
}

export async function uploadDirectoryToR2(
  localDir: string,
  keyPrefix: string,
): Promise<{ totalBytes: number; fileCount: number }> {
  const entries = await fs.promises.readdir(localDir);
  let totalBytes = 0;
  let fileCount = 0;

  for (const entry of entries) {
    const fullPath = path.join(localDir, entry);
    const stat = await fs.promises.stat(fullPath);
    if (!stat.isFile()) continue;

    const r2Key = `${keyPrefix.replace(/\/+$/, '')}/${entry}`;
    totalBytes += await uploadFileToR2(fullPath, r2Key);
    fileCount += 1;
  }

  return { totalBytes, fileCount };
}

export async function getR2ObjectText(r2Key: string): Promise<string> {
  const client = getR2Client();
  const res = await client.send(
    new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: r2Key,
    }),
  );

  if (!res.Body) {
    throw new AppError('Video manifest not found in storage', 404);
  }
  return res.Body.transformToString('utf-8');
}

export async function getSignedR2Url(r2Key: string, expiresInSeconds = 900): Promise<string> {
  const client = getR2Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Key: r2Key,
    }),
    { expiresIn: expiresInSeconds },
  );
}

export async function deleteR2Prefix(keyPrefix: string): Promise<void> {
  if (!isR2Configured()) return;
  const client = getR2Client();
  const list = await client.send(
    new ListObjectsV2Command({
      Bucket: env.R2_BUCKET_NAME!,
      Prefix: keyPrefix,
    }),
  );

  const objects = (list.Contents ?? []).filter((o) => o.Key).map((o) => ({ Key: o.Key! }));
  if (objects.length === 0) return;

  await client.send(
    new DeleteObjectsCommand({
      Bucket: env.R2_BUCKET_NAME!,
      Delete: { Objects: objects },
    }),
  );
}
