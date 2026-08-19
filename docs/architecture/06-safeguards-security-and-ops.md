# 06. Safeguards, Security & Operations

This domain covers all operational, security, and quality safeguards: TLS/HTTPS everywhere, Sentry error monitoring, structured logging, rate limiting, idempotency, CI/CD quality gates, and containerized deployment.

---

## 🛡️ Network Edge & TLS Everywhere

### Reverse Proxy (Nginx / Caddy)
```nginx
# Example Nginx security headers
server {
    listen 80;
    server_name mathitis.university.edu;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name mathitis.university.edu;

    ssl_protocols TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # HSTS - 2 years
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # CSP - strict, embed providers whitelisted
    add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-src https://open.spotify.com https://www.youtube.com https://www.youtube-nocookie.com https://steamcommunity.com; frame-ancestors 'none'; upgrade-insecure-requests;" always;

    location / {
        proxy_pass http://api:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /web/ {
        proxy_pass http://web:80/;
        # Static asset caching
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### Firewall & Port Isolation
- **Publicly exposed**: Only ports **80 (HTTP→HTTPS redirect)** and **443 (HTTPS)**.
- **Internal Docker Network**: Fastify (4000), PostgreSQL (5432), Redis (6379), MinIO (9000/9001) communicate exclusively over a private Docker bridge network. No internal ports mapped to host.
- **WAF Rules**: Block common attack patterns (SQLi, XSS, path traversal) at proxy layer before reaching application.

---

## 📊 Sentry Error Monitoring & Observability

### Backend (Fastify)
```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: `mathitis@${process.env.npm_package_version}`,
  beforeSend(event, hint) {
    // Scrub PII before sending to Sentry
    const redacted = redactPII(event);
    return redacted;
  }
});

// Global error handler integration
fastify.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error, {
    extra: {
      method: request.method,
      url: request.url,
      correlationId: request.headers['x-request-id'],
      user: request.session.get('user') ? { id: request.session.user.id, role: request.session.user.role } : undefined
    }
  });
  // Return generic error to client
});
```

### Frontend (React)
```typescript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_NODE_ENV,
  integrations: [new BrowserTracing()],
  tracesSampleRate: 1.0,
  beforeSend(event) {
    // Scrub PII
    return redactPII(event);
  }
});

// Error Boundary wrapping route groups
<Sentry.ErrorBoundary fallback={ErrorFallback} onError={e => Sentry.captureException(e)}>
  <Routes>...</Routes>
</Sentry.ErrorBoundary>
```

---

## 📝 Structured JSON Logging (Pino)

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
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
      '*.token'
    ],
    censor: '[REDACTED]'
  },
  formatters: {
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
      service: 'mathitis-api'
    })
  }
});

// Fastify integration
fastify.addHook('onRequest', (request, reply, done) => {
  request.log = logger.child({
    correlationId: request.headers['x-request-id'] || crypto.randomUUID()
  });
  done();
});
```

- **Correlation IDs**: `x-request-id` header propagated across all services, included in every log line.
- **Log Levels**: `debug`, `info`, `warn`, `error`, `fatal` — configured via `LOG_LEVEL` env var.
- **Log Aggregation**: JSON output ready for Loki, Datadog, Elasticsearch, or stdout in containers.

---

## ⚡ Rate Limiting (Tiered by Sensitivity)

```typescript
import rateLimit from '@fastify/rate-limit';

await fastify.register(rateLimit, {
  global: false, // Apply per-route via route options
  cache: 5000,
  keyGenerator: (req) => req.ip,
  addHeaders: true,
  redis: redisClient // Distributed rate limiting across instances
});

// Route-specific limits
fastify.route({
  method: 'POST',
  url: '/api/auth/login',
  config: { rateLimit: { max: 5, timeWindow: '1 minute' } }
});
fastify.route({
  method: 'POST',
  url: '/api/auth/recover',
  config: { rateLimit: { max: 3, timeWindow: '1 hour' } }
});
fastify.route({
  method: 'POST',
  url: '/api/requests',
  config: { rateLimit: { max: 10, timeWindow: '1 hour', keyGenerator: req => req.session.user?.id || req.ip } }
});
fastify.route({
  method: 'POST',
  url: '/api/profiles/:handle/bump',
  config: { rateLimit: { max: 20, timeWindow: '1 hour', keyGenerator: req => req.session.user?.id || req.ip } }
});
fastify.route({
  method: 'GET',
  url: '/api/seniors',
  config: { rateLimit: { max: 120, timeWindow: '1 minute' } }
});
```

---

## 🔑 Idempotency Key Middleware (Redis, 24-hour TTL)

