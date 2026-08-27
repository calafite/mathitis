import { Prisma, type PrismaClient, type AccountStatus, type UserRole } from '@prisma/client';
import type { ModerationAction } from '@mathitis/schemas';
import { randomBytes } from 'node:crypto';

export interface AdminUserFilters {
  role?: string;
  status?: string;
  semester?: number;
  q?: string;
  limit: number;
  offset: number;
}

export interface AdminUserRow {
  id: string;
  handle: string;
  email: string;
  role: UserRole;
  semester: number;
  status: AccountStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  socialName: string | null;
}

export interface ApprovalRow {
  id: string;
  freshmanId: string;
  seniorId: string;
  status: string;
  message: string;
  createdAt: Date;
  freshman: {
    userId: string;
    handle: string;
    socialName: string | null;
    semester: number;
    avatarThumbnailUrl: string | null;
  } | null;
  senior: {
    userId: string;
    handle: string;
    socialName: string | null;
    semester: number;
    avatarThumbnailUrl: string | null;
  } | null;
}

export interface AdminMentorshipRequestRow {
  id: string;
  freshmanId: string;
  seniorId: string;
  status: string;
  message: string;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  freshman: {
    userId: string;
    handle: string;
    socialName: string | null;
    semester: number;
    avatarThumbnailUrl: string | null;
  } | null;
  senior: {
    userId: string;
    handle: string;
    socialName: string | null;
    semester: number;
    avatarThumbnailUrl: string | null;
  } | null;
}

export interface AdminRepository {
  listUsers(filters: AdminUserFilters): Promise<AdminUserRow[]>;
  countUsers(filters: Omit<AdminUserFilters, 'limit' | 'offset'>): Promise<number>;
  findUserById(id: string): Promise<AdminUserRow | null>;
  updateUserStatus(id: string, status: AccountStatus): Promise<AdminUserRow>;
  anonymizeUser(id: string): Promise<AdminUserRow>;
  clearProfileField(userId: string, action: ModerationAction): Promise<void>;
  listApprovals(status: string): Promise<ApprovalRow[]>;
  listMentorshipRequests(status?: string): Promise<AdminMentorshipRequestRow[]>;
}

function toAdminUserRow(row: {
  id: string;
  handle: string;
  email: string;
  role: UserRole;
  semester: number;
  status: AccountStatus;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profile?: { socialName: string | null } | null;
}): AdminUserRow {
  return {
    id: row.id,
    handle: row.handle,
    email: row.email,
    role: row.role,
    semester: row.semester,
    status: row.status,
    deletedAt: row.deletedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    socialName: row.profile?.socialName ?? null,
  };
}

