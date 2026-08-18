import type { PrismaClient } from '@prisma/client';

export interface SystemConfigRepository {
  getConfig(key: string): Promise<unknown>;
  getBoolean(key: string, fallback: boolean): Promise<boolean>;
  getNumber(key: string, fallback: number): Promise<number>;
  list(): Promise<Array<{ key: string; value: unknown }>>;
  set(key: string, value: unknown): Promise<void>;
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

  async function list() {
    const rows = await prisma.systemConfig.findMany();
    return rows.map((row) => ({ key: row.key, value: row.value }));
  }

  async function set(key: string, value: unknown) {
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: value as object },
      create: { key, value: value as object },
    });
  }

  return { getConfig, getBoolean, getNumber, list, set };
}
