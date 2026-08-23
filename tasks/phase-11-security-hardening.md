# Phase 11: Security Hardening Backlog

## Objective
Close remaining hardening gaps: disable directory listing at the web-server layer, lock accounts after repeated failed logins, and invalidate all active sessions when a password changes.

## Tasks
- [ ] **11.1 Disable directory listing**
  - Ensure nginx never auto-indexes directories: set `autoindex off;` explicitly in the `http` block of `nginx.conf` (it is off by default, but make it explicit for auditability).
  - Verify no location block serves a filesystem path directly (all locations proxy to `web`/`api` containers); if any static root is ever added, confirm `autoindex off` and absence of `index` directives that would generate listings.
  - Add a smoke check to the deployment runbook (`docs/operations/01-deployment.md`): `curl -s https://pasteldemiolos.xyz/assets/uploads/ | grep -qi '<title>Index of' && fail`.
  - Return `403`/`404` (never a listing) for directory-style requests.

- [ ] **11.2 Account lockout after repeated failed logins**
  - Track failed login attempts per account (and per IP) in Redis: key `login:fail:{userId}` and `login:fail:ip:{ip}`, incrementing on each failed `POST /api/auth/login`.
  - Lock the account for a cool-down window (e.g. 15 minutes) after N consecutive failures (e.g. 5); return a generic error identical to invalid-credentials (no enumeration signal) but skip the Argon2id verification while locked.
  - Reset the failure counter on successful login.
  - Emit an audit log entry (`account.lockout`) when a lock is triggered, and notify the user by e-mail if `EMAIL_NOTIFICATIONS_ENABLED` is on.
  - Make thresholds configurable via env (`LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`) in `env.schema.ts` with sane defaults.
  - Tests: unit (counter/lock/expiry logic) + integration (5 failures → 6th attempt rejected even with correct password; counter resets after success).

- [ ] **11.3 Invalidate sessions on password change**
  - Introduce a per-user `sessionEpoch` (integer column on `users` via Prisma migration, or a Redis key `session:epoch:{userId}`).
  - Embed the epoch in the session JWT payload (`session.ts`) and reject tokens whose epoch does not match the current one during `verifySessionCookie`.
  - Bump the epoch whenever a password changes: `POST /api/account/change-password`, `POST /api/auth/reset-password`, and admin-forced suspensions/anonymization.
  - After a self-service password change, immediately issue a fresh session cookie for the current device (so the user stays logged in) while all other devices are logged out.
  - Tests: integration — change password → old cookie rejected with 401, new cookie works; reset-password via token → all sessions invalidated.

## Verification
- Full quality gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm test:integration`, `pnpm --filter @mathitis/web test:e2e`.
- Manual nginx checks from a clean container: directory listing returns 403/404; locked account cannot log in even with correct credentials until the cool-down expires.
