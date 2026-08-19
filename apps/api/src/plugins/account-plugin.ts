import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import {
  changePasswordBodySchema,
  updateAccountBodySchema,
  anonymizeAccountBodySchema,
  userDataExportSchema,
  type ChangePasswordBody,
  type UpdateAccountBody,
  type AnonymizeAccountBody,
} from '@mathitis/schemas';
import { createRequireAuth } from './auth-guard.js';
import { createAuditLogRepository } from '../repositories/audit-log-repository.js';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { SessionManager } from './session.js';

interface AccountPluginOptions {
  prisma: PrismaClient;
  session: SessionManager;
}

const RATE_LIMIT_AUTH_MAX = 10;

export async function registerAccountPlugin(app: FastifyInstance, options: AccountPluginOptions) {
  const { prisma, session } = options;
  const requireAuth = createRequireAuth(session);
  const auditLogRepository = createAuditLogRepository(prisma);

  app.addHook('preHandler', requireAuth);

  app.post<{ Body: ChangePasswordBody }>(
    '/api/account/change-password',
    {
      config: { rateLimit: { max: RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' } },
      schema: {
        body: changePasswordBodySchema,
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const { currentPassword, newPassword } = request.body;
      const userId = request.sessionUser!.sub;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.deletedAt !== null) {
        return reply.code(404).send({ ok: false, error: 'User not found' });
      }

      const valid = await argon2.verify(user.passwordHash, currentPassword);
      if (!valid) {
        await auditLogRepository.create({
          actorId: userId,
          action: 'account.password.update',
          targetEntity: 'user',
          targetId: userId,
          details: { reason: 'invalid_current_password' },
        });
        return reply.code(400).send({ ok: false, error: 'Current password is incorrect' });
      }

      const passwordHash = await argon2.hash(newPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      await auditLogRepository.create({
        actorId: userId,
        action: 'account.password.update',
        targetEntity: 'user',
        targetId: userId,
      });

      return reply.send({ ok: true });
    },
  );

  app.get(
    '/api/account/settings',
    {
      schema: {
        response: {
          200: z.object({
            email: z.string(),
            semester: z.number().int(),
            preferences: z
              .object({
                theme: z.enum(['dark', 'light', 'system']).optional(),
                reducedMotion: z.boolean().optional(),
                soundEnabled: z.boolean().optional(),
                emailNotifications: z.boolean().optional(),
              })
              .nullable(),
          }),
          404: z.object({ ok: z.boolean(), error: z.string() }),
        },
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.sub;
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.deletedAt !== null) {
        return reply.code(404).send({ ok: false, error: 'User not found' });
      }
      return reply.send({
        email: user.email,
        semester: user.semester,
        preferences: (user.preferences as Record<string, unknown> | null) ?? null,
      });
    },
  );

  app.patch<{ Body: UpdateAccountBody }>(
    '/api/account',
    {
      schema: {
        body: updateAccountBodySchema,
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const { semester, preferences } = request.body;
      const userId = request.sessionUser!.sub;

      const data: Record<string, unknown> = {};
      if (semester !== undefined) data.semester = semester;
      if (preferences !== undefined) {
        const existing = (await prisma.user.findUnique({ where: { id: userId }, select: { preferences: true } }))?.preferences as Record<string, unknown> | null;
        data.preferences = { ...(existing ?? {}), ...preferences };
      }

      if (Object.keys(data).length === 0) {
        return reply.send({ ok: true });
      }

      await prisma.user.update({ where: { id: userId }, data });

      return reply.send({ ok: true });
    },
  );

  app.get(
    '/api/account/export',
    {
      schema: {
        response: { 200: userDataExportSchema, 404: z.object({ ok: z.boolean(), error: z.string() }) },
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.sub;

      const [user, profile, tags, richCards, sentRequests, receivedRequests, mentorships] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId } }),
        prisma.profile.findUnique({ where: { userId } }),
        prisma.tag.findMany({ where: { profiles: { some: { profile: { userId } } } } }),
        prisma.richCard.findMany({ where: { profile: { userId } }, orderBy: { displayOrder: 'asc' } }),
        prisma.mentorshipRequest.findMany({
          where: { freshmanId: userId },
          include: { senior: { include: { profile: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.mentorshipRequest.findMany({
          where: { seniorId: userId },
          include: { freshman: { include: { profile: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.mentorship.findMany({
          where: { OR: [{ freshmanId: userId }, { seniorId: userId }] },
          include: {
            freshman: { include: { profile: true } },
            senior: { include: { profile: true } },
          },
        }),
      ]);

      if (!user || !profile) {
        return reply.code(404).send({ ok: false, error: 'User not found' });
      }

      const ancestors: Array<{ handle: string; socialName: string | null; semester: number; relationship: 'mentor' | 'grand-mentor' | 'great-grand-mentor' }> = [];
      const descendants: Array<{ handle: string; socialName: string | null; semester: number; relationship: 'pupil' | 'grand-pupil' | 'great-grand-pupil' }> = [];

      for (const m of mentorships) {
        const mTyped = m as unknown as { freshmanId: string; senior: { handle: string; socialName: string | null; semester: number; profile: { socialName: string | null } | null }; freshman: { handle: string; socialName: string | null; semester: number; profile: { socialName: string | null } | null } };
        if (mTyped.freshmanId === userId) {
          ancestors.push({
            handle: mTyped.senior.handle,
            socialName: mTyped.senior.profile?.socialName ?? null,
            semester: mTyped.senior.semester,
            relationship: 'mentor',
          });
        } else {
          descendants.push({
            handle: mTyped.freshman.handle,
            socialName: mTyped.freshman.profile?.socialName ?? null,
            semester: mTyped.freshman.semester,
            relationship: 'pupil',
          });
        }
      }

      function mapSentRequest(r: unknown) {
        const rr = r as { id: string; senior: { handle: string; profile: { socialName: string | null } | null }; message: string; status: string; createdAt: Date; updatedAt: Date };
        const pending = rr.status === 'pending' || rr.status === 'pending_admin_approval';
        return {
          id: rr.id,
          seniorHandle: rr.senior.handle,
          seniorSocialName: rr.senior.profile?.socialName ?? null,
          message: rr.message,
          status: rr.status,
          createdAt: rr.createdAt.toISOString(),
          decidedAt: pending ? null : rr.updatedAt.toISOString(),
        };
      }

      function mapReceivedRequest(r: unknown) {
        const rr = r as { id: string; freshman: { handle: string; profile: { socialName: string | null } | null }; message: string; status: string; createdAt: Date; updatedAt: Date };
        const pending = rr.status === 'pending' || rr.status === 'pending_admin_approval';
        return {
          id: rr.id,
          freshmanHandle: rr.freshman.handle,
          freshmanSocialName: rr.freshman.profile?.socialName ?? null,
          message: rr.message,
          status: rr.status,
          createdAt: rr.createdAt.toISOString(),
          decidedAt: pending ? null : rr.updatedAt.toISOString(),
        };
      }

      const exportData = {
        user: {
          id: user.id,
          handle: user.handle,
          email: user.email,
          role: user.role,
          semester: user.semester,
          status: user.status,
          socialName: profile.socialName,
          pronouns: profile.pronouns,
          tagline: profile.tagline,
          biographyMarkdown: profile.biographyMarkdown,
          themePalette: profile.themePalette,
          contactEmail: profile.contactEmail,
          socialLinks: profile.socialLinks,
          maxMentees: profile.maxMentees,
          isAcceptingRequests: profile.isAcceptingRequests,
          isDiscoverable: profile.isDiscoverable,
          avatarUrl: profile.avatarUrl,
          bannerUrl: profile.bannerUrl,
          bannerPreset: profile.bannerPreset,
          effortScore: profile.effortScore,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
        tags: tags.map((t) => ({ id: t.id, name: t.name, category: t.category, color: t.color })),
        richCards: richCards.map((c) => ({
          id: c.id,
          type: c.cardType,
          title: c.title,
          payload: c.metadata as Record<string, unknown>,
          displayOrder: c.displayOrder,
          createdAt: c.createdAt.toISOString(),
        })),
        sentRequests: sentRequests.map(mapSentRequest),
        receivedRequests: receivedRequests.map(mapReceivedRequest),
        lineage: { ancestors, descendants },
      };

      reply.header('Content-Disposition', 'attachment; filename="mathitis-data-export.json"');
      reply.header('Content-Type', 'application/json');
      return reply.send(exportData);
    },
  );

  app.post<{ Body: AnonymizeAccountBody }>(
    '/api/account/anonymize',
    {
      config: { rateLimit: { max: RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' } },
      schema: {
        body: anonymizeAccountBodySchema,
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const { password } = request.body;
      const userId = request.sessionUser!.sub;

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.deletedAt !== null) {
        return reply.code(404).send({ ok: false, error: 'User not found' });
      }

      const valid = await argon2.verify(user.passwordHash, password);
      if (!valid) {
        await auditLogRepository.create({
          actorId: userId,
          action: 'account.self_anonymize',
          targetEntity: 'user',
          targetId: userId,
          details: { reason: 'invalid_password' },
        });
        return reply.code(400).send({ ok: false, error: 'Password is incorrect' });
      }

      const anonHandle = `user_${userId.slice(0, 8)}`;

      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: {
            handle: anonHandle,
            email: `${anonHandle}@anonymized.local`,
            status: 'deactivated',
            deletedAt: new Date(),
          },
        });

        await tx.profile.update({
          where: { userId },
          data: {
            socialName: null,
            pronouns: null,
            tagline: null,
            biographyMarkdown: null,
            themePalette: Prisma.DbNull,
            contactEmail: null,
            socialLinks: Prisma.DbNull,
            maxMentees: 3,
            isAcceptingRequests: false,
            isDiscoverable: false,
            avatarUrl: null,
            bannerUrl: null,
            bannerPreset: null,
            effortScore: 0,
          },
        });

        await tx.richCard.deleteMany({ where: { profile: { userId } } });
        await tx.profileTag.deleteMany({ where: { profile: { userId } } });
        await tx.notification.deleteMany({ where: { userId } });
        await tx.userToken.deleteMany({ where: { userId } });
      });

      await auditLogRepository.create({
        actorId: userId,
        action: 'account.self_anonymize',
        targetEntity: 'user',
        targetId: userId,
        details: { originalHandle: user.handle },
      });

      reply.clearCookie('mathitis_session');
      return reply.send({ ok: true });
    },
  );
}