# Mathitis

Mathitis is a mentorship platform for students. Students can create profiles, discover senior students, send and manage mentorship requests, and follow the resulting mentorship lineage. Profiles support tags, Markdown biographies, social links, rich cards, and uploaded avatars or banners. Administrators manage users, approvals, and system configuration; developers have access to diagnostics and the development mailbox.

The repository is a pnpm monorepo. The API owns authentication, profiles, discovery, mentorship requests, notifications, image processing, and background jobs. The web application is a single-page React client served by Vite in development and nginx in production.

## ~ Stack ~

- Node.js 24 and TypeScript
- pnpm 11 workspaces
- React 18, React Router, Vite, Tailwind CSS
- Fastify 5 with Zod validation
- PostgreSQL 16 with Prisma
- Redis 7 with BullMQ and ioredis
- MinIO or another S3-compatible object store for profile media
- nginx as the production reverse proxy and static web server
- Nodemailer for email delivery
- Sentry for optional API and browser error reporting
- Hugging Face Transformers (`Xenova/all-MiniLM-L6-v2`) for tag embeddings and recommendations
- Vitest and Playwright for tests

## ~ Services & configuration ~

PostgreSQL is the source of truth for accounts, profiles, tags, mentorships, notifications, audit logs, and system configuration. Use PostgreSQL 16 in production, and keep `DATABASE_URL` pointed at the application database rather than an administrative account. The production compose file keeps PostgreSQL on the private Docker network and persists it in the `postgres_data` volume. Apply checked-in migrations with `prisma migrate deploy`; use `prisma migrate dev` only when developing a schema change.

Redis is required even when no optional integrations are configured. It stores rate-limit and session-related state and drives the email and profile-view queues. In production, enable a password and persistence, as the included compose file does. Put the same password in `REDIS_PASSWORD` and in the password-bearing `REDIS_URL`. Do not expose Redis directly to the internet.

