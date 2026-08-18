# Phase 5: Real-Time Notifications, Error Monitoring, Network Firewall & Security Hardening

## Objective
Implement in-app and background email notifications with BullMQ, integrate Sentry error monitoring across frontend and backend, establish comprehensive administrative audit logging, and enforce production network security hardening (TLS/HTTPS everywhere, WAF filtering, port exposure hardening, and strict CSP).

## Tasks
- [ ] **5.1 Notification System & Resilient Background Workers**
  - Implement notifications database queries and API endpoints (`GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`).
  - Implement Redis + BullMQ background queue for asynchronous email notification dispatch (e.g. on new request received, request accepted/rejected, admin decision).
  - Add resilient background worker error handling: automatic retries with exponential backoff and jitter, dead-letter queue (DLQ) for failed notifications, and worker telemetry logging.
  - Build frontend Notification Center with dropdown badge, real-time polling or WebSocket/SSE listener, unread counters, and sound/toast alerts.
- [ ] **5.2 Sentry Error Monitoring & Observability Integration**
  - Configure **Sentry Node SDK** in Fastify server with global exception handler, request context capture (method, URL, correlation ID, redacted headers/body), environment tagging (`development`, `staging`, `production`), and release versioning.
  - Configure **Sentry React SDK** on the frontend with React Error Boundaries wrapping route groups, tracking uncaught exceptions, network errors, and browser environment diagnostics.
  - Verify that no sensitive data (passwords, tokens, student emails) is sent to Sentry via `beforeSend` scrubbing filters.
- [ ] **5.3 Comprehensive Audit Logging Framework**
  - Implement backend audit middleware intercepting all administrative and sensitive state modifications.
  - Store IP address, actor ID, action type, target entity, target ID, and before/after JSON diffs in `audit_logs`.
  - Build Admin Audit Log viewer interface with filterable timeline, date range picker, and payload inspection modal.
- [ ] **5.4 TLS/HTTPS Everywhere, Firewall & Minimal Port Exposure**
  - Configure reverse proxy (Nginx/Caddy) to enforce **TLS 1.3 only**, automatic HTTP-to-HTTPS redirection, and HSTS (`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`).
  - Configure Firewall & Port Isolation: Only ports 80/443 exposed publicly. Internal Fastify API, PostgreSQL, and Redis communicate exclusively over isolated internal Docker networks.
  - Apply HTTP security headers using `@fastify/helmet` with a strict Content Security Policy (CSP) allowing only whitelisted embed providers (Spotify, YouTube, Steam).
- [x] **5.5 Rate Limiting & Secret Rotation**
  - Configure `@fastify/rate-limit` with tiered limits:
    - Auth endpoints: max 5 requests/minute per IP.
    - Request creation & Bumps: max 10 requests/hour per user.
    - Public discovery & profile browsing: max 120 requests/minute.
  - Configure strict CORS options and anti-CSRF token verification on state-changing requests.
  - Implement secret rotation support for JWT/session cookies via multi-key validation keyrings.
