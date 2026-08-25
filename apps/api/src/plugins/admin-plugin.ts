import type { FastifyInstance } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type {
  AdminUserParams,
  AdminUsersQuery,
  ApprovalParams,
  ApprovalsQuery,
  AuditLogsQuery,
  ConfigPatch,
  DecisionBody,
  ModerationBody,
  UpdateUserStatusBody,
} from '@mathitis/schemas';
import {
  adminUserParamsSchema,
  adminUserResponseSchema,
  adminUsersQuerySchema,
  adminUsersResponseSchema,
  anonymizeResponseSchema,
  approvalParamsSchema,
  approvalsQuerySchema,
  approvalsResponseSchema,
  auditLogsQuerySchema,
  auditLogsResponseSchema,
  configPatchSchema,
  configResponseSchema,
  decisionBodySchema,
  decisionResponseSchema,
  moderationBodySchema,
  updateUserStatusBodySchema,
} from '@mathitis/schemas';
import type { SessionManager } from './session.js';
import { createRequireRole } from './auth-guard.js';
import { createAdminRepository } from '../repositories/admin-repository.js';
import { createAuditLogRepository } from '../repositories/audit-log-repository.js';
import type { SessionEpochStore } from '../lib/session-epoch.js';
import { createSystemConfigRepository } from '../repositories/system-config-repository.js';
import { createUserRepository } from '../repositories/user-repository.js';
import { createProfileRepository } from '../repositories/profile-repository.js';
import { createRequestRepository } from '../repositories/request-repository.js';
import { createMentorshipRepository } from '../repositories/mentorship-repository.js';
import type { Redis } from 'ioredis';
import { invalidateLineageCache } from '../lib/lineage-cache.js';
import { createAdminService } from '../services/admin-service.js';
import { createRequestService } from '../services/request-service.js';
import { createNotificationRepository } from '../repositories/notification-repository.js';
import { createNotificationService } from '../services/notification-service.js';
import type { IdempotencyStore } from '../lib/idempotency.js';
import type { LoggerLike } from '../lib/logger.js';
import type { Queue } from 'bullmq';

export interface AdminPluginOptions {
  prisma: PrismaClient;
  session: SessionManager;
  idempotencyStore: IdempotencyStore;
  emailQueue: Queue;
  logger: LoggerLike;
  sessionEpoch?: SessionEpochStore;
  /** Enables lineage cache invalidation on anonymization when provided. */
  redis?: Redis;
}

