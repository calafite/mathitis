import { beforeEach, describe, expect, it } from 'vitest';
import { createSessionManager } from '../../src/plugins/session.js';
import { createMemorySessionEpoch } from '../../src/lib/session-epoch.js';

const secrets = { current: 'unit_test_secret_that_is_at_least_32_chars', legacy: [] };

function makeManager(getEpoch?: (userId: string) => Promise<number>) {
  return createSessionManager(secrets, 7, getEpoch);
}

describe('session epoch invalidation', () => {
  let epoch: ReturnType<typeof createMemorySessionEpoch>;

  beforeEach(() => {
    epoch = createMemorySessionEpoch();
  });

  it('accepts a session issued at the current epoch', async () => {
    const manager = makeManager(epoch.get);
    const cookie = await manager.createSessionCookie({
      sub: 'u1',
      role: 'freshman',
      handle: 'satanyahu',
    });
    const payload = await manager.verifySessionCookie(cookie);
    expect(payload?.sub).toBe('u1');
  });

  it('rejects sessions from a previous epoch after a bump', async () => {
    const manager = makeManager(epoch.get);
    const oldCookie = await manager.createSessionCookie({
      sub: 'u1',
      role: 'freshman',
      handle: 'satanyahu',
    });

    await epoch.bump('u1'); // password changed elsewhere

    expect(await manager.verifySessionCookie(oldCookie)).toBeNull();
  });

  it('keeps other users unaffected by someone else’s bump', async () => {
    const manager = makeManager(epoch.get);
    const cookieA = await manager.createSessionCookie({
      sub: 'a',
      role: 'senior',
      handle: 'a',
    });
    const cookieB = await manager.createSessionCookie({
      sub: 'b',
      role: 'freshman',
      handle: 'b',
    });

    await epoch.bump('a');

    expect(await manager.verifySessionCookie(cookieA)).toBeNull();
    expect((await manager.verifySessionCookie(cookieB))?.sub).toBe('b');
  });

  it('treats tokens without an epoch as epoch 0 (legacy tokens die on first bump)', async () => {
    const legacyManager = makeManager(undefined); // issued without epoch support
    const legacyCookie = await legacyManager.createSessionCookie({
      sub: 'u1',
      role: 'freshman',
      handle: 'satanyahu',
    });

    const manager = makeManager(epoch.get);
    await epoch.bump('u1');
    expect(await manager.verifySessionCookie(legacyCookie)).toBeNull();
  });
});
