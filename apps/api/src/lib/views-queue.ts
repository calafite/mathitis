import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const VIEWS_QUEUE_NAME = 'system-tasks';
export const FLUSH_VIEWS_JOB = 'flush-profile-views';
export const FLUSH_VIEWS_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Queue that carries the periodic profile-views flush job. The scheduler is
 * upserted by id, so re-running at boot never duplicates the schedule.
 */
export function createViewsQueue(connection: Redis): Queue {
  return new Queue(VIEWS_QUEUE_NAME, { connection });
}

export async function scheduleViewsFlush(queue: Queue): Promise<void> {
  await queue.upsertJobScheduler(
    FLUSH_VIEWS_JOB,
    { every: FLUSH_VIEWS_INTERVAL_MS },
    { name: FLUSH_VIEWS_JOB, data: {} },
  );
}
