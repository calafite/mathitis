# Phase 6: Automated Testing, Continuous Deployment & Containerization

## Objective
Ensure full test coverage across unit, integration, and end-to-end user flows, implement automated CI/CD PR quality gates, and establish production-ready containerized deployment configuration with health checks.

## Tasks
- [ ] **6.1 Unit & Domain Logic Testing**
  - Write Vitest unit tests for domain services (auth policies, limit calculations, semester validations, Markdown sanitization rules).
  - Test transactional edge cases: concurrency limit saturation, concurrent acceptance race conditions, and idempotency key duplicate replay protection.
  - Test **email enumeration prevention**: verify `POST /api/auth/recover` and `POST /api/auth/register` always return `200 OK` with identical response bodies regardless of email existence.
  - Test **soft delete / anonymization**: verify `users.deleted_at` is set, `mentorships` FKs preserved, profile data anonymized, queries respect `WHERE deleted_at IS NULL`.
  - Test **partial unique index**: verify `rejected`/`cancelled` requests allow new applications to same senior; active statuses block duplicates.
  - Test **bump limit enforcement**: verify max 4 active bumps per freshman; reallocation (DELETE + INSERT in transaction) works correctly.
  - Test **idempotency TTL**: verify Redis keys expire after 24 hours; no memory leak from abandoned keys.
  - Achieve >85% code coverage across core business logic modules.
- [ ] **6.2 API Integration & Database Testing**
  - Write Fastify integration tests using Supertest against a test PostgreSQL instance.
  - Verify complete request/response lifecycles, role-based authorization guards, field privacy filtering, and error status code mappings.
  - Test database constraint enforcement and transaction rollback on failure.
  - Test `user_tokens` flow: token creation, hash verification, expiry, consumption marking, reuse prevention.
- [x] **6.3 Frontend Component & E2E Testing**
  - Write React Testing Library tests for forms, theme pickers, rich card widgets, custom Markdown parser, and profile components.
  - Implement Playwright E2E test suites covering:
    - Complete Freshman Journey: Registration -> Email verification -> Profile customization -> Discovery catalog search/filter -> Bump (max 4, reallocate) -> Mentorship request submission -> Lineage graph exploration.
    - Senior Mentorship Flow: Login -> Notification receipt -> Request inbox review -> Candidate profile inspection -> Request acceptance -> Permanent mentorship roster -> Lineage graph.
    - Administrative Workflow: Dynamic configuration toggle -> Admin approval queue override -> Content moderation -> User anonymization (with lineage warning) -> Audit log verification.
    - Email enumeration: Attempt to register/recover with existing and non-existing emails; verify identical UI responses.
- [x] **6.4 CI/CD Pipeline & Pull Request Quality Gates (GitHub Actions)**
  - Implement complete `.github/workflows/ci.yml` running on every Pull Request:
    - Code formatting check (`prettier --check`).
    - Static analysis & linting (`eslint`).
    - TypeScript strict type checking (`tsc --noEmit`).
    - Dependency vulnerability audit (`pnpm audit --audit-level=high`).
    - Unit, integration, and E2E test execution with coverage reports.
    - Production build verification for both `apps/web` and `apps/api`.
- [ ] **6.5 Production Docker & Deployment Configuration**
  - Write multi-stage Dockerfiles for `apps/api` and `apps/web` (Nginx static serving with gzip/brotli compression and security headers).
  - Run container processes as non-root users (`node` / `nginx`) for principle of least privilege.
  - Create `docker-compose.production.yml` specifying Fastify API, PostgreSQL 16, Redis, and MinIO with strict health check probes (`HEALTHCHECK`).
  - Provide `.env.example` templates and comprehensive operational runbooks for deployment, database migrations, and secret rotation.
