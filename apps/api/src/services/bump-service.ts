import type { BumpRepository } from '../repositories/bump-repository.js';
import type { UserRepository } from '../repositories/user-repository.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors.js';

export const MAX_ACTIVE_BUMPS = 4;

export interface BumpResult {
  bumped: boolean;
  bumpCount: number;
  remainingSlots: number;
}

export interface BumpService {
  bump(
    freshmanId: string,
    seniorHandle: string,
    replaceHandle?: string,
  ): Promise<BumpResult>;
  unbump(freshmanId: string, seniorHandle: string): Promise<BumpResult>;
}

export function createBumpService(
  bumpRepository: BumpRepository,
  userRepository: UserRepository,
): BumpService {
  async function resolveSenior(handle: string): Promise<string> {
    const user = await userRepository.findByHandle(handle);
    if (!user || user.deletedAt !== null || user.role !== 'senior') {
      throw new NotFoundError('Senior not found', 'SENIOR_NOT_FOUND');
    }
    return user.id;
  }

  function toResult(bumped: boolean, bumpCount: number): BumpResult {
    return { bumped, bumpCount, remainingSlots: Math.max(0, MAX_ACTIVE_BUMPS - bumpCount) };
  }

  async function bump(freshmanId: string, seniorHandle: string, replaceHandle?: string) {
    const seniorId = await resolveSenior(seniorHandle);
    if (seniorId === freshmanId) {
      throw new ValidationError('You cannot bump yourself');
    }

    const alreadyBumped = await bumpRepository.has(freshmanId, seniorId);
    if (alreadyBumped) {
      const count = await bumpRepository.countByFreshman(freshmanId);
      return toResult(true, count);
    }

    const currentCount = await bumpRepository.countByFreshman(freshmanId);

    if (currentCount >= MAX_ACTIVE_BUMPS) {
      if (replaceHandle) {
        const replacedSeniorId = await resolveSenior(replaceHandle);
        if (replacedSeniorId === seniorId) {
          throw new ValidationError('Cannot replace a bump with the same senior');
        }
        const replaced = await bumpRepository.replace(freshmanId, replacedSeniorId, seniorId);
        if (!replaced) {
          throw new NotFoundError('Bump to replace not found', 'BUMP_NOT_FOUND');
        }
        return toResult(true, currentCount);
      }
      throw new ConflictError(
        `Bump limit reached: you can keep at most ${MAX_ACTIVE_BUMPS} active bumps`,
        'BUMP_LIMIT_REACHED',
      );
    }

    await bumpRepository.create(freshmanId, seniorId);
    return toResult(true, currentCount + 1);
  }

  async function unbump(freshmanId: string, seniorHandle: string) {
    const seniorId = await resolveSenior(seniorHandle);
    await bumpRepository.remove(freshmanId, seniorId);
    const count = await bumpRepository.countByFreshman(freshmanId);
    return toResult(false, count);
  }

  return { bump, unbump };
}