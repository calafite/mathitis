import type { DevHealth, DevMetrics } from '@mathitis/schemas';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Queue } from 'bullmq';
import { readFileSync } from 'node:fs';
import { getQueueStats } from '../lib/queue.js';
import { ConflictError, NotFoundError, ValidationError } from '../errors.js';

export interface DevService {
  getHealth(): Promise<DevHealth>;
  getMetrics(): Promise<DevMetrics>;
  listAdmins(): Promise<
    Array<{
      id: string;
      handle: string;
      email: string;
      role: 'administrator' | 'developer';
      semester: number;
      socialName: string | null;
      createdAt: Date;
    }>
  >;
  promoteToAdmin(developerId: string, clientIp: string, identifier: string): Promise<{
    id: string;
    handle: string;
    email: string;
    role: 'administrator' | 'developer';
    semester: number;
    socialName: string | null;
    createdAt: Date;
  }>;
  revokeAdmin(developerId: string, clientIp: string, targetUserId: string): Promise<void>;
}

function parseListeningPorts(): number[] {
  try {
    const ports = new Set<number>();
    for (const file of ['/proc/net/tcp', '/proc/net/tcp6']) {
      const content = readFileSync(file, 'utf8');
      for (const line of content.split('\n').slice(1)) {
        if (!line.trim()) continue;
        const parts = line.trim().split(/\s+/);
        // parts[1] = local_address in hex ip:port, parts[3] = st (0A = LISTEN)
        if (parts[3] !== '0A') continue;
        const localAddress = parts[1];
        if (!localAddress) continue;
        const portHex = localAddress.split(':')[1];
        const port = portHex ? parseInt(portHex, 16) : NaN;
        if (!Number.isNaN(port)) ports.add(port);
      }
    }
    return [...ports].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

function networkReport(listeningPorts: number[]): DevMetrics['network'] {
  const exposedPorts = listeningPorts.filter((port) => port !== 80 && port !== 443);
  const warnings = exposedPorts.map(
    (port) => `Port ${port} is listening outside the standard web ports (80/443).`,
  );
  if (listeningPorts.length === 0) {
    warnings.push('Unable to inspect listening sockets.');
  }
  return { listeningPorts, exposedPorts, warnings };
}

export function createDevService(deps: {
  prisma: PrismaClient;
  redis: Redis;
  queue: Queue;
  /** Bumps a user's session epoch, invalidating all their sessions. */
  bumpSessionEpoch: (userId: string) => Promise<void>;
}): DevService {
  const { prisma, redis, queue, bumpSessionEpoch } = deps;

  async function checkDatabase(): Promise<DevHealth['checks']['database']> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return 'ok';
    } catch {
      return 'error';
    }
  }

  async function checkRedis(): Promise<DevHealth['checks']['redis']> {
    try {
      const pong = await redis.ping();
      return pong === 'PONG' ? 'ok' : 'error';
    } catch {
      return 'error';
    }
  }

  async function checkQueue(): Promise<DevHealth['checks']['queue']> {
    try {
      await getQueueStats(queue);
      return 'ok';
    } catch {
      return 'error';
    }
  }

  async function getHealth(): Promise<DevHealth> {
    const [database, redisCheck, queueCheck] = await Promise.all([
      checkDatabase(),
      checkRedis(),
      checkQueue(),
    ]);
    const allOk = database === 'ok' && redisCheck === 'ok' && queueCheck === 'ok';
    return {
      status: allOk ? 'ok' : 'degraded',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      checks: { database, redis: redisCheck, queue: queueCheck },
    };
  }

  async function getMetrics(): Promise<DevMetrics> {
    const memory = process.memoryUsage();

    let connections = { activeConnections: 0, idleConnections: 0, totalConnections: 0 };
    try {
      const rows = await prisma.$queryRaw<
        Array<{ state: string; count: bigint }>
      >`SELECT state, count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() GROUP BY state`;
      connections = rows.reduce(
        (acc, row) => {
          const n = Number(row.count);
          acc.totalConnections += n;
          if (row.state === 'active') acc.activeConnections += n;
          if (row.state === 'idle') acc.idleConnections += n;
          return acc;
        },
        { activeConnections: 0, idleConnections: 0, totalConnections: 0 },
      );
    } catch {
      // Connection pool stats are best-effort.
    }

    let queueStats = {
      waiting: 0,
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      throughput: { completed: 0, failed: 0 },
    };
    try {
      queueStats = await getQueueStats(queue);
    } catch {
      // Queue telemetry is best-effort.
    }

    const listeningPorts = parseListeningPorts();

    return {
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        memory: {
          rss: memory.rss,
          heapUsed: memory.heapUsed,
          heapTotal: memory.heapTotal,
          external: memory.external,
        },
        nodeVersion: process.version,
        pid: process.pid,
      },
      database: connections,
      queue: queueStats,
      network: networkReport(listeningPorts),
    };
  }

  async function auditRoleChange(
    actorId: string,
    action: 'developer.admin.promote' | 'developer.admin.demote',
    targetId: string,
    previousRole: string,
    clientIp: string,
  ) {
    await prisma.auditLog.create({
      data: {
        actorId,
        action,
        targetEntity: 'user',
        targetId,
        details: { previousRole },
        ipAddress: clientIp === 'unknown' ? null : clientIp,
      },
    });
  }

  async function listAdmins() {
    const users = await prisma.user.findMany({
      where: { role: { in: ['administrator', 'developer'] }, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        handle: true,
        email: true,
        role: true,
        semester: true,
        createdAt: true,
        profile: { select: { socialName: true } },
      },
    });
    return users.map((user) => ({
      id: user.id,
      handle: user.handle,
      email: user.email,
      role: user.role as 'administrator' | 'developer',
      semester: user.semester,
      socialName: user.profile?.socialName ?? null,
      createdAt: user.createdAt,
    }));
  }

  async function promoteToAdmin(
    developerId: string,
    clientIp: string,
    identifier: string,
  ): ReturnType<DevService['promoteToAdmin']> {
    const lookup = identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { OR: [{ handle: lookup }, { email: lookup }], deletedAt: null },
    });
    if (!user) {
      throw new NotFoundError('Usuário não encontrado', 'DEV_USER_NOT_FOUND');
    }
    if (user.role === 'administrator' || user.role === 'developer') {
      throw new ConflictError('Este usuário já possui privilégios administrativos');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: 'administrator' },
    });

    await auditRoleChange(developerId, 'developer.admin.promote', user.id, user.role, clientIp);
    // Force a fresh session everywhere so the new role claim takes effect now.
    await bumpSessionEpoch(user.id);

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        handle: true,
        email: true,
        role: true,
        semester: true,
        createdAt: true,
        profile: { select: { socialName: true } },
      },
    });

    return {
      id: updated!.id,
      handle: updated!.handle,
      email: updated!.email,
      role: 'administrator',
      semester: updated!.semester,
      socialName: updated!.profile?.socialName ?? null,
      createdAt: updated!.createdAt,
    };
  }

  async function revokeAdmin(developerId: string, clientIp: string, targetUserId: string) {
    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user || user.deletedAt !== null) {
      throw new NotFoundError('Usuário não encontrado', 'DEV_USER_NOT_FOUND');
    }
    if (user.role !== 'administrator') {
      throw new ValidationError('O usuário selecionado não é um administrador');
    }

    // Safe demotion fallback: only semester-1 students are freshmen.
    const fallbackRole = user.semester >= 2 ? 'senior' : 'freshman';

    await prisma.user.update({
      where: { id: user.id },
      data: { role: fallbackRole },
    });

    await auditRoleChange(developerId, 'developer.admin.demote', user.id, user.role, clientIp);
    await bumpSessionEpoch(user.id);
  }

  return { getHealth, getMetrics, listAdmins, promoteToAdmin, revokeAdmin };
}