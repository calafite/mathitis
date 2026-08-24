import { beforeEach, describe, expect, it } from 'vitest';
import { createLoginGuard, type LoginGuardStorage } from '../../src/lib/login-guard.js';

/** Deterministic in-memory Redis stand-in. */
function memoryStorage(): LoginGuardStorage & { dump: () => Map<string, string> } {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async set(key, value, _mode, _ttl) {
      store.set(key, String(value));
      return 'OK';
    },
    async incr(key) {
      const next = Number(store.get(key) ?? 0) + 1;
      store.set(key, String(next));
      return next;
    },
    async expire() {
      return 1;
    },
    async del(...keys) {
      let n = 0;
      for (const key of keys) {
        if (store.delete(key)) n += 1;
      }
      return n;
    },
    dump: () => store,
  };
}

const opts = { maxAttempts: 3, lockoutSeconds: 900, ipMaxAttempts: 12 };

describe('login guard', () => {
  let storage: ReturnType<typeof memoryStorage>;
  let guard: ReturnType<typeof createLoginGuard>;

  beforeEach(() => {
    storage = memoryStorage();
    guard = createLoginGuard(storage, opts);
  });

  it('starts unlocked', async () => {
    expect(await guard.isLocked('u1', '1.1.1.1')).toBe(false);
  });

  it('locks the account after maxAttempts consecutive failures', async () => {
    await guard.recordFailure('u1', '1.1.1.1');
    await guard.recordFailure('u1', '1.1.1.1');
    expect(await guard.isLocked('u1', '9.9.9.9')).toBe(false);

    await guard.recordFailure('u1', '1.1.1.1'); // 3rd failure
    expect(await guard.isLocked('u1', '9.9.9.9')).toBe(true);
  });

  it('does not lock the account when failures come from unknown users', async () => {
    for (let i = 0; i < opts.maxAttempts + 2; i += 1) {
      await guard.recordFailure(null, '2.2.2.2');
    }
    // Below the IP threshold: account checks stay unaffected.
    expect(await guard.isLocked('u1', '2.2.2.2')).toBe(false);
    expect(await guard.isLocked(null, '2.2.2.2')).toBe(false);

    // ... and the IP itself gets locked after ipMaxAttempts
    for (let i = 0; i < opts.ipMaxAttempts - (opts.maxAttempts + 2); i += 1) {
      await guard.recordFailure(null, '2.2.2.2');
    }
    expect(await guard.isLocked(null, '2.2.2.2')).toBe(true);
  });

  it('clears counters after a successful login', async () => {
    await guard.recordFailure('u1', '1.1.1.1');
    await guard.recordFailure('u1', '1.1.1.1');
    await guard.reset('u1', '1.1.1.1');

    await guard.recordFailure('u1', '1.1.1.1');
    expect(await guard.isLocked('u1', '1.1.1.1')).toBe(false);
  });

  it('keeps the lock even when the failure counter is exhausted', async () => {
    for (let i = 0; i < opts.maxAttempts; i += 1) {
      await guard.recordFailure('u1', '1.1.1.1');
    }
    // Counter key removed after lock; lock key remains.
    expect(storage.dump().has('login:fail:user:u1')).toBe(false);
    expect(storage.dump().get('login:locked:u1')).toBe('1');
  });
});
