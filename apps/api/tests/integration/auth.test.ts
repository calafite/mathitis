import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestContext,
} from './test-environment.js';

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
    message: 'If an account with that information exists, you will receive an email shortly.',
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
});