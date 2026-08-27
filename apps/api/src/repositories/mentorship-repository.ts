import type { Prisma, PrismaClient } from '@prisma/client';

export interface MentorshipCreateInput {
  requestId: string;
  freshmanId: string;
  seniorId: string;
  semester: number;
  academicYear: string;
}

export interface MentorshipRepository {
  create(input: MentorshipCreateInput, tx?: Prisma.TransactionClient): Promise<void>;
  countActiveBySenior(seniorId: string, tx?: Prisma.TransactionClient): Promise<number>;
  listLineage(): Promise<
    Array<{
      mentorId: string;
      menteeId: string;
      academicYear: string;
      semester: number;
      mentor: { handle: string; socialName: string | null; semester: number; role: string };
      mentee: { handle: string; socialName: string | null; semester: number; role: string };
    }>
  >;
  listByUser(userId: string): Promise<
    Array<{
      id: string;
      mentorId: string;
      menteeId: string;
      academicYear: string;
      semester: number;
    }>
  >;
}

export function createMentorshipRepository(prisma: PrismaClient): MentorshipRepository {
  async function create(input: MentorshipCreateInput, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    await db.mentorship.create({
      data: {
        requestId: input.requestId,
        freshmanId: input.freshmanId,
        seniorId: input.seniorId,
        semester: input.semester,
        academicYear: input.academicYear,
      },
    });
  }

  async function countActiveBySenior(seniorId: string, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    return db.mentorship.count({ where: { seniorId } });
  }

  async function listLineage() {
    const rows = await prisma.mentorship.findMany({
      include: {
        senior: {
          select: {
            id: true,
            handle: true,
            semester: true,
            role: true,
            profile: { select: { socialName: true } },
          },
        },
        freshman: {
          select: {
            id: true,
            handle: true,
            semester: true,
            role: true,
            profile: { select: { socialName: true } },
          },
        },
      },
      orderBy: [{ academicYear: 'asc' }, { semester: 'asc' }],
    });

    return rows.map((row) => ({
      mentorId: row.senior.id,
      menteeId: row.freshman.id,
      academicYear: row.academicYear,
      semester: row.semester,
      mentor: {
        handle: row.senior.handle,
        socialName: row.senior.profile?.socialName ?? null,
        semester: row.senior.semester,
        role: row.senior.role,
      },
      mentee: {
        handle: row.freshman.handle,
        socialName: row.freshman.profile?.socialName ?? null,
        semester: row.freshman.semester,
        role: row.freshman.role,
      },
    }));
  }

  async function listByUser(userId: string) {
    const rows = await prisma.mentorship.findMany({
      where: { OR: [{ freshmanId: userId }, { seniorId: userId }] },
      select: { id: true, freshmanId: true, seniorId: true, academicYear: true, semester: true },
    });

    return rows.map((row) => ({
      id: row.id,
      mentorId: row.seniorId,
      menteeId: row.freshmanId,
      academicYear: row.academicYear,
      semester: row.semester,
    }));
  }

  return { create, countActiveBySenior, listLineage, listByUser };
}
