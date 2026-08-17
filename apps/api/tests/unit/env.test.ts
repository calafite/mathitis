import { describe, expect, it } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const baseEnv = {
  JWT_SECRET: 'x'.repeat(32),
  COOKIE_SECRET: 'y'.repeat(32),
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/mathitis',
  REDIS_URL: 'redis://localhost:6379',
};

describe('loadEnv', () => {
  it('accepts a valid environment', () => {
    const env = loadEnv(baseEnv);
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(4000);
    expect(env.SESSION_MAX_AGE_DAYS).toBe(7);
  });

  it('throws when JWT_SECRET is missing', () => {
    const { JWT_SECRET, ...rest } = baseEnv;
    void JWT_SECRET;
    expect(() => loadEnv(rest)).toThrow(/JWT_SECRET/);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => loadEnv({ ...baseEnv, JWT_SECRET: 'short' })).toThrow(/at least 32 characters/);
  });

  it('throws when DATABASE_URL is invalid', () => {
    expect(() => loadEnv({ ...baseEnv, DATABASE_URL: 'not-a-url' })).toThrow(/DATABASE_URL/);
  });

  it('parses PORT as a number', () => {
    const env = loadEnv({ ...baseEnv, PORT: '3000' });
    expect(env.PORT).toBe(3000);
  });
});