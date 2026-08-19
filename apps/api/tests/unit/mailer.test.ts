import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Env } from '../../src/config/env.js';
import { createEmailSender } from '../../src/lib/mailer.js';

const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'msg-1' });
  return { createTransport: vi.fn().mockReturnValue({ sendMail }), sendMail };
});

vi.mock('nodemailer', () => ({
  default: { createTransport },
}));

function baseEnv(overrides: Partial<Env> = {}): Env {
  return {
    NODE_ENV: 'development',
    PORT: 4000,
    HOST: '0.0.0.0',
    JWT_SECRET: 'test_jwt_secret_that_is_at_least_32_characters_long',
    COOKIE_SECRET: 'test_cookie_secret_that_is_at_least_32_chars_long',
    SESSION_MAX_AGE_DAYS: 7,
    WEB_ORIGIN: undefined,
    RATE_LIMIT_GLOBAL_MAX: 120,
    RATE_LIMIT_AUTH_MAX: 5,
    RATE_LIMIT_REQUEST_MAX: 10,
    DATABASE_URL: 'postgresql://localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    S3_ENDPOINT: undefined,
    S3_BUCKET: undefined,
    S3_ACCESS_KEY: undefined,
    S3_SECRET_KEY: undefined,
    S3_USE_SSL: false,
    S3_PUBLIC_BASE_URL: undefined,
    PUBLIC_BASE_URL: 'http://localhost:4000',
    UPLOAD_DIR: 'uploads',
    SENTRY_DSN: undefined,
    LOG_LEVEL: 'info',
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
    SMTP_FROM: undefined,
    ...overrides,
  };
}

describe('createEmailSender', () => {
  beforeEach(() => {
    createTransport.mockClear();
    sendMail.mockClear();
  });

  it('logs to the provided logger when SMTP is not configured', async () => {
    const info = vi.fn();
    const sender = createEmailSender(baseEnv(), { info, warn: vi.fn(), error: vi.fn() });

    await sender.send({ to: 'senior@example.com', subject: 'Hi', text: 'Body' });

    expect(createTransport).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(
      { to: 'senior@example.com', subject: 'Hi', body: 'Body', transport: 'dev-noop' },
      'email dispatched (no SMTP configured)',
    );
  });

  it('delivers via nodemailer with SMTP credentials', async () => {
    const sender = createEmailSender(
      baseEnv({
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: 587,
        SMTP_USER: 'user',
        SMTP_PASS: 'pass',
        SMTP_FROM: 'no-reply@example.com',
      }),
      { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    );

    await sender.send({
      to: 'freshman@example.com',
      subject: 'Accepted',
      text: 'Congrats',
      html: '<p>Congrats</p>',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'no-reply@example.com',
      to: 'freshman@example.com',
      subject: 'Accepted',
      text: 'Congrats',
      html: '<p>Congrats</p>',
    });
  });

  it('uses TLS on port 465 and a default from address', async () => {
    const sender = createEmailSender(baseEnv({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: 465 }), {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    });

    await sender.send({ to: 'x@example.com', subject: 'S', text: 'T' });

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: undefined,
    });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'mathitis@localhost' }));
  });

  it('falls back to the dev logger when SMTP port is missing', async () => {
    const info = vi.fn();
    const sender = createEmailSender(
      baseEnv({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: undefined }),
      { info, warn: vi.fn(), error: vi.fn() },
    );

    await sender.send({ to: 'x@example.com', subject: 'S', text: 'T' });

    expect(createTransport).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
});
