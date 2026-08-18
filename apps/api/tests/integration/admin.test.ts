import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestContext,
} from './test-environment.js';

interface TestUser {
  handle: string;
  email: string;
  password: string;
  role: 'senior' | 'freshman' | 'administrator' | 'developer';
  semester: number;
}

describe('Admin API', () => {
  let ctx: TestContext;

  const admin: TestUser = { handle: 'root_admin', email: 'root_admin@cs.uni.edu', password: 'Pass12345!', role: 'administrator', semester: 10 };
  const senior: TestUser = { handle: 'senior_adm', email: 'senior_adm@cs.uni.edu', password: 'Pass12345!', role: 'senior', semester: 8 };
  const senior2: TestUser = { handle: 'senior_adm2', email: 'senior_adm2@cs.uni.edu', password: 'Pass12345!', role: 'senior', semester: 7 };
  const freshman: TestUser = { handle: 'fresh_adm', email: 'fresh_adm@cs.uni.edu', password: 'Pass12345!', role: 'freshman', semester: 2 };
  const otherFreshman: TestUser = { handle: 'fresh_adm2', email: 'fresh_adm2@cs.uni.edu', password: 'Pass12345!', role: 'freshman', semester: 3 };

  let adminCookie = '';
  let freshmanCookie = '';
  let adminUserId = '';
  let seniorUserId = '';
  let senior2UserId = '';
  let freshmanUserId = '';
  let otherFreshmanId = '';

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
        profile: {
          create: {
            socialName: user.handle,
            isDiscoverable: user.role === 'senior',
            isAcceptingRequests: true,
            maxMentees: 3,
            biographyMarkdown: `Bio for ${user.handle}`,
            contactEmail: `contact-${user.handle}@cs.uni.edu`,
          },
        },
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

    const adminUser = await createUser(admin);
    const seniorUser = await createUser(senior);
    const senior2User = await createUser(senior2);
    const freshmanUser = await createUser(freshman);
    const otherFreshmanUser = await createUser(otherFreshman);

    adminUserId = adminUser.id;
    seniorUserId = seniorUser.id;
    senior2UserId = senior2User.id;
    freshmanUserId = freshmanUser.id;
    otherFreshmanId = otherFreshmanUser.id;

    adminCookie = await login(admin.handle, admin.password);
    freshmanCookie = await login(freshman.handle, freshman.password);
  });

  afterAll(async () => {
    await stopTestEnvironment(ctx);
  });

  // -- RBAC ----------------------------------------------------------------

  it('rejects admin endpoints for non-administrators with 403', async () => {
    const urls = [
      '/api/admin/config',
      '/api/admin/users',
      '/api/admin/approvals',
      '/api/dev/health',
      '/api/dev/metrics',
    ];
    for (const url of urls) {
      const res = await ctx.app.inject({ method: 'GET', url, headers: { cookie: freshmanCookie } });
      expect(res.statusCode, `Expected 403 for ${url}`).toBe(403);
    }
  });

  it('rejects anonymous access to admin endpoints with 403', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/admin/config' });
    expect(res.statusCode).toBe(403);
  });

  // -- System configuration ------------------------------------------------

  it('returns the default system configuration', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/config',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().config).toMatchObject({
      REQUIRE_ADMIN_REQUEST_APPROVAL: false,
      REGISTRATION_ENABLED: true,
      DISCOVERY_ACTIVE: true,
      EMAIL_NOTIFICATIONS_ENABLED: true,
      MAX_FRESHMAN_REQUESTS: 3,
      MAX_SENIOR_MENTEES: 3,
    });
  });

  it('patches configuration values and records an audit trail', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/admin/config',
      headers: { cookie: adminCookie },
      payload: {
        DISCOVERY_ACTIVE: false,
        MAX_FRESHMAN_REQUESTS: 5,
        REQUIRE_ADMIN_REQUEST_APPROVAL: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().config).toMatchObject({
      DISCOVERY_ACTIVE: false,
      MAX_FRESHMAN_REQUESTS: 5,
      REQUIRE_ADMIN_REQUEST_APPROVAL: true,
    });

    const audit = await ctx.prisma.auditLog.findMany({
      where: { action: 'config.update', targetEntity: 'system_config' },
      orderBy: { createdAt: 'asc' },
    });
    expect(audit).toHaveLength(3);
    const discoveryAudit = audit.find((row) => row.targetId === 'DISCOVERY_ACTIVE');
    expect(discoveryAudit).toBeDefined();
    expect(discoveryAudit!.actorId).toBe(adminUserId);
    expect(discoveryAudit!.details).toMatchObject({ before: true, after: false });
  });

  it('rejects invalid configuration values', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/admin/config',
      headers: { cookie: adminCookie },
      payload: { MAX_FRESHMAN_REQUESTS: 'many' },
    });
    expect(res.statusCode).toBe(422);

    const unknown = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/admin/config',
      headers: { cookie: adminCookie },
      payload: { NOT_A_REAL_KEY: true },
    });
    expect(unknown.statusCode).toBe(422);
  });

  it('closes the discovery catalog when DISCOVERY_ACTIVE is false', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/seniors',
      headers: { cookie: freshmanCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().seniors).toHaveLength(0);
    expect(res.json().total).toBe(0);
  });

  // -- User management -----------------------------------------------------

  it('lists users with role and status filters', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/users?role=freshman&status=active',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.users.map((u: { handle: string }) => u.handle).sort()).toEqual([
      'fresh_adm',
      'fresh_adm2',
    ]);
  });

  it('searches users by handle', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/users?q=senior_adm%40',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(1);
    expect(body.users[0].handle).toBe('senior_adm');
  });

  it('updates a user status and records an audit entry', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${freshmanUserId}/status`,
      headers: { cookie: adminCookie },
      payload: { status: 'suspended' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.status).toBe('suspended');

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'user.status.update', targetId: freshmanUserId },
    });
    expect(audit).toBeDefined();
    expect(audit!.details).toMatchObject({ before: 'active', after: 'suspended' });

    // Restore so later approval flows can use this freshman.
    const restore = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${freshmanUserId}/status`,
      headers: { cookie: adminCookie },
      payload: { status: 'active' },
    });
    expect(restore.statusCode).toBe(200);
  });

  it('clears profile content via moderation action', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${seniorUserId}/moderation`,
      headers: { cookie: adminCookie },
      payload: { action: 'clear_biography' },
    });
    expect(res.statusCode).toBe(200);

    const profile = await ctx.prisma.profile.findUnique({ where: { userId: seniorUserId } });
    expect(profile!.biographyMarkdown).toBeNull();
    expect(profile!.tagline).toBeNull();
  });

  it('anonymizes a user while preserving mentorships and lineage', async () => {
    // Create a mentorship relationship first so we can verify it survives.
    const request = await ctx.prisma.mentorshipRequest.create({
      data: {
        freshmanId: otherFreshmanId,
        seniorId: seniorUserId,
        message: 'Please mentor me',
        status: 'accepted',
      },
    });
    await ctx.prisma.mentorship.create({
      data: {
        requestId: request.id,
        freshmanId: otherFreshmanId,
        seniorId: seniorUserId,
        semester: 3,
        academicYear: '2025/2026',
      },
    });

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${otherFreshmanId}/anonymize`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.lineagePreserved).toBe(true);
    expect(body.user.deletedAt).not.toBeNull();
    expect(body.user.status).toBe('deactivated');
    expect(body.user.handle).not.toBe('fresh_adm2');
    expect(body.user.email).toMatch(/@anonymized\.local$/);

    const lineage = await ctx.prisma.mentorship.findMany({
      where: { freshmanId: otherFreshmanId },
    });
    expect(lineage).toHaveLength(1);

    const profile = await ctx.prisma.profile.findUnique({ where: { userId: otherFreshmanId } });
    expect(profile!.biographyMarkdown).toBeNull();
    expect(profile!.contactEmail).toBeNull();

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'user.anonymize', targetId: otherFreshmanId },
    });
    expect(audit).toBeDefined();
    expect(audit!.details).toMatchObject({ lineagePreserved: true });
  });

  it('cannot anonymize an already anonymized user', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${otherFreshmanId}/anonymize`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(409);
  });

  it('excludes an anonymized user from discovery search and public profiles', async () => {
    await ctx.prisma.systemConfig.upsert({
      where: { key: 'DISCOVERY_ACTIVE' },
      update: { value: 'true' },
      create: { key: 'DISCOVERY_ACTIVE', value: 'true' },
    });
    const doomed: TestUser = { handle: 'senior_doomed', email: 'senior_doomed@cs.uni.edu', password: 'Pass12345!', role: 'senior', semester: 6 };
    const doomedUser = await createUser(doomed);

    const before = await ctx.app.inject({
      method: 'GET',
      url: '/api/seniors',
      headers: { cookie: adminCookie },
    });
    expect(before.statusCode).toBe(200);
    const handlesBefore = (before.json().seniors as Array<{ handle: string }>).map((s) => s.handle);
    expect(handlesBefore).toContain(doomed.handle);

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${doomedUser.id}/anonymize`,
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);

    const after = await ctx.app.inject({
      method: 'GET',
      url: '/api/seniors',
      headers: { cookie: adminCookie },
    });
    const handlesAfter = (after.json().seniors as Array<{ handle: string }>).map((s) => s.handle);
    expect(handlesAfter).not.toContain(doomed.handle);

    const profile = await ctx.app.inject({
      method: 'GET',
      url: `/api/profiles/${doomed.handle}`,
    });
    expect(profile.statusCode).toBe(404);
  });

  it('returns 404 for unknown users', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/admin/users/${'00000000-0000-4000-8000-000000000000'}/status`,
      headers: { cookie: adminCookie },
      payload: { status: 'active' },
    });
    expect(res.statusCode).toBe(404);
  });

  // -- Approval queue ------------------------------------------------------

  it('lists pending approvals and approves one', async () => {
    const approvalRequest = await ctx.prisma.mentorshipRequest.create({
      data: {
        freshmanId: freshmanUserId,
        seniorId: senior2UserId,
        message: 'Please approve me',
        status: 'pending_admin_approval',
      },
    });

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/approvals',
      headers: { cookie: adminCookie },
    });
    expect(list.statusCode).toBe(200);
    const pending = list.json().approvals.filter(
      (a: { id: string }) => a.id === approvalRequest.id,
    );
    expect(pending).toHaveLength(1);
    expect(pending[0].freshman.handle).toBe('fresh_adm');

    const decide = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/approvals/${approvalRequest.id}/decide`,
      headers: { cookie: adminCookie },
      payload: { decision: 'approve' },
    });
    expect(decide.statusCode).toBe(200);
    expect(decide.json().request.status).toBe('accepted');

    const mentorship = await ctx.prisma.mentorship.findUnique({
      where: { requestId: approvalRequest.id },
    });
    expect(mentorship).not.toBeNull();

    const audit = await ctx.prisma.auditLog.findFirst({
      where: { action: 'approval.approve', targetId: approvalRequest.id },
    });
    expect(audit).toBeDefined();
    expect(audit!.actorId).toBe(adminUserId);
  });

  it('denies a pending approval', async () => {
    const approvalRequest = await ctx.prisma.mentorshipRequest.create({
      data: {
        freshmanId: otherFreshmanId,
        seniorId: senior2UserId,
        message: 'Reject me',
        status: 'pending_admin_approval',
      },
    });

    const decide = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/approvals/${approvalRequest.id}/decide`,
      headers: { cookie: adminCookie },
      payload: { decision: 'deny', reason: 'Insufficient effort score' },
    });
    expect(decide.statusCode).toBe(200);
    expect(decide.json().request.status).toBe('rejected');
    expect(decide.json().request.rejectionReason).toBe('Insufficient effort score');
  });

  it('returns 409 when deciding a request that is not awaiting approval', async () => {
    const doneRequest = await ctx.prisma.mentorshipRequest.create({
      data: {
        freshmanId: freshmanUserId,
        seniorId: seniorUserId,
        message: 'Already done',
        status: 'accepted',
      },
    });
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/api/admin/approvals/${doneRequest.id}/decide`,
      headers: { cookie: adminCookie },
      payload: { decision: 'approve' },
    });
    expect(res.statusCode).toBe(409);
  });

  // -- Audit log viewer -----------------------------------------------------

  it('restricts the audit log viewer to administrators', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs',
      headers: { cookie: freshmanCookie },
    });
    expect(res.statusCode).toBe(403);
  });

  it('lists audit logs with actor identity and pagination', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs?limit=10&offset=0',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    expect(body.auditLogs.length).toBeLessThanOrEqual(10);

    const logs = body.auditLogs as Array<{
      id: string;
      action: string;
      actor: { handle: string; role: string } | null;
      details: unknown;
      createdAt: string;
    }>;
    expect(logs[0]!.actor?.handle).toBe('root_admin');
    expect(logs[0]!.actor?.role).toBe('administrator');
    const times = logs.map((log) => new Date(log.createdAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('filters audit logs by action and date range', async () => {
    const filtered = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/audit-logs?action=user.anonymize&actorId=${adminUserId}`,
      headers: { cookie: adminCookie },
    });
    expect(filtered.statusCode).toBe(200);
    const body = filtered.json();
    expect(body.total).toBeGreaterThanOrEqual(1);
    for (const log of body.auditLogs as Array<{ action: string; actorId: string | null }>) {
      expect(log.action).toBe('user.anonymize');
      expect(log.actorId).toBe(adminUserId);
    }

    const from = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const emptyRange = await ctx.app.inject({
      method: 'GET',
      url: `/api/admin/audit-logs?from=${encodeURIComponent(from)}`,
      headers: { cookie: adminCookie },
    });
    expect(emptyRange.statusCode).toBe(200);
    expect(emptyRange.json().auditLogs).toHaveLength(0);
  });

  it('rejects malformed date range params', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs?from=not-a-date',
      headers: { cookie: adminCookie },
    });
    expect(res.statusCode).toBe(422);
  });
});