import { Worker } from 'bullmq';
import type { Redis } from 'ioredis';
import type { EmailSender } from './mailer.js';
import type { NotificationType } from '@prisma/client';
import type { LoggerLike } from './logger.js';
import { createEmailDlq, EMAIL_QUEUE_NAME } from './queue.js';

export interface EmailJobData {
  to: string;
  type: NotificationType;
  title: string;
  body: string;
}

export interface EmailWorker {
  close(): Promise<void>;
  getDlqCount(): Promise<number>;
}

/**
 * Resilient background worker for notification emails:
 * - automatic retries with exponential backoff + randomized jitter
 * - dead-letter queue for jobs that exhaust their retries
 * - structured telemetry logging on success, per-attempt failure, and DLQ moves
 */
export function createEmailWorker(deps: {
  connection: Redis;
  emailSender: EmailSender;
  logger: LoggerLike;
}): EmailWorker {
  const { connection, emailSender, logger } = deps;

  // The worker uses `connection` in blocking mode; the DLQ needs its own
  // connection so its commands never contend with the blocking one.
  const dlqConnection = connection.duplicate();
  const dlq = createEmailDlq(dlqConnection);
  const worker = new Worker(
    EMAIL_QUEUE_NAME,
    async (job) => {
      const data = job.data as EmailJobData;
      const startedAt = Date.now();
      try {
        await emailSender.send({
          to: data.to,
          subject: data.title,
          text: data.body,
        });
        logger.info(
          {
            jobId: job.id,
            attempt: job.attemptsMade + 1,
            type: data.type,
            durationMs: Date.now() - startedAt,
          },
          'notification email sent',
        );
      } catch (error) {
        logger.warn(
          {
            jobId: job.id,
            attempt: job.attemptsMade + 1,
            type: data.type,
            error: error instanceof Error ? error.message : String(error),
          },
          'notification email attempt failed',
        );
        throw error;
      }
    },
    {
      connection,
      concurrency: 5,
      lockDuration: 30_000,
    },
  );

  worker.on('failed', async (job, error) => {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (exhausted) {
      try {
        await dlq.add('email-failed', job.data, {
          attempts: 1,
        });
        logger.error(
          {
            jobId: job.id,
            type: (job.data as EmailJobData)?.type,
            error: error.message,
          },
          'notification email moved to dead-letter queue',
        );
      } catch (dlqError) {
        logger.error(
          { jobId: job.id, error: dlqError instanceof Error ? dlqError.message : String(dlqError) },
          'failed to enqueue email job to dead-letter queue',
        );
      }
    }
  });

  return {
    async close() {
      await worker.close();
      await dlq.close();
      await dlqConnection.quit();
    },
    async getDlqCount() {
      const counts = await dlq.getJobCounts('waiting', 'active', 'failed');
      return (counts.waiting ?? 0) + (counts.active ?? 0) + (counts.failed ?? 0);
    },
  };
}