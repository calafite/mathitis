# Mathitis Operations Runbooks

Operational guides for deploying, migrating, and operating the **Mathitis** platform in production.

| Runbook | Purpose |
| :--- | :--- |
| [`01-deployment.md`](./01-deployment.md) | First-time and routine production deployment with Docker Compose |
| [`02-database-migrations.md`](./02-database-migrations.md) | Applying Prisma migrations safely and rolling back |
| [`03-secret-rotation.md`](./03-secret-rotation.md) | Rotating secrets, keys, and credentials with zero downtime |

## Core invariants (see `docs/architecture/06-safeguards-security-and-ops.md`)

- The API validates every environment variable at boot via Zod (`apps/api/src/config/env.ts`) — a missing or malformed value aborts startup.
- The API container runs Prisma `db:deploy` before `node dist/main.js`, so schema migrations apply automatically on a fresh start.
- Uploads go through the API (Sharp sanitization) into MinIO/S3; the bucket must pre-exist (the API does not create it).
- `JWT_SECRET` and `COOKIE_SECRET` must be at least 32 characters; the API refuses to start otherwise.