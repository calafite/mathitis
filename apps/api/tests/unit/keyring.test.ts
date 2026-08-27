import { describe, expect, it } from 'vitest';
import { parseKeyring } from '../../src/lib/keyring.js';
import { createSessionManager } from '../../src/plugins/session.js';

const CURRENT = 'current_secret_that_is_at_least_32_characters_long';
const LEGACY = 'legacy_secret_that_is_at_least_32_characters_long';
const OTHER = 'other_secret_that_is_at_least_32_characters_long';

describe('parseKeyring', () => {
  it('returns an empty ring when no keyring env is set', () => {
    expect(parseKeyring(CURRENT, undefined)).toEqual({ current: CURRENT, legacy: [] });
  });

  it('parses comma-separated legacy secrets', () => {
    expect(parseKeyring(CURRENT, `${LEGACY}, ${OTHER} ,`)).toEqual({
      current: CURRENT,
      legacy: [LEGACY, OTHER],
    });
  });

  it('parses a JSON array of legacy secrets', () => {
    expect(parseKeyring(CURRENT, JSON.stringify([LEGACY, OTHER]))).toEqual({
      current: CURRENT,
      legacy: [LEGACY, OTHER],
    });
  });
});

describe('session keyring verification', () => {
  it('verifies tokens signed by the current key', async () => {
    const manager = createSessionManager({ current: CURRENT, legacy: [LEGACY] }, 7);
    const token = await manager.createSessionCookie({ sub: 'u1', role: 'freshman', handle: 'a' });
    await expect(manager.verifySessionCookie(token)).resolves.toMatchObject({ sub: 'u1' });
  });

  it('verifies tokens signed by a legacy rotation key', async () => {
    const legacy = createSessionManager({ current: LEGACY, legacy: [] }, 7);
    const token = await legacy.createSessionCookie({ sub: 'u1', role: 'senior', handle: 'b' });

    const rotated = createSessionManager({ current: CURRENT, legacy: [LEGACY] }, 7);
    await expect(rotated.verifySessionCookie(token)).resolves.toMatchObject({ sub: 'u1' });
  });

  it('rejects tokens signed by an unknown key', async () => {
    const foreign = createSessionManager({ current: OTHER, legacy: [] }, 7);
    const token = await foreign.createSessionCookie({ sub: 'u1', role: 'freshman', handle: 'c' });

    const manager = createSessionManager({ current: CURRENT, legacy: [LEGACY] }, 7);
    await expect(manager.verifySessionCookie(token)).resolves.toBeNull();
  });

  it('signs with the current key even when legacy keys exist', async () => {
    const manager = createSessionManager({ current: CURRENT, legacy: [LEGACY] }, 7);
    const token = await manager.createSessionCookie({ sub: 'u1', role: 'freshman', handle: 'd' });

    const currentOnly = createSessionManager({ current: CURRENT, legacy: [] }, 7);
    await expect(currentOnly.verifySessionCookie(token)).resolves.toMatchObject({ sub: 'u1' });
  });
});
