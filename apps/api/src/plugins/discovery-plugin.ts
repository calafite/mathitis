import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PrismaClient } from '@prisma/client';
import type {
  BumpBody,
  BumpParams,
  CreateMentorshipRequestBody,
  LineageResponse,
  MentorshipRequest,
  RejectRequestBody,
  RequestParams,
  RequestsQuery,
  SeniorSummary,
  SeniorsQuery,
} from '@mathitis/schemas';
import {
  bumpBodySchema,
  bumpParamsSchema,
  bumpResponseSchema,
  createMentorshipRequestBodySchema,
  lineageResponseSchema,
  rejectRequestBodySchema,
  requestParamsSchema,
  requestResponseSchema,
  requestsQuerySchema,
  requestsResponseSchema,
  seniorsQuerySchema,
  seniorsResponseSchema,
  recommendationsResponseSchema,
  tagsResponseSchema,
  profileHandleParamsSchema,
} from '@mathitis/schemas';
import type { SessionManager } from './session.js';
import { createRequireAuth, createRequireRole } from './auth-guard.js';
import { createUserRepository } from '../repositories/user-repository.js';
import { createProfileRepository } from '../repositories/profile-repository.js';
import { createDiscoveryRepository } from '../repositories/discovery-repository.js';
import { createBumpRepository } from '../repositories/bump-repository.js';
import { createRequestRepository } from '../repositories/request-repository.js';
import { createMentorshipRepository } from '../repositories/mentorship-repository.js';
import { createSystemConfigRepository } from '../repositories/system-config-repository.js';
import { createDiscoveryService } from '../services/discovery-service.js';
import { createBumpService } from '../services/bump-service.js';
import { createRequestService } from '../services/request-service.js';
import { createNotificationRepository } from '../repositories/notification-repository.js';
import { createNotificationService } from '../services/notification-service.js';
import type { LoggerLike } from '../lib/logger.js';
import type { Queue } from 'bullmq';
import { createLineageService } from '../services/lineage-service.js';
import type { IdempotencyStore } from '../lib/idempotency.js';
import type { RequestRow } from '../repositories/request-repository.js';
import { ValidationError } from '../errors.js';

function requireIdempotencyKey(request: FastifyRequest): string {
  const key = request.headers['x-idempotency-key'];
  if (!key || typeof key !== 'string' || key.length < 8 || key.length > 128) {
    throw new ValidationError(
      'X-Idempotency-Key header is required (8-128 characters)',
    );
  }
  return key;
}

function coerceSeniorsQuery(query: SeniorsQuery): SeniorsQuery {
  const tagIds = query.tagIds as unknown as string | string[] | undefined;
  const cardTypes = query.cardTypes as unknown as string | string[] | undefined;
  return {
    ...query,
    semester: query.semester === undefined ? undefined : Number(query.semester),
    tagIds: (Array.isArray(tagIds) ? tagIds : tagIds ? [tagIds] : undefined) as
      | string[]
      | undefined,
    cardTypes: (Array.isArray(cardTypes) ? cardTypes : cardTypes ? [cardTypes] : undefined) as
      SeniorsQuery['cardTypes'],
    limit: Number(query.limit ?? 20),
    offset: Number(query.offset ?? 0),
  };
}

export interface DiscoveryPluginOptions {
  prisma: PrismaClient;
  session: SessionManager;
  idempotencyStore: IdempotencyStore;
  emailQueue: Queue;
  logger: LoggerLike;
}

