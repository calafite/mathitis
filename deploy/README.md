# Production Deployment

## Topology

Only the edge nginx container is reachable from the internet. Everything else
sits on the `internal` Docker network which has **no external access and no
host port mappings**.

```
Internet ──> host firewall (only 80/443) ──> nginx (TLS 1.3 edge)
                                                 ├── /            -> web:80   (built SPA, nginx static)
                                                 ├── /api/        -> api:4000 (Fastify)
                                                 └── /assets/uploads/ -> api:4000
```

- Postgres (5432), Redis (6379), MinIO (9000/9001), Fastify (4000) and the web
  container are never mapped to host ports.
- The `internal` network is `internal: true`, so no service on it can reach
  the internet either; the edge nginx sits on both `internal` and `public`.

## Firewall (host)

Allow only the TLS edge ports; deny everything else.

```sh
ufw default deny incoming
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

## TLS certificates

Place a certificate chain and key for your domain in `./certs/`:

```
certs/fullchain.pem
certs/privkey.pem
```

## Configure & launch

```sh
cp .env.production.example .env.production   # fill in real secrets
docker compose -f docker-compose.production.yml build
docker compose -f docker-compose.production.yml up -d
docker compose -f docker-compose.production.yml logs -f api
```

The API runs `prisma migrate deploy` before starting, so migrations apply
automatically on first boot.

## Verification

```sh
curl -sI https://pasteldemiolos.xyz | grep -i strict-transport-security
# Strict-Transport-Security: max-age=63072000; includeSubDomains; preload

curl -s https://pasteldemiolos.xyz/health
# {"status":"ok",...}
```

## Security headers applied

At the edge nginx: HSTS (2y, preload), X-Frame-Options DENY, nosniff,
Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy, and a
strict CSP whose only frame sources are the whitelisted embed providers
(Spotify, YouTube, YouTube nocookie, Steam). The Fastify API applies the same
policy via `@fastify/helmet` as a second layer.

## WAF

`nginx.conf` blocks common SQLi / XSS / path-traversal patterns with a
`map` + `return 403` before requests reach the application. Harden further
with ModSecurity/OWASP CRS if required.
