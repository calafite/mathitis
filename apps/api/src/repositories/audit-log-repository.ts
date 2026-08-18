import type { Prisma, PrismaClient, UserRole } from '@prisma/client';

export interface AuditLogRow {
  id: string;
  actorId: string | null;
  action: string;
  targetEntity: string;
  targetId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: Date;
  actor: { id: string; handle: string; role: UserRole } | null;
}

export interface AuditLogFilters {
  action?: string;
  actorId?: string;
  targetEntity?: string;
  from?: Date;
  to?: Date;
}

export interface AuditLogRepository {
  create(input: {
    actorId?: string;
    action: string;
    targetEntity: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void>;
  list(filters: AuditLogFilters & { limit: number; offset: number }): Promise<AuditLogRow[]>;
  count(filters: AuditLogFilters): Promise<number>;
}

const actorSelect = {
  select: { id: true, handle: true, role: true },
} satisfies Prisma.UserDefaultArgs;

function buildWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  return {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.targetEntity ? { targetEntity: filters.targetEntity } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };
}

export function createAuditLogRepository(prisma: PrismaClient): AuditLogRepository {
  async function create(input: {
    actorId?: string;
    action: string;
    targetEntity: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }) {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        targetEntity: input.targetEntity,
        targetId: input.targetId ?? null,
        details: (input.details ?? {}) as object,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  async function list(filters: AuditLogFilters & { limit: number; offset: number }) {
    const { limit, offset, ...whereFilters } = filters;
    return prisma.auditLog.findMany({
      where: buildWhere(whereFilters),
      include: { actor: actorSelect },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    });
  }

  async function count(filters: AuditLogFilters) {
    return prisma.auditLog.count({ where: buildWhere(filters) });
  }

  return { create, list, count };
}
