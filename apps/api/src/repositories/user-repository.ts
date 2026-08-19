import type { PrismaClient, User, UserRole } from '@prisma/client';
import { DomainError } from '../errors.js';

export interface CreateUserInput {
  handle: string;
  email: string;
  passwordHash: string;
  semester: number;
  role: UserRole;
  socialName?: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findByHandle(handle: string): Promise<User | null>;
  findActiveById(id: string): Promise<(User & { profile: { socialName: string | null } | null }) | null>;
  findByLoginIdentifier(identifier: string): Promise<(User & { profile: { socialName: string | null } | null }) | null>;
  create(input: CreateUserInput): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
  activate(id: string): Promise<void>;
}

export function createUserRepository(prisma: PrismaClient): UserRepository {
  async function findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  }

  async function findByHandle(handle: string) {
    return prisma.user.findUnique({ where: { handle } });
  }

  async function findActiveById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { profile: { select: { socialName: true } } },
    });
  }

  async function findByLoginIdentifier(identifier: string) {
    const isEmail = identifier.includes('@');
    return prisma.user.findFirst({
      where: isEmail
        ? { email: identifier.toLowerCase(), deletedAt: null }
        : { handle: identifier, deletedAt: null },
      include: { profile: { select: { socialName: true } } },
    });
  }

  async function create(input: CreateUserInput) {
    try {
      return await prisma.user.create({
        data: {
          handle: input.handle,
          email: input.email,
          passwordHash: input.passwordHash,
          semester: input.semester,
          role: input.role,
          profile: {
            create: {
              socialName: input.socialName,
              isDiscoverable: input.role === 'freshman' ? false : true,
            },
          },
        },
      });
    } catch {
      throw new DomainError(
        'HANDLE_OR_EMAIL_TAKEN',
        409,
        'An account with this handle or email already exists',
      );
    }
  }

  async function updatePassword(id: string, passwordHash: string) {
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async function activate(id: string) {
    await prisma.user.update({
      where: { id },
      data: { status: 'active' },
    });
  }

  return {
    findByEmail,
    findByHandle,
    findActiveById,
    findByLoginIdentifier,
    create,
    updatePassword,
    activate,
  };
}
