/**
 * Minimal structural logger used by services/workers so they accept both
 * pino's Logger and Fastify's FastifyBaseLogger without type friction.
 */
export interface LoggerLike {
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}
