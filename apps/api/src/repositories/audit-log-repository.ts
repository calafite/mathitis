import type { PrismaClient } from '@prisma/client';

export interface AuditLogRepository {
  create(input: {
    actorId?: string;
    action: string;
    targetEntity: string;
    targetId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<void>;
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

  return { create };
}
