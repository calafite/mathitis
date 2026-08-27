import type { FastifyInstance, FastifyRequest } from 'fastify';
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
import type { SessionEpochStore } from '../lib/session-epoch.js';
import { createAuditLogRepository } from '../repositories/audit-log-repository.js';
import type { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type { SessionManager } from './session.js';

interface AccountPluginOptions {
  prisma: PrismaClient;
  session: SessionManager;
  sessionEpoch?: SessionEpochStore;
}

export async function registerAccountPlugin(app: FastifyInstance, options: AccountPluginOptions) {
  const { prisma, session, sessionEpoch } = options;
  const requireAuth = createRequireAuth(session);
  const auditLogRepository = createAuditLogRepository(prisma);

  function accountKeyGenerator(request: FastifyRequest): string {
    const sub = (request as unknown as { sessionUser?: { sub: string } }).sessionUser?.sub;
    return sub ? `user:${sub}` : `ip:${request.ip}`;
  }

  app.addHook('preHandler', requireAuth);

  app.post<{ Body: ChangePasswordBody }>(
    '/api/account/change-password',
    {
      config: {
        rateLimit: {
          max: app.env.RATE_LIMIT_AUTH_MAX,
          timeWindow: '1 minute',
          keyGenerator: accountKeyGenerator,
        },
      },
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
        return reply.code(404).send({ ok: false, error: 'Usuário não encontrado' });
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
        return reply.code(400).send({ ok: false, error: 'A senha atual está incorreta' });
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

      // Invalidate all existing sessions (every other device) ...
      if (sessionEpoch) await sessionEpoch.bump(userId);

      await auditLogRepository.create({
        actorId: userId,
        action: 'account.password.update',
        targetEntity: 'user',
        targetId: userId,
      });

      // ... then keep THIS device logged in with a fresh epoch-valid cookie.
      const token = await session.createSessionCookie({
        sub: user.id,
        role: user.role,
        handle: user.handle,
      });
      reply.setCookie('mathitis_session', token, {
        path: '/',
        httpOnly: true,
        sameSite: 'strict',
        secure: app.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60,
      });

      return reply.send({ ok: true });
    },
  );

  app.get(
    '/api/account/settings',
    {
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: accountKeyGenerator,
        },
      },
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
        return reply.code(404).send({ ok: false, error: 'Usuário não encontrado' });
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
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
          keyGenerator: accountKeyGenerator,
        },
      },
      schema: {
        body: updateAccountBodySchema,
        response: { 200: z.object({ ok: z.boolean() }) },
      },
    },
    async (request, reply) => {
      const { semester, preferences } = request.body;
      const userId = request.sessionUser!.sub;

      const data: Record<string, unknown> = {};
      if (semester !== undefined) {
        data.semester = semester;
        data.role = semester >= 2 ? 'senior' : 'freshman';
      }
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
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: accountKeyGenerator,
        },
      },
      schema: {
        response: { 200: userDataExportSchema, 404: z.object({ ok: z.boolean(), error: z.string() }) },
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.sub;

      const [user, profile, tags, richCards, sentRequests, receivedRequests] = await Promise.all([
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
      ]);

      if (!user || !profile) {
        return reply.code(404).send({ ok: false, error: 'Usuário não encontrado' });
      }

      const ancestors: Array<{ handle: string; socialName: string | null; semester: number; relationship: 'mentor' | 'grand-mentor' | 'great-grand-mentor' }> = [];
      const descendants: Array<{ handle: string; socialName: string | null; semester: number; relationship: 'pupil' | 'grand-pupil' | 'great-grand-pupil' }> = [];

      // Build complete lineage (up to 3 levels) using recursive CTE-style queries
      async function getMentors(freshmanId: string) {
        return prisma.mentorship.findMany({
          where: { freshmanId },
          include: { senior: { include: { profile: true } } },
        });
      }

      async function getPupils(seniorId: string) {
        return prisma.mentorship.findMany({
          where: { seniorId },
          include: { freshman: { include: { profile: true } } },
        });
      }

      // Level 1: Direct mentor/pupil
      const directMentors = await getMentors(userId);
      for (const m of directMentors) {
        ancestors.push({
          handle: m.senior.handle,
          socialName: m.senior.profile?.socialName ?? null,
          semester: m.senior.semester,
          relationship: 'mentor',
        });
      }

      const directPupils = await getPupils(userId);
      for (const m of directPupils) {
        descendants.push({
          handle: m.freshman.handle,
          socialName: m.freshman.profile?.socialName ?? null,
          semester: m.freshman.semester,
          relationship: 'pupil',
        });
      }

      // Level 2: Grand-mentor / Grand-pupil
      for (const m of directMentors) {
        const grandMentors = await getMentors(m.seniorId);
        for (const gm of grandMentors) {
          ancestors.push({
            handle: gm.senior.handle,
            socialName: gm.senior.profile?.socialName ?? null,
            semester: gm.senior.semester,
            relationship: 'grand-mentor',
          });
        }
      }

      for (const m of directPupils) {
        const grandPupils = await getPupils(m.freshmanId);
        for (const gp of grandPupils) {
          descendants.push({
            handle: gp.freshman.handle,
            socialName: gp.freshman.profile?.socialName ?? null,
            semester: gp.freshman.semester,
            relationship: 'grand-pupil',
          });
        }
      }

      // Level 3: Great-grand-mentor / Great-grand-pupil
      for (const m of directMentors) {
        const grandMentors = await getMentors(m.seniorId);
        for (const gm of grandMentors) {
          const greatGrandMentors = await getMentors(gm.seniorId);
          for (const ggm of greatGrandMentors) {
            ancestors.push({
              handle: ggm.senior.handle,
              socialName: ggm.senior.profile?.socialName ?? null,
              semester: ggm.senior.semester,
              relationship: 'great-grand-mentor',
            });
          }
        }
      }

      for (const m of directPupils) {
        const grandPupils = await getPupils(m.freshmanId);
        for (const gp of grandPupils) {
          const greatGrandPupils = await getPupils(gp.freshmanId);
          for (const ggp of greatGrandPupils) {
            descendants.push({
              handle: ggp.freshman.handle,
              socialName: ggp.freshman.profile?.socialName ?? null,
              semester: ggp.freshman.semester,
              relationship: 'great-grand-pupil',
            });
          }
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
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: accountKeyGenerator,
        },
      },
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
        return reply.code(404).send({ ok: false, error: 'Usuário não encontrado' });
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
        return reply.code(400).send({ ok: false, error: 'A senha está incorreta' });
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