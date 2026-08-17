import { loadEnv } from './config/env.js';
import { buildApp } from './app.js';
import { createPrismaClient } from './db/client.js';

async function main() {
  const env = loadEnv(process.env);
  const prisma = createPrismaClient(env.DATABASE_URL, env.NODE_ENV === 'development');

  const app = await buildApp({ env, prisma });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Shutting down');
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
