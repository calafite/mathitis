import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  genericSuccessResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  meResponseSchema,
  recoverBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
  verifyEmailParamsSchema,
  type AuthUser,
  type LoginBody,
  type RecoverBody,
  type RegisterBody,
  type ResetPasswordBody,
  type VerifyEmailParams,
} from '@mathitis/schemas';
import { createAuthService, type AuthService, type Mailer } from '../services/auth-service.js';
import type { UserRepository } from '../repositories/user-repository.js';
import type { TokenRepository } from '../repositories/token-repository.js';
import type { SystemConfigRepository } from '../repositories/system-config-repository.js';
import { createSessionManager, type SessionManager } from './session.js';
import { createRequireAuth } from './auth-guard.js';
import { clearCsrfCookie, createCsrfToken, setCsrfCookie } from './csrf.js';
import type { LoginGuard } from '../lib/login-guard.js';
import type { SessionEpochStore } from '../lib/session-epoch.js';

const GENERIC_OK = {
  ok: true,
  message: 'Se existir uma conta com essas informações, você receberá um e-mail em breve.',
};

function toAuthUser(user: {
  id: string;
  handle: string;
  email: string;
  role: AuthUser['role'];
  semester: number;
  status: AuthUser['status'];
  profile?: { socialName: string | null } | null;
}): AuthUser {
  return {
    id: user.id,
    handle: user.handle,
    email: user.email,
    role: user.role,
    semester: user.semester,
    status: user.status,
    socialName: user.profile?.socialName ?? null,
    createdAt: new Date(),
  };
}

export interface AuthPluginOptions {
  jwtSecret: string;
  cookieSecret: string;
  sessionMaxAgeDays: number;
  userRepository: UserRepository;
  tokenRepository: TokenRepository;
  systemConfigRepository: SystemConfigRepository;
  mailer?: Mailer;
  session?: SessionManager;
  loginGuard?: LoginGuard;
  sessionEpoch?: SessionEpochStore;
  onLockout?: (userId: string) => Promise<void>;
}

export async function registerAuthPlugin(app: FastifyInstance, options: AuthPluginOptions) {
  const { userRepository } = options;
  const authService: AuthService = createAuthService({
    userRepository: options.userRepository,
    tokenRepository: options.tokenRepository,
    systemConfigRepository: options.systemConfigRepository,
    mailer: options.mailer,
    loginGuard: options.loginGuard,
    onLockout: options.onLockout,
  });

  const session: SessionManager =
    options.session ??
    createSessionManager(
      { current: options.jwtSecret, legacy: [] },
      options.sessionMaxAgeDays,
    );

  const requireAuth = createRequireAuth(session);

  async function setSessionCookie(
    reply: FastifyReply,
    userId: string,
    role: AuthUser['role'],
    handle: string,
  ) {
    const token = await session.createSessionCookie({ sub: userId, role, handle });
    reply.setCookie('mathitis_session', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: app.env.NODE_ENV === 'production',
      maxAge: options.sessionMaxAgeDays * 24 * 60 * 60,
    });
    setCsrfCookie(reply, createCsrfToken(), app.env.NODE_ENV === 'production');
  }

  app.register(
    async (authRoutes) => {
      authRoutes.post<{ Body: RegisterBody }>(
        '/register',
        {
          schema: {
            body: registerBodySchema,
            response: { 200: genericSuccessResponseSchema },
          },
          config: { rateLimit: { max: app.env.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' } },
        },
        async (request, reply) => {
          const { handle, email, password, semester, socialName } = request.body;
          await authService.register({ handle, email, password, semester, socialName });
          return reply.code(200).send(GENERIC_OK);
        },
      );

      authRoutes.post<{ Body: LoginBody }>(
        '/login',
        {
          schema: {
            body: loginBodySchema,
            response: { 200: loginResponseSchema },
          },
          config: { rateLimit: { max: app.env.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' } },
        },
        async (request, reply) => {
          const { identifier, password } = request.body;
          const user = await authService.login(identifier, password, request.ip);
          await setSessionCookie(reply, user.id, user.role, user.handle);
          return reply.send({ user: toAuthUser(user) });
        },
      );

      authRoutes.post(
        '/logout',
        {
          schema: {
            response: { 200: genericSuccessResponseSchema },
          },
          config: { rateLimit: { max: app.env.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' } },
        },
        async (_request, reply) => {
          session.clearSession(reply);
          clearCsrfCookie(reply);
          return reply.send({ ok: true, message: 'Sessão encerrada com sucesso' });
        },
      );

      authRoutes.get(
        '/me',
        {
          preHandler: requireAuth,
          schema: {
            response: { 200: meResponseSchema },
          },
        },
        async (request, reply) => {
          const user = await authService.getCurrentUser(request.sessionUser!.sub);
          return reply.send({ user: toAuthUser(user) });
        },
      );

      authRoutes.post<{ Body: RecoverBody }>(
        '/recover',
        {
          schema: {
            body: recoverBodySchema,
            response: { 200: genericSuccessResponseSchema },
          },
          config: { rateLimit: { max: app.env.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' } },
        },
        async (request, reply) => {
          const { email } = request.body;
          await authService.recover(email);
          return reply.code(200).send(GENERIC_OK);
        },
      );

      authRoutes.post<{ Body: ResetPasswordBody }>(
        '/reset-password',
        {
          schema: {
            body: resetPasswordBodySchema,
            response: { 200: genericSuccessResponseSchema },
          },
          config: { rateLimit: { max: app.env.RATE_LIMIT_AUTH_MAX, timeWindow: '1 minute' } },
        },
        async (request, reply) => {
          const { token, password } = request.body;
          const result = await authService.resetPassword(token, password);
          // Invalidate every existing session for this user (all devices).
          if (options.sessionEpoch) await options.sessionEpoch.bump(result.userId);
          return reply.send({ ok: true, message: 'Senha redefinida com sucesso' });
        },
      );

      authRoutes.get<{ Params: VerifyEmailParams }>(
        '/verify-email/:token',
        {
          schema: {
            params: verifyEmailParamsSchema,
            response: { 200: genericSuccessResponseSchema },
          },
        },
        async (request, reply) => {
          const { userId } = await authService.verifyEmail(request.params.token);

          // Auto-login: hand the freshly verified user a session so they land
          // straight in the app instead of the login page.
          const user = await userRepository.findActiveById(userId);
          if (user) {
            await setSessionCookie(reply, user.id, user.role, user.handle);
          }

          return reply.send({ ok: true, message: 'E-mail verificado com sucesso' });
        },
      );
    },
    { prefix: '/api/auth' },
  );

  app.decorateRequest('sessionUser', null);
}

declare module 'fastify' {
  interface FastifyRequest {
    sessionUser: { sub: string; role: AuthUser['role']; handle: string } | null;
  }
}
