import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { startTestEnvironment, stopTestEnvironment, type TestContext } from './test-environment.js';

describe('Auth API', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await startTestEnvironment();
  });

  afterAll(async () => {
    await stopTestEnvironment(ctx);
  });

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
    plainToken: string,
    expiresAt: Date = new Date(Date.now() + 24 * 60 * 60 * 1000),
  ) {
    const argon2 = await import('argon2');
    const digest = createHash('sha256').update(plainToken).digest();
    const tokenHash = await argon2.default.hash(digest, {
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
    const plain = 'cafebabe'.repeat(4);
    await issueKnownToken(user.id, 'email_verification', plain);

    const res = await ctx.app.inject({ method: 'GET', url: `/api/auth/verify-email/${plain}` });
    expect(res.statusCode).toBe(200);

    const after = await ctx.prisma.user.findUnique({ where: { id: user.id } });
    expect(after!.status).toBe('active');
    const token = await ctx.prisma.userToken.findFirst({
      where: { userId: user.id, type: 'email_verification' },
    });
    expect(token!.consumedAt).not.toBeNull();
  });

  it('treats a re-verified (already consumed) token as an idempotent success', async () => {
    const plain = 'cafebabe'.repeat(4);
    const again = await ctx.app.inject({ method: 'GET', url: `/api/auth/verify-email/${plain}` });
    expect(again.statusCode).toBe(200);
    const user = await ctx.prisma.user.findUnique({ where: { email: 'tokenverify@cs.uni.edu' } });
    expect(user!.status).toBe('active');
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
    const plain = 'deadbeef'.repeat(4);
    await issueKnownToken(user.id, 'email_verification', plain, new Date(Date.now() - 1000));

    const res = await ctx.app.inject({ method: 'GET', url: `/api/auth/verify-email/${plain}` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_INVALID');
  });

  it('rejects a forged token that does not match the stored hash', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/auth/verify-email/${'0badc0de'.repeat(4)}`,
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('TOKEN_INVALID');
  });
});
