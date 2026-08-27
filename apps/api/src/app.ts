import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import Redis from 'ioredis';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError, type ZodSchema } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { Queue } from 'bullmq';
import type { Env } from './config/env.js';
import { createPrismaClient } from './db/client.js';
import { registerErrorHandler } from './plugins/error-handler.js';
import { registerAuthPlugin } from './plugins/auth-plugin.js';
import { registerAccountPlugin } from './plugins/account-plugin.js';
import { registerProfilesPlugin } from './plugins/profiles-plugin.js';
import { registerDiscoveryPlugin } from './plugins/discovery-plugin.js';
import { registerAdminPlugin } from './plugins/admin-plugin.js';
import { registerDevPlugin } from './plugins/dev-plugin.js';
import { registerNotificationsPlugin } from './plugins/notifications-plugin.js';
import { createSessionManager } from './plugins/session.js';
import { createStorage } from './storage/storage-service.js';
import { createRedisIdempotencyStore } from './lib/idempotency.js';
import { createEmailQueue } from './lib/queue.js';
import { initSentry } from './lib/sentry.js';
import { parseKeyring } from './lib/keyring.js';
import { createCsrfGuard } from './plugins/csrf.js';
import { createRedisLoginGuard } from './lib/login-guard.js';
import { createRedisSessionEpoch } from './lib/session-epoch.js';
import { createAuditLogRepository } from './repositories/audit-log-repository.js';
import { createUserRepository } from './repositories/user-repository.js';
import { createTokenRepository } from './repositories/token-repository.js';
import { createSystemConfigRepository } from './repositories/system-config-repository.js';
import { createAuthMailer } from './services/auth-mailer.js';
import { ValidationError } from './errors.js';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.passwordHash',
  'req.body.token',
  'req.body.email',
  'req.body.contactEmail',
  '*.password',
  '*.passwordHash',
  '*.email',
  '*.contactEmail',
  '*.token',
];

function createLoggerOptions(logLevel: string): false | Record<string, unknown> {
  if (logLevel === 'silent') return false;
  return {
    level: logLevel,
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
    formatters: {
      bindings: (bindings: { pid: number; hostname: string }) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: 'mathitis-api',
      }),
    },
  };
}

export interface BuildAppOptions {
  env: Env;
  prisma?: PrismaClient;
  redis?: Redis;
  queue?: Queue;
  mailer?: Parameters<typeof registerAuthPlugin>[1]['mailer'];
  /** Injectable fetch for the rich-card scraper (tests mock the network). */
  scrapeFetch?: typeof fetch;
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = options;
  const prisma = options.prisma ?? createPrismaClient(env.DATABASE_URL);
  const redis = options.redis ?? new Redis(env.REDIS_URL);

  const app = Fastify({
    logger: createLoggerOptions(env.LOG_LEVEL),
    disableRequestLogging: true,
    trustProxy: true,
    // Composite selector.validator tokens are ~101 chars; the default cap of
    // 100 would reject verification links with FST_ERR_MAX_PARAM_LENGTH.
    maxParamLength: 500,
  });

  initSentry({ dsn: env.SENTRY_DSN, environment: env.NODE_ENV });

  // Zod-based validator and serializer compilers
  app.setValidatorCompiler<ZodSchema>(({ schema }) => {
    return (data: unknown) => {
      const result = schema.safeParse(data);
      if (!result.success) {
        const errors = result.error.errors.map((e) => ({
          instancePath: e.path.join('.'),
          schemaPath: e.path.join('.'),
          keyword: e.code,
          message: e.message,
        }));
        const error = new Error('Validation failed') as Error & { validation: typeof errors };
        error.validation = errors;
        throw error;
      }
      return result.data;
    };
  });

  app.setSerializerCompiler<ZodSchema>(({ schema }) => {
    return (data: unknown) => JSON.stringify(schema.parse(data));
  });

  app.decorate('env', env);
  app.decorate('prisma', prisma);

  app.addHook('onRequest', async (request) => {
    const correlationId = randomUUID();
    request.correlationId = correlationId;
    request.headers['x-request-id'] = correlationId;
  });

