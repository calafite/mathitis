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
  devAdminsResponseSchema,
  promoteAdminBodySchema,
  promoteAdminResponseSchema,
  revokeAdminParamsSchema,
  revokeAdminResponseSchema,
  type DevMailboxQuery,
  type DevLinkQuery,
} from '@mathitis/schemas';
import type { SessionManager } from './session.js';
import { createRequireRole } from './auth-guard.js';
import { createDevService } from '../services/dev-service.js';
import { latestDevLink, listDevEmails } from '../lib/dev-mailbox.js';
import type { SessionEpochStore } from '../lib/session-epoch.js';

// Tokens are either legacy hex strings or composite `tokenId.secret` pairs.
const TOKEN_FRAGMENT = '[a-f0-9-]{16,}(?:\\.[a-f0-9]+)?';
const VERIFY_LINK_PATTERN = new RegExp(
  `https?:\\/\\/\\S*\\/verify-email\\?token=${TOKEN_FRAGMENT}`,
);
const RESET_LINK_PATTERN = new RegExp(`https?:\\/\\/\\S*\\/recover\\?token=${TOKEN_FRAGMENT}`);

export interface DevPluginOptions {
  prisma: PrismaClient;
  session: SessionManager;
  redis: Redis;
  queue: Queue;
  sessionEpoch?: SessionEpochStore;
}

export async function registerDevPlugin(app: FastifyInstance, options: DevPluginOptions) {
  const devService = createDevService({
    prisma: options.prisma,
    redis: options.redis,
    queue: options.queue,
    // Admin role changes must kick every active session immediately.
    bumpSessionEpoch: async (userId) => {
      if (!options.sessionEpoch) return;
      await options.sessionEpoch.bump(userId);
    },
  });

  const requireDeveloper = createRequireRole(options.session, ['developer', 'administrator']);
  // Privilege management is strictly developer-only: administrators must not
  // be able to promote peers or escalate themselves.
  const requireDeveloperOnly = createRequireRole(options.session, ['developer']);

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

      // -- Administrator management (developer-only) --------------------------

      devRoutes.get(
        '/admins',
        {
          preHandler: requireDeveloperOnly,
          schema: { response: { 200: devAdminsResponseSchema } },
        },
        async (_request, reply) => {
          const admins = await devService.listAdmins();
          return reply.send({ admins });
        },
      );

      devRoutes.post<{ Body: { identifier: string } }>(
        '/admins',
        {
          preHandler: requireDeveloperOnly,
          schema: {
            body: promoteAdminBodySchema,
            response: { 200: promoteAdminResponseSchema },
          },
        },
        async (request, reply) => {
          const developerId = request.sessionUser!.sub;
          const clientIp = request.ip;
          const admin = await devService.promoteToAdmin(
            developerId,
            clientIp,
            request.body.identifier,
          );
          return reply.send({ admin });
        },
      );

      devRoutes.delete<{ Params: { id: string } }>(
        '/admins/:id',
        {
          preHandler: requireDeveloperOnly,
          schema: {
            params: revokeAdminParamsSchema,
            response: { 200: revokeAdminResponseSchema },
          },
        },
        async (request, reply) => {
          const developerId = request.sessionUser!.sub;
          await devService.revokeAdmin(developerId, request.ip, request.params.id);
          return reply.send({ ok: true });
        },
      );
    },
    { prefix: '/api/dev' },
  );
}
