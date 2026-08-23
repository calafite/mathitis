import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError } from '../errors.js';

export const CSRF_COOKIE = 'mathitis_csrf';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function safeEqual(a: string, b: string): boolean {
  const ah = createHash('sha256').update(a).digest();
  const bh = createHash('sha256').update(b).digest();
  return timingSafeEqual(ah, bh);
}

export function createCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

export function getCsrfCookie(request: FastifyRequest): string | undefined {
  return request.cookies[CSRF_COOKIE];
}

/**
 * Double-submit CSRF protection for state-changing requests.
 *
 * The server sets a readable `mathitis_csrf` cookie alongside the session;
 * browsers are expected to echo it in the `x-csrf-token` header. Requests are
 * rejected when they carry a cross-site fetch signal, come from a disallowed
 * origin, or send a mismatched token.
 */
export function createCsrfGuard(allowedOrigins: ReadonlySet<string>) {
  return async function csrfGuard(request: FastifyRequest) {
    if (!STATE_CHANGING_METHODS.has(request.method)) return;

    const secFetchSite = request.headers['sec-fetch-site'];
    if (secFetchSite === 'cross-site') {
      throw new ForbiddenError('Requisição cross-site rejeitada', 'CSRF_REJECTED');
    }

    const origin = request.headers.origin;
    if (origin && allowedOrigins.size > 0 && !allowedOrigins.has(origin)) {
      throw new ForbiddenError('Requisição de origem não permitida', 'CSRF_REJECTED');
    }

    // No CSRF session yet (pre-login or non-browser clients) - nothing to check.
    const cookieToken = getCsrfCookie(request);
    if (!cookieToken) return;

    const headerToken = request.headers['x-csrf-token'];
    if (
      typeof headerToken !== 'string' ||
      headerToken.length === 0 ||
      !safeEqual(headerToken, cookieToken)
    ) {
      throw new ForbiddenError('Token CSRF inválido', 'CSRF_INVALID');
    }
  };
}

export function setCsrfCookie(reply: FastifyReply, token: string, secure: boolean): void {
  reply.setCookie(CSRF_COOKIE, token, {
    path: '/',
    httpOnly: false,
    sameSite: 'strict',
    secure,
    maxAge: 24 * 60 * 60,
  });
}

export function clearCsrfCookie(reply: FastifyReply): void {
  reply.clearCookie(CSRF_COOKIE, { path: '/' });
}