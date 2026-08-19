import type { Queue } from 'bullmq';
import type { Mailer } from './auth-service.js';
import type { LoggerLike } from '../lib/logger.js';

export interface AuthMailerDeps {
  /** Base URL of the API (used as a fallback when no web origin is set). */
  publicBaseUrl: string;
  /** Origin of the browser-facing web app (email links point here). */
  webBaseUrl: string;
  /** BullMQ queue shared with the notification email pipeline. */
  emailQueue: Queue;
  logger: LoggerLike;
}

const EMAIL_JOB = 'email-send';

const VERIFICATION_SUBJECT = 'Verify your Mathitis email';
const RESET_SUBJECT = 'Reset your Mathitis password';

/**
 * Production auth mailer: builds the verification/reset links from the public
 * web origin and dispatches them through the same resilient BullMQ pipeline as
 * notification emails (retries with backoff, dead-letter queue, telemetry).
 *
 * With SMTP unset the worker's dev sender logs the message body, so the link
 * remains reachable during local development.
 */
export function createAuthMailer(deps: AuthMailerDeps): Mailer {
  const webBase = deps.webBaseUrl.replace(/\/$/, '');

  async function enqueue(type: string, to: string, subject: string, text: string): Promise<void> {
    try {
      await deps.emailQueue.add(
        EMAIL_JOB,
        { to, type, title: subject, body: text },
        {
          attempts: 5,
          backoff: { type: 'exponential', delay: 1000, jitter: 0.2 },
          removeOnComplete: { count: 1000 },
          removeOnFail: false,
        },
      );
    } catch (error) {
      deps.logger.error(
        { type, to, error: error instanceof Error ? error.message : String(error) },
        'failed to enqueue auth email',
      );
    }
  }

  return {
    async sendVerificationEmail(to, token) {
      const url = `${webBase}/verify-email?token=${encodeURIComponent(token)}`;
      await enqueue(
        'email_verification',
        to,
        VERIFICATION_SUBJECT,
        [
          'Welcome to Mathitis!',
          '',
          'Please confirm your email address to activate your account:',
          url,
          '',
          'The link expires in 24 hours. If you did not create this account, you can ignore this email.',
        ].join('\n'),
      );
    },

    async sendPasswordResetEmail(to, token) {
      const url = `${webBase}/recover?token=${encodeURIComponent(token)}`;
      await enqueue(
        'password_reset',
        to,
        RESET_SUBJECT,
        [
          'We received a request to reset your Mathitis password.',
          '',
          'Choose a new password here:',
          url,
          '',
          'The link expires in 24 hours. If you did not request this, you can safely ignore this email.',
        ].join('\n'),
      );
    },
  };
}
