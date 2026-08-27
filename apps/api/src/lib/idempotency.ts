import type Redis from 'ioredis';

export interface IdempotencyStore {
  /**
   * Reads the cached response body for an idempotency key.
   * @returns the cached payload, or null when absent/expired
   */
  get(key: string): Promise<string | null>;
  /**
   * Stores a response payload for an idempotency key under a mandatory TTL so
   * keys never accumulate in Redis.
   */
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

/**
 * Redis-backed idempotency store. Uses SETEX (as required by the phase 3
 * safeguard) so every key carries an explicit 24-hour TTL.
 */
export function createRedisIdempotencyStore(redis: Redis): IdempotencyStore {
  return {
    async get(key) {
      const value = await redis.get(key);
      return value;
    },
    async set(key, value, ttlSeconds) {
      await redis.setex(key, ttlSeconds, value);
    },
  };
}

/**
 * Wraps a mutation so it runs at most once per idempotency key: a cached
 * response short-circuits repeat submissions within the TTL window.
 */
export async function withIdempotency<T>(
  store: IdempotencyStore,
  key: string,
  ttlSeconds: number,
  handler: () => Promise<T>,
): Promise<T> {
  const cached = await store.get(key);
  if (cached !== null) {
    return JSON.parse(cached) as T;
  }
  const result = await handler();
  await store.set(key, JSON.stringify(result), ttlSeconds);
  return result;
}

export function buildIdempotencyKey(scope: string, key: string): string {
  return `idem:${scope}:${key}`;
}
