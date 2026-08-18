import { Prisma } from '@prisma/client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../errors.js';
import { captureRequestError } from '../lib/sentry.js';

const knownPrismaCodes = new Map<string, { code: string; status: number; message: string }>([
  [
    'P2002',
    {
      code: 'CONFLICT',
      status: 409,
      message: 'A record with the same unique value already exists',
    },
  ],
  ['P2025', { code: 'NOT_FOUND', status: 404, message: 'The requested record does not exist' }],
  [
    'P2003',
    { code: 'CONFLICT', status: 409, message: 'The operation violates a foreign key constraint' },
  ],
]);

export function buildErrorHandler() {
  return async function errorHandler(error: unknown, request: FastifyRequest, reply: FastifyReply) {
    if (error instanceof DomainError) {
      return reply.code(error.status).send({
        error: {
          code: error.code,
          message: error.message,
          statusCode: error.status,
        },
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const known = knownPrismaCodes.get(error.code);
      if (known) {
        request.log.warn({ prismaCode: error.code }, 'Prisma request error');
        return reply.code(known.status).send({
          error: {
            code: known.code,
            message: known.message,
            statusCode: known.status,
          },
        });
      }
    }

    const validationError = error as { validation?: Array<{ instancePath?: string; keyword?: string; message?: string }>; statusCode?: number };
    if (validationError.validation) {
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          statusCode: 422,
          details: validationError.validation,
        },
      });
    }

    if (validationError.statusCode === 400) {
      return reply.code(400).send({
        error: {
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Bad request',
          statusCode: 400,
        },
      });
    }

    request.log.error({ err: error }, 'Unhandled error');
    captureRequestError(error, {
      method: request.method,
      url: request.url,
      correlationId: request.correlationId,
      sessionUser: request.sessionUser ?? undefined,
    });
    reply.code(500).send({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        statusCode: 500,
      },
    });
  };
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(buildErrorHandler());
}
