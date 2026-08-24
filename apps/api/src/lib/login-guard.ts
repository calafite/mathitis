import type { Redis } from 'ioredis';

/**
 * Minimal storage contract so the guard can be unit-tested with an
 * in-memory fake (ioredis satisfies it structurally).
 */
export interface LoginGuardStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode: 'EX', ttl: number): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(...keys: string[]): Promise<number>;
}

export interface LoginGuardOptions {
  /** Failed attempts per account before locking. */
  maxAttempts: number;
  /** Lock cool-down window in seconds. */
  lockoutSeconds: number;
  /** Failed attempts per IP before the IP itself is locked. */
  ipMaxAttempts?: number;
}

export interface LoginGuard {
  isLocked(userId: string | null, ip: string): Promise<boolean>;
  /** Records a failure for the account (when known) and for the source IP. */
  recordFailure(userId: string | null, ip: string): Promise<void>;
  /** Clears account + IP counters after a successful login. */
  reset(userId: string, ip: string): Promise<void>;
}

const userKey = (userId: string) => `login:fail:user:${userId}`;
const ipKey = (ip: string) => `login:fail:ip:${ip}`;
const userLockKey = (userId: string) => `login:locked:${userId}`;
const ipLockKey = (ip: string) => `login:locked:ip:${ip}`;

export function createLoginGuard(
  storage: LoginGuardStorage,
  { maxAttempts, lockoutSeconds, ipMaxAttempts = maxAttempts * 4 }: LoginGuardOptions,
): LoginGuard {
  async function isLocked(userId: string | null, ip: string): Promise<boolean> {
    if (userId && (await storage.get(userLockKey(userId)))) return true;
    if (await storage.get(ipLockKey(ip))) return true;
    return false;
  }

  async function recordFailure(userId: string | null, ip: string): Promise<void> {
    if (userId) {
      const fails = await storage.incr(userKey(userId));
      if (fails === 1) await storage.expire(userKey(userId), lockoutSeconds);
      if (fails >= maxAttempts) {
        await storage.set(userLockKey(userId), '1', 'EX', lockoutSeconds);
        await storage.del(userKey(userId));
      }
    }
    const ipFails = await storage.incr(ipKey(ip));
    if (ipFails === 1) await storage.expire(ipKey(ip), lockoutSeconds);
    if (ipFails >= ipMaxAttempts) {
      await storage.set(ipLockKey(ip), '1', 'EX', lockoutSeconds);
      await storage.del(ipKey(ip));
    }
  }

  async function reset(userId: string, ip: string): Promise<void> {
    await storage.del(userKey(userId), ipKey(ip));
  }

  return { isLocked, recordFailure, reset };
}

/** Convenience constructor for the real Redis client. */
export function createRedisLoginGuard(
  redis: Redis,
  options: LoginGuardOptions,
): LoginGuard {
  return createLoginGuard(redis, options);
}