export function createAdminRepository(prisma: PrismaClient): AdminRepository {
  function buildWhere(filters: Omit<AdminUserFilters, 'limit' | 'offset'>): Prisma.UserWhereInput {
    return {
      ...(filters.role ? { role: filters.role as Prisma.UserWhereInput['role'] } : {}),
      ...(filters.status ? { status: filters.status as AccountStatus } : {}),
      ...(filters.semester !== undefined ? { semester: filters.semester } : {}),
      ...(filters.q
        ? {
            OR: [
              { handle: { contains: filters.q, mode: 'insensitive' } },
              { email: { contains: filters.q, mode: 'insensitive' } },
              { profile: { socialName: { contains: filters.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
  }

  async function listUsers(filters: AdminUserFilters) {
    const rows = await prisma.user.findMany({
      where: buildWhere(filters),
      include: { profile: { select: { socialName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: filters.offset,
      take: filters.limit,
    });
    return rows.map(toAdminUserRow);
  }

  async function countUsers(filters: Omit<AdminUserFilters, 'limit' | 'offset'>) {
    return prisma.user.count({ where: buildWhere(filters) });
  }

  async function findUserById(id: string) {
    const row = await prisma.user.findUnique({
      where: { id },
      include: { profile: { select: { socialName: true } } },
    });
    return row ? toAdminUserRow(row) : null;
  }

  async function updateUserStatus(id: string, status: AccountStatus) {
    const row = await prisma.user.update({
      where: { id },
      data: { status },
      include: { profile: { select: { socialName: true } } },
    });
    return toAdminUserRow(row);
  }

  /**
   * Soft deletes the user and anonymizes every piece of personal data while
   * preserving mentorships FK integrity so the lineage graph stays intact.
   */
  async function anonymizeUser(id: string) {
    const suffix = randomBytes(8).toString('hex');
    return prisma.$transaction(async (tx) => {
      await tx.richCard.deleteMany({ where: { profileId: id } });
      await tx.profileTag.deleteMany({ where: { profileId: id } });
      await tx.profile.update({
        where: { userId: id },
        data: {
          socialName: null,
          pronouns: null,
          tagline: null,
          biographyMarkdown: null,
          avatarUrl: null,
          avatarThumbnailUrl: null,
          bannerUrl: null,
          bannerThumbnailUrl: null,
          bannerPreset: null,
          themePalette: Prisma.DbNull,
          socialLinks: Prisma.DbNull,
          contactEmail: null,
          isDiscoverable: false,
          isAcceptingRequests: false,
        },
      });
      const row = await tx.user.update({
        where: { id },
        data: {
          handle: `user_${suffix}`,
          email: `user_${suffix}@anonymized.local`,
          deletedAt: new Date(),
          status: 'deactivated',
          profile: {
            update: {},
          },
        },
        include: { profile: { select: { socialName: true } } },
      });
      return toAdminUserRow(row);
    });
  }

  async function clearProfileField(userId: string, action: ModerationAction) {
    if (action === 'clear_rich_cards') {
      await prisma.richCard.deleteMany({ where: { profileId: userId } });
      return;
    }

    const data: Prisma.ProfileUpdateInput = {};
    if (action === 'clear_banner') {
      data.bannerUrl = null;
      data.bannerThumbnailUrl = null;
      data.bannerPreset = null;
    } else if (action === 'clear_biography') {
      data.biographyMarkdown = null;
      data.tagline = null;
    } else if (action === 'clear_contact') {
      data.contactEmail = null;
      data.socialLinks = Prisma.DbNull;
    }
    await prisma.profile.update({ where: { userId }, data });
  }

  async function listApprovals(status: string) {
    const rows = await prisma.mentorshipRequest.findMany({
      where: { status: status as never },
      include: {
        freshman: {
          select: {
            id: true,
            handle: true,
            semester: true,
            profile: {
              select: { userId: true, socialName: true, avatarThumbnailUrl: true },
            },
          },
        },
        senior: {
          select: {
            id: true,
            handle: true,
            semester: true,
            profile: {
              select: { userId: true, socialName: true, avatarThumbnailUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      id: row.id,
      freshmanId: row.freshmanId,
      seniorId: row.seniorId,
      status: row.status,
      message: row.message,
      createdAt: row.createdAt,
      freshman: row.freshman.profile
        ? {
            userId: row.freshman.profile.userId,
            handle: row.freshman.handle,
            socialName: row.freshman.profile.socialName,
            semester: row.freshman.semester,
            avatarThumbnailUrl: row.freshman.profile.avatarThumbnailUrl,
          }
        : null,
      senior: row.senior.profile
        ? {
            userId: row.senior.profile.userId,
            handle: row.senior.handle,
            socialName: row.senior.profile.socialName,
            semester: row.senior.semester,
            avatarThumbnailUrl: row.senior.profile.avatarThumbnailUrl,
          }
        : null,
    }));
  }

  async function listMentorshipRequests(status?: string) {
    const rows = await prisma.mentorshipRequest.findMany({
      where: status ? { status: status as never } : {},
      include: {
        freshman: {
          select: {
            id: true,
            handle: true,
            semester: true,
            profile: {
              select: { userId: true, socialName: true, avatarThumbnailUrl: true },
            },
          },
        },
        senior: {
          select: {
            id: true,
            handle: true,
            semester: true,
            profile: {
              select: { userId: true, socialName: true, avatarThumbnailUrl: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id,
      freshmanId: row.freshmanId,
      seniorId: row.seniorId,
      status: row.status,
      message: row.message,
      rejectionReason: row.rejectionReason,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      freshman: row.freshman.profile
        ? {
            userId: row.freshman.profile.userId,
            handle: row.freshman.handle,
            socialName: row.freshman.profile.socialName,
            semester: row.freshman.semester,
            avatarThumbnailUrl: row.freshman.profile.avatarThumbnailUrl,
          }
        : null,
      senior: row.senior.profile
        ? {
            userId: row.senior.profile.userId,
            handle: row.senior.handle,
            socialName: row.senior.profile.socialName,
            semester: row.senior.semester,
            avatarThumbnailUrl: row.senior.profile.avatarThumbnailUrl,
          }
        : null,
    }));
  }

  return {
    listUsers,
    countUsers,
    findUserById,
    updateUserStatus,
    anonymizeUser,
    clearProfileField,
    listApprovals,
    listMentorshipRequests,
  };
}
