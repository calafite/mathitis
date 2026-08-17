import type { Prisma, PrismaClient, Profile, RichCard, Tag } from '@prisma/client';

export interface ProfileWithRelations extends Profile {
  user: {
    handle: string;
    role: 'freshman' | 'senior' | 'administrator' | 'developer';
    semester: number;
    deletedAt: Date | null;
  };
  tags: Array<{ tag: Pick<Tag, 'id' | 'name' | 'category' | 'color'> }>;
  richCards: RichCard[];
}

export interface ProfileRepository {
  findByHandle(handle: string): Promise<ProfileWithRelations | null>;
  findByUserId(userId: string): Promise<ProfileWithRelations | null>;
  update(userId: string, data: Prisma.ProfileUncheckedUpdateInput): Promise<void>;
  incrementViews(userId: string): Promise<void>;
  setEffortScore(userId: string, score: number): Promise<void>;
  setAvatar(userId: string, url: string, thumbnailUrl: string): Promise<void>;
  setBanner(userId: string, url: string, thumbnailUrl: string): Promise<void>;
}

const profileInclude = {
  user: { select: { handle: true, role: true, semester: true, deletedAt: true } },
  tags: { include: { tag: { select: { id: true, name: true, category: true, color: true } } } },
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
    incrementViews,
    setEffortScore,
    setAvatar,
    setBanner,
  };
}