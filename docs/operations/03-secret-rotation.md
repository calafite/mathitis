# Secret Rotation Runbook

Secrets live in `.env.production` (repo root) and are read by the API and infra containers. Every value is validated at API boot; invalid/missing values abort startup.

**Impact summary**

| Secret | Rotation impact | Zero-downtime? |
| :--- | :--- | :--- |
| `JWT_SECRET` | Signs all sessions; old JWTs stay valid via `JWT_KEYRING` | Yes |
| `COOKIE_SECRET` | Invalidates all signed session cookies (everyone logged out) | No |
| `REDIS_PASSWORD` | Blocks redis clients until all services updated | No (brief blip) |
| `POSTGRES_PASSWORD` | Blocks new DB connections until all services updated | No (brief blip) |
| `S3_SECRET_KEY` / `MINIO_ROOT_PASSWORD` | Uploads fail until updated | No (brief blip) |
| `SMTP_PASS` | Emails fail until updated | No (brief blip) |

Generate new secrets with:

```bash
openssl rand -base64 48   # 64 chars, suitable for all secrets above
```

## 1. Rotating `JWT_SECRET` (preferred: keep sessions alive)

`JWT_KEYRING` lists the previous secret(s) that are still accepted for verifying JWTs. `JWT_SECRET` is used for both signing and verifying.

```bash
# 1. Before rotating, place the CURRENT secret into the keyring
#    JWT_KEYRING accepts a comma-separated list or a JSON array.
#    Put the current JWT_SECRET value into JWT_KEYRING, e.g.:
#    JWT_KEYRING="<current JWT_SECRET value>"

# 2. Replace JWT_SECRET with a new value, keep JWT_KEYRING as-is
JWT_SECRET=$(openssl rand -base64 48)

# 3. Restart the API
docker compose -f docker-compose.production.yml up -d --build api

# 4. New sessions use the new secret; old sessions verify against the keyring.
#    After the previous secret's sessions have all expired (SESSION_MAX_AGE_DAYS),
#    remove the old value from JWT_KEYRING and redeploy once more.
```

If an emergency forced logout is required instead, rotate `JWT_SECRET` **without** a keyring entry.

## 2. Rotating `COOKIE_SECRET` (forces logout)

The cookie plugin signs session cookies with `COOKIE_SECRET`; there is no legacy keyring, so this signs everyone out.

```bash
COOKIE_SECRET=$(openssl rand -base64 48)
docker compose -f docker-compose.production.yml up -d --build api
# All users must log in again. Do this during a maintenance window.
```

## 3. Rotating `REDIS_PASSWORD`

`REDIS_PASSWORD` appears twice: in the redis container command (`--requirepass`) and inside `REDIS_URL` (`redis://:<password>@redis:6379`). They must match.

```bash
NEW=$(openssl rand -base64 48)
# 1. Set REDIS_PASSWORD=$NEW AND REDIS_URL="redis://:$NEW@redis:6379" in .env.production
# 2. Recreate redis first, then the API (order matters):
docker compose -f docker-compose.production.yml up -d redis
docker compose -f docker-compose.production.yml up -d --build api
```

Expected: a brief window where API clients that still hold the old password log `NOAUTH`/`WRONGPASS`; clear within one `up -d` cycle.

## 4. Rotating `POSTGRES_PASSWORD`

```bash
NEW=$(openssl rand -base64 48)
# 1. Update the password inside the running postgres container
docker compose -f docker-compose.production.yml exec -T postgres \
  psql -U $POSTGRES_USER -d postgres -c "ALTER USER $POSTGRES_USER WITH PASSWORD '$NEW'"
# 2. Update POSTGRES_PASSWORD and DATABASE_URL in .env.production (password embedded in the URL)
# 3. Recreate api (and any other consumer) to pick up the new credentials
docker compose -f docker-compose.production.yml up -d --build api
```

## 5. Rotating S3 / MinIO credentials

`S3_ACCESS_KEY`/`S3_SECRET_KEY` (API side) must match MinIO's `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`.

```bash
NEW_PASS=$(openssl rand -base64 48)
# 1. Set MINIO_ROOT_PASSWORD=$NEW_PASS and S3_SECRET_KEY=$NEW_PASS in .env.production
#    (MINIO_ROOT_USER and S3_ACCESS_KEY must stay equal to each other)
# 2. Recreate minio (new root password takes effect), then the API
docker compose -f docker-compose.production.yml up -d minio
docker compose -f docker-compose.production.yml up -d --build api
```

Note: recreating minio keeps `minio_data` volume contents intact; the bucket and objects persist.

## 6. Rotating `SMTP_PASS`

```bash
SMTP_PASS=$(openssl rand -base64 48)
docker compose -f docker-compose.production.yml up -d --build api
```

## 7. General hygiene

- Never commit `.env.production`; it is gitignored. Only `.env.production.example` (placeholder values) is tracked.
- Keep the previous `JWT_SECRET` in a password manager for at least `SESSION_MAX_AGE_DAYS` before discarding it.
- After any rotation, confirm with `curl -fsS https://<host>/api/health` and a real login/upload smoke test.