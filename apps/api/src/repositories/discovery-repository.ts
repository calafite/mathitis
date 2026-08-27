import type { Prisma, PrismaClient, Tag } from '@prisma/client';

export interface SeniorRow {
  userId: string;
  handle: string;
  semester: number;
  socialName: string | null;
  tagline: string | null;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  bannerUrl: string | null;
  bannerPreset: string | null;
  themePalette: Prisma.JsonValue | null;
  socialLinks: Prisma.JsonValue | null;
  contactEmail: string | null;
  isAcceptingRequests: boolean;
  maxMentees: number;
  effortScore: number;
  profileViews: number;
  tags: Array<{ id: string; name: string; category: string; color: string; icon: string | null }>;
  richCardTypes: string[];
}

export interface DiscoverableFilters {
  semester?: number;
  tagIds?: string[];
  cardTypes?: string[];
  availability?: 'accepting' | 'full';
  limit: number;
  offset: number;
}

export interface DiscoveryRepository {
  listDiscoverableSeniors(filters: DiscoverableFilters): Promise<SeniorRow[]>;
  countDiscoverableSeniors(filters: Omit<DiscoverableFilters, 'limit' | 'offset'>): Promise<number>;
  listTags(options?: { activeOnly?: boolean }): Promise<Tag[]>;
  suggestTags(q: string, limit?: number): Promise<Tag[]>;
}

const seniorSelect = {
  userId: true,
  socialName: true,
  tagline: true,
  avatarUrl: true,
  avatarThumbnailUrl: true,
  bannerUrl: true,
  bannerPreset: true,
  themePalette: true,
  socialLinks: true,
  contactEmail: true,
  isAcceptingRequests: true,
  maxMentees: true,
  effortScore: true,
  profileViews: true,
  user: { select: { handle: true, semester: true } },
  tags: {
    include: { tag: { select: { id: true, name: true, category: true, color: true, icon: true } } },
  },
  richCards: { select: { cardType: true } },
} satisfies Prisma.ProfileSelect;

export function createDiscoveryRepository(prisma: PrismaClient): DiscoveryRepository {
  function buildWhere(
    filters: Omit<DiscoverableFilters, 'limit' | 'offset'>,
  ): Prisma.ProfileWhereInput {
    return {
      isDiscoverable: true,
      user: {
        role: 'senior',
        deletedAt: null,
        ...(filters.semester !== undefined ? { semester: filters.semester } : {}),
      },
      ...(filters.tagIds && filters.tagIds.length > 0
        ? { tags: { some: { tagId: { in: filters.tagIds } } } }
        : {}),
      ...(filters.cardTypes && filters.cardTypes.length > 0
        ? { richCards: { some: { cardType: { in: filters.cardTypes } } } }
        : {}),
      ...(filters.availability === 'accepting' ? { isAcceptingRequests: true } : {}),
      ...(filters.availability === 'full' ? { isAcceptingRequests: false } : {}),
    };
  }

  async function listDiscoverableSeniors(filters: DiscoverableFilters) {
    const rows = await prisma.profile.findMany({
      where: buildWhere(filters),
      select: seniorSelect,
      orderBy: { effortScore: 'desc' },
      skip: filters.offset,
      take: filters.limit,
    });

    return rows.map((row) => ({
      userId: row.userId,
      handle: row.user.handle,
      semester: row.user.semester,
      socialName: row.socialName,
      tagline: row.tagline,
      avatarUrl: row.avatarUrl,
      avatarThumbnailUrl: row.avatarThumbnailUrl,
      bannerUrl: row.bannerUrl,
      bannerPreset: row.bannerPreset,
      themePalette: row.themePalette,
      socialLinks: row.socialLinks,
      contactEmail: row.contactEmail,
      isAcceptingRequests: row.isAcceptingRequests,
      maxMentees: row.maxMentees,
      effortScore: row.effortScore,
      profileViews: row.profileViews,
      tags: row.tags.map(({ tag }) => tag),
      richCardTypes: row.richCards.map(({ cardType }) => cardType),
    }));
  }

  async function countDiscoverableSeniors(filters: Omit<DiscoverableFilters, 'limit' | 'offset'>) {
    return prisma.profile.count({ where: buildWhere(filters) });
  }

  async function listTags(options?: { activeOnly?: boolean }) {
    if (!options?.activeOnly) {
      return prisma.tag.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] });
    }
    // Only tags currently attached to at least one visible senior profile.
    const rows = await prisma.profileTag.findMany({
      where: {
        profile: {
          isDiscoverable: true,
          user: { role: 'senior', deletedAt: null },
        },
      },
      include: { tag: true },
      distinct: ['tagId'],
    });
    return rows
      .map((row) => row.tag)
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  async function suggestTags(q: string, limit = 8) {
    if (!q.trim()) return [];
    return prisma.tag.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      orderBy: [{ name: 'asc' }],
      take: limit,
    });
  }

  return { listDiscoverableSeniors, countDiscoverableSeniors, listTags, suggestTags };
}
