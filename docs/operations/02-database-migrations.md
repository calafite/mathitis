# Database Migration Runbook

Schema is managed with **Prisma Migrate**. Migration files live in `apps/api/prisma/migrations/` and are versioned in git.

## 1. How migrations are applied

- The production API container runs `pnpm db:deploy` (`prisma migrate deploy`) as its entrypoint before starting the HTTP server (`apps/api/Dockerfile`).
- `migrate deploy` applies only pending migrations, in order, and records them in `_prisma_migrations`. It never generates or asks for confirmation.
- Because every API container runs it on boot, ensure you have **exactly one replica** starting at a time during a release, or run the deploy step once manually and then scale out (see [Zero-downtime deploy](#5-zero-downtime-deploy)).

## 2. Creating a new migration

Work against a local/dev database, never production:

```bash
cd apps/api
# 1. Edit prisma/schema.prisma, then generate the migration
pnpm db:generate
pnpm exec prisma migrate dev --name describe_the_change

# 2. Review the generated SQL in apps/api/prisma/migrations/<timestamp>_describe_the_change/migration.sql
# 3. Commit the migration folder with the schema change
```

Prisma Migrate requires a shadow database for `migrate dev`; set `SHADOW_DATABASE_URL` in your local env or give the dev user `CREATEDB` privileges.

## 3. Deploying a migration

```bash
# Option A - automatic: the API applies pending migrations on boot
git pull && VITE_SENTRY_DSN=... VITE_RELEASE=v1.3.0 \
  docker compose -f docker-compose.production.yml up -d --build api

# Option B - manual, when you must control the moment of application
docker compose -f docker-compose.production.yml exec -T api \
  pnpm --filter @mathitis/api db:deploy
```

Always **back up the database before a migration**:

```bash
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U $POSTGRES_USER -d $POSTGRES_DB | gzip > pre-migrate-$(date +%F-%H%M).sql.gz
```

## 4. Rolling back a migration

Prisma Migrate does not support `migrate down`. Recover instead:

```bash
# 1. Restore the pre-migration dump
docker compose -f docker-compose.production.yml exec -T postgres \
  gunzip -c pre-migrate-<timestamp>.sql.gz | \
  docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U $POSTGRES_USER -d $POSTGRES_DB

# 2. Remove the offending migration folder from apps/api/prisma/migrations/
#    and redeploy so migrate deploy no longer sees it
```

If the migration partially applied, `prisma migrate resolve --rolled-back <migration_name>` marks it applied-failed so a redeploy can proceed. Treat destructive changes (drops, irrecoverable column type changes) as forward-only: prefer additive migrations plus a data-fix migration.

## 5. Zero-downtime deploy

Additive, non-breaking migrations (new tables, nullable columns, new indexes) are safe to apply while the old API is running:

```bash
# 1. Apply migrations to the running database first
docker compose -f docker-compose.production.yml exec -T api \
  pnpm --filter @mathitis/api db:deploy

# 2. Then roll the API image over
docker compose -f docker-compose.production.yml up -d --build api
```

For breaking migrations (column renames, NOT NULL additions), apply the migration, release the new API, and clean up legacy columns in a follow-up migration. Do not combine data-mutating steps with column drops in one release.

## 6. Restore from backup

```bash
# Stop API writes briefly (optional but safer)
docker compose -f docker-compose.production.yml stop api

# Drop and recreate the database, then restore
docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U $POSTGRES_USER -d postgres -c "DROP DATABASE $POSTGRES_DB"
docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $POSTGRES_DB"
docker compose -f docker-compose.production.yml exec -T postgres \
  gunzip -c /backups/mathitis-<date>.sql.gz | \
  docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U $POSTGRES_USER -d $POSTGRES_DB

docker compose -f docker-compose.production.yml start api
```

## 7. Seeding

`pnpm db:seed` (`tsx prisma/seed.ts`) creates the demo users and is intended for development/E2E only. Do not run it against production.