import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { Env } from '../config/env.js';

export interface StoredAsset {
  url: string;
  key: string;
}

export interface ObjectStorage {
  putObject(key: string, body: Buffer, contentType: string): Promise<StoredAsset>;
}

const UPLOADS_PREFIX = 'assets/uploads';

function sanitizeKey(key: string): string {
  // Prevent path traversal by normalising to a posix-safe relative path
  const safe = posix.normalize(key).replace(/^(\.\.(\/|$))+/, '');
  return safe.replace(/^\/+/, '');
}

export function createS3Storage(env: Env): ObjectStorage {
  const bucket = env.S3_BUCKET!;
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: 'us-east-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY!,
      secretAccessKey: env.S3_SECRET_KEY!,
    },
    tls: env.S3_USE_SSL,
  });

  // Idempotently create the bucket on first use so a fresh MinIO/ S3
  // deployment never fails uploads with NoSuchBucket. Errors are swallowed:
  // a read-only-credentials deployment will surface its own error on upload.
  let bucketReady = false;
  async function ensureBucket(): Promise<void> {
    if (bucketReady) return;
    try {
      await client.send(new HeadBucketCommand({ Bucket: bucket }));
      bucketReady = true;
    } catch {
      try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }));
      } catch {
        // Bucket creation failed (permissions?) - uploads will report the
        // underlying storage error to the client.
        return;
      }
      // Profile assets are public by design (visible on mentor profiles).
      // Apply an anonymous-download policy; ignore failures on providers
      // that manage policies externally (CDN-signed setups).
      try {
        await client.send(
          new PutBucketPolicyCommand({
            Bucket: bucket,
            Policy: JSON.stringify({
              Version: '2012-10-17',
              Statement: [
                {
                  Sid: 'PublicReadGetObject',
                  Effect: 'Allow',
                  Principal: '*',
                  Action: 's3:GetObject',
                  Resource: `arn:aws:s3:::${bucket}/*`,
                },
              ],
            }),
          }),
        );
      } catch {
        // Policy application is best-effort.
      }
      bucketReady = true;
    }
  }

  async function putObject(key: string, body: Buffer, contentType: string): Promise<StoredAsset> {
    await ensureBucket();
    const safeKey = sanitizeKey(key);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: safeKey,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    const url = env.S3_PUBLIC_BASE_URL
      ? `${env.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${safeKey}`
      : `${env.S3_ENDPOINT!.replace(/\/$/, '')}/${bucket}/${safeKey}`;

    return { url, key: safeKey };
  }

  return { putObject };
}

export function createLocalStorage(uploadDir: string, publicBaseUrl: string): ObjectStorage {
  async function putObject(key: string, body: Buffer, _contentType: string): Promise<StoredAsset> {
    const safeKey = sanitizeKey(key);
    const absolute = join(uploadDir, safeKey);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, body);
    const url = `${publicBaseUrl.replace(/\/$/, '')}/${UPLOADS_PREFIX}/${safeKey}`;
    return { url, key: safeKey };
  }

  return { putObject };
}

export function createStorage(env: Env): ObjectStorage {
  if (env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY) {
    return createS3Storage(env);
  }
  return createLocalStorage(env.UPLOAD_DIR, env.PUBLIC_BASE_URL);
}

export { UPLOADS_PREFIX };