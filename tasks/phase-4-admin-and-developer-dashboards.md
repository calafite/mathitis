# Phase 4: Administrator Command Center & Developer Telemetry Portal

## Objective
Build administrative control centers for system configuration (including runtime approval workflow toggles and season matching windows), user moderation with soft-delete/anonymization for lineage preservation, request override queues, and technical developer diagnostics without exposing user PII, backed by immutable audit logs, strict path protection, and backend role verification.

## Tasks
^- [x] **4.1 Dynamic System Configuration Module & Audit Logging**
  - Implement `GET` and `PATCH /api/admin/config` endpoints with strict RBAC guards (`administrator` role only).
  - Support dynamic system flags:
    - `REQUIRE_ADMIN_REQUEST_APPROVAL`: Toggle between direct senior acceptance and mandatory admin sign-off.
    - `REGISTRATION_ENABLED` & `DISCOVERY_ACTIVE`: Manage matching season active windows (close discovery once matches are finalized).
    - `MAX_FRESHMAN_REQUESTS`, `MAX_SENIOR_MENTEES`, `EMAIL_NOTIFICATIONS_ENABLED`.
  - Ensure every configuration change triggers an automatic, structured audit log recording actor ID, target entity, before/after JSON diffs, and client IP.
^- [x] **4.2 User & Content Moderation API (Soft Delete for Lineage Preservation)**
  - Build `GET /api/admin/users` with filters by role, status, semester, and search query (surfacing both Seniors and Freshmen accounts).
  - Implement status override endpoints (`PATCH /api/admin/users/:id/status`) for account suspension and reactivation.
  - **No hard delete**: Implement `PATCH /api/admin/users/:id/anonymize` — sets `users.deleted_at = NOW()`, anonymizes `profiles` (handle → `user_<uuid>`, clears bio/cards/contact), preserves `mentorships` FK integrity for lineage graph.
  - Implement profile content moderation actions (clearing inappropriate banners, bios, or rich cards) with audit logging.
  - Build Admin approval queue endpoints (`GET /api/admin/approvals`, `POST /api/admin/approvals/:id/decide`) for pending requests.
^- [x] **4.3 Developer Diagnostics & Telemetry API (Least-Privilege & Exposure Auditing)**
  - Implement `/api/dev/health` and `/api/dev/metrics` endpoints guarded by `developer` and `administrator` roles.
  - Integrate BullMQ queue status inspector (active, failed, completed jobs, throughput), memory telemetry, process uptime, and database connection pool stats (active vs idle connections).
  - Add firewall & port exposure telemetry checks (verifying that only public ports 80/443 are reachable externally).
  - Ensure strict isolation: zero exposure of user PII (student emails, bios, contact details) on developer routes via backend authorization guards and response data filters.
^- [x] **4.4 Strict Path Protection & Admin Frontend Portals**
  - Enforce frontend route protection: All `/admin/*` and `/dev/*` routes wrapped in `<RoleGuard allowedRoles={[...]} />` redirecting unauthenticated users to `/login`.
  - Enforce backend route protection: Fastify pre-handler hooks blocking non-admin/non-dev requests with HTTP 403 Forbidden and audit log triggers.
  - Build Admin Layout with sidebar navigation, matching season analytics, and quick metric overview cards.
  - Build User Management Table with search, filter, and moderation modal triggers (including "Anonymize User" action with lineage warning).
  - Build System Configuration settings UI panel with immediate persistence and optimistic UI feedback.
  - Build Developer Diagnostics portal showing live system telemetry, queue counters, and error stream previews.
  - Wrap administrative and developer modules with localized React Error Boundaries integrated with Sentry.
