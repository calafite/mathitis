import type { Prisma, PrismaClient, RichCard } from '@prisma/client';

export type RichCardCreateInput = Omit<Prisma.RichCardUncheckedCreateInput, 'profileId'>;

export interface RichCardRepository {
  listByProfileId(profileId: string): Promise<RichCard[]>;
  findOwnedById(id: string, profileId: string): Promise<RichCard | null>;
  create(profileId: string, data: RichCardCreateInput): Promise<RichCard>;
  update(id: string, data: Prisma.RichCardUncheckedUpdateInput): Promise<RichCard>;
  remove(id: string): Promise<void>;
  reorder(entries: Array<{ id: string; displayOrder: number }>): Promise<void>;
  countByProfileId(profileId: string): Promise<number>;
}

export function createRichCardRepository(prisma: PrismaClient): RichCardRepository {
  async function listByProfileId(profileId: string) {
    return prisma.richCard.findMany({
      where: { profileId },
      orderBy: { displayOrder: 'asc' },
    });
  }

  async function findOwnedById(id: string, profileId: string) {
    return prisma.richCard.findFirst({ where: { id, profileId } });
  }

  async function create(profileId: string, data: Prisma.RichCardUncheckedCreateInput) {
    return prisma.richCard.create({ data: { ...data, profileId } });
  }

  async function update(id: string, data: Prisma.RichCardUncheckedUpdateInput) {
    return prisma.richCard.update({ where: { id }, data });
  }

  async function remove(id: string) {
    await prisma.richCard.delete({ where: { id } });
  }

  async function reorder(entries: Array<{ id: string; displayOrder: number }>) {
    await prisma.$transaction(
      entries.map((entry) =>
        prisma.richCard.update({
          where: { id: entry.id },
          data: { displayOrder: entry.displayOrder },
        }),
      ),
    );
  }

  async function countByProfileId(profileId: string) {
    return prisma.richCard.count({ where: { profileId } });
  }

  return { listByProfileId, findOwnedById, create, update, remove, reorder, countByProfileId };
}