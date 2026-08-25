import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushProfileViews, VIEWS_BUFFER_KEY } from '../../src/services/views-worker.js';

function memoryRedis() {
  const store = new Map<string, Record<string, string>>();
  return {
    store,
    calls: [] as string[],
    async exists(key: string) {
      this.calls.push(`EXISTS ${key}`);
      return store.has(key) ? 1 : 0;
    },
    async rename(from: string, to: string) {
      this.calls.push(`RENAME ${from} ${to}`);
      const data = store.get(from);
      if (!data) throw new Error('ERR no such key');
      store.set(to, data);
      store.delete(from);
    },
    async hgetall(key: string) {
      this.calls.push(`HGETALL ${key}`);
      return store.get(key) ?? {};
    },
    async del(key: string) {
      this.calls.push(`DEL ${key}`);
      return store.delete(key) ? 1 : 0;
    },
    hset(key: string, field: string, value: string) {
      const hash = store.get(key) ?? {};
      hash[field] = value;
      store.set(key, hash);
    },
  };
}

function memoryPrisma(overrides?: { failOnce?: boolean }) {
  const updates: Array<{ userId: string; increment: number }> = [];
  let failed = false;
  return {
    updates,
    profile: {
      update: vi.fn(async ({ where, data }: { where: { userId: string }; data: { profileViews: { increment: number } } }) => {
        if (overrides?.failOnce && !failed) {
          failed = true;
          throw new Error('deadlock detected');
        }
        updates.push({ userId: where.userId, increment: data.profileViews.increment });
        return {};
      }),
    },
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  };
}

describe('flushProfileViews', () => {
  let redis: ReturnType<typeof memoryRedis>;

  beforeEach(() => {
    redis = memoryRedis();
  });

  it('exits gracefully when the buffer does not exist', async () => {
    const prisma = memoryPrisma();
    const result = await flushProfileViews({ redis: redis as never, prisma: prisma as never });
    expect(result).toBe(0);
    expect(prisma.updates).toHaveLength(0);
  });

  it('performs the atomic RENAME → HGETALL → update → DEL flow', async () => {
    redis.hset(VIEWS_BUFFER_KEY, 'user-1', '3');
    redis.hset(VIEWS_BUFFER_KEY, 'user-2', '5');
    const prisma = memoryPrisma();

    const result = await flushProfileViews({ redis: redis as never, prisma: prisma as never });

    expect(result).toBe(2);
    expect(prisma.updates).toEqual([
      { userId: 'user-1', increment: 3 },
      { userId: 'user-2', increment: 5 },
    ]);
    expect(redis.calls.some((c) => c.startsWith(`RENAME ${VIEWS_BUFFER_KEY} `))).toBe(true);
    expect(redis.calls.some((c) => c.startsWith('DEL profile:views:processing:'))).toBe(true);
    // Buffer is empty after flush; processing key removed.
    expect(redis.store.has(VIEWS_BUFFER_KEY)).toBe(false);
    expect([...redis.store.keys()].some((k) => k.startsWith('profile:views:processing:'))).toBe(false);
  });

  it('preserves new increments that arrive during the flush', async () => {
    redis.hset(VIEWS_BUFFER_KEY, 'user-1', '3');
    const prisma = memoryPrisma();
    // Simulate a view arriving between RENAME and HGETALL: hook into hgetall.
    const originalHgetall = redis.hgetall.bind(redis);
    redis.hgetall = async (key: string) => {
      if (key.startsWith('profile:views:processing:')) {
        redis.hset(VIEWS_BUFFER_KEY, 'user-1', '2'); // late arrival
      }
      return originalHgetall(key);
    };

    await flushProfileViews({ redis: redis as never, prisma: prisma as never });

    // The late arrival stays in the fresh buffer for the next flush.
    expect(redis.store.get(VIEWS_BUFFER_KEY)?.['user-1']).toBe('2');
    expect(prisma.updates).toEqual([{ userId: 'user-1', increment: 3 }]);
  });

  it('skips DEL when the transaction fails so data survives for retry', async () => {
    redis.hset(VIEWS_BUFFER_KEY, 'user-1', '7');
    const prisma = memoryPrisma({ failOnce: true });

    await expect(
      flushProfileViews({ redis: redis as never, prisma: prisma as never }),
    ).rejects.toThrow('deadlock detected');

    // The processing key must still hold the data.
    const processing = [...redis.store.keys()].find((k) => k.startsWith('profile:views:processing:'));
    expect(processing).toBeTruthy();
    expect(redis.store.get(processing!)?.['user-1']).toBe('7');
  });

  it('ignores zero-count entries', async () => {
    redis.hset(VIEWS_BUFFER_KEY, 'user-1', '0');
    const prisma = memoryPrisma();
    const result = await flushProfileViews({ redis: redis as never, prisma: prisma as never });
    expect(result).toBe(0);
    expect(prisma.updates).toHaveLength(0);
  });
});
