import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestEnvironment, stopTestEnvironment, type TestContext } from './test-environment.js';

type Role = 'senior' | 'freshman' | 'administrator';

interface TestUser {
  handle: string;
  email: string;
  password: string;
  role: Role;
  semester: number;
}

const tagNames = ['algebra', 'analysis', 'geometry'] as const;

type TagName = (typeof tagNames)[number];

describe('Discovery, Requests & Lineage API', () => {
  let ctx: TestContext;
  let tagIds: Record<TagName, string>;

  const seniorA: TestUser = {
    handle: 'senior_a',
    email: 'senior_a@cs.uni.edu',
    password: 'Pass12345!',
    role: 'senior',
    semester: 8,
  };
  const seniorB: TestUser = {
    handle: 'senior_b',
    email: 'senior_b@cs.uni.edu',
    password: 'Pass12345!',
    role: 'senior',
    semester: 6,
  };
  const seniorC: TestUser = {
    handle: 'senior_c',
    email: 'senior_c@cs.uni.edu',
    password: 'Pass12345!',
    role: 'senior',
    semester: 4,
  };
  const seniorD: TestUser = {
    handle: 'senior_d',
    email: 'senior_d@cs.uni.edu',
    password: 'Pass12345!',
    role: 'senior',
    semester: 7,
  };
  const seniorE: TestUser = {
    handle: 'senior_e',
    email: 'senior_e@cs.uni.edu',
    password: 'Pass12345!',
    role: 'senior',
    semester: 5,
  };
  const hiddenSenior: TestUser = {
    handle: 'hidden_senior',
    email: 'hidden_senior@cs.uni.edu',
    password: 'Pass12345!',
    role: 'senior',
    semester: 5,
  };
  const freshmanA: TestUser = {
    handle: 'freshman_a',
    email: 'freshman_a@cs.uni.edu',
    password: 'Pass12345!',
    role: 'freshman',
    semester: 2,
  };
  const freshmanB: TestUser = {
    handle: 'freshman_b',
    email: 'freshman_b@cs.uni.edu',
    password: 'Pass12345!',
    role: 'freshman',
    semester: 3,
  };
  const admin: TestUser = {
    handle: 'admin_one',
    email: 'admin_one@cs.uni.edu',
    password: 'Pass12345!',
    role: 'administrator',
    semester: 10,
  };

  let seniorCookie = '';
  let freshmanCookie = '';
  let adminCookie = '';

  async function createUser(
    user: TestUser,
    options?: {
      discoverable?: boolean;
      accepting?: boolean;
      maxMentees?: number;
      tags?: TagName[];
      effortScore?: number;
    },
  ) {
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
            isDiscoverable: options?.discoverable ?? user.role === 'senior',
            isAcceptingRequests: options?.accepting ?? true,
            maxMentees: options?.maxMentees ?? 3,
            effortScore: options?.effortScore ?? 0,
            tags: options?.tags
              ? { create: options.tags.map((name) => ({ tagId: tagIds[name] })) }
              : undefined,
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

  async function createReapplyPair(): Promise<{ freshman: string; senior: string }> {
    const seniorUser: TestUser = {
      handle: 'reapply_senior',
      email: 'reapply_senior@cs.uni.edu',
      password: 'Pass12345!',
      role: 'senior',
      semester: 8,
    };
    const freshUser: TestUser = {
      handle: 'reapply_fresh',
      email: 'reapply_fresh@cs.uni.edu',
      password: 'Pass12345!',
      role: 'freshman',
      semester: 2,
    };
    for (const user of [seniorUser, freshUser]) {
      const exists = await ctx.prisma.user.findUnique({ where: { handle: user.handle } });
      if (!exists) await createUser(user);
    }
    const pair = await ctx.prisma.user.findUnique({ where: { handle: freshUser.handle } });
    const seniorRow = await ctx.prisma.user.findUnique({ where: { handle: seniorUser.handle } });
    await ctx.prisma.mentorshipRequest.updateMany({
      where: {
        freshmanId: pair!.id,
        seniorId: seniorRow!.id,
        status: { in: ['pending', 'pending_admin_approval'] },
      },
      data: { status: 'cancelled' },
    });
    const freshman = await login(freshUser.handle, freshUser.password);
    const senior = await login(seniorUser.handle, seniorUser.password);
    return { freshman, senior };
  }

  beforeAll(async () => {
    ctx = await startTestEnvironment();

    const tagRows = await Promise.all(
      tagNames.map((name, index) =>
        ctx.prisma.tag.create({
          data: { name, category: 'math', color: '#6366f1', icon: `tag${index}` },
        }),
      ),
    );
    tagIds = {
      algebra: tagRows[0]!.id,
      analysis: tagRows[1]!.id,
      geometry: tagRows[2]!.id,
    };

    await createUser(seniorA, {
      discoverable: true,
      maxMentees: 1,
      tags: ['algebra', 'analysis'],
      effortScore: 80,
    });
    await createUser(seniorB, { discoverable: true, accepting: false, tags: ['geometry'] });
    await createUser(seniorC, { discoverable: true, maxMentees: 1, tags: ['algebra'] });
    await createUser(seniorD, { discoverable: true, tags: ['analysis'] });
    await createUser(seniorE, { discoverable: true, tags: [] });
    await createUser(hiddenSenior, { discoverable: false });
    await createUser(freshmanA, { discoverable: false, tags: ['algebra'] });
    await createUser(freshmanB, { discoverable: false, tags: ['geometry'] });
    await createUser(admin);

    seniorCookie = await login(seniorA.handle, seniorA.password);
    freshmanCookie = await login(freshmanA.handle, freshmanA.password);
    adminCookie = await login(admin.handle, admin.password);
  });

  afterAll(async () => {
    await stopTestEnvironment(ctx);
  });

  // -- Tags ---------------------------------------------------------------

  it('lists tags publicly', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/tags' });
    expect(res.statusCode).toBe(200);
    expect(
      res
        .json()
        .tags.map((tag: { name: string }) => tag.name)
        .sort(),
    ).toEqual([...tagNames].sort());
  });

  // -- Discovery catalog ---------------------------------------------------

  it('requires authentication for the discovery catalog', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/seniors' });
    expect(res.statusCode).toBe(403);
  });

  it('returns only discoverable seniors with counters', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/seniors',
      headers: { cookie: freshmanCookie },
    });
    expect(res.statusCode).toBe(200);
    const seniors = res.json().seniors as Array<{
      handle: string;
      bumpCount: number;
      activeMenteeCount: number;
    }>;
    const handles = seniors.map((s) => s.handle).sort();
    expect(handles).toEqual(['senior_a', 'senior_b', 'senior_c', 'senior_d', 'senior_e']);
    for (const senior of seniors) {
      expect(senior.bumpCount).toBe(0);
      expect(senior.activeMenteeCount).toBe(0);
    }
  });

  it('filters by semester, availability and tags', async () => {
    const bySemester = await ctx.app.inject({
      method: 'GET',
      url: '/api/seniors?semester=8',
      headers: { cookie: freshmanCookie },
    });
    expect(bySemester.statusCode).toBe(200);
    expect(bySemester.json().seniors.map((s: { handle: string }) => s.handle)).toEqual([
      'senior_a',
    ]);

    const byAvailability = await ctx.app.inject({
      method: 'GET',
      url: '/api/seniors?availability=accepting',
      headers: { cookie: freshmanCookie },
    });
    expect(byAvailability.statusCode).toBe(200);
    expect(
      byAvailability
        .json()
        .seniors.map((s: { handle: string }) => s.handle)
        .sort(),
    ).toEqual(['senior_a', 'senior_c', 'senior_d', 'senior_e']);

    const byTag = await ctx.app.inject({
      method: 'GET',
      url: `/api/seniors?tagIds=${tagIds.algebra}`,
      headers: { cookie: freshmanCookie },
    });
    expect(byTag.statusCode).toBe(200);
    expect(
      byTag
        .json()
        .seniors.map((s: { handle: string }) => s.handle)
        .sort(),
    ).toEqual(['senior_a', 'senior_c']);
  });

  // -- Recommendations ------------------------------------------------------

  it('recommends seniors ordered by compatibility score with match reasons', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/recommendations',
      headers: { cookie: freshmanCookie },
    });
    expect(res.statusCode).toBe(200);
    const recommendations = res.json().recommendations as Array<{
      handle: string;
      score: number;
      matchReasons: string[];
    }>;
    expect(recommendations.length).toBeGreaterThan(0);
    const scores = recommendations.map((r) => r.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    // freshman_a tags = [algebra]; senior_a shares algebra + high effort score,
    // so it leads even though senior_c has full tag overlap.
    expect(recommendations[0]!.handle).toBe('senior_a');
    for (const recommendation of recommendations) {
      expect(Array.isArray(recommendation.matchReasons)).toBe(true);
    }
    // The leading senior shares the freshman's algebra tag, so its reasons
    // explain that overlap.
    expect(recommendations[0]!.matchReasons).toContain('1 interesse em comum: algebra');
  });

  // -- Bumps ---------------------------------------------------------------

  it('rejects bumps from non-freshmen', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/profiles/senior_a/bump',
      headers: { cookie: seniorCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows a freshman to bump a senior and reports remaining slots', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/profiles/senior_a/bump',
      headers: { cookie: freshmanCookie },
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ bumped: true, bumpCount: 1, remainingSlots: 3 });
  });

  it('enforces the 4-bump limit and supports reallocation', async () => {
    const cookie = freshmanCookie;
    for (const handle of ['senior_b', 'senior_c', 'senior_d']) {
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/api/profiles/${handle}/bump`,
        headers: { cookie },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
    }

    // freshman_a now bumps a, b, c, d (4 active)
    const duplicate = await ctx.app.inject({
      method: 'POST',
      url: '/api/profiles/senior_a/bump',
      headers: { cookie },
      payload: {},
    });
    expect(duplicate.statusCode).toBe(200);
    expect(duplicate.json().bumpCount).toBe(4);

    const fifth = await ctx.app.inject({
      method: 'POST',
      url: '/api/profiles/senior_e/bump',
      headers: { cookie },
      payload: {},
    });
    expect(fifth.statusCode).toBe(409);
    expect(fifth.json().error.code).toBe('BUMP_LIMIT_REACHED');

    const reallocated = await ctx.app.inject({
      method: 'POST',
      url: '/api/profiles/senior_e/bump',
      headers: { cookie },
      payload: { replaceHandle: 'senior_d' },
    });
    expect(reallocated.statusCode).toBe(200);
    expect(reallocated.json().bumpCount).toBe(4);
    expect(reallocated.json().remainingSlots).toBe(0);
  });

  it('removes a bump', async () => {
    const res = await ctx.app.inject({
      method: 'DELETE',
      url: '/api/profiles/senior_c/bump',
      headers: { cookie: freshmanCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ bumped: false, bumpCount: 3 });
  });

  // -- Requests --------------------------------------------------------------

  function idemKey(tag: string) {
    return `key-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  it('submits a request with an idempotency key', async () => {
    const key = idemKey('submit');
    const payload = {
      seniorHandle: seniorA.handle,
      message: 'Hello, I would love to learn algebra.',
    };
    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie, 'x-idempotency-key': key },
      payload,
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().request).toMatchObject({ status: 'pending' });
    expect(first.json().request.freshmanId).toBeTruthy();
    expect(first.json().request.seniorId).toBeTruthy();
    const requestId = first.json().request.id as string;
    expect(requestId).toBeTruthy();

    const replay = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie, 'x-idempotency-key': key },
      payload,
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.json().request.id).toBe(requestId);
  });

  it('rejects duplicate active requests to the same senior', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie, 'x-idempotency-key': idemKey('dup') },
      payload: { seniorHandle: seniorA.handle, message: 'Second application' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('DUPLICATE_REQUEST');
  });

  it('requires an idempotency key header', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie },
      payload: { seniorHandle: seniorA.handle, message: 'no key' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('lists the freshman sent inbox without revealing senior request privacy', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/requests?inbox=sent',
      headers: { cookie: freshmanCookie },
    });
    expect(res.statusCode).toBe(200);
    const requests = res.json().requests as Array<{ status: string; freshman: unknown }>;
    expect(requests.some((r) => r.status === 'pending')).toBe(true);
  });

  it('inspecting own request reveals the freshman rich profile to the target senior', async () => {
    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/requests?inbox=sent',
      headers: { cookie: freshmanCookie },
    });
    const pending = (list.json().requests as Array<{ id: string }>)[0]!;

    const asFreshman = await ctx.app.inject({
      method: 'GET',
      url: `/api/requests/${pending.id}`,
      headers: { cookie: freshmanCookie },
    });
    expect(asFreshman.statusCode).toBe(200);
    expect(asFreshman.json().request.freshmanProfile).toBeTruthy();

    const asSenior = await ctx.app.inject({
      method: 'GET',
      url: `/api/requests/${pending.id}`,
      headers: { cookie: seniorCookie },
    });
    expect(asSenior.statusCode).toBe(200);
    const profile = asSenior.json().request.freshmanProfile;
    expect(profile.handle).toBe(freshmanA.handle);
    expect(profile.tags.map((tag: { name: string }) => tag.name)).toContain('algebra');
  });

  it('forbids inspecting a request you are not a party to', async () => {
    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/requests?inbox=sent',
      headers: { cookie: freshmanCookie },
    });
    const pending = (list.json().requests as Array<{ id: string }>)[0]!;
    const other = await login(freshmanB.handle, freshmanB.password);
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/requests/${pending.id}`,
      headers: { cookie: other },
    });
    expect(res.statusCode).toBe(403);
  });

  it('accepts a request transactionally and records a permanent mentorship', async () => {
    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/requests?inbox=sent',
      headers: { cookie: freshmanCookie },
    });
    const pending = (list.json().requests as Array<{ id: string }>)[0]!;

    const accepted = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${pending.id}/accept`,
      headers: { cookie: seniorCookie, 'x-idempotency-key': idemKey('accept') },
    });
    expect(accepted.statusCode, `Body: ${accepted.body}`).toBe(200);
    expect(accepted.json().request.status).toBe('accepted');

    const mentorship = await ctx.prisma.mentorship.findFirst({
      where: { requestId: pending.id },
    });
    expect(mentorship).toBeTruthy();
    expect(mentorship!.semester).toBe(freshmanA.semester);
    expect(mentorship!.academicYear).toMatch(/^\d{4}\/\d{4}$/);

    const lineage = await ctx.app.inject({ method: 'GET', url: '/api/lineage' });
    expect(lineage.statusCode).toBe(200);
    const handles = (lineage.json().nodes as Array<{ handle: string }>).map((n) => n.handle);
    expect(handles).toContain(seniorA.handle);
    expect(handles).toContain(freshmanA.handle);
    expect(lineage.json().edges.length).toBeGreaterThanOrEqual(1);
  });

  it('auto-cancels pending requests once capacity is saturated', async () => {
    // senior_c has maxMentees 1. freshman_a (bumped?) -> no; use freshman_b.
    const freshB = await login(freshmanB.handle, freshmanB.password);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshB, 'x-idempotency-key': idemKey('cap1') },
      payload: { seniorHandle: seniorC.handle, message: 'Request one' },
    });
    expect(res.statusCode).toBe(200);
    const firstId = res.json().request.id as string;

    const second = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie, 'x-idempotency-key': idemKey('cap2') },
      payload: { seniorHandle: seniorC.handle, message: 'Request two' },
    });
    expect(second.statusCode).toBe(200);
    const secondId = second.json().request.id as string;

    const seniorCcookie = await login(seniorC.handle, seniorC.password);
    const accept = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${firstId}/accept`,
      headers: { cookie: seniorCcookie, 'x-idempotency-key': idemKey('cap-accept') },
    });
    expect(accept.statusCode, `Body: ${accept.body}`).toBe(200);

    const secondNow = await ctx.app.inject({
      method: 'GET',
      url: `/api/requests/${secondId}`,
      headers: { cookie: freshmanCookie },
    });
    expect(secondNow.json().request.status).toBe('cancelled_capacity_filled');
  });

  it('moves requests to pending_admin_approval when the config demands it', async () => {
    await ctx.prisma.systemConfig.upsert({
      where: { key: 'REQUIRE_ADMIN_REQUEST_APPROVAL' },
      update: { value: 'true' },
      create: { key: 'REQUIRE_ADMIN_REQUEST_APPROVAL', value: 'true' },
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie, 'x-idempotency-key': idemKey('admin-req') },
      payload: { seniorHandle: seniorE.handle, message: 'Needs admin approval' },
    });
    expect(res.statusCode).toBe(200);
    const requestId = res.json().request.id as string;
    expect(res.json().request.status).toBe('pending');

    const seniorEcookie = await login(seniorE.handle, seniorE.password);
    const accepted = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/accept`,
      headers: { cookie: seniorEcookie, 'x-idempotency-key': idemKey('admin-accept') },
    });
    expect(accepted.statusCode, `Body: ${accepted.body}`).toBe(200);
    expect(accepted.json().request.status).toBe('pending_admin_approval');

    const denied = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/deny`,
      headers: { cookie: adminCookie },
      payload: { reason: 'Not a good fit right now' },
    });
    expect(denied.statusCode).toBe(200);
    expect(denied.json().request.status).toBe('rejected');
    expect(denied.json().request.rejectionReason).toBe('Not a good fit right now');

    await ctx.prisma.systemConfig.deleteMany({ where: { key: 'REQUIRE_ADMIN_REQUEST_APPROVAL' } });
  });

  it('allows a freshman to cancel a pending request', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie, 'x-idempotency-key': idemKey('cancel-req') },
      payload: { seniorHandle: seniorD.handle, message: 'To be cancelled' },
    });
    expect(res.statusCode).toBe(200);
    const requestId = res.json().request.id as string;

    const cancelled = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/cancel`,
      headers: { cookie: freshmanCookie },
    });
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().request.status).toBe('cancelled');
  });

  it('lets a senior reject a request with a reason', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie, 'x-idempotency-key': idemKey('reject-req') },
      payload: { seniorHandle: seniorD.handle, message: 'To be rejected' },
    });
    expect(res.statusCode).toBe(200);
    const requestId = res.json().request.id as string;
    const seniorDcookie = await login(seniorD.handle, seniorD.password);

    const rejected = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/reject`,
      headers: { cookie: seniorDcookie },
      payload: { reason: 'Already at capacity' },
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().request.status).toBe('rejected');
    expect(rejected.json().request.rejectionReason).toBe('Already at capacity');
  });

  it('allows a new application to the same senior after a cancellation', async () => {
    const { freshman: freshB } = await createReapplyPair();
    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshB, 'x-idempotency-key': idemKey('reapply-cancel-1') },
      payload: { seniorHandle: 'reapply_senior', message: 'First application' },
    });
    expect(first.statusCode, `Body: ${first.body}`).toBe(200);
    const cancelled = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${first.json().request.id as string}/cancel`,
      headers: { cookie: freshB },
    });
    expect(cancelled.statusCode).toBe(200);

    const again = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshB, 'x-idempotency-key': idemKey('reapply-cancel-2') },
      payload: { seniorHandle: 'reapply_senior', message: 'Application after cancellation' },
    });
    expect(again.statusCode, `Body: ${again.body}`).toBe(200);
    expect(again.json().request.status).toBe('pending');
  });

  it('allows a new application to the same senior after a rejection', async () => {
    const { freshman: freshB, senior: seniorBcookie } = await createReapplyPair();
    const first = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshB, 'x-idempotency-key': idemKey('reapply-reject-1') },
      payload: { seniorHandle: 'reapply_senior', message: 'First attempt' },
    });
    expect(first.statusCode, `Body: ${first.body}`).toBe(200);
    const rejected = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${first.json().request.id as string}/reject`,
      headers: { cookie: seniorBcookie },
      payload: { reason: 'Try again next semester' },
    });
    expect(rejected.statusCode).toBe(200);

    const again = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshB, 'x-idempotency-key': idemKey('reapply-reject-2') },
      payload: { seniorHandle: 'reapply_senior', message: 'Second attempt' },
    });
    expect(again.statusCode, `Body: ${again.body}`).toBe(200);
    expect(again.json().request.status).toBe('pending');
  });

  it('stores idempotency results in Redis under a 24-hour TTL', async () => {
    const { freshman: freshB } = await createReapplyPair();
    const key = idemKey('ttl');
    const payload = { seniorHandle: 'reapply_senior', message: 'TTL check' };
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshB, 'x-idempotency-key': key },
      payload,
    });
    expect(res.statusCode, `Body: ${res.body}`).toBe(200);

    const redisKey = `idem:request-submit:${key}`;
    const cached = await ctx.redis.get(redisKey);
    expect(cached).toBeTruthy();
    const ttl = await ctx.redis.ttl(redisKey);
    expect(ttl).toBeGreaterThan(86_000);
    expect(ttl).toBeLessThanOrEqual(86_400);
  });

  it('serializes concurrent acceptances so capacity is never exceeded', async () => {
    const seniorRow = await createUser(
      {
        handle: 'race_senior',
        email: 'race_senior@cs.uni.edu',
        password: 'Pass12345!',
        role: 'senior',
        semester: 8,
      },
      { discoverable: true, maxMentees: 1 },
    );
    await createUser({
      handle: 'race_fresh_a',
      email: 'race_fresh_a@cs.uni.edu',
      password: 'Pass12345!',
      role: 'freshman',
      semester: 2,
    });
    await createUser({
      handle: 'race_fresh_b',
      email: 'race_fresh_b@cs.uni.edu',
      password: 'Pass12345!',
      role: 'freshman',
      semester: 3,
    });

    const seniorCookie = await login('race_senior', 'Pass12345!');
    const freshA = await login('race_fresh_a', 'Pass12345!');
    const freshB = await login('race_fresh_b', 'Pass12345!');

    const reqA = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshA, 'x-idempotency-key': idemKey('race-req-a') },
      payload: { seniorHandle: 'race_senior', message: 'Race applicant A' },
    });
    const reqB = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshB, 'x-idempotency-key': idemKey('race-req-b') },
      payload: { seniorHandle: 'race_senior', message: 'Race applicant B' },
    });
    expect(reqA.statusCode).toBe(200);
    expect(reqB.statusCode).toBe(200);
    const idA = reqA.json().request.id as string;
    const idB = reqB.json().request.id as string;

    const [resA, resB] = await Promise.all([
      ctx.app.inject({
        method: 'POST',
        url: `/api/requests/${idA}/accept`,
        headers: { cookie: seniorCookie, 'x-idempotency-key': idemKey('race-accept-a') },
      }),
      ctx.app.inject({
        method: 'POST',
        url: `/api/requests/${idB}/accept`,
        headers: { cookie: seniorCookie, 'x-idempotency-key': idemKey('race-accept-b') },
      }),
    ]);

    const statuses = [resA.statusCode, resB.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    const mentorships = await ctx.prisma.mentorship.count({
      where: { seniorId: seniorRow.id },
    });
    expect(mentorships).toBe(1);
  });

  // -- Lineage ----------------------------------------------------------------

  it('serves the full lineage graph and handle-scoped subgraphs', async () => {
    const full = await ctx.app.inject({ method: 'GET', url: '/api/lineage' });
    expect(full.statusCode).toBe(200);
    expect(full.json().academicYears.length).toBeGreaterThanOrEqual(1);

    const sub = await ctx.app.inject({ method: 'GET', url: `/api/lineage/${seniorA.handle}` });
    expect(sub.statusCode).toBe(200);
    const handles = (sub.json().nodes as Array<{ handle: string }>).map((n) => n.handle);
    expect(handles).toContain(seniorA.handle);
    expect(handles).toContain(freshmanA.handle);
  });
});
