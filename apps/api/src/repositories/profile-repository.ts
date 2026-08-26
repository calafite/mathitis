import type { Prisma, PrismaClient, Profile, RichCard, Tag } from '@prisma/client';
import { ValidationError } from '../errors.js';

export interface ProfileWithRelations extends Profile {
  user: {
    handle: string;
    role: 'freshman' | 'senior' | 'administrator' | 'developer';
    semester: number;
    deletedAt: Date | null;
  };
  tags: Array<{ tag: Pick<Tag, 'id' | 'name' | 'category' | 'color' | 'icon'> }>;
  richCards: RichCard[];
}

export interface ProfileRepository {
  findByHandle(handle: string): Promise<ProfileWithRelations | null>;
  findByUserId(userId: string): Promise<ProfileWithRelations | null>;
  update(userId: string, data: Prisma.ProfileUncheckedUpdateInput): Promise<void>;
  /** Overwrites the profile's tag set with the given tag ids (validated). */
  setTags(userId: string, tagIds: string[], tagNames?: string[]): Promise<void>;
  incrementViews(userId: string): Promise<void>;
  setEffortScore(userId: string, score: number): Promise<void>;
  setAvatar(userId: string, url: string, thumbnailUrl: string): Promise<void>;
  setBanner(userId: string, url: string, thumbnailUrl: string): Promise<void>;
}

const profileInclude = {
  user: { select: { handle: true, role: true, semester: true, deletedAt: true } },
  tags: { include: { tag: { select: { id: true, name: true, category: true, color: true, icon: true } } } },
  richCards: { orderBy: { displayOrder: 'asc' as const } },
} satisfies Prisma.ProfileInclude;

export function createProfileRepository(prisma: PrismaClient): ProfileRepository {
  async function findByHandle(handle: string) {
    return prisma.profile.findFirst({
      where: { user: { handle, deletedAt: null } },
      include: profileInclude,
    });
  }

  async function findByUserId(userId: string) {
    return prisma.profile.findUnique({
      where: { userId },
      include: profileInclude,
    });
  }

  async function update(userId: string, data: Prisma.ProfileUncheckedUpdateInput) {
    await prisma.profile.update({ where: { userId }, data });
  }

  async function setTags(userId: string, tagIds: string[], tagNames?: string[]) {
    const uniqueIds = [...new Set(tagIds)];
    const uniqueNames = [...new Set(tagNames ?? [])];
    await prisma.$transaction(async (tx) => {
      // Resolve tag names: find existing or create with embedding.
      const resolvedIds = [...uniqueIds];
      for (const name of uniqueNames) {
        const existing = await tx.tag.findFirst({ where: { name }, select: { id: true } });
        if (existing) {
          resolvedIds.push(existing.id);
        } else {
          const { generateEmbedding } = await import('../lib/embeddings.js');
          const embedding = await generateEmbedding(name);
          const tag = await tx.tag.create({
            data: { name, category: 'custom', color: '#c9f24c' },
            select: { id: true },
          });
          await tx.$executeRaw`UPDATE tags SET embedding = ${embedding}::float[] WHERE id = ${tag.id}::uuid`;
          resolvedIds.push(tag.id);
        }
      }
      const finalIds = [...new Set(resolvedIds)];
      // Reject unknown ids outright so a stale client cannot silently drop them.
      const known = await tx.tag.findMany({
        where: { id: { in: finalIds } },
        select: { id: true },
      });
      if (known.length !== finalIds.length) {
        throw new ValidationError('Um ou mais interesses selecionados não existem', 'TAG_NOT_FOUND');
      }
      await tx.profileTag.deleteMany({ where: { profileId: userId } });
      if (finalIds.length > 0) {
        await tx.profileTag.createMany({
          data: finalIds.map((tagId) => ({ profileId: userId, tagId })),
        });
      }
    });
  }

  async function incrementViews(userId: string) {
    await prisma.profile.update({
      where: { userId },
      data: { profileViews: { increment: 1 } },
    });
  }

  async function setEffortScore(userId: string, score: number) {
    await prisma.profile.update({
      where: { userId },
      data: { effortScore: score },
    });
  }

  async function setAvatar(userId: string, url: string, thumbnailUrl: string) {
    await prisma.profile.update({
      where: { userId },
      data: { avatarUrl: url, avatarThumbnailUrl: thumbnailUrl },
    });
  }

  async function setBanner(userId: string, url: string, thumbnailUrl: string) {
    await prisma.profile.update({
      where: { userId },
      data: { bannerUrl: url, bannerThumbnailUrl: thumbnailUrl },
    });
  }

  return {
    findByHandle,
    findByUserId,
    update,
    setTags,
    incrementViews,
    setEffortScore,
    setAvatar,
    setBanner,
  };
}