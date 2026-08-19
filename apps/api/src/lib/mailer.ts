import nodemailer, { type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';
import type { LoggerLike } from './logger.js';
import { recordDevEmail } from './dev-mailbox.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Production SMTP transport via nodemailer. When SMTP is not configured (local
 * development / tests) it falls back to a logger so the background pipeline
 * still runs end-to-end without a mail server.
 */
export function createEmailSender(env: Env, logger: LoggerLike): EmailSender {
  let transporter: Transporter | null = null;
  if (env.SMTP_HOST && env.SMTP_PORT) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  }

  return {
    async send(message: EmailMessage) {
      if (transporter) {
        await transporter.sendMail({
          from: env.SMTP_FROM ?? 'mathitis@localhost',
          to: message.to,
          subject: message.subject,
          text: message.text,
          html: message.html,
        });
        return;
      }
      recordDevEmail(message);
      logger.info(
        {
          to: message.to,
          subject: message.subject,
          body: message.text,
          transport: 'dev-noop',
        },
        'email dispatched (no SMTP configured)',
      );
    },
  };
}
