# Deployment Runbook

Production is deployed as a Docker Compose stack (`docker-compose.production.yml`). The stack is: **nginx** (TLS edge + WAF), **web** (static SPA on nginx), **api** (Fastify), **postgres 16**, **redis 7**, **minio** (S3 object storage).

Only nginx sits on the public network; every other service is on an `internal` bridge with no host ports.

## 1. Prerequisites

- Docker Engine 24+ with Compose v2 on the host (Debian/Ubuntu or Alpine).
- A DNS record pointing `mathitis.university.edu` at the host.
- TLS certificates placed at `./certs/fullchain.pem` and `./certs/privkey.pem` (see [TLS](#tls)).
- `nginx.conf` (root) edited so every `server_name` matches your real domain.

## 2. First-time deployment

```bash
# 1. Clone the repository on the host
git clone <repo-url> mathitis && cd mathitis

# 2. Create the production environment from the template
cp .env.production.example .env.production
# ... edit .env.production: generate all secrets, set real SMTP/CDN/domain values
#     (DATABASE_URL host must be "postgres", REDIS_URL host "redis", S3_ENDPOINT "http://minio:9000")

# 3. Create the TLS directory and drop in certificates
mkdir -p certs
# copy fullchain.pem and privkey.pem into ./certs/

# 4. Create the MinIO bucket before starting (the API does not auto-create it)
docker compose -f docker-compose.production.yml run --rm \
  -e "MC_HOST_local=http://${MINIO_ROOT_USER}:${MINIO_ROOT_PASSWORD}@minio:9000" \
  minio mc mb local/mathitis

# 5. Build and start the stack
docker compose -f docker-compose.production.yml up -d --build

# 6. Verify
docker compose -f docker-compose.production.yml ps
curl -fsS https://mathitis.university.edu/api/health
docker compose -f docker-compose.production.yml logs -f api
```

Migrations apply automatically: the API image runs `pnpm db:deploy` (Prisma `migrate deploy`) before starting the HTTP server (see `apps/api/Dockerfile`).

## 3. TLS

- Terminate TLS at the edge nginx container. Certificates are mounted read-only from `./certs/`.
- The edge config pins TLSv1.3, enables HSTS + preload, and a strict CSP. To (re)issue certificates, keep the paths `fullchain.pem` / `privkey.pem` and run `docker compose ... restart nginx`.
- Backend traffic between nginx and the internal services is plain HTTP on the internal-only bridge, which is acceptable because the bridge is not routable from outside.

## 4. Deploying a new release

```bash
git pull
# build args for the web bundle (Sentry) come from the shell environment when present:
VITE_SENTRY_DSN=... VITE_RELEASE=v1.2.3 \
docker compose -f docker-compose.production.yml up -d --build
```

The web bundle is built with `VITE_SENTRY_DSN`/`VITE_RELEASE` baked in via `build.args`; if unset the bundle is built without Sentry. `VITE_RELEASE` should track your git tag (`git describe --tags`).

## 5. Routine operations

```bash
# View status / logs
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f --tail=200 api
docker compose -f docker-compose.production.yml logs -f --tail=100 nginx

# Restart a single service
docker compose -f docker-compose.production.yml restart api

# Backup the database (see 02-database-migrations.md for restore)
docker compose -f docker-compose.production.yml exec -T postgres \
  pg_dump -U $POSTGRES_USER -d $POSTGRES_DB | gzip > backup-$(date +%F).sql.gz

# Daily crontab example (backups + retention)
0 2 * * * cd /opt/mathitis && docker compose -f docker-compose.production.yml exec -T postgres pg_dump -U mathitis_app -d mathitis | gzip > /backups/mathitis-$(date +\%F).sql.gz && find /backups -name '*.sql.gz' -mtime +14 -delete
```

## 6. Troubleshooting

| Symptom | Likely cause / fix |
| :--- | :--- |
| `api` restarts in a loop | Env validation failed at boot — run `docker compose ... logs api` and fix the reported variable. |
| `api` healthy but `/api/health` errors | `WEB_ORIGIN` does not match the public origin, or the nginx `/api/` proxy target is misconfigured. |
| Image uploads 500 | MinIO bucket missing (`mc mb`) or `MINIO_ROOT_USER/PASSWORD` in `.env.production` differs from `S3_ACCESS_KEY/S3_SECRET_KEY`. |
| Redis `NOAUTH` errors | `REDIS_PASSWORD` in `REDIS_URL` does not match the redis `command` password (both read from `.env.production`). |
| Login cookies lost | `WEB_ORIGIN` must be the exact origin users browse on; cookies are scoped to it. |
| HTTPS not responding | Certificates missing/expired under `./certs/` or `server_name` mismatch in `nginx.conf`. |