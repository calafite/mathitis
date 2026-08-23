import { describe, expect, it, vi } from 'vitest';
import { createAuthMailer } from '../../src/services/auth-mailer.js';

function logger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
}

function queue() {
  const add = vi.fn().mockResolvedValue(undefined);
  return { add };
}

describe('createAuthMailer', () => {
  it('builds a verification link to the web origin and enqueues an email job', async () => {
    const log = logger();
    const q = queue();
    const mailer = createAuthMailer({
      publicBaseUrl: 'http://localhost:4000',
      webBaseUrl: 'http://localhost:5173',
      emailQueue: q as never,
      logger: log as never,
    });

    await mailer.sendVerificationEmail('new@cs.uni.edu', 'plain-token-123');

    expect(q.add).toHaveBeenCalledTimes(1);
    const [name, data, opts] = q.add.mock.calls[0]! as [
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(name).toBe('email-send');
    expect(data.type).toBe('email_verification');
    expect(data.to).toBe('new@cs.uni.edu');
    expect(data.title).toBe('Verifique seu e-mail no Mathitis');
    expect(data.body).toContain('http://localhost:5173/verify-email?token=plain-token-123');
    expect(opts.attempts).toBe(5);
  });

  it('builds a reset link to the web origin recover page', async () => {
    const log = logger();
    const q = queue();
    const mailer = createAuthMailer({
      publicBaseUrl: 'http://localhost:4000',
      webBaseUrl: 'https://mathitis.university.edu/',
      emailQueue: q as never,
      logger: log as never,
    });

    await mailer.sendPasswordResetEmail('user@cs.uni.edu', 'reset-token-abc');

    const [, data] = q.add.mock.calls[0]! as [string, Record<string, unknown>];
    expect(data.type).toBe('password_reset');
    expect(data.body).toContain('https://mathitis.university.edu/recover?token=reset-token-abc');
  });

  it('logs and swallows queue failures instead of throwing', async () => {
    const log = logger();
    const q = queue();
    q.add.mockRejectedValue(new Error('redis down'));
    const mailer = createAuthMailer({
      publicBaseUrl: 'http://localhost:4000',
      webBaseUrl: 'http://localhost:5173',
      emailQueue: q as never,
      logger: log as never,
    });

    await expect(
      mailer.sendVerificationEmail('a@cs.uni.edu', 'token-xyz'),
    ).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalledWith(expect.anything(), 'failed to enqueue auth email');
  });
});