```typescript
// middleware/idempotency.ts
export async function idempotencyMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const key = request.headers['x-idempotency-key'];
  if (!key || typeof key !== 'string') return; // Optional for idempotent-safe routes

  const cacheKey = `idempotency:${key}`;
  const existing = await redis.get(cacheKey);

  if (existing) {
    const { statusCode, headers, body } = JSON.parse(existing);
    reply.headers(headers).code(statusCode).send(body);
    return reply.halt();
  }

  // Wrap send to cache response
  const originalSend = reply.send.bind(reply);
  reply.send = (payload: any) => {
    if (reply.statusCode >= 200 && reply.statusCode < 300) {
      const cacheValue = JSON.stringify({
        statusCode: reply.statusCode,
        headers: reply.getHeaders(),
        body: payload
      });
      // MANDATORY 24-hour TTL to prevent memory leaks
      await redis.setEx(cacheKey, 86400, cacheValue);
    }
    return originalSend(payload);
  };
}
```

---

## 🧪 CI/CD Pipeline & Quality Gates (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: Continuous Integration
on:
  pull_request:
    branches: [main, develop]

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install Dependencies
        run: pnpm install --frozen-lockfile

      - name: Code Formatting Check
        run: pnpm format:check

      - name: Static Analysis & Linting
        run: pnpm lint

      - name: Type Checking
        run: pnpm typecheck

      - name: Security & Dependency Vulnerability Audit
        run: pnpm audit --audit-level=high

      - name: Unit & Domain Logic Tests
        run: pnpm test:unit

      - name: API Integration Tests
        run: pnpm test:integration

      - name: Frontend Component & E2E Tests
        run: pnpm test:e2e

      - name: Production Build Verification
        run: pnpm build
```

**Required to pass on every PR**:
1. `prettier --check` — code formatting
2. `eslint` — static analysis
3. `tsc --noEmit` — strict TypeScript compilation
4. `pnpm audit --audit-level=high` — dependency vulnerability scan
5. Unit + Integration + E2E tests with coverage reports
6. Production build verification (`apps/web` + `apps/api`)

---

## 🐳 Production Docker & Deployment

### Multi-stage API Dockerfile
```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
COPY . .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./
USER nodejs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/health || exit 1
CMD ["node", "dist/main.js"]
```

### Multi-stage Web Dockerfile (Nginx Static Serving)
```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
COPY . .
RUN pnpm build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
```

### docker-compose.production.yml
```yaml
services:
  api:
    build: ./apps/api
    env_file: .env.production
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks: [internal]

  web:
    build: ./apps/web
    networks: [internal]
    depends_on: [api]

  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./certs:/etc/nginx/certs:ro
    depends_on: [api, web]
    networks: [internal, public]

  postgres:
    image: postgres:16-alpine
    env_file: .env.production
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks: [internal]

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    networks: [internal]

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    env_file: .env.production
    volumes: [minio_data:/data]
    networks: [internal]

networks:
  internal:
    driver: bridge
    internal: true  # No external access
  public:
    driver: bridge

volumes:
  postgres_data:
  minio_data:
```

> The configs above are illustrative summaries. The source of truth is the actual `docker-compose.production.yml`, `apps/api/Dockerfile`, `apps/web/Dockerfile`, and `nginx.conf`. For step-by-step operational procedures (deploy, migrations, secret rotation) see [`docs/operations/`](../operations/README.md).

---

## 🔐 Secrets Management & Startup Validation

```typescript
// apps/api/src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  HOST: z.string().default('0.0.0.0'),

  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars'),
  COOKIE_SECRET: z.string().min(32, 'COOKIE_SECRET must be at least 32 chars'),
  SESSION_MAX_AGE_DAYS: z.coerce.number().default(7),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string(),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),

  SENTRY_DSN: z.string().url().optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),
});

// Validates at process startup — fails fast if invalid
export const env = envSchema.parse(process.env);
```

---

## 🔑 Secret Rotation & Least-Privilege Credentials

1. **Database Roles**:
   - `mathitis_app` — Application runtime: `SELECT`, `INSERT`, `UPDATE`, `DELETE` only. **No DDL**.
   - `mathitis_migrator` — CI/CD pipeline: Full DDL (`CREATE`, `ALTER`, `DROP`) for Prisma migrations.

2. **JWT/Cookie Key Rotation**:
   - Accept key rings/arrays for validation: `JWT_SECRETS=["current", "previous"]`.
   - New keys added to front of array; old keys kept for 1 rotation cycle for seamless expiry.

3. **S3/MinIO Keys**: Rotated via CI/CD secret store; mounted as env vars at runtime.