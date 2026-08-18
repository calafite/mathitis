import { Queue } from 'bullmq';
import type { Redis } from 'ioredis';

export const EMAIL_QUEUE_NAME = 'email';
export const EMAIL_DLQ_NAME = 'email-dlq';

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  throughput: { completed: number; failed: number };
}

/**
 * Email notifications are dispatched through a BullMQ queue. Only the producer
 * side is required here: inspection/telemetry reads job counts and throughput
 * without needing a running worker.
 */
export function createEmailQueue(connection: Redis): Queue {
  return new Queue(EMAIL_QUEUE_NAME, { connection });
}

export function createEmailDlq(connection: Redis): Queue {
  return new Queue(EMAIL_DLQ_NAME, { connection });
}

export async function getQueueStats(queue: Queue): Promise<QueueStats> {
  const [counts, completed, failed] = await Promise.all([
    queue.getJobCounts(),
    queue.getMetrics('completed'),
    queue.getMetrics('failed'),
  ]);
  return {
    waiting: counts.waiting ?? 0,
    active: counts.active ?? 0,
    completed: counts.completed ?? 0,
    failed: counts.failed ?? 0,
    delayed: counts.delayed ?? 0,
    throughput: {
      completed: completed.count,
      failed: failed.count,
    },
  };
}