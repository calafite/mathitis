import { describe, expect, it, vi, beforeEach } from 'vitest';

const { init, captureException } = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock('@sentry/node', () => ({
  init,
  captureException,
}));

import { initSentry, captureRequestError, scrub } from '../../src/lib/sentry.js';

describe('initSentry', () => {
  beforeEach(() => {
    init.mockClear();
  });

  it('skips initialization when no DSN is configured', () => {
    expect(initSentry({ environment: 'development' })).toBe(false);
    expect(init).not.toHaveBeenCalled();
  });

  it('initializes the SDK with environment, release and a scrubbing beforeSend', () => {
    const initialized = initSentry({
      dsn: 'https://key@o0.ingest.sentry.io/1',
      environment: 'staging',
    });
    expect(initialized).toBe(true);
    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: 'https://key@o0.ingest.sentry.io/1',
        environment: 'staging',
        release: expect.any(String),
        tracesSampleRate: 0.1,
      }),
    );

    const options = init.mock.calls[0]![0] as { beforeSend: (event: unknown) => unknown };
    const scrubbed = options.beforeSend({
      extra: { password: 'secret', email: 'student@example.com' },
    }) as Record<string, unknown>;
    expect(scrubbed.extra).toEqual({
      password: '[REDACTED]',
      email: '[REDACTED]',
    });
  });
});

describe('captureRequestError', () => {
  it('captures the error with request tags and id-only user identity', () => {
    const error = new Error('boom');
    captureRequestError(error, {
      method: 'POST',
      url: '/api/requests',
      correlationId: 'corr-123',
      sessionUser: { sub: 'u1', role: 'freshman', handle: 'a' },
    });

    expect(captureException).toHaveBeenCalledWith(error, {
      tags: {
        'request.method': 'POST',
        'request.url': '/api/requests',
        correlation_id: 'corr-123',
      },
      user: { id: 'u1' },
    });
  });

  it('omits the user when there is no session', () => {
    captureRequestError(new Error('boom'), {
      method: 'GET',
      url: '/api/tags',
      correlationId: 'corr-456',
    });

    expect(captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ user: undefined }),
    );
  });
});

describe('scrub', () => {
  it('redacts sensitive keys and email-shaped values recursively', () => {
    const result = scrub({
      headers: { authorization: 'Bearer x', cookie: 'a=b' },
      body: { token: 'abc', contactEmail: 'x@example.com', safe: 'ok' },
      nested: { array: ['a@b.com', 'fine'] },
    });
    expect(result).toEqual({
      headers: { authorization: '[REDACTED]', cookie: '[REDACTED]' },
      body: { token: '[REDACTED]', contactEmail: '[REDACTED]', safe: 'ok' },
      nested: { array: ['[REDACTED]', 'fine'] },
    });
  });
});
