import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { NotificationParams, NotificationsQuery } from '@mathitis/schemas';
import {
  notificationParamsSchema,
  notificationReadResponseSchema,
  notificationsQuerySchema,
  notificationsReadAllResponseSchema,
  notificationsResponseSchema,
} from '@mathitis/schemas';
import { getSessionCookie, type SessionManager } from './session.js';
import { createRequireAuth } from './auth-guard.js';
import { createNotificationRepository } from '../repositories/notification-repository.js';
import { createSystemConfigRepository } from '../repositories/system-config-repository.js';
import { createNotificationService } from '../services/notification-service.js';
import type { LoggerLike } from '../lib/logger.js';

export interface NotificationsPluginOptions {
  prisma: PrismaClient;
  session: SessionManager;
  emailQueue: Queue;
  logger: LoggerLike;
}

export async function registerNotificationsPlugin(
  app: FastifyInstance,
  options: NotificationsPluginOptions,
) {
  const notificationService = createNotificationService({
    notificationRepository: createNotificationRepository(options.prisma),
    systemConfigRepository: createSystemConfigRepository(options.prisma),
    emailQueue: options.emailQueue,
    logger: options.logger,
  });

  const requireAuth = createRequireAuth(options.session);

  async function notifKeyGenerator(request: FastifyRequest): Promise<string> {
    const payload = await options.session.verifySessionCookie(getSessionCookie(request));
    return payload?.sub ? `user:${payload.sub}` : `ip:${request.ip}`;
  }

  app.register(
    async (notificationRoutes) => {
      notificationRoutes.get<{ Querystring: NotificationsQuery }>(
        '/notifications',
        {
          preHandler: requireAuth,
          schema: {
            querystring: notificationsQuerySchema,
            response: { 200: notificationsResponseSchema },
          },
          config: {
            rateLimit: { max: 60, timeWindow: '1 minute', keyGenerator: notifKeyGenerator },
          },
        },
        async (request, reply) => {
          const viewerId = request.sessionUser!.sub;
          const raw = request.query as unknown as {
            unreadOnly?: boolean;
            limit?: number;
            offset?: number;
          };
          const result = await notificationService.listForUser(viewerId, {
            unreadOnly: raw.unreadOnly ?? false,
            limit: raw.limit ?? 20,
            offset: raw.offset ?? 0,
          });
          return reply.send(result);
        },
      );

      notificationRoutes.patch<{ Params: NotificationParams }>(
        '/notifications/:id/read',
        {
          preHandler: requireAuth,
          schema: {
            params: notificationParamsSchema,
            response: { 200: notificationReadResponseSchema },
          },
          config: {
            rateLimit: { max: 60, timeWindow: '1 minute', keyGenerator: notifKeyGenerator },
          },
        },
        async (request, reply) => {
          const viewerId = request.sessionUser!.sub;
          const notification = await notificationService.markRead(request.params.id, viewerId);
          if (!notification) {
            return reply.code(404).send({
              error: {
                code: 'NOTIFICATION_NOT_FOUND',
                message: 'Notificação não encontrada',
                statusCode: 404,
              },
            });
          }
          return reply.send({ notification });
        },
      );

      notificationRoutes.patch(
        '/notifications/read-all',
        {
          preHandler: requireAuth,
          schema: {
            response: { 200: notificationsReadAllResponseSchema },
          },
          config: {
            rateLimit: { max: 30, timeWindow: '1 minute', keyGenerator: notifKeyGenerator },
          },
        },
        async (request, reply) => {
          const viewerId = request.sessionUser!.sub;
          const updated = await notificationService.markAllRead(viewerId);
          return reply.send({ updated });
        },
      );
    },
    { prefix: '/api' },
  );
}