  app.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        correlationId: request.correlationId,
        responseTime: reply.elapsedTime,
      },
      'request completed',
    );
  });

  await app.register(cookie, { secret: env.COOKIE_SECRET });
  const allowedOrigins = new Set(
    env.WEB_ORIGIN
      ? env.WEB_ORIGIN.split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      : [],
  );
  const csrfGuard = createCsrfGuard(allowedOrigins);
  app.addHook('onRequest', csrfGuard);

  await app.register(helmet, {
    contentSecurityPolicy:
      env.NODE_ENV === 'production'
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              fontSrc: ["'self'", 'data:'],
              connectSrc: ["'self'"],
              objectSrc: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
              frameAncestors: ["'none'"],
              // Rich cards embed media from these providers via iframes.
              frameSrc: [
                'https://open.spotify.com',
                'https://www.youtube.com',
                'https://www.youtube-nocookie.com',
                'https://steamcommunity.com',
              ],
              upgradeInsecureRequests: [],
            },
          }
        : false,
  });
  await app.register(cors, {
    origin:
      allowedOrigins.size > 0 ? [...allowedOrigins] : env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_GLOBAL_MAX,
    timeWindow: '1 minute',
    cache: 5000,
    skipOnError: true,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true,
    },
    // Health and static assets must never be rate-limited for uptime probes
    // and normal browsing.
    allowList: (request: FastifyRequest) =>
      request.url === '/health' || request.url.startsWith('/assets/'),
    // Default key is per-IP. Per-route configs with user-aware keys (e.g.
    // discovery bumps) override this for authenticated traffic, avoiding
    // NAT collateral where many campus users share one egress IP.
    keyGenerator: (request: FastifyRequest) => request.ip,
  });

  const sessionEpoch = createRedisSessionEpoch(redis);
  const session = createSessionManager(
    parseKeyring(env.JWT_SECRET, env.JWT_KEYRING),
    env.SESSION_MAX_AGE_DAYS,
    sessionEpoch.get,
  );
  const loginGuard = createRedisLoginGuard(redis, {
    maxAttempts: env.LOGIN_MAX_ATTEMPTS,
    lockoutSeconds: env.LOGIN_LOCKOUT_MINUTES * 60,
  });
  const storage = createStorage(env);
  const idempotencyStore = createRedisIdempotencyStore(redis);

  // Email links must always open the SPA, never the API port. In development
  // WEB_ORIGIN is often unset, so default to Vite's port.
  const webRedirectTarget =
    env.WEB_ORIGIN?.split(',')[0]?.trim() ||
    (env.NODE_ENV === 'development' ? 'http://localhost:5173' : env.PUBLIC_BASE_URL);

  const queue = options.queue ?? createEmailQueue(new Redis(env.REDIS_URL));
  app.decorate('emailQueue', queue);

  const mailer =
    options.mailer ??
    createAuthMailer({
      publicBaseUrl: env.PUBLIC_BASE_URL,
      // Email links must always open the SPA, never the API port. In
      // development WEB_ORIGIN is often unset, so default to Vite's port.
      webBaseUrl: webRedirectTarget,
      emailQueue: queue,
      logger: app.log,
    });

  app.addHook('onClose', async () => {
    await queue.close();
    await redis.quit();
  });

  if (!env.S3_ENDPOINT || !env.S3_BUCKET) {
    const uploadDir = resolve(env.UPLOAD_DIR);
    mkdirSync(uploadDir, { recursive: true });
    await app.register(fastifyStatic, {
      root: uploadDir,
      prefix: '/assets/uploads/',
      maxAge: '1y',
      immutable: true,
    });
  } else {
    // When using S3/MinIO, redirect asset requests to the public URL
    app.get('/assets/uploads/*', async (request, reply) => {
      const params = request.params as { ['*']: string };
      const key = params['*'];
      const publicUrl = `${env.S3_PUBLIC_BASE_URL!.replace(/\/$/, '')}/assets/uploads/${key}`;
      return reply.redirect(publicUrl);
    });
  }

  registerErrorHandler(app);

  // Fail-safe browser-route redirects: email links occasionally land on the
  // API origin (wrong WEB_ORIGIN, old bookmarks). Send visitors to the SPA
  // with query strings intact instead of a raw JSON 404.
  for (const path of ['/verify-email', '/recover', '/reset-password', '/login', '/register']) {
    app.get(path, async (request, reply) => {
      const target = path === '/reset-password' ? '/recover' : path;
      const queryIndex = request.url.indexOf('?');
      const queryString = queryIndex >= 0 ? request.url.slice(queryIndex) : '';
      return reply.redirect(`${webRedirectTarget.replace(/\/$/, '')}${target}${queryString}`);
    });
  }

  app.addHook('onError', async (_request, _reply, error) => {
    if (error instanceof ZodError) {
      throw new ValidationError('Corpo da requisição inválido');
    }
  });
  app.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  const auditLogRepository = createAuditLogRepository(prisma);

  await app.register(registerAuthPlugin, {
    jwtSecret: env.JWT_SECRET,
    cookieSecret: env.COOKIE_SECRET,
    sessionMaxAgeDays: env.SESSION_MAX_AGE_DAYS,
    session,
    userRepository: createUserRepository(prisma),
    tokenRepository: createTokenRepository(prisma),
    systemConfigRepository: createSystemConfigRepository(prisma),
    mailer,
    loginGuard,
    sessionEpoch,
    onLockout: async (userId) => {
      await auditLogRepository.create({
        actorId: userId,
        action: 'account.lockout',
        targetEntity: 'user',
        targetId: userId,
        details: { reason: 'max_failed_logins' },
      });
    },
  });

  await app.register(registerAccountPlugin, {
    prisma,
    session,
    sessionEpoch,
  });

  await app.register(registerProfilesPlugin, {
    prisma,
    session,
    storage,
    uploadDir: resolve(env.UPLOAD_DIR),
    publicBaseUrl: env.PUBLIC_BASE_URL,
    scrapeFetch: options.scrapeFetch,
    redis,
  });

  await app.register(registerDiscoveryPlugin, {
    prisma,
    session,
    idempotencyStore,
    emailQueue: queue,
    logger: app.log,
    redis,
  });

  await app.register(registerAdminPlugin, {
    prisma,
    session,
    idempotencyStore,
    emailQueue: queue,
    logger: app.log,
    sessionEpoch,
    redis,
  });

  await app.register(registerDevPlugin, {
    prisma,
    session,
    redis,
    queue,
    sessionEpoch,
  });

  await app.register(registerNotificationsPlugin, {
    prisma,
    session,
    emailQueue: queue,
    logger: app.log,
  });

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    env: Env;
    prisma: PrismaClient;
    emailQueue: Queue;
  }
  interface FastifyRequest {
    correlationId: string;
  }
}
