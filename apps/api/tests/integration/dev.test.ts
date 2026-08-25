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
  let developerId = '';
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
    const devUser = await createUser(developer);
    developerId = devUser.id;
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

  // -- Administrator management (developer-only) -----------------------------

  describe('admin management', () => {
    let adminCookie = '';
    let adminId = '';
    const adminUser: TestUser = {
      handle: 'managed_admin',
      email: 'managed_admin@cs.uni.edu',
      password: 'Pass12345!',
      role: 'administrator',
      semester: 8,
    };
    const student: TestUser = {
      handle: 'promote_me',
      email: 'promote_me@cs.uni.edu',
      password: 'Pass12345!',
      role: 'senior',
      semester: 6,
    };

    beforeAll(async () => {
      const created = await createUser(adminUser);
      adminId = created.id;
      await createUser(student);
      adminCookie = await login(adminUser.handle, adminUser.password);
    });

    it('forbids administrators, seniors and freshmen from managing admins', async () => {
      for (const cookie of [adminCookie, freshmanCookie]) {
        const list = await ctx.app.inject({
          method: 'GET',
          url: '/api/dev/admins',
          headers: { cookie },
        });
        expect(list.statusCode).toBe(403);

        const promote = await ctx.app.inject({
          method: 'POST',
          url: '/api/dev/admins',
          headers: { cookie },
          payload: { identifier: student.handle },
        });
        expect(promote.statusCode).toBe(403);

        const revoke = await ctx.app.inject({
          method: 'DELETE',
          url: `/api/dev/admins/${adminId}`,
          headers: { cookie },
        });
        expect(revoke.statusCode).toBe(403);
      }
    });

    it('lets a developer promote a student by handle', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/dev/admins',
        headers: { cookie: developerCookie },
        payload: { identifier: student.handle },
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().admin).toMatchObject({ handle: student.handle, role: 'administrator' });

      // The roster now includes the new administrator.
      const roster = await ctx.app.inject({
        method: 'GET',
        url: '/api/dev/admins',
        headers: { cookie: developerCookie },
      });
      const handles = roster.json().admins.map((a: { handle: string }) => a.handle);
      expect(handles).toContain(student.handle);
    });

    it('rejects promoting an unknown user or an existing admin', async () => {
      const ghost = await ctx.app.inject({
        method: 'POST',
        url: '/api/dev/admins',
        headers: { cookie: developerCookie },
        payload: { identifier: 'ghost_user' },
      });
      expect(ghost.statusCode).toBe(404);

      const duplicate = await ctx.app.inject({
        method: 'POST',
        url: '/api/dev/admins',
        headers: { cookie: developerCookie },
        payload: { identifier: adminUser.email },
      });
      expect(duplicate.statusCode).toBe(409);
    });

    it('kicks the revoked admin out of /api/admin routes via session epoch invalidation', async () => {
      // Sanity: the admin can currently reach admin-only endpoints.
      const before = await ctx.app.inject({
        method: 'GET',
        url: '/api/admin/audit-logs',
        headers: { cookie: adminCookie },
      });
      expect(before.statusCode).toBe(200);

      const revoke = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/dev/admins/${adminId}`,
        headers: { cookie: developerCookie },
      });
      expect(revoke.statusCode).toBe(200);

      // The stale session is rejected immediately.
      const after = await ctx.app.inject({
        method: 'GET',
        url: '/api/admin/audit-logs',
        headers: { cookie: adminCookie },
      });
      expect(after.statusCode).toBe(403);

      // Audit trail: the promotion targeted the student, the revocation the admin.
      const demoteLogs = await ctx.prisma.auditLog.findMany({
        where: { targetId: adminId, action: 'developer.admin.demote' },
      });
      expect(demoteLogs).toHaveLength(1);
      expect(demoteLogs[0]!.actorId).toBe(developerId);
      expect((demoteLogs[0]!.details as { previousRole?: string }).previousRole).toBe(
        'administrator',
      );

      const promoteLogs = await ctx.prisma.auditLog.findMany({
        where: { action: 'developer.admin.promote' },
      });
      const studentPromotion = promoteLogs.find((log) => log.details !== null);
      expect(studentPromotion).toBeDefined();
      expect((studentPromotion!.details as { previousRole?: string }).previousRole).toBe('senior');
    });
  });
});
