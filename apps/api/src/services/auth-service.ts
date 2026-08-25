import { randomBytes } from 'node:crypto';
import argon2 from 'argon2';
import type { UserRepository, UserWithProfile } from '../repositories/user-repository.js';
import type { TokenRepository } from '../repositories/token-repository.js';
import type { SystemConfigRepository } from '../repositories/system-config-repository.js';
import { DomainError, UnauthorizedError } from '../errors.js';
import type { LoginGuard } from '../lib/login-guard.js';

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

const TOKEN_TTL_HOURS = 24;

const COMPOSITE_TOKEN_SEPARATOR = '.';

export interface Mailer {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}

export interface AuthServiceDeps {
  userRepository: UserRepository;
  tokenRepository: TokenRepository;
  systemConfigRepository: SystemConfigRepository;
  mailer?: Mailer;
  loginGuard?: LoginGuard;
  /** Called when repeated failures trigger an account lockout (for audit logging). */
  onLockout?: (userId: string) => Promise<void>;
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
  login(identifier: string, password: string, clientIp?: string): Promise<UserWithProfile>;
  getCurrentUser(userId: string): Promise<UserWithProfile>;
  recover(email: string): Promise<void>;
  resetPassword(token: string, newPassword: string): Promise<{ userId: string }>;
  verifyEmail(token: string): Promise<void>;
}

export function createAuthService(deps: AuthServiceDeps): AuthService {
  const { userRepository, tokenRepository, systemConfigRepository, mailer, loginGuard, onLockout } = deps;

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
    const plainSecret = randomBytes(32).toString('hex');
    const tokenHash = await argon2.hash(plainSecret, ARGON2_OPTIONS);
    const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
    const token = await tokenRepository.createToken(userId, type, tokenHash, expiresAt);
    return `${token.id}${COMPOSITE_TOKEN_SEPARATOR}${plainSecret}`;
  }

  async function verifyPlainToken(
    compositeToken: string,
    type: 'email_verification' | 'password_reset',
  ): Promise<{ userId: string; tokenId: string } | null> {
    const parts = compositeToken.split(COMPOSITE_TOKEN_SEPARATOR);
    if (parts.length !== 2) return null;
    const tokenId = parts[0]!;
    const plainSecret = parts[1]!;

    const candidate = await tokenRepository.findById(tokenId);
    if (!candidate || candidate.type !== type) return null;
    if (candidate.consumedAt !== null) return null;
    if (candidate.expiresAt <= new Date()) return null;

    try {
      const matches = await argon2.verify(candidate.tokenHash, plainSecret);
      if (matches) {
        return { userId: candidate.userId, tokenId: candidate.id };
      }
    } catch {
      // hash format mismatch
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

  async function login(
    identifier: string,
    password: string,
    clientIp = 'unknown',
  ): Promise<UserWithProfile> {
    const user = await userRepository.findByLoginIdentifier(identifier);

    // Brute-force lockout: reject before any expensive Argon2id work and
    // with the same generic message used for bad credentials (no
    // account-existence oracle while the lock is active).
    if (loginGuard && (await loginGuard.isLocked(user?.id ?? null, clientIp))) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    if (!user || user.deletedAt !== null) {
      if (loginGuard) await loginGuard.recordFailure(null, clientIp);
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      if (loginGuard) {
        const wasLocked = await loginGuard.isLocked(user.id, clientIp);
        await loginGuard.recordFailure(user.id, clientIp);
        if (!wasLocked && (await loginGuard.isLocked(user.id, clientIp))) {
          await onLockout?.(user.id);
        }
      }
      throw new UnauthorizedError('Credenciais inválidas');
    }

    if (user.status === 'suspended') {
      throw new DomainError('ACCOUNT_SUSPENDED', 403, 'Esta conta foi suspensa');
    }

    if (user.status !== 'active') {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    if (loginGuard) await loginGuard.reset(user.id, clientIp);

    return user;
  }

  async function getCurrentUser(userId: string): Promise<UserWithProfile> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new UnauthorizedError('A sessão não é mais válida');
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

  async function resetPassword(token: string, newPassword: string): Promise<{ userId: string }> {
    const match = await verifyPlainToken(token, 'password_reset');
    if (!match) {
      throw new DomainError('TOKEN_INVALID', 400, 'Token de redefinição inválido ou expirado');
    }

    const user = await userRepository.findActiveById(match.userId);
    if (!user) {
      throw new DomainError('TOKEN_INVALID', 400, 'Token de redefinição inválido ou expirado');
    }

    const passwordHash = await hashPassword(newPassword);
    await userRepository.updatePassword(match.userId, passwordHash);
    const consumed = await tokenRepository.consume(match.tokenId);
    if (!consumed) {
      throw new DomainError('TOKEN_ALREADY_USED', 400, 'Este token já foi utilizado');
    }
    return { userId: match.userId };
  }

  async function verifyEmail(token: string): Promise<void> {
    const parts = token.split(COMPOSITE_TOKEN_SEPARATOR);
    if (parts.length !== 2) {
      throw new DomainError('TOKEN_INVALID', 400, 'Token de verificação inválido ou expirado');
    }
    const tokenId = parts[0]!;
    const plainSecret = parts[1]!;

    const candidate = await tokenRepository.findById(tokenId);
    if (!candidate || candidate.type !== 'email_verification') {
      throw new DomainError('TOKEN_INVALID', 400, 'Token de verificação inválido ou expirado');
    }
    if (candidate.consumedAt !== null) {
      return;
    }
    if (candidate.expiresAt <= new Date()) {
      throw new DomainError('TOKEN_INVALID', 400, 'Token de verificação inválido ou expirado');
    }

    try {
      const matches = await argon2.verify(candidate.tokenHash, plainSecret);
      if (!matches) {
        throw new DomainError('TOKEN_INVALID', 400, 'Token de verificação inválido ou expirado');
      }
    } catch {
      throw new DomainError('TOKEN_INVALID', 400, 'Token de verificação inválido ou expirado');
    }

    const consumed = await tokenRepository.consume(candidate.id);
    if (!consumed) {
      return;
    }
    await userRepository.activate(candidate.userId);
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
