import { describe, expect, it, vi } from 'vitest';
import { createBumpService, MAX_ACTIVE_BUMPS } from '../../src/services/bump-service.js';
import type { BumpRepository } from '../../src/repositories/bump-repository.js';
import type { UserRepository } from '../../src/repositories/user-repository.js';

const FRESHMAN = '11111111-1111-4111-8111-111111111111';
const SENIOR_A = '22222222-2222-4222-8222-222222222222';
const SENIOR_B = '33333333-3333-4333-8333-333333333333';
const SENIOR_C = '44444444-4444-4444-8444-444444444444';
const SENIOR_D = '55555555-5555-4555-8555-555555555555';
const SENIOR_E = '66666666-6666-4666-8666-666666666666';

function createUserRepo(): UserRepository {
  const seniors = new Set([SENIOR_A, SENIOR_B, SENIOR_C, SENIOR_D, SENIOR_E]);
  return {
    async findByHandle(handle) {
      const idByHandle: Record<string, string> = {
        senior_a: SENIOR_A,
        senior_b: SENIOR_B,
        senior_c: SENIOR_C,
        senior_d: SENIOR_D,
        senior_e: SENIOR_E,
        unknown: '99999999-9999-4999-8999-999999999999',
      };
      const id = idByHandle[handle];
      if (!id) return null;
      return { id, role: 'senior', deletedAt: null, handle } as never;
    },
    async findActiveById(id) {
      return seniors.has(id) ? ({ id, role: 'senior', status: 'active' } as never) : null;
    },
  } as UserRepository;
}

function createBumpRepo(): BumpRepository {
  const bumps = new Set<string>();
  return {
    async has(freshmanId, seniorId) {
      return bumps.has(`${freshmanId}:${seniorId}`);
    },
    async create(freshmanId, seniorId) {
      bumps.add(`${freshmanId}:${seniorId}`);
    },
    async remove(freshmanId, seniorId) {
      return bumps.delete(`${freshmanId}:${seniorId}`);
    },
    async countByFreshman(freshmanId) {
      let count = 0;
      for (const key of bumps) if (key.startsWith(`${freshmanId}:`)) count += 1;
      return count;
    },
    async countBySenior() {
      return 0;
    },
    async replace(freshmanId, removedSeniorId, addedSeniorId) {
      const removed = bumps.delete(`${freshmanId}:${removedSeniorId}`);
      if (!removed) return false;
      bumps.add(`${freshmanId}:${addedSeniorId}`);
      return true;
    },
  };
}

describe('bump service', () => {
  it('allows up to MAX_ACTIVE_BUMPS distinct bumps', async () => {
    const service = createBumpService(createBumpRepo(), createUserRepo());
    let expected = 0;
    for (const handle of ['senior_a', 'senior_b', 'senior_c', 'senior_d']) {
      expected += 1;
      const result = await service.bump(FRESHMAN, handle);
      expect(result.bumped).toBe(true);
      expect(result.bumpCount).toBe(expected);
    }
  });

  it('rejects a fifth bump without a replacement', async () => {
    const service = createBumpService(createBumpRepo(), createUserRepo());
    for (const handle of ['senior_a', 'senior_b', 'senior_c', 'senior_d']) {
      await service.bump(FRESHMAN, handle);
    }
    await expect(service.bump(FRESHMAN, 'senior_e')).rejects.toMatchObject({
      code: 'BUMP_LIMIT_REACHED',
    });
  });

  it('reallocates an existing bump when replaceHandle is supplied', async () => {
    const service = createBumpService(createBumpRepo(), createUserRepo());
    for (const handle of ['senior_a', 'senior_b', 'senior_c', 'senior_d']) {
      await service.bump(FRESHMAN, handle);
    }
    const result = await service.bump(FRESHMAN, 'senior_e', 'senior_a');
    expect(result.bumped).toBe(true);
    expect(result.bumpCount).toBe(MAX_ACTIVE_BUMPS);
    expect(result.remainingSlots).toBe(0);
  });

  it('is idempotent for an already-bumped senior', async () => {
    const service = createBumpService(createBumpRepo(), createUserRepo());
    await service.bump(FRESHMAN, 'senior_a');
    const result = await service.bump(FRESHMAN, 'senior_a');
    expect(result.bumped).toBe(true);
    expect(result.bumpCount).toBe(1);
  });

  it('prevents bumping yourself', async () => {
    const userRepo = createUserRepo();
    userRepo.findByHandle = vi.fn().mockResolvedValue({
      id: FRESHMAN,
      role: 'senior',
      deletedAt: null,
      handle: 'me',
    });
    const service = createBumpService(createBumpRepo(), userRepo);
    await expect(service.bump(FRESHMAN, 'me')).rejects.toThrow('Você não pode se impulsionar');
  });
});
