import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Queue } from 'bullmq';
import { devHealthSchema, devMetricsResponseSchema } from '@mathitis/schemas';
import type { SessionManager } from './session.js';
import { createRequireRole } from './auth-guard.js';
import { createDevService } from '../services/dev-service.js';

export interface DevPluginOptions {
  prisma: PrismaClient;
  session: SessionManager;
  redis: Redis;
  queue: Queue;
}

export async function registerDevPlugin(app: FastifyInstance, options: DevPluginOptions) {
  const devService = createDevService({
    prisma: options.prisma,
    redis: options.redis,
    queue: options.queue,
  });

  const requireDeveloper = createRequireRole(options.session, ['developer', 'administrator']);

  app.register(
    async (devRoutes) => {
      devRoutes.get(
        '/health',
        {
          preHandler: requireDeveloper,
          schema: { response: { 200: devHealthSchema } },
        },
        async (_request, reply) => {
          return reply.send(await devService.getHealth());
        },
      );

      devRoutes.get(
        '/metrics',
        {
          preHandler: requireDeveloper,
          schema: { response: { 200: devMetricsResponseSchema } },
        },
        async (_request, reply) => {
          const metrics = await devService.getMetrics();
          return reply.send({ metrics });
        },
      );
    },
    { prefix: '/api/dev' },
  );
}