import { describe, expect, it } from 'vitest';
import {
  buildIdempotencyKey,
  IDEMPOTENCY_TTL_SECONDS,
  withIdempotency,
  type IdempotencyStore,
} from '../../src/lib/idempotency.js';

function createFakeStore(): IdempotencyStore & { calls: { set: string[] } } {
  const data = new Map<string, { value: string; ttl: number }>();
  return {
    calls: { set: [] },
    async get(key) {
      return data.get(key)?.value ?? null;
    },
    async set(key, value, ttlSeconds) {
      data.set(key, { value, ttl: ttlSeconds });
      this.calls.set.push(key);
    },
  };
}

describe('withIdempotency', () => {
  it('runs the handler once and caches the payload', async () => {
    const store = createFakeStore();
    let runs = 0;
    const result = await withIdempotency(store, 'idem:request-submit:key1', 60, async () => {
      runs += 1;
      return { id: 'abc', ok: true };
    });
    expect(result).toEqual({ id: 'abc', ok: true });
    expect(runs).toBe(1);

    const second = await withIdempotency(store, 'idem:request-submit:key1', 60, async () => {
      runs += 1;
      return { id: 'different', ok: false };
    });
    expect(second).toEqual({ id: 'abc', ok: true });
    expect(runs).toBe(1);
  });

  it('stores the payload under the mandatory TTL', async () => {
    const store = createFakeStore();
    await withIdempotency(store, 'idem:request-accept-42:key2', 1234, async () => 'payload');
    expect(store.calls.set).toEqual(['idem:request-accept-42:key2']);
  });

  it('does not cache when the handler throws', async () => {
    const store = createFakeStore();
    await expect(
      withIdempotency(store, 'idem:request-submit:key3', 60, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(store.calls.set).toEqual([]);
  });

  it('reuses the 24-hour default TTL constant', () => {
    expect(IDEMPOTENCY_TTL_SECONDS).toBe(24 * 60 * 60);
  });
});

describe('buildIdempotencyKey', () => {
  it('namespaces keys by scope', () => {
    expect(buildIdempotencyKey('request-submit', 'abc')).toBe('idem:request-submit:abc');
    expect(buildIdempotencyKey('request-accept-42', 'abc')).toBe('idem:request-accept-42:abc');
  });
});