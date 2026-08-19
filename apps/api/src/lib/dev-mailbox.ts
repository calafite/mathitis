import type { EmailMessage } from './mailer.js';

export interface DevEmailRecord {
  id: string;
  to: string;
  subject: string;
  text: string;
  sentAt: string;
}

const MAX_EMAILS = 200;
const mailbox: DevEmailRecord[] = [];
let nextId = 1;

/**
 * In-process dev mailbox. The SMTP-less email sender records every message here
 * so local testers can pick up verification/reset links without running a mail
 * server, instead of grepping logs. Exposed read-only through the dev plugin
 * (developer/administrator only); never enabled in production.
 */
export function recordDevEmail(message: EmailMessage): void {
  mailbox.push({
    id: `dev-mail-${nextId++}`,
    to: message.to,
    subject: message.subject,
    text: message.text,
    sentAt: new Date().toISOString(),
  });
  if (mailbox.length > MAX_EMAILS) {
    mailbox.splice(0, mailbox.length - MAX_EMAILS);
  }
}

export function listDevEmails(options: { to?: string; limit?: number } = {}): DevEmailRecord[] {
  const filtered = options.to ? mailbox.filter((email) => email.to === options.to) : mailbox;
  const newestFirst = [...filtered].reverse();
  return options.limit ? newestFirst.slice(0, options.limit) : newestFirst;
}

export function latestDevLink(options: { to: string; pattern: RegExp }): string | null {
  for (const email of listDevEmails({ to: options.to })) {
    const match = email.text.match(options.pattern);
    if (match) return match[0];
  }
  return null;
}

export function clearDevMailbox(): void {
  mailbox.length = 0;
  nextId = 1;
}
