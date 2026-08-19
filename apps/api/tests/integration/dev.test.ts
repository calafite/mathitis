import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestEnvironment, stopTestEnvironment, type TestContext } from './test-environment.js';
import { clearDevMailbox, recordDevEmail } from '../../src/lib/dev-mailbox.js';

interface TestUser {
  handle: string;
  email: string;
  password: string;
  role: 'senior' | 'freshman' | 'administrator' | 'developer';
  semester: number;
}

describe('Developer Diagnostics API', () => {
  let ctx: TestContext;

  const developer: TestUser = {
    handle: 'dev_ops',
    email: 'dev_ops@cs.uni.edu',
    password: 'Pass12345!',
    role: 'developer',
    semester: 10,
  };
  const freshman: TestUser = {
    handle: 'fresh_dev',
    email: 'fresh_dev@cs.uni.edu',
    password: 'Pass12345!',
    role: 'freshman',
    semester: 2,
  };

  let developerCookie = '';
  let freshmanCookie = '';

  async function createUser(user: TestUser) {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.default.hash(user.password, {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    return ctx.prisma.user.create({
      data: {
        handle: user.handle,
        email: user.email,
        passwordHash,
        role: user.role,
        semester: user.semester,
        status: 'active',
        profile: { create: { socialName: user.handle, isDiscoverable: false } },
      },
    });
  }

  async function login(handle: string, password: string): Promise<string> {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: handle, password },
    });
    expect(res.statusCode, `Login failed: ${res.body}`).toBe(200);
    return String(res.headers['set-cookie']).split(';')[0] ?? '';
  }

  beforeAll(async () => {
    ctx = await startTestEnvironment();
    await createUser(developer);
    await createUser(freshman);
    developerCookie = await login(developer.handle, developer.password);
    freshmanCookie = await login(freshman.handle, freshman.password);
  });

  afterAll(async () => {
    await stopTestEnvironment(ctx);
  });

  it('rejects non-developers with 403', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dev/metrics',
      headers: { cookie: freshmanCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects anonymous access with 403', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/dev/health' });
    expect(res.statusCode).toBe(403);
  });

  it('reports healthy database, redis and queue checks', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dev/health',
      headers: { cookie: developerCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.status).toBe('ok');
    expect(body.checks).toEqual({ database: 'ok', redis: 'ok', queue: 'ok' });
    expect(typeof body.uptimeSeconds).toBe('number');
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });

  it('returns metrics with process, database, queue and network sections', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dev/metrics',
      headers: { cookie: developerCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().metrics;

    expect(typeof body.process.uptimeSeconds).toBe('number');
    expect(typeof body.process.memory.rss).toBe('number');
    expect(typeof body.process.memory.heapUsed).toBe('number');
    expect(body.process.pid).toBeGreaterThan(0);
    expect(body.process.nodeVersion).toMatch(/^v\d+/);

    expect(typeof body.database.totalConnections).toBe('number');
    expect(body.database.totalConnections).toBeGreaterThanOrEqual(0);

    expect(typeof body.queue.waiting).toBe('number');
    expect(typeof body.queue.completed).toBe('number');
    expect(typeof body.queue.throughput.completed).toBe('number');

    expect(Array.isArray(body.network.listeningPorts)).toBe(true);
    expect(Array.isArray(body.network.exposedPorts)).toBe(true);
    expect(Array.isArray(body.network.warnings)).toBe(true);
  });

  it('does not leak personal data in metrics', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dev/metrics',
      headers: { cookie: developerCookie },
    });
    const raw = res.body;
    expect(raw).not.toContain('fresh_dev@cs.uni.edu');
    expect(raw).not.toContain('Pass12345');
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('biographyMarkdown');
  });

  it('does not leak personal data in health', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/dev/health',
      headers: { cookie: developerCookie },
    });
    expect(res.body).not.toContain('fresh_dev@cs.uni.edu');
    expect(res.body).not.toContain('Pass12345');
  });

  describe('dev mailbox', () => {
    beforeAll(() => {
      clearDevMailbox();
    });

    it('rejects anonymous and non-developer access', async () => {
      const anon = await ctx.app.inject({ method: 'GET', url: '/api/dev/mailbox' });
      expect(anon.statusCode).toBe(403);
      const user = await ctx.app.inject({
        method: 'GET',
        url: '/api/dev/mailbox',
        headers: { cookie: freshmanCookie },
      });
      expect(user.statusCode).toBe(403);
    });

    it('lists captured emails for a developer', async () => {
      recordDevEmail({
        to: 'fresh_dev@cs.uni.edu',
        subject: 'Verify your Mathitis email',
        text: 'http://localhost:5173/verify-email?token=abcdef0123456789abcdef0123456789',
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/dev/mailbox',
        headers: { cookie: developerCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(Array.isArray(body.emails)).toBe(true);
      expect(body.emails[0]).toMatchObject({
        to: 'fresh_dev@cs.uni.edu',
        subject: 'Verify your Mathitis email',
      });
      expect(typeof body.emails[0].text).toBe('string');
    });

    it('filters the mailbox by recipient', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/dev/mailbox?to=${encodeURIComponent('fresh_dev@cs.uni.edu')}`,
        headers: { cookie: developerCookie },
      });
      expect(res.statusCode).toBe(200);
      const emails = res.json().emails;
      expect(emails.length).toBeGreaterThan(0);
      for (const email of emails) {
        expect(email.to).toBe('fresh_dev@cs.uni.edu');
      }
    });

    it('returns the latest verification link for an email', async () => {
      recordDevEmail({
        to: 'fresh_dev@cs.uni.edu',
        subject: 'Verify your Mathitis email',
        text: 'http://localhost:5173/verify-email?token=fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      });

      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/dev/verification-link?email=${encodeURIComponent('fresh_dev@cs.uni.edu')}`,
        headers: { cookie: developerCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().url).toBe(
        'http://localhost:5173/verify-email?token=fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321',
      );
    });

    it('returns null when no reset link exists for an email', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/dev/reset-link?email=${encodeURIComponent('nobody@cs.uni.edu')}`,
        headers: { cookie: developerCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().url).toBeNull();
    });
  });
});
