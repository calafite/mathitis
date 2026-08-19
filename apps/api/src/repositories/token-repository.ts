import type { PrismaClient, TokenType, UserToken } from '@prisma/client';

export interface TokenRepository {
  createToken(
    userId: string,
    type: TokenType,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<UserToken>;
  findActiveByType(type: TokenType): Promise<UserToken[]>;
  findActiveByUserAndType(userId: string, type: TokenType): Promise<UserToken[]>;
  findAllByType(type: TokenType): Promise<UserToken[]>;
  consume(id: string): Promise<boolean>;
}

export function createTokenRepository(prisma: PrismaClient): TokenRepository {
  async function createToken(userId: string, type: TokenType, tokenHash: string, expiresAt: Date) {
    return prisma.userToken.create({
      data: { userId, type, tokenHash, expiresAt },
    });
  }

  async function findActiveByType(type: TokenType) {
    return prisma.userToken.findMany({
      where: {
        type,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function findActiveByUserAndType(userId: string, type: TokenType) {
    return prisma.userToken.findMany({
      where: {
        userId,
        type,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function findAllByType(type: TokenType) {
    return prisma.userToken.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
    });
  }

  async function consume(id: string) {
    const result = await prisma.userToken.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return result.count > 0;
  }

  return { createToken, findActiveByType, findActiveByUserAndType, findAllByType, consume };
}