export async function registerDiscoveryPlugin(app: FastifyInstance, options: DiscoveryPluginOptions) {
  const prisma = options.prisma;

  const userRepository = createUserRepository(prisma);
  const profileRepository = createProfileRepository(prisma);
  const discoveryRepository = createDiscoveryRepository(prisma);
  const bumpRepository = createBumpRepository(prisma);
  const requestRepository = createRequestRepository(prisma);
  const mentorshipRepository = createMentorshipRepository(prisma);
  const systemConfigRepository = createSystemConfigRepository(prisma);

  const notificationService = createNotificationService({
    notificationRepository: createNotificationRepository(prisma),
    systemConfigRepository,
    emailQueue: options.emailQueue,
    logger: options.logger,
  });

  const discoveryService = createDiscoveryService(
    discoveryRepository,
    profileRepository,
    bumpRepository,
    mentorshipRepository,
    systemConfigRepository,
  );
  const bumpService = createBumpService(bumpRepository, userRepository);
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
  const lineageService = createLineageService(mentorshipRepository);

  const requireAuth = createRequireAuth(options.session);
  const requireFreshman = createRequireRole(options.session, ['freshman']);
  const requireSenior = createRequireRole(options.session, ['senior']);
  const requireStaff = createRequireRole(options.session, ['administrator', 'developer']);

  const mapSenior = (senior: SeniorSummary) => senior;

  app.register(
    async (discoveryRoutes) => {
      // -- Discovery catalog -------------------------------------------------
      discoveryRoutes.get<{ Querystring: SeniorsQuery }>(
        '/seniors',
        {
          preHandler: requireAuth,
          schema: {
            querystring: seniorsQuerySchema,
            response: { 200: seniorsResponseSchema },
          },
        },
        async (request, reply) => {
          const { seniors, total } = await discoveryService.listSeniors(
            coerceSeniorsQuery(request.query),
          );
          return reply.send({ seniors: seniors.map(mapSenior), total });
        },
      );

      discoveryRoutes.get<{ Querystring: SeniorsQuery }>(
        '/recommendations',
        {
          preHandler: requireAuth,
          schema: {
            querystring: seniorsQuerySchema,
            response: { 200: recommendationsResponseSchema },
          },
        },
        async (request, reply) => {
          const { limit, ...filters } = coerceSeniorsQuery(request.query);
          const recommendations = await discoveryService.recommend(request.sessionUser!.sub, {
            ...filters,
            limit,
          });
          return reply.send({ recommendations });
        },
      );

      discoveryRoutes.get(
        '/tags',
        {
          schema: { response: { 200: tagsResponseSchema } },
        },
        async (_request, reply) => {
          const tags = await discoveryService.listTags();
          return reply.send({ tags });
        },
      );

      // -- Bumps -------------------------------------------------------------
      discoveryRoutes.post<{ Params: BumpParams; Body: BumpBody }>(
        '/profiles/:handle/bump',
        {
          preHandler: requireFreshman,
          schema: {
            params: bumpParamsSchema,
            body: bumpBodySchema,
            response: { 200: bumpResponseSchema },
          },
          config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
        },
        async (request, reply) => {
          const result = await bumpService.bump(
            request.sessionUser!.sub,
            request.params.handle,
            request.body?.replaceHandle,
          );
          return reply.send(result);
        },
      );

      discoveryRoutes.delete<{ Params: BumpParams }>(
        '/profiles/:handle/bump',
        {
          preHandler: requireFreshman,
          schema: {
            params: bumpParamsSchema,
            response: { 200: bumpResponseSchema },
          },
        },
        async (request, reply) => {
          const result = await bumpService.unbump(
            request.sessionUser!.sub,
            request.params.handle,
          );
          return reply.send(result);
        },
      );

      // -- Requests ----------------------------------------------------------
      discoveryRoutes.post<{ Body: CreateMentorshipRequestBody }>(
        '/requests',
        {
          preHandler: requireFreshman,
          schema: {
            body: createMentorshipRequestBodySchema,
            response: { 200: requestResponseSchema },
          },
        },
        async (request, reply) => {
          const key = requireIdempotencyKey(request);
          const result = await requestService.submit(
            request.sessionUser!.sub,
            request.body,
            key,
          );
          return reply.send({ request: toRequestSchema(result) });
        },
      );

      discoveryRoutes.get<{ Querystring: RequestsQuery }>(
        '/requests',
        {
          preHandler: requireAuth,
          schema: {
            querystring: requestsQuerySchema,
            response: { 200: requestsResponseSchema },
          },
        },
        async (request, reply) => {
          const viewer = request.sessionUser!;
          const inbox = request.query.inbox ?? (viewer.role === 'freshman' ? 'sent' : 'incoming');
          const rows =
            inbox === 'sent'
              ? await requestService.listSent(viewer.sub, request.query.status)
              : await requestService.listIncoming(viewer.sub, request.query.status);
          return reply.send({ requests: rows.map(toRequestSchema) });
        },
      );

      discoveryRoutes.get<{ Params: RequestParams }>(
        '/requests/:id',
        {
          preHandler: requireAuth,
          schema: {
            params: requestParamsSchema,
            response: { 200: requestResponseSchema },
          },
        },
        async (request, reply) => {
          const viewer = request.sessionUser!;
          const row = await requestService.getForInspection(
            request.params.id,
            viewer.sub,
            viewer.role,
          );
          return reply.send({ request: toRequestSchema(row) });
        },
      );

      discoveryRoutes.post<{ Params: RequestParams }>(
        '/requests/:id/accept',
        {
          preHandler: requireSenior,
          schema: {
            params: requestParamsSchema,
            response: { 200: requestResponseSchema },
          },
        },
        async (request, reply) => {
          const key = requireIdempotencyKey(request);
          const result = await requestService.accept(
            request.sessionUser!.sub,
            request.params.id,
            key,
          );
          return reply.send({ request: toRequestSchema(result) });
        },
      );

      discoveryRoutes.post<{ Params: RequestParams; Body: RejectRequestBody }>(
        '/requests/:id/reject',
        {
          preHandler: requireSenior,
          schema: {
            params: requestParamsSchema,
            body: rejectRequestBodySchema,
            response: { 200: requestResponseSchema },
          },
        },
        async (request, reply) => {
          const result = await requestService.reject(
            request.sessionUser!.sub,
            request.params.id,
            request.body?.reason,
          );
          return reply.send({ request: toRequestSchema(result) });
        },
      );

      discoveryRoutes.post<{ Params: RequestParams }>(
        '/requests/:id/cancel',
        {
          preHandler: requireFreshman,
          schema: {
            params: requestParamsSchema,
            response: { 200: requestResponseSchema },
          },
        },
        async (request, reply) => {
          const result = await requestService.cancel(
            request.sessionUser!.sub,
            request.params.id,
          );
          return reply.send({ request: toRequestSchema(result) });
        },
      );

      discoveryRoutes.post<{ Params: RequestParams }>(
        '/requests/:id/approve',
        {
          preHandler: requireStaff,
          schema: {
            params: requestParamsSchema,
            response: { 200: requestResponseSchema },
          },
        },
        async (request, reply) => {
          const result = await requestService.approveAdmin(
            request.sessionUser!.sub,
            request.params.id,
          );
          return reply.send({ request: toRequestSchema(result) });
        },
      );

      discoveryRoutes.post<{ Params: RequestParams; Body: RejectRequestBody }>(
        '/requests/:id/deny',
        {
          preHandler: requireStaff,
          schema: {
            params: requestParamsSchema,
            body: rejectRequestBodySchema,
            response: { 200: requestResponseSchema },
          },
        },
        async (request, reply) => {
          const result = await requestService.denyAdmin(
            request.sessionUser!.sub,
            request.params.id,
            request.body?.reason,
          );
          return reply.send({ request: toRequestSchema(result) });
        },
      );

      // -- Lineage -----------------------------------------------------------
      discoveryRoutes.get<{ Reply: LineageResponse }>(
        '/lineage',
        {
          schema: { response: { 200: lineageResponseSchema } },
        },
        async (_request, reply) => {
          const graph = await lineageService.getFullGraph();
          return reply.send(graph);
        },
      );

      discoveryRoutes.get<{ Params: { handle: string } }>(
        '/lineage/:handle',
        {
          schema: {
            params: profileHandleParamsSchema,
            response: { 200: lineageResponseSchema },
          },
        },
        async (request, reply) => {
          const graph = await lineageService.getSubgraph(request.params.handle);
          return reply.send(graph);
        },
      );
    },
    { prefix: '/api' },
  );
}

function toRequestSchema(row: RequestRow & { freshmanProfile?: MentorshipRequest['freshmanProfile'] }): MentorshipRequest {
  const party = (partyRow: RequestRow['freshman'] | RequestRow['senior']) =>
    partyRow.profile
      ? {
          userId: partyRow.profile.userId,
          handle: partyRow.handle,
          socialName: partyRow.profile.socialName,
          tagline: partyRow.profile.tagline,
          semester: partyRow.semester,
          avatarThumbnailUrl: partyRow.profile.avatarThumbnailUrl,
        }
      : undefined;

  return {
    id: row.id,
    freshmanId: row.freshmanId,
    seniorId: row.seniorId,
    status: row.status,
    message: row.message,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    freshman: party(row.freshman),
    senior: party(row.senior),
    ...(row.freshmanProfile ? { freshmanProfile: row.freshmanProfile } : {}),
  };
}