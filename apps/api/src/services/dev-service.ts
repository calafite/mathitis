import type { DevHealth, DevMetrics } from '@mathitis/schemas';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Queue } from 'bullmq';
import { readFileSync } from 'node:fs';
import { getQueueStats } from '../lib/queue.js';

export interface DevService {
  getHealth(): Promise<DevHealth>;
  getMetrics(): Promise<DevMetrics>;
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
}): DevService {
  const { prisma, redis, queue } = deps;

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

  return { getHealth, getMetrics };
}