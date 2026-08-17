import { randomUUID } from 'node:crypto';
import pino from 'pino';

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.passwordHash',
  'req.body.token',
  'req.body.email',
  'req.body.contactEmail',
  '*.password',
  '*.passwordHash',
  '*.email',
  '*.contactEmail',
  '*.token',
];

export function createLogger(logLevel: string) {
  if (logLevel === 'silent') {
    return pino({ level: 'silent' });
  }
  return pino({
    level: logLevel,
    redact: {
      paths: redactPaths,
      censor: '[REDACTED]',
    },
    formatters: {
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        service: 'mathitis-api',
      }),
    },
  });
}

export function requestLogger(logLevel: string) {
  return pino(
    {
      level: logLevel,
      redact: {
        paths: redactPaths,
        censor: '[REDACTED]',
      },
      formatters: {
        bindings: (bindings) => ({
          pid: bindings.pid,
          hostname: bindings.hostname,
          service: 'mathitis-api',
        }),
      },
    },
    pino.destination({ sync: false }),
  );
}

export function createCorrelationId(headerValue: string | undefined): string {
  if (headerValue && typeof headerValue === 'string' && headerValue.length <= 128) {
    return headerValue;
  }
  return randomUUID();
}
