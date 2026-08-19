import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Queue } from 'bullmq';
import {
  devHealthSchema,
  devMetricsResponseSchema,
  devMailboxQuerySchema,
  devMailboxResponseSchema,
  devLinkQuerySchema,
  devLinkResponseSchema,
  type DevMailboxQuery,
  type DevLinkQuery,
} from '@mathitis/schemas';
import type { SessionManager } from './session.js';
import { createRequireRole } from './auth-guard.js';
import { createDevService } from '../services/dev-service.js';
import { latestDevLink, listDevEmails } from '../lib/dev-mailbox.js';

const VERIFY_LINK_PATTERN = /https?:\/\/\S*\/verify-email\?token=[a-f0-9]{16,}/;
const RESET_LINK_PATTERN = /https?:\/\/\S*\/recover\?token=[a-f0-9]{16,}/;

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

      devRoutes.get<{ Querystring: DevMailboxQuery }>(
        '/mailbox',
        {
          preHandler: requireDeveloper,
          schema: {
            querystring: devMailboxQuerySchema,
            response: { 200: devMailboxResponseSchema },
          },
        },
        async (request, reply) => {
          const { to, limit } = request.query;
          return reply.send({ emails: listDevEmails({ to, limit }) });
        },
      );

      devRoutes.get<{ Querystring: DevLinkQuery }>(
        '/verification-link',
        {
          preHandler: requireDeveloper,
          schema: {
            querystring: devLinkQuerySchema,
            response: { 200: devLinkResponseSchema },
          },
        },
        async (request, reply) => {
          return reply.send({
            url: latestDevLink({ to: request.query.email, pattern: VERIFY_LINK_PATTERN }),
          });
        },
      );

      devRoutes.get<{ Querystring: DevLinkQuery }>(
        '/reset-link',
        {
          preHandler: requireDeveloper,
          schema: {
            querystring: devLinkQuerySchema,
            response: { 200: devLinkResponseSchema },
          },
        },
        async (request, reply) => {
          return reply.send({
            url: latestDevLink({ to: request.query.email, pattern: RESET_LINK_PATTERN }),
          });
        },
      );
    },
    { prefix: '/api/dev' },
  );
}
