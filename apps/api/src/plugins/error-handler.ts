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
  ['P2025', { code: 'NOT_FOUND', status: 404, message: 'O registro solicitado não existe' }],
  [
    'P2003',
    { code: 'CONFLICT', status: 409, message: 'A operação viola uma restrição de chave estrangeira' },
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

    const validationError = error as {
      validation?: Array<{ instancePath?: string; keyword?: string; message?: string }>;
      statusCode?: number;
      code?: string;
      message?: string;
    };
    if (validationError.validation) {
      // Surface actionable, per-field messages instead of a blanket failure.
      const issues = validationError.validation;
      const fieldMessages = issues
        .map((issue) => {
          const path = (issue.instancePath ?? '').replace(/^\.*/, '');
          return path && issue.message ? `${path}: ${issue.message}` : issue.message;
        })
        .filter((message): message is string => typeof message === 'string' && message.length > 0);
      const message =
        fieldMessages.length > 0
          ? fieldMessages.slice(0, 3).join('; ')
          : 'Falha na validação';
      return reply.code(422).send({
        error: {
          code: 'VALIDATION_ERROR',
          message,
          statusCode: 422,
          details: issues,
        },
      });
    }

    if (validationError.statusCode === 400) {
      return reply.code(400).send({
        error: {
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Requisição inválida',
          statusCode: 400,
        },
      });
    }

    // Preserve 4xx statuses raised by framework plugins (e.g. rate limiting).
    if (validationError.statusCode && validationError.statusCode >= 400 && validationError.statusCode < 500) {
      return reply.code(validationError.statusCode).send({
        error: {
          code: validationError.code ?? 'REQUEST_REJECTED',
          message:
            typeof validationError.message === 'string'
              ? validationError.message
              : 'Requisição rejeitada',
          statusCode: validationError.statusCode,
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
        message: 'Ocorreu um erro inesperado',
        statusCode: 500,
      },
    });
  };
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler(buildErrorHandler());
}
