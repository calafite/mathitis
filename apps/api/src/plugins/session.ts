import { SignJWT, jwtVerify } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@mathitis/schemas';
import type { SessionSecrets } from '../lib/keyring.js';

export interface SessionPayload {
  sub: string;
  role: UserRole;
  handle: string;
}

const SESSION_COOKIE = 'mathitis_session';

/** Returns the current session epoch for a user (0 when none is tracked). */
export type GetSessionEpoch = (userId: string) => Promise<number>;

export interface SessionManager {
  createSessionCookie(payload: SessionPayload): Promise<string>;
  verifySessionCookie(cookieValue: string | undefined): Promise<SessionPayload | null>;
  clearSession(reply: FastifyReply): void;
}

export function createSessionManager(
  secrets: SessionSecrets,
  maxAgeDays: number,
  getEpoch?: GetSessionEpoch,
): SessionManager {
  const currentKey = new TextEncoder().encode(secrets.current);
  const verifyKeys = [
    currentKey,
    ...secrets.legacy.map((secret) => new TextEncoder().encode(secret)),
  ];

  async function createSessionCookie(payload: SessionPayload): Promise<string> {
    const epoch = getEpoch ? await getEpoch(payload.sub) : 0;
    return new SignJWT({ role: payload.role, handle: payload.handle, ep: epoch })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub)
      .setIssuedAt()
      .setExpirationTime(`${maxAgeDays}d`)
      .sign(currentKey);
  }

  async function verifySessionCookie(
    cookieValue: string | undefined,
  ): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    // Try the current key first, then any legacy rotation keys.
    for (const key of verifyKeys) {
      try {
        const { payload } = await jwtVerify(cookieValue, key, {
          algorithms: ['HS256'],
        });
        if (!payload.sub || typeof payload.role !== 'string') return null;

        // Reject sessions issued before the latest epoch bump (e.g. the
        // password changed and every prior device must be logged out).
        if (getEpoch) {
          const currentEpoch = await getEpoch(payload.sub);
          const tokenEpoch = typeof payload.ep === 'number' ? payload.ep : 0;
          if (tokenEpoch < currentEpoch) return null;
        }

        return {
          sub: payload.sub,
          role: payload.role as UserRole,
          handle: String(payload.handle ?? ''),
        };
      } catch {
        // Try the next key in the ring.
      }
    }
    return null;
  }

  function clearSession(reply: FastifyReply): void {
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  return { createSessionCookie, verifySessionCookie, clearSession };
}

export { SESSION_COOKIE };

export function getSessionCookie(request: FastifyRequest): string | undefined {
  return request.cookies[SESSION_COOKIE];
}
