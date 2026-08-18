import * as Sentry from '@sentry/node';
import type { SessionPayload } from '../plugins/session.js';
import { API_VERSION } from './version.js';

export interface SentryOptions {
  dsn?: string;
  environment: string;
}

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|authorization|cookie|apikey|api[-_]?key|email|jwt|session)/i;
const SENSITIVE_VALUE_PATTERN = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;

function scrubValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return '[REDACTED]';
  }
  if (typeof value === 'string' && SENSITIVE_VALUE_PATTERN.test(value)) {
    return '[REDACTED]';
  }
  return value;
}

function scrub(entry: unknown, key = ''): unknown {
  if (Array.isArray(entry)) {
    return entry.map((item) => scrub(item, key));
  }
  if (entry && typeof entry === 'object') {
    const out: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(entry)) {
      out[childKey] = scrub(childValue, childKey);
    }
    return out;
  }
  return scrubValue(key, entry);
}

export { scrub };

/**
 * Sentry middleware for the Fastify app. Initializes the Node SDK only when a
 * DSN is configured and installs a `beforeSend` filter that scrubs passwords,
 * tokens, authorization/cookie headers, and student email addresses before any
 * event leaves the process.
 */
export function initSentry(options: SentryOptions): boolean {
  if (!options.dsn) return false;
  Sentry.init({
    dsn: options.dsn,
    environment: options.environment,
    release: API_VERSION,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      return scrub(event) as Sentry.ErrorEvent;
    },
  });
  return true;
}

export interface RequestErrorContext {
  method: string;
  url: string;
  correlationId: string;
  sessionUser?: SessionPayload;
}

/**
 * Captures an unexpected error with request context (method, URL, correlation
 * ID) and id-only user identity. Context is attached per-capture instead of on
 * the shared scope so concurrent requests never leak context into each other.
 */
export function captureRequestError(error: unknown, context: RequestErrorContext) {
  Sentry.captureException(error, {
    tags: {
      'request.method': context.method,
      'request.url': context.url,
      correlation_id: context.correlationId,
    },
    user: context.sessionUser ? { id: context.sessionUser.sub } : undefined,
  });
}
