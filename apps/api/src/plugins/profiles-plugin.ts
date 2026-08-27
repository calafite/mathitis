import type { Readable } from 'node:stream';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import multipart from '@fastify/multipart';
import type { PrismaClient } from '@prisma/client';
import type {
  CreateRichCardBody,
  ProfileHandleParams,
  ReorderRichCardsBody,
  RichCardParams,
  UpdateProfileBody,
  UpdateRichCardBody,
} from '@mathitis/schemas';
import {
  createRichCardBodySchema,
  profileHandleParamsSchema,
  profileResponseSchema,
  reorderRichCardsBodySchema,
  richCardParamsSchema,
  richCardResponseSchema,
  richCardsResponseSchema,
  updateProfileBodySchema,
  updateRichCardBodySchema,
  uploadImageResponseSchema,
  scrapedCardResponseSchema,
  scrapeCardQuerySchema,
  type ScrapeCardQuery,
} from '@mathitis/schemas';
import type {
  ProfileRepository,
  ProfileWithRelations,
} from '../repositories/profile-repository.js';
import { createProfileRepository } from '../repositories/profile-repository.js';
import type { RichCardRepository } from '../repositories/rich-card-repository.js';
import { createRichCardRepository } from '../repositories/rich-card-repository.js';
import type { ObjectStorage } from '../storage/storage-service.js';
import type { SessionManager } from './session.js';
import { getSessionCookie } from './session.js';
import { createRequireAuth } from './auth-guard.js';
import type { Redis } from 'ioredis';
import { createRichCardScraper } from '../services/rich-card-scraper.js';
import { createProfileService, type ProfileService } from '../services/profile-service.js';
import { createRichCardService, type RichCardService } from '../services/rich-card-service.js';
import { ValidationError } from '../errors.js';

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const BANNER_MAX_BYTES = 5 * 1024 * 1024;

function toProfileResponse(profile: ProfileWithRelations) {
  return {
    userId: profile.userId,
    handle: profile.user.handle,
    role: profile.user.role,
    semester: profile.user.semester,
    socialName: profile.socialName,
    pronouns: profile.pronouns,
    tagline: profile.tagline,
    biographyMarkdown: profile.biographyMarkdown,
    avatarUrl: profile.avatarUrl,
    bannerUrl: profile.bannerUrl,
    bannerPreset: profile.bannerPreset,
    themePalette: profile.themePalette,
    socialLinks: profile.socialLinks,
    contactEmail: profile.contactEmail,
    maxMentees: profile.maxMentees,
    isDiscoverable: profile.isDiscoverable,
    isAcceptingRequests: profile.isAcceptingRequests,
    profileViews: profile.profileViews,
    effortScore: profile.effortScore,
    tags: profile.tags.map((profileTag) => ({
      id: profileTag.tag.id,
      name: profileTag.tag.name,
      category: profileTag.tag.category,
      color: profileTag.tag.color,
      icon: profileTag.tag.icon,
    })),
    richCards: profile.richCards,
  };
}

async function readFileBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export interface ProfilesPluginOptions {
  prisma: PrismaClient;
  session: SessionManager;
  storage: ObjectStorage;
  uploadDir: string;
  publicBaseUrl: string;
  /** Injectable fetch for tests (scraper never touches the real network in CI). */
  scrapeFetch?: typeof fetch;
  /** Enables Redis-buffered profile view counting when provided. */
  redis?: Redis;
}

function createProfileKeyGenerator(session: SessionManager) {
  return async (request: FastifyRequest): Promise<string> => {
    const sid = (request as unknown as { sessionUser?: { sub: string } }).sessionUser?.sub;
    if (sid) return `user:${sid}`;
    try {
      const payload = await session.verifySessionCookie(
        (request.cookies as Record<string, string | undefined>)?.mathitis_session,
      );
      if (payload?.sub) return `user:${payload.sub}`;
    } catch {
      // fall through to IP
    }
    return `ip:${request.ip}`;
  };
}

