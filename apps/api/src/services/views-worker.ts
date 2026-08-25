import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { LoggerLike } from '../lib/logger.js';

export const VIEWS_BUFFER_KEY = 'profile:views';

/**
 * Atomically flushes buffered profile view increments to PostgreSQL.
 *
 * Zero-loss design: the buffer hash is RENAMEd to a processing key before
 * reading, so increments arriving mid-flush land in the fresh buffer and are
 * picked up by the next run. The processing key is deleted only after the
 * database transaction commits; on failure it survives for the retry.
 *
 * @returns the number of profiles updated (0 when the buffer was empty).
 */
export async function flushProfileViews(deps: {
  redis: Redis;
  prisma: PrismaClient;
  logger?: Pick<LoggerLike, 'info' | 'warn' | 'error'>;
}): Promise<number> {
  const { redis, prisma, logger } = deps;

  const exists = await redis.exists(VIEWS_BUFFER_KEY);
  if (!exists) return 0;

  const processingKey = `${VIEWS_BUFFER_KEY}:processing:${Date.now()}`;
  try {
    await redis.rename(VIEWS_BUFFER_KEY, processingKey);
  } catch {
    return 0; // RENAME fails when the key vanished between EXISTS and RENAME.
  }

  const raw = await redis.hgetall(processingKey);
  const entries = Object.entries(raw).filter(([, count]) => Number(count) > 0);
  if (entries.length === 0) {
    await redis.del(processingKey);
    return 0;
  }

  try {
    await prisma.$transaction(
      entries.map(([userId, count]) =>
        prisma.profile.update({
          where: { userId },
          data: { profileViews: { increment: Number(count) } },
        }),
      ),
    );
  } catch (error) {
    // Do NOT delete the processing key: the next job run retries the same
    // increments, so no view data is ever lost.
    logger?.error({ err: error, profiles: entries.length }, 'profile views flush failed');
    throw error;
  }

  await redis.del(processingKey);
  logger?.info({ profiles: entries.length }, 'profile views flushed');
  return entries.length;
}
