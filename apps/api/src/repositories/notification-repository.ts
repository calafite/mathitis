import type { PrismaClient, NotificationType } from '@prisma/client';

export interface NotificationRow {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  payload: unknown;
  readAt: Date | null;
  createdAt: Date;
}

export interface NotificationRepository {
  create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<NotificationRow>;
  findById(id: string, userId: string): Promise<NotificationRow | null>;
  listForUser(
    userId: string,
    options: { unreadOnly: boolean; limit: number; offset: number },
  ): Promise<NotificationRow[]>;
  countUnread(userId: string): Promise<number>;
  markRead(id: string, userId: string): Promise<number>;
  markAllRead(userId: string): Promise<number>;
  listAdministratorIds(): Promise<string[]>;
  getEmail(userId: string): Promise<string | null>;
}

export function createNotificationRepository(prisma: PrismaClient): NotificationRepository {
  async function create(input: {
    userId: string;
    type: NotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }) {
    return prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        payload: (input.payload ?? undefined) as object | undefined,
      },
    });
  }

  async function findById(id: string, userId: string) {
    return prisma.notification.findFirst({ where: { id, userId } });
  }

  async function listForUser(
    userId: string,
    options: { unreadOnly: boolean; limit: number; offset: number },
  ) {
    return prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      skip: options.offset,
      take: options.limit,
    });
  }

  async function countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, readAt: null } });
  }

  async function markRead(id: string, userId: string) {
    const result = await prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async function markAllRead(userId: string) {
    const result = await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async function listAdministratorIds() {
    const rows = await prisma.user.findMany({
      where: { role: 'administrator', deletedAt: null },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  async function getEmail(userId: string) {
    const row = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { email: true },
    });
    return row?.email ?? null;
  }

  return {
    create,
    findById,
    listForUser,
    countUnread,
    markRead,
    markAllRead,
    listAdministratorIds,
    getEmail,
  };
}