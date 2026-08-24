import type { Redis } from 'ioredis';

const epochKey = (userId: string) => `session:epoch:${userId}`;

/**
 * Per-user session epoch. Every session JWT embeds the epoch at issue time;
 * verification rejects tokens whose epoch is stale. Bumping the epoch
 * (password change, reset, suspension, anonymization) instantly invalidates
 * every previously issued session for that user across all devices.
 */
export function createRedisSessionEpoch(redis: Redis) {
  return {
    async get(userId: string): Promise<number> {
      const raw = await redis.get(epochKey(userId));
      const n = Number(raw ?? 0);
      return Number.isFinite(n) && n > 0 ? n : 0;
    },
    async bump(userId: string): Promise<number> {
      return redis.incr(epochKey(userId));
    },
  };
}

export type SessionEpochStore = ReturnType<typeof createRedisSessionEpoch>;

/** In-memory epoch store for unit tests. */
export function createMemorySessionEpoch(): SessionEpochStore {
  const epochs = new Map<string, number>();
  return {
    async get(userId) {
      return epochs.get(userId) ?? 0;
    },
    async bump(userId) {
      const next = (epochs.get(userId) ?? 0) + 1;
      epochs.set(userId, next);
      return next;
    },
  };
}
