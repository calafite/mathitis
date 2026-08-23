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

const VERIFICATION_SUBJECT = 'Verifique seu e-mail no Mathitis';
const RESET_SUBJECT = 'Redefina sua senha no Mathitis';

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
          'Bem-vindo(a) ao Mathitis!',
          '',
          'Confirme seu endereço de e-mail para ativar sua conta:',
          url,
          '',
          'O link expira em 24 horas. Se você não criou esta conta, pode ignorar este e-mail.',
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
          'Recebemos uma solicitação de redefinição de senha do Mathitis.',
          '',
          'Escolha uma nova senha aqui:',
          url,
          '',
          'O link expira em 24 horas. Se você não fez esta solicitação, pode ignorar este e-mail com segurança.',
        ].join('\n'),
      );
    },
  };
}
