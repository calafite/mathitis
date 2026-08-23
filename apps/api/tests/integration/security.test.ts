import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import type { Env } from '../../src/config/env.js';
import { buildApp } from '../../src/app.js';
import { startTestEnvironment, stopTestEnvironment, type TestContext } from './test-environment.js';

describe('Security hardening: rate limits, CSRF and CORS', () => {
  let ctx: TestContext;
  const apps: Array<{ app: FastifyInstance; redis: Redis }> = [];

  function baseEnv(): Env {
    return {
      NODE_ENV: 'development',
      PORT: 4000,
      HOST: '0.0.0.0',
      JWT_SECRET: 'test_jwt_secret_that_is_at_least_32_characters_long',
      COOKIE_SECRET: 'test_cookie_secret_that_is_at_least_32_chars_long',
      SESSION_MAX_AGE_DAYS: 7,
      WEB_ORIGIN: undefined,
      RATE_LIMIT_GLOBAL_MAX: 1000,
      RATE_LIMIT_AUTH_MAX: 1000,
      RATE_LIMIT_REQUEST_MAX: 1000,
      DATABASE_URL: ctx.env.DATABASE_URL,
      REDIS_URL: ctx.env.REDIS_URL,
      S3_ENDPOINT: undefined,
      S3_BUCKET: undefined,
      S3_ACCESS_KEY: undefined,
      S3_SECRET_KEY: undefined,
      S3_USE_SSL: false,
      S3_PUBLIC_BASE_URL: undefined,
      PUBLIC_BASE_URL: 'http://localhost:4000',
      UPLOAD_DIR: '/tmp/mathitis-test-uploads',
      SENTRY_DSN: undefined,
      LOG_LEVEL: 'trace',
      SMTP_HOST: undefined,
      SMTP_PORT: undefined,
      SMTP_USER: undefined,
      SMTP_PASS: undefined,
      SMTP_FROM: undefined,
    };
  }

  async function createApp(overrides: Partial<Env> = {}): Promise<FastifyInstance> {
    const redis = new Redis(ctx.env.REDIS_URL);
    const app = await buildApp({ env: { ...baseEnv(), ...overrides }, prisma: ctx.prisma, redis });
    apps.push({ app, redis });
    return app;
  }

  function parseCookies(setCookie: string[] | undefined): Record<string, string> {
    const cookies: Record<string, string> = {};
    for (const entry of setCookie ?? []) {
      const [pair] = entry.split(';');
      if (!pair) continue;
      const eq = pair.indexOf('=');
      if (eq < 0) continue;
      cookies[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    return cookies;
  }

  beforeAll(async () => {
    ctx = await startTestEnvironment();

    const argon2 = await import('argon2');
    const passwordHash = await argon2.default.hash('password123', {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await ctx.prisma.user.create({
      data: {
        handle: 'sec_senior',
        email: 'sec_senior@example.com',
        passwordHash,
        role: 'senior',
        semester: 8,
        status: 'active',
        profile: { create: { socialName: 'Sec Senior', isDiscoverable: true, isAcceptingRequests: true, maxMentees: 3 } },
      },
    });
    await ctx.prisma.user.create({
      data: {
        handle: 'sec_freshman',
        email: 'sec_freshman@example.com',
        passwordHash,
        role: 'freshman',
        semester: 2,
        status: 'active',
        profile: { create: { socialName: 'Sec Freshman' } },
      },
    });
  });

  afterAll(async () => {
    for (const { app } of apps) {
      await app.close();
    }
    await stopTestEnvironment(ctx);
  });

  function login(app: FastifyInstance, password: string) {
    return app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'sec_freshman', password },
    });
  }

  describe('tiered rate limits', () => {
    it('limits auth endpoints to 5 requests per minute per IP', async () => {
      const app = await createApp({ RATE_LIMIT_AUTH_MAX: 5 });
      const statuses: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await login(app, 'wrong-password');
        statuses.push(res.statusCode);
      }
      expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
      expect(statuses[5]).toBe(429);
      const body = (await login(app, 'wrong-password')).json() as {
        error?: { code: string; statusCode: number };
      };
      expect(body.error?.statusCode).toBe(429);
      expect(body.error?.code).toBeTruthy();
    });

    it('limits request creation and bumps per user', async () => {
      const app = await createApp({ RATE_LIMIT_REQUEST_MAX: 3 });
      const cookie = String((await login(app, 'password123')).headers['set-cookie']).split(';')[0];

      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/profiles/sec_senior/bump',
          headers: { cookie },
          payload: {},
        });
        statuses.push(res.statusCode);
      }
      expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
      expect(statuses[3]).toBe(429);
    });

    it('applies a global default to public browsing routes', async () => {
      const app = await createApp({ RATE_LIMIT_GLOBAL_MAX: 3 });
      const statuses: number[] = [];
      for (let i = 0; i < 4; i++) {
        const res = await app.inject({ method: 'GET', url: '/api/tags' });
        statuses.push(res.statusCode);
      }
      expect(statuses.slice(0, 3)).toEqual([200, 200, 200]);
      expect(statuses[3]).toBe(429);
    });
  });

  describe('CSRF double-submit protection', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = await createApp();
    });

    it('rejects state-changing requests with a mismatched token', async () => {
      const res = await login(app, 'password123');
      const cookies = parseCookies(res.headers['set-cookie'] as string[] | undefined);
      const session = `mathitis_session=${cookies['mathitis_session']}`;
      const csrf = `mathitis_csrf=${cookies['mathitis_csrf']}`;

      const rejected = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie: `${session}; ${csrf}`, 'x-csrf-token': 'invalid-token' },
      });
      expect(rejected.statusCode).toBe(403);
      expect(rejected.json().error.code).toBe('CSRF_INVALID');
    });

    it('rejects cross-site requests even with a valid token', async () => {
      const res = await login(app, 'password123');
      const cookies = parseCookies(res.headers['set-cookie'] as string[] | undefined);
      const session = `mathitis_session=${cookies['mathitis_session']}`;
      const csrf = `mathitis_csrf=${cookies['mathitis_csrf']}`;

      const rejected = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          cookie: `${session}; ${csrf}`,
          'x-csrf-token': cookies['mathitis_csrf'],
          'sec-fetch-site': 'cross-site',
        },
      });
      expect(rejected.statusCode).toBe(403);
    });

    it('allows state-changing requests that echo the csrf token', async () => {
      const res = await login(app, 'password123');
      const cookies = parseCookies(res.headers['set-cookie'] as string[] | undefined);
      const session = `mathitis_session=${cookies['mathitis_session']}`;
      const csrf = `mathitis_csrf=${cookies['mathitis_csrf']}`;

      const allowed = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: {
          cookie: `${session}; ${csrf}`,
          'x-csrf-token': cookies['mathitis_csrf'],
        },
      });
      expect(allowed.statusCode).toBe(200);
    });

    it('allows non-browser clients that carry no csrf cookie', async () => {
      const cookie = String((await login(app, 'password123')).headers['set-cookie']).split(';')[0];

      const allowed = await app.inject({
        method: 'POST',
        url: '/api/auth/logout',
        headers: { cookie },
      });
      expect(allowed.statusCode).toBe(200);
    });
  });

  describe('CORS allowlist', () => {
    it('does not allow cross-origin access when no origin is allowed', async () => {
      const app = await createApp({ NODE_ENV: 'production' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { origin: 'https://evil.example.com' },
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('rejects cross-origin requests from a non-allowlisted origin', async () => {
      const app = await createApp({ WEB_ORIGIN: 'https://pasteldemiolos.xyz' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { origin: 'https://evil.example.com' },
      });
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('allows a configured origin via WEB_ORIGIN', async () => {
      const app = await createApp({ WEB_ORIGIN: 'https://pasteldemiolos.xyz' });
      const res = await app.inject({
        method: 'GET',
        url: '/api/tags',
        headers: { origin: 'https://pasteldemiolos.xyz' },
      });
      expect(res.headers['access-control-allow-origin']).toBe('https://pasteldemiolos.xyz');
    });
  });
});
