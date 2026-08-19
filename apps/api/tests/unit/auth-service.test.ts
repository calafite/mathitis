import { describe, expect, it, vi } from 'vitest';
import {
  createAuthService,
  type AuthService,
  type Mailer,
} from '../../src/services/auth-service.js';
import type { UserRepository } from '../../src/repositories/user-repository.js';
import type { TokenRepository } from '../../src/repositories/token-repository.js';
import type { SystemConfigRepository } from '../../src/repositories/system-config-repository.js';
import type { User } from '@prisma/client';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    handle: 'freshman1',
    email: 'freshman1@cs.uni.edu',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$stub',
    role: 'freshman',
    semester: 1,
    status: 'pending_verification',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    preferences: null,
    ...overrides,
  };
}

interface Harness {
  service: AuthService;
  userRepository: {
    findByEmail: ReturnType<typeof vi.fn>;
    findByLoginIdentifier: ReturnType<typeof vi.fn>;
    findActiveById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    updatePassword: ReturnType<typeof vi.fn>;
    activate: ReturnType<typeof vi.fn>;
    findByHandle: ReturnType<typeof vi.fn>;
  };
  tokenRepository: {
    createToken: ReturnType<typeof vi.fn>;
    findActiveByType: ReturnType<typeof vi.fn>;
    consume: ReturnType<typeof vi.fn>;
    findActiveByUserAndType: ReturnType<typeof vi.fn>;
    findAllByType: ReturnType<typeof vi.fn>;
  };
  mailer: {
    sendVerificationEmail: ReturnType<typeof vi.fn>;
    sendPasswordResetEmail: ReturnType<typeof vi.fn>;
  };
  config: {
    getBoolean: ReturnType<typeof vi.fn>;
    getNumber: ReturnType<typeof vi.fn>;
    getConfig: ReturnType<typeof vi.fn>;
  };
}

function createHarness(): Harness {
  const userRepository = {
    findByEmail: vi.fn(),
    findByHandle: vi.fn(),
    findActiveById: vi.fn(),
    findByLoginIdentifier: vi.fn(),
    create: vi.fn(),
    updatePassword: vi.fn(),
    activate: vi.fn(),
  };

  const tokenRepository = {
    createToken: vi.fn(),
    findActiveByType: vi.fn(),
    findActiveByUserAndType: vi.fn(),
    findAllByType: vi.fn(),
    consume: vi.fn(),
  };

  const mailer = {
    sendVerificationEmail: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
  };

  const config = {
    getConfig: vi.fn(),
    getBoolean: vi.fn(),
    getNumber: vi.fn(),
  };

  const service = createAuthService({
    userRepository: userRepository as unknown as UserRepository,
    tokenRepository: tokenRepository as unknown as TokenRepository,
    systemConfigRepository: config as unknown as SystemConfigRepository,
    mailer: mailer as unknown as Mailer,
  });

  return { service, userRepository, tokenRepository, mailer, config };
}

describe('AuthService.register', () => {
  it('creates an account and issues a verification token', async () => {
    const h = createHarness();
    h.config.getBoolean.mockResolvedValue(true);
    h.userRepository.findByEmail.mockResolvedValue(null);
    h.userRepository.create.mockImplementation(async (input) =>
      makeUser({ email: input.email, handle: input.handle }),
    );

    await h.service.register({
      handle: 'freshman1',
      email: 'freshman1@cs.uni.edu',
      password: 'StrongPassword123!',
      semester: 1,
    });

    expect(h.userRepository.create).toHaveBeenCalledOnce();
    expect(h.tokenRepository.createToken).toHaveBeenCalledWith(
      expect.any(String),
      'email_verification',
      expect.any(String),
      expect.any(Date),
    );
    expect(h.mailer.sendVerificationEmail).toHaveBeenCalledOnce();
  });

  it('does not expose whether the email already exists (email enumeration prevention)', async () => {
    const h = createHarness();
    h.config.getBoolean.mockResolvedValue(true);
    h.userRepository.findByEmail.mockResolvedValue(makeUser());

    await expect(
      h.service.register({
        handle: 'freshman1',
        email: 'freshman1@cs.uni.edu',
        password: 'StrongPassword123!',
        semester: 1,
      }),
    ).resolves.toBeUndefined();

    expect(h.userRepository.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  it('rejects invalid credentials', async () => {
    const h = createHarness();
    h.userRepository.findByLoginIdentifier.mockResolvedValue(null);

    await expect(h.service.login('nobody', 'wrong')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects a wrong password for an existing user', async () => {
    const h = createHarness();
    h.userRepository.findByLoginIdentifier.mockResolvedValue(
      makeUser({ passwordHash: 'not-a-real-argon2-hash' }),
    );

    await expect(h.service.login('freshman1', 'wrong-password')).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects suspended accounts', async () => {
    const h = createHarness();
    const realHash = await import('argon2').then((m) =>
      m.default.hash('StrongPassword123!', {
        type: 2,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      }),
    );
    h.userRepository.findByLoginIdentifier.mockResolvedValue(
      makeUser({ passwordHash: realHash, status: 'suspended' }),
    );

    await expect(h.service.login('freshman1', 'StrongPassword123!')).rejects.toMatchObject({
      status: 403,
      code: 'ACCOUNT_SUSPENDED',
    });
  });
});

describe('AuthService.recover', () => {
  it('sends a reset email when the account exists', async () => {
    const h = createHarness();
    h.userRepository.findByEmail.mockResolvedValue(makeUser());

    await expect(h.service.recover('freshman1@cs.uni.edu')).resolves.toBeUndefined();

    expect(h.tokenRepository.createToken).toHaveBeenCalledWith(
      expect.any(String),
      'password_reset',
      expect.any(String),
      expect.any(Date),
    );
    expect(h.mailer.sendPasswordResetEmail).toHaveBeenCalledOnce();
  });

  it('silently succeeds when the account does not exist (email enumeration prevention)', async () => {
    const h = createHarness();
    h.userRepository.findByEmail.mockResolvedValue(null);

    await expect(h.service.recover('nobody@cs.uni.edu')).resolves.toBeUndefined();
    expect(h.mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('AuthService.resetPassword', () => {
  it('rejects an invalid token', async () => {
    const h = createHarness();
    h.tokenRepository.findActiveByType.mockResolvedValue([]);

    await expect(
      h.service.resetPassword('a'.repeat(64), 'NewStrongPassword123!'),
    ).rejects.toMatchObject({ status: 400, code: 'TOKEN_INVALID' });
  });
});

describe('AuthService.verifyEmail', () => {
  it('rejects an invalid verification token', async () => {
    const h = createHarness();
    h.tokenRepository.findAllByType.mockResolvedValue([]);

    await expect(h.service.verifyEmail('a'.repeat(64))).rejects.toMatchObject({
      status: 400,
      code: 'TOKEN_INVALID',
    });
  });
});
