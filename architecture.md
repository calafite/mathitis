# Mathitis — Architecture Entry Point

This repository follows a **modular architecture documentation** strategy. The canonical domain specifications live in `docs/architecture/`.

---

## 📁 Domain Architecture Files

| # | File | Domain Scope | Start Here For Tasks Involving... |
|---|------|--------------|-----------------------------------|
| 1 | [`docs/architecture/01-auth-and-identity.md`](docs/architecture/01-auth-and-identity.md) | Auth, User Tokens, Soft Deletes, Email Verification, RBAC | Login, Register, Recovery, Sessions, Roles, Account Deletion |
| 2 | [`docs/architecture/02-profile-and-expressive-studio.md`](docs/architecture/02-profile-and-expressive-studio.md) | Profiles, Themes, Markdown Engine, Rich Cards, Sharp Uploads | Profile Customization, Banners, Avatars, Cards, Markdown |
| 3 | [`docs/architecture/03-discovery-matching-and-requests.md`](docs/architecture/03-discovery-matching-and-requests.md) | Search, Algorithmic Matching, Bumps, Requests, Concurrency | Discovery Catalog, Matching Engine, Bumps, Requests |
| 4 | [`docs/architecture/04-mentorships-and-lineage-graph.md`](docs/architecture/04-mentorships-and-lineage-graph.md) | Mentorships (Family-like), Lineage Graph, Anonymization | Mentorships, Lineage Trees, User Deletion, Co-mentees |
| 5 | [`docs/architecture/05-admin-and-developer-portals.md`](docs/architecture/05-admin-and-developer-portals.md) | Admin Config, Path Protection, Telemetry, Audit Logs | System Config, Admin Dashboard, Developer Portal |
| 6 | [`docs/architecture/06-safeguards-security-and-ops.md`](docs/architecture/06-safeguards-security-and-ops.md) | TLS, WAF, Sentry, Pino, Idempotency TTL, CI/CD, Docker | Sentry, Logging, TLS, Rate Limiting, CI/CD, Docker |

---

## 🧭 Quick Navigation

**Index & Agent Guide**: [`docs/architecture/README.md`](docs/architecture/README.md) — contains the 10 non-negotiable invariants and task-to-file mapping.

**Design Rules**: [`design.md`](design.md) — coding standards, patterns, conventions, and execution requirements.

**Implementation Phases**: `tasks/phase-1-foundation-and-auth.md` through `tasks/phase-6-testing-and-deployment.md`

---

## ⚡ The 10 Invariants (Must Adhere in All Work)

1. **Soft Delete for Lineage** — No hard deletes on `users`; `deleted_at` + anonymize; `mentorships` FKs `ON DELETE RESTRICT`.
2. **Freshman Privacy** — `is_discoverable = false` by default; revealed only to target senior on request submission.
3. **Server-Side Image Pipeline** — No direct S3 uploads; Fastify → Sharp (EXIF strip + WebP) → S3.
4. **Permanent Mentorships** — No completion/termination; `mentorship_status = ('active')` only.
5. **Partial Unique Request Index** — `UNIQUE(freshman_id, senior_id) WHERE status IN ('pending', 'pending_admin_approval', 'accepted')`.
6. **Bump Limit (4)** — Max 4 active bumps per freshman; reallocation = DELETE + INSERT in transaction.
7. **Email Enumeration Prevention** — `POST /auth/recover` & `POST /auth/register` always return `200 OK` identical body.
8. **Idempotency TTL** — `X-Idempotency-Key` Redis entries **must** have 24-hour TTL (`SETEX key 86400`).
9. **Strict Path Protection** — `/admin/*` & `/dev/*` guarded by `<RoleGuard />` + Fastify pre-handler hooks (403 + audit log).
10. **Zod Boundary Validation** — Startup env validation (`env.schema.ts`); all HTTP input validated at edge before domain logic.

---

## 🛠️ Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Radix UI, TanStack Query v5, Zustand, React Hook Form + Zod, React Flow/D3, Framer Motion, Sentry |
| **Backend** | Fastify, TypeScript, Prisma ORM, PostgreSQL 16, Redis + BullMQ, Argon2id, Pino, Sentry, Zod schemas |
| **Edge** | Nginx/Caddy (TLS 1.3, HSTS, CSP, WAF), MinIO/S3 |
| **CI/CD** | GitHub Actions (format → lint → typecheck → test → build → audit) |
| **Deploy** | Multi-stage Docker (non-root), docker-compose (internal networks), health checks |

---

> For detailed specifications, always read the relevant domain file in `docs/architecture/` before implementing changes.