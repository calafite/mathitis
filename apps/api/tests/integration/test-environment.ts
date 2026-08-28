import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { afterAll } from 'vitest';
import Redis from 'ioredis';
import { createPrismaClient, type PrismaClient } from '../../src/db/client.js';
import type { Env } from '../../src/config/env.js';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

const CONTAINER = `mathitis-test-pg-${randomUUID().slice(0, 8)}`;
const REDIS_CONTAINER = `mathitis-test-redis-${randomUUID().slice(0, 8)}`;
const POSTGRES_IMAGE = 'postgres:16-alpine';
const REDIS_IMAGE = 'redis:7-alpine';
let port: number;
let redisPort: number;
const DB_USER = 'mathitis_app';
const DB_PASS = 'test_password';
const DB_NAME = 'mathitis_test';

const API_DIR = fileURLToPath(new URL('../..', import.meta.url));

export interface TestContext {
  app: FastifyInstance;
  prisma: PrismaClient;
  redis: Redis;
  env: Env;
}

let started = false;

export interface StartTestEnvironmentOptions {
  /** Injectable fetch forwarded into buildApp (rich-card scraper network mock). */
  scrapeFetch?: typeof fetch;
}

export async function startTestEnvironment(
  options: StartTestEnvironmentOptions = {},
): Promise<TestContext> {
  if (!started) {
    execSync(
      `docker run -d --name ${CONTAINER} -e POSTGRES_USER=${DB_USER} -e POSTGRES_PASSWORD=${DB_PASS} -e POSTGRES_DB=${DB_NAME} -p 0:5432 ${POSTGRES_IMAGE}`,
      { stdio: 'pipe' },
    );
    try {
      execSync(`docker run -d --name ${REDIS_CONTAINER} -p 0:6379 ${REDIS_IMAGE}`, {
        stdio: 'pipe',
      });
    } catch (error) {
      execSync(`docker rm -f ${CONTAINER}`, { stdio: 'pipe' });
      throw error;
    }

    const publishedPort = (containerPort: string): number => {
      const output = execSync(`docker port ${containerPort}`, { encoding: 'utf8' });
      const match = output.match(/:(\d+)\s*$/m);
      if (!match) throw new Error(`Could not determine published port for ${containerPort}`);
      return Number(match[1]);
    };
    port = publishedPort(`${CONTAINER} 5432/tcp`);
    redisPort = publishedPort(`${REDIS_CONTAINER} 6379/tcp`);
    started = true;

    const deadline = Date.now() + 30_000;
    let ready = false;
    while (Date.now() < deadline) {
      try {
        execSync(`docker exec ${CONTAINER} pg_isready -U ${DB_USER} -d ${DB_NAME} -h localhost`, {
          stdio: 'pipe',
        });
        execSync(`docker exec ${REDIS_CONTAINER} redis-cli ping`, { stdio: 'pipe' });
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!ready) {
      throw new Error('PostgreSQL/Redis test containers did not become ready in time');
    }
  }

  const databaseUrl = `postgresql://${DB_USER}:${DB_PASS}@localhost:${port}/${DB_NAME}`;
  const redisUrl = `redis://localhost:${redisPort}`;
  const prisma = createPrismaClient(databaseUrl);
  const redis = new Redis(redisUrl);

  execSync(`${API_DIR}/node_modules/.bin/prisma migrate deploy`, {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
    cwd: API_DIR,
  });

  // Wipe all data for a clean slate
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE audit_logs, user_tokens, profiles, users, profile_tags, rich_cards, tags, profile_bumps, mentorship_requests, mentorships, system_config RESTART IDENTITY CASCADE',
  );

  const env: Env = {
    NODE_ENV: 'development',
    PORT: 4000,
    HOST: '0.0.0.0',
    JWT_SECRET: 'test_jwt_secret_that_is_at_least_32_characters_long',
    COOKIE_SECRET: 'test_cookie_secret_that_is_at_least_32_chars_long',
    SESSION_MAX_AGE_DAYS: 7,
    LOGIN_MAX_ATTEMPTS: 5,
    LOGIN_LOCKOUT_MINUTES: 15,
    WEB_ORIGIN: undefined,
    RATE_LIMIT_GLOBAL_MAX: 100_000,
    RATE_LIMIT_AUTH_MAX: 100_000,
    RATE_LIMIT_REQUEST_MAX: 100_000,
    DATABASE_URL: databaseUrl,
    REDIS_URL: redisUrl,
    S3_ENDPOINT: undefined,
    S3_BUCKET: undefined,
    S3_ACCESS_KEY: undefined,
    S3_SECRET_KEY: undefined,
    S3_USE_SSL: false,
    S3_PUBLIC_BASE_URL: undefined,
    PUBLIC_BASE_URL: 'http://localhost:4000',
    UPLOAD_DIR: '/tmp/mathitis-test-uploads',
    SENTRY_DSN: undefined,
    LOG_LEVEL: 'trace',
    SMTP_HOST: undefined,
    SMTP_PORT: undefined,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
    SMTP_FROM: undefined,
  };

  const app = await buildApp({ env, prisma, redis, scrapeFetch: options.scrapeFetch });

  return { app, prisma, redis, env };
}

export async function stopTestEnvironment(context: TestContext | undefined) {
  if (!context) return;
  await context.app.close();
  await context.prisma.$disconnect();
}

export async function teardown() {
  if (started) {
    execSync(`docker rm -f ${CONTAINER}`, { stdio: 'pipe' });
    execSync(`docker rm -f ${REDIS_CONTAINER}`, { stdio: 'pipe' });
    started = false;
  }
}

afterAll(async () => {
  await teardown();
});
