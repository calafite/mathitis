import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestEnvironment, stopTestEnvironment, type TestContext } from './test-environment.js';

describe('Account management API', () => {
  let ctx: TestContext;
  let session: string;
  let csrf: string;

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

  async function createUser(handle: string, role: 'freshman' | 'senior', semester: number) {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.default.hash('AccountPass123!', {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    return ctx.prisma.user.create({
      data: {
        handle,
        email: `${handle}@cs.uni.edu`,
        passwordHash,
        role,
        semester,
        status: 'active',
        profile: {
          create: {
            socialName: `Social ${handle}`,
            tagline: 'test tagline',
            biographyMarkdown: '## About me\nLoving math.',
            themePalette: { primaryColor: '#6366f1', accentColor: '#ec4899', badgeColor: '#3b82f6', cardStyle: 'glassmorphic' },
            socialLinks: { github: 'https://github.com/test' },
            isAcceptingRequests: true,
            isDiscoverable: true,
          },
        },
      },
    });
  }

  async function login(identifier: string, password: string) {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier, password },
    });
    const cookies = parseCookies(res.headers['set-cookie'] as string[] | undefined);
    session = `mathitis_session=${cookies['mathitis_session']}`;
    csrf = cookies['mathitis_csrf'] ?? '';
    return res;
  }

  beforeAll(async () => {
    ctx = await startTestEnvironment();
    await createUser('acct_freshman', 'freshman', 1);
  });

  afterAll(async () => {
    await stopTestEnvironment(ctx);
  });

  it('requires authentication for account endpoints', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/account/settings' });
    expect(res.statusCode).toBe(403);

    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/account',
      payload: { semester: 2 },
    });
    expect(patch.statusCode).toBe(403);
  });

  it('GET /api/account/settings returns email, semester and preferences', async () => {
    await login('acct_freshman', 'AccountPass123!');
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/account/settings',
      headers: { cookie: session },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.email).toBe('acct_freshman@cs.uni.edu');
    expect(body.semester).toBe(1);
    expect(body.preferences).toBeNull();
  });

  it('PATCH /api/account updates semester and merges preferences', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/account',
      headers: { cookie: session, 'x-csrf-token': csrf },
      payload: { semester: 3, preferences: { theme: 'light', reducedMotion: true } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const after = await ctx.app.inject({
      method: 'GET',
      url: '/api/account/settings',
      headers: { cookie: session },
    });
    const body = after.json();
    expect(body.semester).toBe(3);
    expect(body.preferences).toMatchObject({ theme: 'light', reducedMotion: true });
  });

  it('POST /api/account/change-password rejects an incorrect current password', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/account/change-password',
      headers: { cookie: session, 'x-csrf-token': csrf },
      payload: { currentPassword: 'WrongPassword1', newPassword: 'NewPassword123!' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().ok).toBe(false);
  });

  it('POST /api/account/change-password updates the password and allows login with it', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/account/change-password',
      headers: { cookie: session, 'x-csrf-token': csrf },
      payload: { currentPassword: 'AccountPass123!', newPassword: 'NewPassword123!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const reLogin = await login('acct_freshman', 'NewPassword123!');
    expect(reLogin.statusCode).toBe(200);

    const oldLogin = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'acct_freshman', password: 'AccountPass123!' },
    });
    expect(oldLogin.statusCode).toBe(401);
  });

  it('GET /api/account/export returns complete data without password hash', async () => {
    await login('acct_freshman', 'NewPassword123!');

    const freshmenUser = await ctx.prisma.user.findUnique({ where: { handle: 'acct_freshman' } });
    await ctx.prisma.user.create({
      data: {
        handle: 'acct_senior',
        email: 'acct_senior@cs.uni.edu',
        passwordHash: freshmenUser!.passwordHash,
        role: 'senior',
        semester: 8,
        status: 'active',
        profile: { create: { socialName: 'Senior Acct' } },
      },
    });
    await ctx.prisma.mentorshipRequest.create({
      data: {
        freshmanId: freshmenUser!.id,
        seniorId: (await ctx.prisma.user.findUnique({ where: { handle: 'acct_senior' } }))!.id,
        message: 'Please mentor me',
        status: 'pending',
      },
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/account/export',
      headers: { cookie: session },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.user.handle).toBe('acct_freshman');
    expect(body.user.socialName).toBe('Social acct_freshman');
    expect(body.user.themePalette.primaryColor).toBe('#6366f1');
    expect(body.tags).toEqual([]);
    expect(body.sentRequests).toHaveLength(1);
    expect(body.sentRequests[0].seniorHandle).toBe('acct_senior');
    expect(body.sentRequests[0].seniorSocialName).toBe('Senior Acct');
    expect(body.sentRequests[0].status).toBe('pending');
    expect(body.sentRequests[0].decidedAt).toBeNull();
    expect(body.receivedRequests).toEqual([]);
    expect(body.lineage).toBeDefined();

    const raw = res.body;
    expect(raw).not.toContain('passwordHash');
    expect(raw).not.toContain('$argon2');
  });

  it('POST /api/account/anonymize requires a valid password', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/account/anonymize',
      headers: { cookie: session, 'x-csrf-token': csrf },
      payload: { password: 'WrongPassword1' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().ok).toBe(false);
  });

  it('POST /api/account/anonymize soft-deletes, scrubs profile and blocks further logins', async () => {
    const before = await ctx.prisma.user.findUnique({ where: { handle: 'acct_freshman' } });
    expect(before).not.toBeNull();
    const userId = before!.id;

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/account/anonymize',
      headers: { cookie: session, 'x-csrf-token': csrf },
      payload: { password: 'NewPassword123!' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const user = await ctx.prisma.user.findUnique({ where: { id: userId } });
    expect(user).not.toBeNull();
    expect(user!.status).toBe('deactivated');
    expect(user!.deletedAt).not.toBeNull();
    expect(user!.handle).toMatch(/^user_/);
    expect(user!.email).toContain('anonymized.local');

    const profile = await ctx.prisma.profile.findUnique({ where: { userId } });
    expect(profile!.socialName).toBeNull();
    expect(profile!.biographyMarkdown).toBeNull();
    expect(profile!.themePalette).toBeNull();
    expect(profile!.socialLinks).toBeNull();
    expect(profile!.isDiscoverable).toBe(false);

    const reLogin = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'acct_freshman', password: 'NewPassword123!' },
    });
    expect(reLogin.statusCode).toBe(401);
  });
});