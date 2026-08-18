import { loadEnv } from './config/env.js';
import { buildApp } from './app.js';
import { createPrismaClient } from './db/client.js';
import { createEmailSender } from './lib/mailer.js';
import { createEmailWorker } from './lib/worker.js';
import Redis from 'ioredis';

async function main() {
  const env = loadEnv(process.env);
  const prisma = createPrismaClient(env.DATABASE_URL, env.NODE_ENV === 'development');

  const app = await buildApp({ env, prisma });

  const emailWorker = createEmailWorker({
    connection: new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }),
    emailSender: createEmailSender(env, app.log),
    logger: app.log,
  });
  app.log.info('email worker started');

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
    await emailWorker.close();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
