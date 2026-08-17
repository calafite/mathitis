import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
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

  async function putObject(key: string, body: Buffer, contentType: string): Promise<StoredAsset> {
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