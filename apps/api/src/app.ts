import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import Fastify, { type FastifyInstance } from 'fastify';
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
import { registerProfilesPlugin } from './plugins/profiles-plugin.js';
import { registerDiscoveryPlugin } from './plugins/discovery-plugin.js';
import { registerAdminPlugin } from './plugins/admin-plugin.js';
import { registerDevPlugin } from './plugins/dev-plugin.js';
import { registerNotificationsPlugin } from './plugins/notifications-plugin.js';
import { createSessionManager } from './plugins/session.js';
import { createStorage } from './storage/storage-service.js';
import { createRedisIdempotencyStore } from './lib/idempotency.js';
import { createEmailQueue } from './lib/queue.js';
import { createUserRepository } from './repositories/user-repository.js';
import { createTokenRepository } from './repositories/token-repository.js';
import { createSystemConfigRepository } from './repositories/system-config-repository.js';
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
}

export async function buildApp(options: BuildAppOptions): Promise<FastifyInstance> {
  const { env } = options;
  const prisma = options.prisma ?? createPrismaClient(env.DATABASE_URL);
  const redis = options.redis ?? new Redis(env.REDIS_URL);

  const app = Fastify({
    logger: createLoggerOptions(env.LOG_LEVEL),
    disableRequestLogging: true,
    trustProxy: true,
  });

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
  await app.register(helmet, {
    contentSecurityPolicy: env.NODE_ENV === 'production',
  });
  await app.register(cors, {
    origin: env.NODE_ENV === 'production' ? false : true,
    credentials: true,
  });
  await app.register(rateLimit, {
    global: false,
    cache: 5000,
  });

  const session = createSessionManager(env.JWT_SECRET, env.SESSION_MAX_AGE_DAYS);
  const storage = createStorage(env);
  const idempotencyStore = createRedisIdempotencyStore(redis);

  const queue = options.queue ?? createEmailQueue(new Redis(env.REDIS_URL));
  app.decorate('emailQueue', queue);

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
  }

  registerErrorHandler(app);

  app.addHook('onError', async (_request, _reply, error) => {
    if (error instanceof ZodError) {
      throw new ValidationError('Invalid request payload');
    }
  });

  app.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  await app.register(registerAuthPlugin, {
    jwtSecret: env.JWT_SECRET,
    cookieSecret: env.COOKIE_SECRET,
    sessionMaxAgeDays: env.SESSION_MAX_AGE_DAYS,
    session,
    userRepository: createUserRepository(prisma),
    tokenRepository: createTokenRepository(prisma),
    systemConfigRepository: createSystemConfigRepository(prisma),
    mailer: options.mailer,
  });

  await app.register(registerProfilesPlugin, {
    prisma,
    session,
    storage,
    uploadDir: resolve(env.UPLOAD_DIR),
    publicBaseUrl: env.PUBLIC_BASE_URL,
  });

  await app.register(registerDiscoveryPlugin, {
    prisma,
    session,
    idempotencyStore,
    emailQueue: queue,
    logger: app.log,
  });

  await app.register(registerAdminPlugin, {
    prisma,
    session,
    idempotencyStore,
    emailQueue: queue,
    logger: app.log,
  });

  await app.register(registerDevPlugin, {
    prisma,
    session,
    redis,
    queue,
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
