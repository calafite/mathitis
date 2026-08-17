import type { FastifyReply, FastifyRequest } from 'fastify';
import type { UserRole } from '@mathitis/schemas';
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

export function createRequireRole(session: SessionManager, roles: UserRole[]) {
  return async function requireRole(request: FastifyRequest, _reply: FastifyReply) {
    const payload = await session.verifySessionCookie(getSessionCookie(request));
    if (!payload) {
      throw new ForbiddenError('Authentication required');
    }
    if (!roles.includes(payload.role)) {
      throw new ForbiddenError('You do not have permission to perform this action');
    }
    request.sessionUser = payload;
  };
}