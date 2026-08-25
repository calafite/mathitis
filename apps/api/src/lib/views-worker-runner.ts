import { Worker } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import type Redis from 'ioredis';
import type { LoggerLike } from './logger.js';
import { FLUSH_VIEWS_JOB, VIEWS_QUEUE_NAME } from './views-queue.js';
import { flushProfileViews } from '../services/views-worker.js';

export interface ViewsWorker {
  close(): Promise<void>;
}

/**
 * Consumes the periodic flush-profile-views job from the system-tasks queue.
 * Failures are rethrown so BullMQ retries with backoff — buffered views are
 * never dropped (the processing key survives until the transaction commits).
 */
export function createViewsWorker(deps: {
  connection: Redis;
  prisma: PrismaClient;
  logger: LoggerLike;
}): ViewsWorker {
  const { connection, prisma, logger } = deps;
  const worker = new Worker(
    VIEWS_QUEUE_NAME,
    async (job) => {
      if (job.name !== FLUSH_VIEWS_JOB) return;
      await flushProfileViews({ redis: connection, prisma, logger });
    },
    { connection, maxStalledCount: 5 },
  );
  worker.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err: err.message }, 'views flush job failed');
  });
  return {
    async close() {
      await worker.close();
    },
  };
}
