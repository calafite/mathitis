import type { Prisma, PrismaClient } from '@prisma/client';

export interface BumpRepository {
  has(freshmanId: string, seniorId: string): Promise<boolean>;
  create(freshmanId: string, seniorId: string, tx?: Prisma.TransactionClient): Promise<void>;
  remove(freshmanId: string, seniorId: string): Promise<boolean>;
  countByFreshman(freshmanId: string): Promise<number>;
  countBySenior(seniorId: string): Promise<number>;
  /**
   * Atomic "move affinity": deletes a previously bumped senior and inserts the
   * new one within a single transaction.
   */
  replace(
    freshmanId: string,
    removedSeniorId: string,
    addedSeniorId: string,
  ): Promise<boolean>;
}

export function createBumpRepository(prisma: PrismaClient): BumpRepository {
  async function has(freshmanId: string, seniorId: string) {
    const row = await prisma.profileBump.findUnique({
      where: { freshmanId_seniorId: { freshmanId, seniorId } },
      select: { freshmanId: true },
    });
    return row !== null;
  }

  async function create(freshmanId: string, seniorId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    await db.profileBump.create({ data: { freshmanId, seniorId } });
  }

  async function remove(freshmanId: string, seniorId: string) {
    const result = await prisma.profileBump.deleteMany({
      where: { freshmanId, seniorId },
    });
    return result.count > 0;
  }

  async function countByFreshman(freshmanId: string) {
    return prisma.profileBump.count({ where: { freshmanId } });
  }

  async function countBySenior(seniorId: string) {
    return prisma.profileBump.count({ where: { seniorId } });
  }

  async function replace(freshmanId: string, removedSeniorId: string, addedSeniorId: string) {
    return prisma.$transaction(async (tx) => {
      const deleted = await tx.profileBump.deleteMany({
        where: { freshmanId, seniorId: removedSeniorId },
      });
      if (deleted.count === 0) return false;
      await tx.profileBump.create({ data: { freshmanId, seniorId: addedSeniorId } });
      return true;
    });
  }

  return { has, create, remove, countByFreshman, countBySenior, replace };
}