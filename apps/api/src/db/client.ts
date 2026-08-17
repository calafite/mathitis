import { PrismaClient } from '@prisma/client';

export function createPrismaClient(databaseUrl: string, logInDev = false) {
  return new PrismaClient({
    datasourceUrl: databaseUrl,
    log: logInDev ? ['warn', 'error'] : ['error'],
  });
}

export type { PrismaClient } from '@prisma/client';
