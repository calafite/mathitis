import type { PrismaClient } from '@prisma/client';

export interface SystemConfigRepository {
  getConfig(key: string): Promise<unknown>;
  getBoolean(key: string, fallback: boolean): Promise<boolean>;
  getNumber(key: string, fallback: number): Promise<number>;
}

export function createSystemConfigRepository(prisma: PrismaClient): SystemConfigRepository {
  async function getConfig(key: string) {
    const row = await prisma.systemConfig.findUnique({ where: { key } });
    return row?.value;
  }

  async function getBoolean(key: string, fallback: boolean) {
    const value = await getConfig(key);
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true';
    return fallback;
  }

  async function getNumber(key: string, fallback: number) {
    const value = await getConfig(key);
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  return { getConfig, getBoolean, getNumber };
}