Profile images can be stored in MinIO or any S3-compatible service. Set all four of `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, and `S3_SECRET_KEY` to enable object storage. `S3_PUBLIC_BASE_URL` should be the public CDN or reverse-proxy prefix used to read those objects; this avoids returning an internal MinIO hostname to browsers. The application creates the bucket on first use and profile assets are intentionally publicly readable. For local development, S3 can be left unset and files will be written to `UPLOAD_DIR` and served below `/assets/uploads/`. The development helper starts MinIO by default, so the example development environment is configured to use it.

SMTP is optional during development. When `SMTP_HOST` and `SMTP_PORT` are absent, verification and password-reset messages are recorded by the development mailbox and logged instead of being sent. In production, configure an authenticated SMTP relay, choose port 465 for implicit TLS or 587 for the usual submission flow, and set `SMTP_FROM` to an address accepted by that relay. This keeps account flows usable without making local development depend on a mail provider.

Sentry is optional. `SENTRY_DSN` configures API reporting; `VITE_SENTRY_DSN` configures the browser bundle and must be supplied at web build time, not only when the container starts. Set `VITE_RELEASE` to the deployed version when release grouping matters. Keep both values out of source control.

The API rejects invalid configuration at startup. `JWT_SECRET` and `COOKIE_SECRET` must each be at least 32 characters; production should use fresh random values. `WEB_ORIGIN` is the browser origin allowed by CORS and CSRF checks, and should match the public site URL. `PUBLIC_BASE_URL` is used for generated links and local upload URLs. In production, use HTTPS for both. The public production example also includes rate-limit settings; tune them for the expected traffic rather than treating the defaults as capacity targets.

## ~ Dependencies ~

For local development you need Node.js 24, pnpm 11, Docker with the Compose v2 plugin, and a shell capable of running the scripts in `scripts/`. Corepack can provide the pinned pnpm version:

```sh
corepack enable
corepack prepare pnpm@11.24.0 --activate
pnpm install
```

The API's native dependencies (`argon2`, `sharp`, and the Transformers runtime) may require a working C/C++ toolchain on platforms without prebuilt packages. The production API image installs the required build tools during its build stage. Docker is also needed by the integration and end-to-end test environments.

## ~ Development ~

Copy the development environment template and make it available to the API process. The project does not load `apps/api/.env.example` automatically, so source it in the shell that starts the application:

```sh
cp apps/api/.env.example apps/api/.env.local
set -a
source apps/api/.env.local
set +a
```

The example uses PostgreSQL at `localhost:5432`, Redis at `localhost:6379`, and MinIO at `localhost:9000`. Start the complete development environment with:

```sh
pnpm env:dev
```

This starts the infrastructure containers, resets and seeds the database, then starts the API and web development servers. The web client is available at [http://localhost:5173](http://localhost:5173), the API at [http://localhost:4000](http://localhost:4000), and the MinIO console at [http://localhost:9001](http://localhost:9001). The seeded MinIO credentials are `minioadmin` / `minioadmin`, for local use only.

Use `pnpm env:dev --fresh` when the local containers and their volumes should be removed before starting again. This destroys local PostgreSQL and MinIO data. Use `pnpm env:dev --no-seed` to keep the existing database contents and skip the reset and seed steps.

To run the two applications separately after the services are available:

```sh
pnpm --filter @mathitis/api dev
pnpm --filter @mathitis/web dev
```

The Vite server proxies `/api` requests to port 4000. Email links use `WEB_ORIGIN` when it is set and otherwise default to the Vite development origin. Without SMTP, developer accounts can inspect generated messages through the developer mailbox endpoints.

The seed command creates default tags and configuration, along with these local accounts. All seeded accounts use `TestPassword123!`; do not use these credentials outside development:

```text
developer@mathitis.dev  developer
admin@mathitis.dev       administrator
satanyahu@cs.uni.edu     senior
nycodemonius@cs.uni.edu  senior
joaopedrosasa@cs.uni.edu senior
```

## ~ Production ~

Copy the production template, replace every placeholder, and provide TLS certificates for nginx in `certs/fullchain.pem` and `certs/privkey.pem`:

```sh
cp .env.production.example .env.production
openssl rand -base64 48
```

Set a real `WEB_ORIGIN`, `PUBLIC_BASE_URL`, and `S3_PUBLIC_BASE_URL` for the deployed hostname. The production compose file assumes the internal service names `postgres`, `redis`, and `minio`; keep those hostnames in `DATABASE_URL`, `REDIS_URL`, and `S3_ENDPOINT`. Review the nginx `server_name` and certificate paths if deploying under another domain.

Start the stack with:

```sh
pnpm env:prod
```

The script builds the API and web images, starts nginx, PostgreSQL, Redis, and MinIO, waits for the stateful services to become healthy, and runs pending Prisma migrations inside the API container. Only nginx is published on ports 80 and 443; the application services remain on the internal Docker network. Persistent data lives in the `postgres_data` and `minio_data` volumes, which should be backed up as part of operations.

## ~ Database commands ~

With `DATABASE_URL` exported, the following commands are available:

```sh
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

`db:migrate` is intended for local development and may prompt to create a migration. Production uses the API image's `prisma migrate deploy` step. `db:seed` is repeatable for the default records but creates development accounts, so do not run it against a production database unless that is explicitly intended.

## ~ Tests & checks ~

```sh
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
```

Integration and browser tests start their own PostgreSQL and Redis containers and therefore require Docker. Unit tests do not need the full application stack. `pnpm audit` is available for dependency checks.

## ~ Repository layout ~

`apps/api` contains the Fastify server, Prisma schema and migrations, background workers, and API tests. `apps/web` contains the React client and browser tests. `packages/schemas` holds shared request and response schemas, while `packages/config` contains shared TypeScript configuration. `scripts/` contains the development and production orchestration helpers.
