import type { FastifyReply, FastifyRequest } from 'fastify';
import { ForbiddenError } from '../errors.js';
import { getSessionCookie, type SessionManager } from './session.js';

export function createRequireAuth(session: SessionManager) {
  return async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
    const payload = await session.verifySessionCookie(getSessionCookie(request));
    if (!payload) {
      throw new ForbiddenError('Authentication required');
    }
    request.sessionUser = payload;
  };
}