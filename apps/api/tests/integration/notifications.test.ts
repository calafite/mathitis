import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Redis from 'ioredis';
import {
  startTestEnvironment,
  stopTestEnvironment,
  type TestContext,
} from './test-environment.js';
import { createEmailQueue } from '../../src/lib/queue.js';
import { createEmailWorker } from '../../src/lib/worker.js';

describe('Notifications API', () => {
  let ctx: TestContext;
  let seniorCookie = '';
  let freshmanCookie = '';
  let otherCookie = '';

  beforeAll(async () => {
    ctx = await startTestEnvironment();
    const argon2 = await import('argon2');

    async function createUser(input: {
      handle: string;
      email: string;
      role: 'senior' | 'freshman';
      semester: number;
    }) {
      const passwordHash = await argon2.default.hash('Pass12345!', {
        type: 2,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      return ctx.prisma.user.create({
        data: {
          handle: input.handle,
          email: input.email,
          passwordHash,
          role: input.role,
          semester: input.semester,
          status: 'active',
          profile: {
            create: {
              socialName: input.handle,
              isDiscoverable: true,
              isAcceptingRequests: true,
              maxMentees: 3,
              effortScore: 0,
            },
          },
        },
      });
    }

    async function login(handle: string): Promise<string> {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: handle, password: 'Pass12345!' },
      });
      expect(res.statusCode, `Login failed: ${res.body}`).toBe(200);
      return String(res.headers['set-cookie']).split(';')[0] ?? '';
    }

    await createUser({ handle: 'notif_senior', email: 'notif_senior@cs.uni.edu', role: 'senior', semester: 8 });
    await createUser({ handle: 'notif_freshman', email: 'notif_freshman@cs.uni.edu', role: 'freshman', semester: 2 });
    await createUser({ handle: 'notif_other', email: 'notif_other@cs.uni.edu', role: 'freshman', semester: 3 });

    seniorCookie = await login('notif_senior');
    freshmanCookie = await login('notif_freshman');
    otherCookie = await login('notif_other');
  });

  afterAll(async () => {
    await stopTestEnvironment(ctx);
  });

  function idemKey(tag: string) {
    return `key-${tag}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  it('requires authentication to list notifications', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/notifications' });
    expect(res.statusCode).toBe(403);
  });

  it('creates a request_received notification for the target senior on submit', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/requests',
      headers: { cookie: freshmanCookie, 'x-idempotency-key': idemKey('notif-submit') },
      payload: { seniorHandle: 'notif_senior', message: 'Please mentor me' },
    });
    expect(res.statusCode, `Body: ${res.body}`).toBe(200);

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { cookie: seniorCookie },
    });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.unread).toBeGreaterThanOrEqual(1);
    const received = body.notifications.find(
      (n: { type: string }) => n.type === 'request_received',
    );
    expect(received).toBeTruthy();
    expect(received.body).toContain('notif_freshman');
    expect(received.payload).toMatchObject({ requestId: expect.any(String) });
    expect(received.readAt).toBeNull();
  });

  it('notifies the freshman when a request is accepted', async () => {
    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { cookie: seniorCookie },
    });
    const received = (list.json().notifications as Array<{ payload: { requestId: string } }>).find(
      (n) => n.payload?.requestId,
    )!;
    const requestId = received.payload.requestId;

    const accepted = await ctx.app.inject({
      method: 'POST',
      url: `/api/requests/${requestId}/accept`,
      headers: { cookie: seniorCookie, 'x-idempotency-key': idemKey('notif-accept') },
    });
    expect(accepted.statusCode, `Body: ${accepted.body}`).toBe(200);

    const freshList = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { cookie: freshmanCookie },
    });
    const body = freshList.json();
    const acceptedNotif = body.notifications.find(
      (n: { type: string }) => n.type === 'request_accepted',
    );
    expect(acceptedNotif).toBeTruthy();
    expect(acceptedNotif.body).toContain('notif_senior');
  });

  it('filters unread-only and paginates', async () => {
    const unread = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications?unreadOnly=true&limit=1&offset=0',
      headers: { cookie: seniorCookie },
    });
    expect(unread.statusCode).toBe(200);
    const body = unread.json();
    expect(body.notifications.length).toBeLessThanOrEqual(1);
    for (const notification of body.notifications as Array<{ readAt: unknown }>) {
      expect(notification.readAt).toBeNull();
    }
  });

  it('marks a single notification as read', async () => {
    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications?unreadOnly=true',
      headers: { cookie: seniorCookie },
    });
    const target = (list.json().notifications as Array<{ id: string }>)[0]!;

    const read = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/notifications/${target.id}/read`,
      headers: { cookie: seniorCookie },
    });
    expect(read.statusCode).toBe(200);
    expect(read.json().notification.readAt).toBeTruthy();

    const after = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications?unreadOnly=true',
      headers: { cookie: seniorCookie },
    });
    expect(
      (after.json().notifications as Array<{ id: string }>).some((n) => n.id === target.id),
    ).toBe(false);
  });

  it('returns 404 when marking a foreign notification as read', async () => {
    const senior = await ctx.prisma.user.findUnique({
      where: { handle: 'notif_senior' },
    });
    const foreign = await ctx.prisma.notification.create({
      data: {
        userId: senior!.id,
        type: 'request_received',
        title: 'Unread seed',
        body: 'Foreign notification',
      },
    });
    const target = foreign;

    const res = await ctx.app.inject({
      method: 'PATCH',
      url: `/api/notifications/${target.id}/read`,
      headers: { cookie: otherCookie },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOTIFICATION_NOT_FOUND');
  });

  it('marks all notifications as read', async () => {
    const readAll = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/notifications/read-all',
      headers: { cookie: freshmanCookie },
    });
    expect(readAll.statusCode).toBe(200);

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: { cookie: freshmanCookie },
    });
    expect(list.json().unread).toBe(0);
    for (const notification of list.json().notifications as Array<{ readAt: unknown }>) {
      expect(notification.readAt).toBeTruthy();
    }
  });

  describe('email worker', () => {
    function silentLogger() {
      return {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
      };
    }

    async function freshQueue() {
      const conn = new Redis(ctx.env.REDIS_URL, { maxRetriesPerRequest: null });
      const queue = createEmailQueue(conn);
      await queue.obliterate({ force: true });
      return { conn, queue };
    }

    it('retries with backoff and moves exhausted jobs to the dead-letter queue', async () => {
      const { conn, queue } = await freshQueue();
      const sent: string[] = [];
      const worker = createEmailWorker({
        connection: conn,
        emailSender: {
          async send(message) {
            sent.push(message.subject);
            throw new Error('smtp unavailable');
          },
        },
        logger: silentLogger(),
      });

      await queue.add(
        'email-send',
        { to: 'fail@example.com', type: 'request_received', title: 'Retry me', body: 'Body' },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 50, jitter: 0 },
          removeOnFail: false,
        },
      );

      const deadline = Date.now() + 15_000;
      let dlqCount = 0;
      while (Date.now() < deadline) {
        dlqCount = await worker.getDlqCount();
        if (dlqCount > 0) break;
        await new Promise((r) => setTimeout(r, 200));
      }

      expect(dlqCount).toBeGreaterThan(0);
      expect(sent).toHaveLength(3);

      const failedCount = await queue.getJobCounts('failed');
      expect(failedCount.failed).toBe(1);

      await worker.close();
      await queue.close();
      await conn.quit();
    }, 20_000);

    it('processes successful emails and clears them from the queue', async () => {
      const { conn, queue } = await freshQueue();
      const sent: Array<{ to: string; subject: string }> = [];
      const worker = createEmailWorker({
        connection: conn,
        emailSender: {
          async send(message) {
            sent.push({ to: message.to, subject: message.subject });
          },
        },
        logger: silentLogger(),
      });

      await queue.add(
        'email-send',
        { to: 'ok@example.com', type: 'request_received', title: 'Deliver me', body: 'Body' },
        { attempts: 1, removeOnComplete: { count: 100 } },
      );

      const deadline = Date.now() + 10_000;
      while (Date.now() < deadline && sent.length === 0) {
        await new Promise((r) => setTimeout(r, 200));
      }

      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ to: 'ok@example.com', subject: 'Deliver me' });
      const stats = await queue.getJobCounts('waiting', 'active');
      expect(stats.waiting).toBe(0);
      expect(stats.active).toBe(0);

      await worker.close();
      await queue.close();
      await conn.quit();
    });

    it('does not send emails when the producer config disables them', async () => {
      await ctx.prisma.systemConfig.upsert({
        where: { key: 'EMAIL_NOTIFICATIONS_ENABLED' },
        update: { value: 'false' },
        create: { key: 'EMAIL_NOTIFICATIONS_ENABLED', value: 'false' },
      });

      const { conn, queue } = await freshQueue();
      const before = (await queue.getJobCounts('waiting', 'active', 'delayed')).waiting ?? 0;

      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/requests',
        headers: { cookie: otherCookie, 'x-idempotency-key': idemKey('notif-disabled') },
        payload: { seniorHandle: 'notif_senior', message: 'No email please' },
      });
      expect(res.statusCode, `Body: ${res.body}`).toBe(200);

      const after = (await queue.getJobCounts('waiting', 'active', 'delayed')).waiting ?? 0;
      expect(after).toBe(before);

      await ctx.prisma.systemConfig.deleteMany({ where: { key: 'EMAIL_NOTIFICATIONS_ENABLED' } });
      await queue.close();
      await conn.quit();
    });
  });
});