export async function registerAdminPlugin(app: FastifyInstance, options: AdminPluginOptions) {
  const { prisma, sessionEpoch, redis } = options;

  const adminRepository = createAdminRepository(prisma);
  const auditLogRepository = createAuditLogRepository(prisma);
  const systemConfigRepository = createSystemConfigRepository(prisma);
  const requestRepository = createRequestRepository(prisma);
  const mentorshipRepository = createMentorshipRepository(prisma);
  const userRepository = createUserRepository(prisma);
  const profileRepository = createProfileRepository(prisma);

  const notificationService = createNotificationService({
    notificationRepository: createNotificationRepository(prisma),
    systemConfigRepository,
    emailQueue: options.emailQueue,
    logger: options.logger,
  });

  const requestService = createRequestService({
    prisma,
    requestRepository,
    mentorshipRepository,
    userRepository,
    profileRepository,
    systemConfigRepository,
    idempotencyStore: options.idempotencyStore,
    notificationService,
  });

  const adminService = createAdminService({
    adminRepository,
    systemConfigRepository,
    auditLogRepository,
    requestService,
    onUserAnonymized: async (handle) => {
      if (redis) await invalidateLineageCache(redis, [handle]);
    },
  });

  const requireAdmin = createRequireRole(options.session, ['administrator']);

  app.register(
    async (adminRoutes) => {
      // -- Dynamic system configuration --------------------------------------
      adminRoutes.get(
        '/config',
        {
          preHandler: requireAdmin,
          schema: { response: { 200: configResponseSchema } },
        },
        async (_request, reply) => {
          const config = await adminService.getConfig();
          return reply.send({ config });
        },
      );

      adminRoutes.patch<{ Body: ConfigPatch }>(
        '/config',
        {
          preHandler: requireAdmin,
          schema: {
            body: configPatchSchema,
            response: { 200: configResponseSchema },
          },
        },
        async (request, reply) => {
          const config = await adminService.updateConfig(
            request.sessionUser!.sub,
            request.ip,
            request.body,
          );
          return reply.send({ config });
        },
      );

      // -- User management ----------------------------------------------------
      adminRoutes.get<{ Querystring: AdminUsersQuery }>(
        '/users',
        {
          preHandler: requireAdmin,
          schema: {
            querystring: adminUsersQuerySchema,
            response: { 200: adminUsersResponseSchema },
          },
        },
        async (request, reply) => {
          const { users, total } = await adminService.listUsers(request.query);
          return reply.send({ users, total });
        },
      );

      adminRoutes.patch<{ Params: AdminUserParams; Body: UpdateUserStatusBody }>(
        '/users/:id/status',
        {
          preHandler: requireAdmin,
          schema: {
            params: adminUserParamsSchema,
            body: updateUserStatusBodySchema,
            response: { 200: adminUserResponseSchema },
          },
        },
        async (request, reply) => {
          const user = await adminService.setUserStatus(
            request.sessionUser!.sub,
            request.ip,
            request.params.id,
            request.body.status,
          );
          // Status overrides (suspension/deactivation) kick the user out everywhere.
          if (sessionEpoch) await sessionEpoch.bump(request.params.id);
          return reply.send({ user });
        },
      );

      adminRoutes.patch<{ Params: AdminUserParams }>(
        '/users/:id/anonymize',
        {
          preHandler: requireAdmin,
          schema: {
            params: adminUserParamsSchema,
            response: { 200: anonymizeResponseSchema },
          },
        },
        async (request, reply) => {
          const result = await adminService.anonymizeUser(
            request.sessionUser!.sub,
            request.ip,
            request.params.id,
          );
          if (sessionEpoch) await sessionEpoch.bump(request.params.id);
          return reply.send(result);
        },
      );

      adminRoutes.patch<{ Params: AdminUserParams; Body: ModerationBody }>(
        '/users/:id/moderation',
        {
          preHandler: requireAdmin,
          schema: {
            params: adminUserParamsSchema,
            body: moderationBodySchema,
            response: { 200: adminUserResponseSchema },
          },
        },
        async (request, reply) => {
          const user = await adminService.moderateProfile(
            request.sessionUser!.sub,
            request.ip,
            request.params.id,
            request.body.action,
          );
          return reply.send({ user });
        },
      );

      // -- Approval queue -----------------------------------------------------
      adminRoutes.get<{ Querystring: ApprovalsQuery }>(
        '/approvals',
        {
          preHandler: requireAdmin,
          schema: {
            querystring: approvalsQuerySchema,
            response: { 200: approvalsResponseSchema },
          },
        },
        async (request, reply) => {
          const approvals = await adminService.listApprovals(request.query.status);
          return reply.send({ approvals });
        },
      );

      adminRoutes.post<{ Params: ApprovalParams; Body: DecisionBody }>(
        '/approvals/:id/decide',
        {
          preHandler: requireAdmin,
          schema: {
            params: approvalParamsSchema,
            body: decisionBodySchema,
            response: { 200: decisionResponseSchema },
          },
        },
        async (request, reply) => {
          const result = await adminService.decideApproval(
            request.sessionUser!.sub,
            request.ip,
            request.params.id,
            request.body.decision,
            request.body.reason,
          );
          return reply.send({ request: result });
        },
      );

      // -- Audit log viewer ---------------------------------------------------
      adminRoutes.get<{ Querystring: AuditLogsQuery }>(
        '/audit-logs',
        {
          preHandler: requireAdmin,
          schema: {
            querystring: auditLogsQuerySchema,
            response: { 200: auditLogsResponseSchema },
          },
        },
        async (request, reply) => {
          const raw = request.query as unknown as Record<string, string | undefined>;
          const { auditLogs, total } = await adminService.listAuditLogs({
            action: raw.action || undefined,
            actorId: raw.actorId || undefined,
            targetEntity: raw.targetEntity || undefined,
            from: raw.from ? new Date(raw.from) : undefined,
            to: raw.to ? new Date(raw.to) : undefined,
            limit: Number(raw.limit ?? 50),
            offset: Number(raw.offset ?? 0),
          });
          return reply.send({ auditLogs, total });
        },
      );
    },
    { prefix: '/api/admin' },
  );
}