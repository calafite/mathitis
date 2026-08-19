import { createHash, randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { UserRepository, UserWithProfile } from '../repositories/user-repository.js';
import type { TokenRepository } from '../repositories/token-repository.js';
import type { SystemConfigRepository } from '../repositories/system-config-repository.js';
import { DomainError, UnauthorizedError } from '../errors.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const TOKEN_TTL_HOURS = 24;

export interface Mailer {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}

export interface AuthServiceDeps {
  userRepository: UserRepository;
  tokenRepository: TokenRepository;
  systemConfigRepository: SystemConfigRepository;
  mailer?: Mailer;
}

export interface RegisterInput {
  handle: string;
  email: string;
  password: string;
  semester: number;
  socialName?: string;
}

export interface AuthService {
  register(input: RegisterInput): Promise<void>;
  login(identifier: string, password: string): Promise<UserWithProfile>;
  getCurrentUser(userId: string): Promise<UserWithProfile>;
  recover(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<void>;
  verifyEmail(token: string): Promise<void>;
}

function sha256(input: string): Buffer {
  return createHash('sha256').update(input).digest();
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { userRepository, tokenRepository, systemConfigRepository, mailer } = deps;

  async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async function verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async function issueToken(userId: string, type: 'email_verification' | 'password_reset') {
    const plainToken = randomBytes(32).toString('hex');
    const tokenDigest = sha256(plainToken);
    const tokenHash = await argon2.hash(tokenDigest, ARGON2_OPTIONS);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
    await tokenRepository.createToken(userId, type, tokenHash, expiresAt);
    return plainToken;
  }

  async function verifyPlainToken(
    plainToken: string,
    type: 'email_verification' | 'password_reset',
  ): Promise<{ userId: string; tokenId: string } | null> {
    const inputDigest = sha256(plainToken);
    const candidates = await tokenRepository.findActiveByType(type);
    if (candidates.length === 0) return null;

    for (const candidate of candidates) {
      try {
        const matches = await argon2.verify(candidate.tokenHash, inputDigest);
        if (matches) {
          return { userId: candidate.userId, tokenId: candidate.id };
        }
      } catch {
        // hash format mismatch — ignore and continue
      }
    }
    return null;
  }

  async function register(input: RegisterInput): Promise<void> {
    const registrationEnabled = await systemConfigRepository.getBoolean(
      'REGISTRATION_ENABLED',
      true,
    );
    if (!registrationEnabled) {
      // Enumeration-safe: behave identically whether or not registration is open
      return;
    }

    const existing = await userRepository.findByEmail(input.email.toLowerCase());
    if (existing) {
      if (existing.status === 'pending_verification' && existing.deletedAt === null) {
        const token = await issueToken(existing.id, 'email_verification');
        await mailer?.sendVerificationEmail(existing.email, token);
      }
      return;
    }

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      handle: input.handle,
      email: input.email.toLowerCase(),
      passwordHash,
      semester: input.semester,
      role: 'freshman',
      socialName: input.socialName,
    });

    const token = await issueToken(user.id, 'email_verification');
    await mailer?.sendVerificationEmail(user.email, token);
  }

  async function login(identifier: string, password: string): Promise<UserWithProfile> {
    const user = await userRepository.findByLoginIdentifier(identifier);
    if (!user || user.deletedAt !== null) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (user.status === 'suspended') {
      throw new DomainError('ACCOUNT_SUSPENDED', 403, 'This account has been suspended');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('Invalid credentials');
    }

    return user;
  }

  async function getCurrentUser(userId: string): Promise<UserWithProfile> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new UnauthorizedError('Session is no longer valid');
    }
    return user;
  }

  async function recover(email: string): Promise<void> {
    const user = await userRepository.findByEmail(email.toLowerCase());
    if (!user || user.deletedAt !== null) {
      // Enumeration-safe: silently succeed regardless of account existence
      return;
    }

    const token = await issueToken(user.id, 'password_reset');
    await mailer?.sendPasswordResetEmail(user.email, token);
  }

  async function resetPassword(token: string, newPassword: string): Promise<void> {
    const match = await verifyPlainToken(token, 'password_reset');
    if (!match) {
      throw new DomainError('TOKEN_INVALID', 400, 'Invalid or expired reset token');
    }

    const user = await userRepository.findActiveById(match.userId);
    if (!user) {
      throw new DomainError('TOKEN_INVALID', 400, 'Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.updatePassword(match.userId, passwordHash);
    const consumed = await tokenRepository.consume(match.tokenId);
    if (!consumed) {
      throw new DomainError('TOKEN_ALREADY_USED', 400, 'This token has already been used');
    }
  }

  async function verifyEmail(token: string): Promise<void> {
    const match = await verifyPlainToken(token, 'email_verification');
    if (!match) {
      throw new DomainError('TOKEN_INVALID', 400, 'Invalid or expired verification token');
    }

    const consumed = await tokenRepository.consume(match.tokenId);
    if (!consumed) {
      throw new DomainError('TOKEN_ALREADY_USED', 400, 'This token has already been used');
    }

    await userRepository.activate(match.userId);
  }

  return {
    register,
    login,
    getCurrentUser,
    recover,
    resetPassword,
    verifyEmail,
  };
}
