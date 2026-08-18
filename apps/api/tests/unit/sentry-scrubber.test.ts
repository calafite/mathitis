import { describe, expect, it } from 'vitest';
import { scrub } from '../../src/lib/sentry.js';

describe('sentry pii scrubber', () => {
  it('redacts sensitive header fields', () => {
    const event = {
      request: {
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.abc',
          cookie: 'mathitis_session=token-value',
        },
      },
    };
    const scrubbed = scrub(event) as typeof event;
    expect(scrubbed.request.headers['content-type']).toBe('application/json');
    expect(scrubbed.request.headers.authorization).toBe('[REDACTED]');
    expect(scrubbed.request.headers.cookie).toBe('[REDACTED]');
  });

  it('redacts passwords and tokens in request bodies', () => {
    const event = {
      request: {
        data: {
          identifier: 'some_handle',
          password: 'hunter2',
          token: 'abc123',
        },
      },
    };
    const scrubbed = scrub(event) as typeof event;
    expect(scrubbed.request.data.identifier).toBe('some_handle');
    expect(scrubbed.request.data.password).toBe('[REDACTED]');
    expect(scrubbed.request.data.token).toBe('[REDACTED]');
  });

  it('redacts student email addresses even under non-obvious keys', () => {
    const event = {
      contexts: {
        user: {
          id: 'uuid-1',
          email: 'student@cs.uni.edu',
        },
      },
      extra: {
        payload: {
          contact: 'john.doe@uni.edu',
        },
      },
    };
    const scrubbed = scrub(event) as typeof event;
    expect(scrubbed.contexts.user.id).toBe('uuid-1');
    expect(scrubbed.contexts.user.email).toBe('[REDACTED]');
    expect(scrubbed.extra.payload.contact).toBe('[REDACTED]');
  });

  it('leaves non-sensitive event data untouched', () => {
    const event = {
      event_id: 'abc',
      level: 'error',
      request: {
        method: 'POST',
        url: '/api/requests',
      },
    };
    expect(scrub(event)).toEqual(event);
  });
});
