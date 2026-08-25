import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestEnvironment, stopTestEnvironment, type TestContext } from './test-environment.js';

describe('Auth API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestEnvironment();
  });

  afterAll(async () => {
    await stopTestEnvironment(ctx);
  });


  async function loginMailboxAdmin(): Promise<string> {
    // The integration environment does not seed users, so create a dedicated
    // administrator for privileged checks.
    const argon2 = await import('argon2');
    const passwordHash = await argon2.default.hash('MailboxAdmin123!', {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    await ctx.prisma.user.upsert({
      where: { handle: 'mailbox_admin' },
      update: { passwordHash },
      create: {
        handle: 'mailbox_admin',
        email: 'mailbox_admin@cs.uni.edu',
        passwordHash,
        role: 'administrator',
        semester: 12,
        status: 'active',
        profile: { create: { socialName: 'Mailbox Admin' } },
      },
    });

    const adminLogin = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'mailbox_admin', password: 'MailboxAdmin123!' },
      // Dedicated IP: the auth rate limit is per-IP and other tests share 127.0.0.1.
      remoteAddress: '10.99.99.99',
    });
    if (!adminLogin.cookies[0]) {
      throw new Error(`admin login failed: ${adminLogin.statusCode} ${adminLogin.body}`);
    }
    return adminLogin.cookies[0]!.value;
  }


  async function activateUser(handle: string) {
    await ctx.prisma.user.update({
      where: { handle },
      data: { status: 'active' },
    });
  }

  /** Creates a password_reset token the same way the auth service does. */
  async function mintResetToken(userId: string): Promise<string> {
    const { randomBytes } = await import('node:crypto');
    const argon2 = await import('argon2');
    const plainSecret = randomBytes(32).toString('hex');
    const tokenHash = await argon2.default.hash(plainSecret, {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    const token = await ctx.prisma.userToken.create({
      data: {
        userId,
        tokenHash,
        type: 'password_reset',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
    return `${token.id}.${plainSecret}`;
  }

  const genericBody = {
    ok: true,
    message: 'Se existir uma conta com essas informações, você receberá um e-mail em breve.',
  };

  it('register returns 200 with generic message', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        handle: 'freshman_test',
        email: 'freshman_test@cs.uni.edu',
        password: 'StrongPassword123!',
        semester: 1,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(genericBody);
  });

  it('register returns identical generic body when email exists (enumeration prevention)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        handle: 'another_handle',
        email: 'freshman_test@cs.uni.edu',
        password: 'StrongPassword123!',
        semester: 1,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(genericBody);
  });

  it('login with unverified account returns 401', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'freshman_test', password: 'StrongPassword123!' },
    });

    expect(res.statusCode).toBe(401);
  });

  it('logs in a seeded active user and returns session cookie', async () => {
    // Seed an active user directly through prisma
    const argon2 = await import('argon2');
    const passwordHash = await argon2.default.hash('ActivePass123!', {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    await ctx.prisma.user.create({
      data: {
        handle: 'active_user',
        email: 'active_user@cs.uni.edu',
        passwordHash,
        role: 'freshman',
        semester: 2,
        status: 'active',
        profile: { create: { socialName: 'Active' } },
      },
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'active_user', password: 'ActivePass123!' },
    });

    if (res.statusCode !== 200) console.error('LOGIN ERROR:', res.statusCode, res.body);
    expect(res.statusCode, `Body: ${res.body}`).toBe(200);
    expect(res.json().user).toMatchObject({ handle: 'active_user', role: 'freshman' });
    const setCookie = res.headers['set-cookie'];
    expect(setCookie).toBeTruthy();
    expect(String(setCookie)).toContain('mathitis_session');
    expect(String(setCookie)).toContain('HttpOnly');
  });

  it('me returns the authenticated user with cookie', async () => {
    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: 'active_user', password: 'ActivePass123!' },
    });
    const cookie = String(login.headers['set-cookie']).split(';')[0];

    const me = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie },
    });

    expect(me.statusCode).toBe(200);
    expect(me.json().user.handle).toBe('active_user');
  });

  it('me returns 403 when no session cookie present', async () => {
    const me = await ctx.app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(me.statusCode).toBe(403);
  });

  it('recover returns 200 generic response for both existing and missing emails', async () => {
    const existing = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/recover',
      payload: { email: 'active_user@cs.uni.edu' },
    });
    const missing = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/recover',
      payload: { email: 'nobody@cs.uni.edu' },
    });

    expect(existing.statusCode).toBe(200);
    expect(existing.json()).toEqual(genericBody);
    expect(missing.statusCode).toBe(200);
    expect(missing.json()).toEqual(genericBody);
    expect(existing.json()).toEqual(missing.json());
  });

  it('rejects invalid payloads with validation error', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        handle: 'x',
        email: 'not-an-email',
        password: 'short',
        semester: 99,
      },
    });

    expect(res.statusCode).toBe(422);
  });

  // -- user_tokens flow -------------------------------------------------------

  async function issueKnownToken(
    userId: string,
    type: 'email_verification' | 'password_reset',
    plainSecret: string,
    expiresAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000),
  ) {
    const argon2 = await import('argon2');
    const tokenHash = await argon2.default.hash(plainSecret, {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    return ctx.prisma.userToken.create({
      data: { userId, type, tokenHash, expiresAt },
    });
  }

  it('stores email verification tokens as hashes on registration', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        handle: 'tokenuser',
        email: 'tokenuser@cs.uni.edu',
        password: 'StrongPassword123!',
        semester: 1,
      },
    });
    expect(res.statusCode).toBe(200);

    const user = await ctx.prisma.user.findUnique({ where: { email: 'tokenuser@cs.uni.edu' } });
    const tokens = await ctx.prisma.userToken.findMany({
      where: { userId: user!.id, type: 'email_verification' },
    });
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.consumedAt).toBeNull();
    expect(tokens[0]!.tokenHash).toMatch(/^\$argon2/);
    expect(tokens[0]!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('verifies email, activates the user, and consumes the token', async () => {
    const user = await ctx.prisma.user.create({
      data: {
        handle: 'tokenverify',
        email: 'tokenverify@cs.uni.edu',
        passwordHash: 'irrelevant-for-login',
        role: 'freshman',
        semester: 1,
        status: 'pending_verification',
      },
    });
    const plainSecret = 'cafebabe'.repeat(4);
    const token = await issueKnownToken(user.id, 'email_verification', plainSecret);
    const compositeToken = `${token.id}.${plainSecret}`;

    const res = await ctx.app.inject({ method: 'GET', url: `/api/auth/verify-email/${compositeToken}` });
    expect(res.statusCode).toBe(200);

    const after = await ctx.prisma.user.findUnique({ where: { id: user.id } });
    expect(after!.status).toBe('active');
    const storedToken = await ctx.prisma.userToken.findFirst({
      where: { userId: user.id, type: 'email_verification' },
    });
    expect(storedToken!.consumedAt).not.toBeNull();
  });

  it('treats a re-verified (already consumed) token as an idempotent success', async () => {
    const user = await ctx.prisma.user.findUnique({ where: { email: 'tokenverify@cs.uni.edu' } });
    const token = await ctx.prisma.userToken.findFirst({
      where: { userId: user!.id, type: 'email_verification' },
    });
    const compositeToken = `${token!.id}.${'cafebabe'.repeat(4)}`;
    const again = await ctx.app.inject({ method: 'GET', url: `/api/auth/verify-email/${compositeToken}` });
    expect(again.statusCode).toBe(200);
    const userAfter = await ctx.prisma.user.findUnique({ where: { email: 'tokenverify@cs.uni.edu' } });
    expect(userAfter!.status).toBe('active');
  });

  it('rejects an expired verification token', async () => {
    const user = await ctx.prisma.user.create({
      data: {
        handle: 'tokenexpired',
        email: 'tokenexpired@cs.uni.edu',
        passwordHash: 'irrelevant-for-login',
        role: 'freshman',
        semester: 1,
        status: 'pending_verification',
      },
    });
    const plainSecret = 'deadbeef'.repeat(4);
    const token = await issueKnownToken(user.id, 'email_verification', plainSecret, new Date(Date.now() - 1000));
    const compositeToken = `${token.id}.${plainSecret}`;

    const res = await ctx.app.inject({ method: 'GET', url: `/api/auth/verify-email/${compositeToken}` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_INVALID');
  });

  it('rejects a forged token that does not match the stored hash', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/auth/verify-email/${'00000000-0000-0000-0000-000000000000'}.${'0badc0de'.repeat(4)}`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_INVALID');
  });

  it('locks an account after repeated failed logins and rejects the correct password while locked', async () => {
    const handle = 'lockout_user';
    await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        handle,
        email: `${handle}@cs.uni.edu`,
        password: 'StrongPassword123!',
        semester: 1,
      },
    });
    // The integration env has no queue worker, so activate directly.
    await activateUser(handle);

    // Exhaust the attempt budget (LOGIN_MAX_ATTEMPTS = 5 in the test env).
    for (let i = 0; i < 5; i += 1) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: handle, password: 'WrongPassword123!' },
        remoteAddress: '10.50.0.7',
      });
      expect(res.statusCode).toBe(401);
    }

    // Even the CORRECT password is rejected while the lock is active —
    // with the same generic message (no oracle).
    const locked = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: handle, password: 'StrongPassword123!' },
      remoteAddress: '10.50.0.8',
    });
    expect(locked.statusCode).toBe(401);
    expect(locked.json().message ?? locked.json().error).toBeDefined();

    // The lockout was audited.
    const mailboxCookie = await loginMailboxAdmin();
    const audit = await ctx.app.inject({
      method: 'GET',
      url: '/api/admin/audit-logs?action=account.lockout',
      cookies: { mathitis_session: mailboxCookie },
    });
    expect(audit.statusCode).toBe(200);
    expect(JSON.stringify(audit.json())).toContain('account.lockout');
  });

  it('invalidates existing sessions after a password reset via token', async () => {
    const handle = 'reset_epoch_user';
    await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        handle,
        email: `${handle}@cs.uni.edu`,
        password: 'StrongPassword123!',
        semester: 2,
      },
    });
    await activateUser(handle);

    // Sign in and keep the session cookie.
    const login = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: handle, password: 'StrongPassword123!' },
      remoteAddress: '10.51.0.1',
    });
    expect(login.statusCode).toBe(200);
    const oldCookie = login.cookies[0]!.value;

    const meBefore = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { mathitis_session: oldCookie },
    });
    expect(meBefore.statusCode).toBe(200);

    // Mint a reset token directly (no queue worker in the integration env).
    const user = await ctx.prisma.user.findUnique({ where: { handle } });
    const resetToken = await mintResetToken(user!.id);

    const reset = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/reset-password',
      payload: { token: resetToken, password: 'NewStrongPassword123!' },
    });
    expect(reset.statusCode).toBe(200);

    // The old session cookie is now dead (rejected as unauthenticated).
    const meAfter = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { mathitis_session: oldCookie },
    });
    expect(meAfter.statusCode).toBe(403);

    // Login works with the new password and yields a working session.
    const relogin = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: handle, password: 'NewStrongPassword123!' },
      remoteAddress: '10.51.0.2',
    });
    expect(relogin.statusCode).toBe(200);
    const meNew = await ctx.app.inject({
      method: 'GET',
      url: '/api/auth/me',
      cookies: { mathitis_session: relogin.cookies[0]!.value },
    });
    expect(meNew.statusCode).toBe(200);
  });
});