export async function registerProfilesPlugin(app: FastifyInstance, options: ProfilesPluginOptions) {
  const profileRepository: ProfileRepository = createProfileRepository(options.prisma);
  const richCardRepository: RichCardRepository = createRichCardRepository(options.prisma);

  const profileService: ProfileService = createProfileService({
    profileRepository,
    richCardRepository,
    storage: options.storage,
    redis: options.redis,
  });
  const richCardService: RichCardService = createRichCardService(
    richCardRepository,
    profileRepository,
  );

  const requireAuth = createRequireAuth(options.session);
  const profileKeyGenerator = createProfileKeyGenerator(options.session);

  async function resolveSession(request: FastifyRequest) {
    const payload = await options.session.verifySessionCookie(getSessionCookie(request));
    if (payload) {
      request.sessionUser = payload;
    }
  }

  await app.register(multipart, {
    limits: {
      fileSize: BANNER_MAX_BYTES,
      files: 1,
      fields: 0,
    },
    throwFileSizeLimit: true,
  });

  async function handleImageUpload(
    request: FastifyRequest,
    reply: FastifyReply,
    kind: 'avatar' | 'banner',
  ) {
    const data = await request.file();
    if (!data) {
      throw new ValidationError('Nenhum arquivo enviado');
    }
    const buffer = await readFileBuffer(data.file);
    const maxBytes = kind === 'avatar' ? AVATAR_MAX_BYTES : BANNER_MAX_BYTES;
    if (buffer.length > maxBytes) {
      const limitMb = Math.round(maxBytes / 1024 / 1024);
      throw new ValidationError(
        `${kind === 'avatar' ? 'Avatar' : 'Banner'} exceeds the ${limitMb}MB upload limit`,
      );
    }
    const result = await profileService.uploadImage(request.sessionUser!.sub, kind, buffer);
    return reply.send(result);
  }

  app.register(
    async (profilesRoutes) => {
      profilesRoutes.get<{ Params: ProfileHandleParams }>(
        '/:handle',
        {
          preHandler: resolveSession,
          schema: {
            params: profileHandleParamsSchema,
            response: { 200: profileResponseSchema },
          },
          config: {
            rateLimit: {
              max: 60,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        async (request, reply) => {
          const handle = request.params.handle;

          let profile = await profileService.getProfileByHandle(handle, request.sessionUser);

          // Self-view prevention: don't track views when the profile owner views their own profile
          const isSelfView = request.sessionUser?.sub === profile.userId;
          if (!isSelfView) {
            const viewerIdentifier = request.sessionUser?.sub ?? request.ip;
            await profileService.recordUniqueView(profile.userId, viewerIdentifier);
            profile = await profileService.getProfileByHandle(handle, request.sessionUser);
          }

          return reply.send({ profile: toProfileResponse(profile) });
        },
      );

      profilesRoutes.get(
        '/me',
        {
          preHandler: requireAuth,
          schema: { response: { 200: profileResponseSchema } },
          config: {
            rateLimit: {
              max: 60,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        async (request, reply) => {
          const profile = await profileService.getOwnProfile(request.sessionUser!.sub);
          return reply.send({ profile: toProfileResponse(profile) });
        },
      );

      profilesRoutes.patch<{ Body: UpdateProfileBody }>(
        '/me',
        {
          preHandler: requireAuth,
          schema: {
            body: updateProfileBodySchema,
            response: { 200: profileResponseSchema },
          },
          config: {
            rateLimit: {
              max: 30,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        async (request, reply) => {
          const profile = await profileService.updateProfile(
            request.sessionUser!.sub,
            request.body,
          );
          return reply.send({ profile: toProfileResponse(profile) });
        },
      );

      profilesRoutes.post(
        '/me/avatar',
        {
          preHandler: requireAuth,
          schema: { response: { 200: uploadImageResponseSchema } },
          config: {
            rateLimit: {
              max: 20,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        (request, reply) => handleImageUpload(request, reply, 'avatar'),
      );

      profilesRoutes.post(
        '/me/banner',
        {
          preHandler: requireAuth,
          schema: { response: { 200: uploadImageResponseSchema } },
          config: {
            rateLimit: {
              max: 20,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        (request, reply) => handleImageUpload(request, reply, 'banner'),
      );

      const cardScraper = createRichCardScraper({ fetchImpl: options.scrapeFetch });

      profilesRoutes.get<{ Querystring: ScrapeCardQuery }>(
        '/me/cards/scrape',
        {
          preHandler: requireAuth,
          config: {
            rateLimit: {
              max: 15,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
          schema: {
            querystring: scrapeCardQuerySchema,
            response: { 200: scrapedCardResponseSchema },
          },
        },
        async (request, reply) => {
          const card = await cardScraper.scrape(request.query.url);
          return reply.send(card);
        },
      );

      profilesRoutes.get(
        '/me/cards',
        {
          preHandler: requireAuth,
          schema: { response: { 200: richCardsResponseSchema } },
          config: {
            rateLimit: {
              max: 60,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        async (request, reply) => {
          const cards = await richCardService.listCards(request.sessionUser!.sub);
          return reply.send({ cards });
        },
      );

      profilesRoutes.post<{ Body: CreateRichCardBody }>(
        '/me/cards',
        {
          preHandler: requireAuth,
          schema: {
            body: createRichCardBodySchema,
            response: { 200: richCardResponseSchema },
          },
          config: {
            rateLimit: {
              max: 30,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        async (request, reply) => {
          const card = await richCardService.createCard(request.sessionUser!.sub, request.body);
          return reply.send({ card });
        },
      );

      profilesRoutes.patch<{ Params: RichCardParams; Body: UpdateRichCardBody }>(
        '/me/cards/:id',
        {
          preHandler: requireAuth,
          schema: {
            params: richCardParamsSchema,
            body: updateRichCardBodySchema,
            response: { 200: richCardResponseSchema },
          },
          config: {
            rateLimit: {
              max: 30,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        async (request, reply) => {
          const card = await richCardService.updateCard(
            request.sessionUser!.sub,
            request.params.id,
            request.body,
          );
          return reply.send({ card });
        },
      );

      profilesRoutes.delete<{ Params: RichCardParams }>(
        '/me/cards/:id',
        {
          preHandler: requireAuth,
          schema: { params: richCardParamsSchema },
          config: {
            rateLimit: {
              max: 30,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        async (request, reply) => {
          await richCardService.deleteCard(request.sessionUser!.sub, request.params.id);
          return reply.code(204).send();
        },
      );

      profilesRoutes.put<{ Body: ReorderRichCardsBody }>(
        '/me/cards/reorder',
        {
          preHandler: requireAuth,
          schema: {
            body: reorderRichCardsBodySchema,
            response: { 200: richCardsResponseSchema },
          },
          config: {
            rateLimit: {
              max: 30,
              timeWindow: '1 minute',
              keyGenerator: profileKeyGenerator,
            },
          },
        },
        async (request, reply) => {
          const cards = await richCardService.reorderCards(
            request.sessionUser!.sub,
            request.body.order,
          );
          return reply.send({ cards });
        },
      );
    },
    { prefix: '/api/profiles' },
  );
}
