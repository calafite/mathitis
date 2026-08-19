import { defineConfig } from '@playwright/test';

const API_PORT = 4000;
const WEB_PORT = 5173;
const DB_URL = 'postgresql://mathitis_app:test_password@localhost:5434/mathitis_e2e';

const apiEnv = {
  NODE_ENV: 'development',
  PORT: String(API_PORT),
  HOST: '0.0.0.0',
  DATABASE_URL: DB_URL,
  REDIS_URL: 'redis://localhost:6381',
  JWT_SECRET: 'e2e_jwt_secret_that_is_at_least_32_characters_long',
  COOKIE_SECRET: 'e2e_cookie_secret_that_is_at_least_32_characters_long',
  SESSION_MAX_AGE_DAYS: '7',
  PUBLIC_BASE_URL: `http://localhost:${API_PORT}`,
  WEB_ORIGIN: `http://localhost:${WEB_PORT}`,
  RATE_LIMIT_GLOBAL_MAX: '100000',
  RATE_LIMIT_AUTH_MAX: '100000',
  RATE_LIMIT_REQUEST_MAX: '100000',
  UPLOAD_DIR: '/tmp/mathitis-e2e-uploads',
  LOG_LEVEL: 'warn',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @mathitis/api exec tsx src/main.ts',
      url: `http://localhost:${API_PORT}/health`,
      env: apiEnv,
      timeout: 120_000,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm exec vite --port 5173',
      url: `http://localhost:${WEB_PORT}`,
      timeout: 120_000,
      reuseExistingServer: false,
    },
  ],
});
