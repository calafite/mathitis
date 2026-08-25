import type { MentorshipRequestStatus, Prisma, PrismaClient } from '@prisma/client';

const requestInclude = {
  freshman: {
    select: {
      id: true,
      handle: true,
      semester: true,
      profile: {
        select: {
          userId: true,
          socialName: true,
          tagline: true,
          avatarThumbnailUrl: true,
        },
      },
    },
  },
  senior: {
    select: {
      id: true,
      handle: true,
      semester: true,
      profile: {
        select: {
          userId: true,
          socialName: true,
          tagline: true,
          avatarThumbnailUrl: true,
        },
      },
    },
  },
} satisfies Prisma.MentorshipRequestInclude;

export interface RequestRow {
  id: string;
  freshmanId: string;
  seniorId: string;
  status: MentorshipRequestStatus;
  message: string;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  freshman: {
    id: string;
    handle: string;
    semester: number;
    profile: {
      userId: string;
      socialName: string | null;
      tagline: string | null;
      avatarThumbnailUrl: string | null;
    } | null;
  };
  senior: {
    id: string;
    handle: string;
    semester: number;
    profile: {
      userId: string;
      socialName: string | null;
      tagline: string | null;
      avatarThumbnailUrl: string | null;
    } | null;
  };
}

export interface RequestRepository {
  create(
    data: { freshmanId: string; seniorId: string; message: string },
    tx?: Prisma.TransactionClient,
  ): Promise<RequestRow>;
  findById(id: string, tx?: Prisma.TransactionClient): Promise<RequestRow | null>;
  listIncoming(seniorId: string, status?: MentorshipRequestStatus): Promise<RequestRow[]>;
  listSent(freshmanId: string, status?: MentorshipRequestStatus): Promise<RequestRow[]>;
  updateStatus(
    id: string,
    status: MentorshipRequestStatus,
    extra?: { rejectionReason?: string | null; reviewedByAdminId?: string },
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
  countActiveByFreshman(freshmanId: string, tx?: Prisma.TransactionClient): Promise<number>;
  countActiveBySenior(seniorId: string, tx?: Prisma.TransactionClient): Promise<number>;
  lockSeniorProfile(
    seniorId: string,
    tx: Prisma.TransactionClient,
  ): Promise<{ maxMentees: number; isAcceptingRequests: boolean } | null>;
  cancelPendingBeyondCapacity(seniorId: string, tx: Prisma.TransactionClient): Promise<void>;
}

export function createRequestRepository(prisma: PrismaClient): RequestRepository {
  async function create(
    data: { freshmanId: string; seniorId: string; message: string },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? prisma;
    return db.mentorshipRequest.create({ data, include: requestInclude });
  }

  async function findById(id: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    return db.mentorshipRequest.findUnique({ where: { id }, include: requestInclude });
  }

  async function listIncoming(seniorId: string, status?: MentorshipRequestStatus) {
    return prisma.mentorshipRequest.findMany({
      where: { seniorId, ...(status ? { status } : {}) },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async function listSent(freshmanId: string, status?: MentorshipRequestStatus) {
    return prisma.mentorshipRequest.findMany({
      where: { freshmanId, ...(status ? { status } : {}) },
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async function updateStatus(
    id: string,
    status: MentorshipRequestStatus,
    extra?: { rejectionReason?: string | null; reviewedByAdminId?: string },
    tx?: Prisma.TransactionClient,
  ) {
    const db = tx ?? prisma;
    await db.mentorshipRequest.update({
      where: { id },
      data: { status, ...(extra ?? {}) },
    });
  }

  async function countActiveByFreshman(freshmanId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    return db.mentorshipRequest.count({
      where: { freshmanId, status: { in: ['pending', 'pending_admin_approval', 'accepted'] } },
    });
  }

  async function countActiveBySenior(seniorId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    return db.mentorshipRequest.count({
      where: { seniorId, status: { in: ['pending', 'pending_admin_approval', 'accepted'] } },
    });
  }

  async function lockSeniorProfile(seniorId: string, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<Array<{ max_mentees: number; is_accepting_requests: boolean }>>`
      SELECT max_mentees, is_accepting_requests
      FROM profiles
      WHERE user_id = ${seniorId}::uuid
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) return null;
    return { maxMentees: Number(row.max_mentees), isAcceptingRequests: row.is_accepting_requests };
  }

  async function cancelPendingBeyondCapacity(seniorId: string, tx: Prisma.TransactionClient) {
    await tx.mentorshipRequest.updateMany({
      where: { seniorId, status: 'pending' },
      data: {
        status: 'cancelled_capacity_filled',
        rejectionReason: 'Senior reached maximum mentee capacity',
      },
    });
  }

  return {
    create,
    findById,
    listIncoming,
    listSent,
    updateStatus,
    countActiveByFreshman,
    countActiveBySenior,
    lockSeniorProfile,
    cancelPendingBeyondCapacity,
  };
}