# Mathitis Architecture Index & Agent Navigation Guide

Welcome to the **Mathitis** architectural documentation. This index guides developers and AI agents through the domain-specific architectural specifications.

---

## 🧭 Agent Navigation & Domain Map

When assigned a task, consult the corresponding domain architecture file **before** making changes:

```
docs/architecture/
├── 01-auth-and-identity.md             # Auth, User Tokens, Soft Deletes, Email Verification, RBAC
├── 02-profile-and-expressive-studio.md # Profiles, Themes, Markdown Engine, Rich Cards, Sharp Uploads
├── 03-discovery-matching-and-requests.md # Search, Algorithmic Matching, Bumps, Requests, Concurrency
├── 04-mentorships-and-lineage-graph.md   # Mentorships (Family-like), Lineage Graph, Anonymization
├── 05-admin-and-developer-portals.md   # Admin Config, Path Protection, Telemetry, Audit Logs
└── 06-safeguards-security-and-ops.md   # TLS, WAF, Sentry, Pino, Idempotency TTL, CI/CD, Docker
```

### Quick Lookup Table

| If your task involves... | Read this file first... | Key DB Tables / Services |
| :--- | :--- | :--- |
| Login, Register, Recovery, Sessions, Roles | [`01-auth-and-identity.md`](./01-auth-and-identity.md) | `users`, `user_tokens`, Fastify Auth, Argon2id |
| Profile Customization, Markdown, Avatars, Cards | [`02-profile-and-expressive-studio.md`](./02-profile-and-expressive-studio.md) | `profiles`, `rich_cards`, `tags`, Sharp, Rehype |
| Discovery Catalog, Algorithmic Matching, Bumps | [`03-discovery-matching-and-requests.md`](./03-discovery-matching-and-requests.md) | `profiles`, `profile_bumps`, `mentorship_requests` |
| Mentorships, Lineage Trees, User Deletion | [`04-mentorships-and-lineage-graph.md`](./04-mentorships-and-lineage-graph.md) | `mentorships`, React Flow, Anonymization |
| System Config, Admin Dashboard, Developer Portal | [`05-admin-and-developer-portals.md`](./05-admin-and-developer-portals.md) | `system_config`, `audit_logs`, Telemetry |
| Sentry, Logging, TLS, Rate Limiting, CI/CD, Docker | [`06-safeguards-security-and-ops.md`](./06-safeguards-security-and-ops.md) | Sentry, Pino, Redis, Fastify Rate-Limit, Docker |

---

## ⚡ 10 Non-Negotiable Key Architectural Invariants

Every agent and developer **must** adhere to these 10 core design choices across all modifications:

1. **Soft Delete for Lineage Preservation**: Hard deletes on `users` are strictly forbidden. Users set `deleted_at = NOW()` and anonymize profile data. `mentorships` FKs use `ON DELETE RESTRICT` to preserve historical lineage graphs forever.
2. **Freshman Discoverability Privacy**: Freshmen profiles default to `is_discoverable = false` (hidden from general discovery). A freshman's profile is revealed *exclusively* to a senior when the freshman submits a mentorship request to that senior.
3. **Server-Side Image Processing (No Direct S3 Uploads)**: Avatar and banner uploads MUST go through Fastify first (`POST /api/profiles/me/avatar|banner`), get sanitized via **Sharp** (EXIF/GPS metadata stripped, WebP re-encoding), and then saved to S3. No direct pre-signed URLs to S3.
4. **Permanent Family-Like Mentorships**: Mentorships are permanent family-like relationships. There are no completion or termination states.
5. **Partial Unique Index on Requests**: `mentorship_requests` unique constraint applies ONLY to active states (`WHERE status IN ('pending', 'pending_admin_approval', 'accepted')`), allowing freshmen to re-apply to a senior in later semesters if previously rejected/cancelled.
6. **Freshman Bump Limit (4 Max)**: Freshmen hold a maximum of 4 active bumps simultaneously (`profile_bumps` count ≤ 4). Reallocation requires deleting an existing bump and inserting a new one in a single transaction.
7. **Email Enumeration Prevention**: `POST /api/auth/recover` and `POST /api/auth/register` MUST always return `200 OK` with identical generic messages, regardless of whether the email or handle exists in the database.
8. **Idempotency Key TTL**: All Redis entries for `X-Idempotency-Key` MUST explicitly set a 24-hour TTL (`SETEX key 86400 value`) to prevent memory leaks.
9. **Strict Path Protection**: All `/admin/*` and `/dev/*` routes MUST be protected on the frontend (`<RoleGuard />`) AND backend (Fastify pre-handler hooks returning `403 Forbidden` and writing to `audit_logs`).
10. **Zod Boundary & Startup Validation**: Environment variables MUST be validated at startup (`env.schema.ts`). All HTTP request bodies, queries, and params MUST be validated at the boundary via Zod schemas before touching domain logic.
