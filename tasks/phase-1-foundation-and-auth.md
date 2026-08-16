# Phase 1: Core Foundation, Database & Authentication Engine

## Objective
Establish the repository architecture, database schema (with soft deletes for lineage preservation), Fastify server setup, and robust authentication engine with role management, university domain verification, secure token storage, email enumeration prevention, dynamic environment variable validation, and structured JSON logging.

## Tasks
- [ ] **1.1 Project Scaffolding & Setup**
  - Initialize pnpm monorepo with `apps/web` (React 18 + Vite + Tailwind CSS) and `apps/api` (Fastify + TypeScript).
  - Configure shared TypeScript configs, ESLint, and Prettier.
  - Set up base UI component library with Radix UI primitives and Tailwind CSS.
  - Implement GitHub Actions CI/CD pipeline template running ESLint, Prettier formatting check, TypeScript type checks, and a mock test step on every pull request.
- [ ] **1.2 Environment & Logging Configuration (Safeguards)**
  - Implement dynamic environment variable and secret validation *at process launch* using a strict **Zod** schema (`env.schema.ts`). Ensure the application crashes immediately if any crucial variable is missing or malformed.
  - Set up **Pino** structured JSON logging for all request/response cycles.
  - Implement automatic correlation IDs (`x-request-id`) passed via HTTP headers and propagated across all logs.
  - Configure strict log redaction pathways to mask sensitive student information (passwords, JWT tokens, personal emails).
- [ ] **1.3 Database Infrastructure (PostgreSQL + Prisma)**
  - Configure Prisma ORM with PostgreSQL connection strings and separation between application database credentials (`mathitis_app` role with least-privilege DML rights) and migrations credentials (`mathitis_migrator` with administrative DDL rights).
  - Implement initial schema migration containing:
    - `users` (with `deleted_at` for soft deletes)
    - `user_tokens` (Argon2id-hashed tokens for email verification & password reset, with `expires_at`, `consumed_at`, `type`)
    - `profiles` (with `is_discoverable` default false for freshmen)
    - `tags`, `profile_tags`
    - `system_config`
    - `audit_logs`
  - Create partial unique indexes where needed (e.g., `user_tokens` for unconsumed tokens per user+type).
  - Create database seed script providing initial default tags, system configs, and test users for all 4 roles (`freshman`, `senior`, `administrator`, `developer`).
- [ ] **1.4 Authentication & Session System**
  - Implement robust password hashing using **Argon2id** with standard high-entropy work parameters.
  - Build Fastify Auth plugin utilizing cryptographically signed, short-lived **HttpOnly**, **SameSite** (Strict/Lax), **Secure** session cookies/JWTs.
  - Build registration endpoint (`POST /api/auth/register`) with strict validation of university email domain (`.edu` / `@cs.uni.edu`) and semester.
    - **Email enumeration prevention**: Always return `200 OK` with generic success message; silently send verification email only if email exists.
  - Build login (`POST /api/auth/login`), logout (`POST /api/auth/logout`), and current user (`GET /api/auth/me`) endpoints.
  - Build password recovery flow:
    - `POST /api/auth/recover` — **Always returns `200 OK` with generic message** (prevents email enumeration). Creates `user_tokens` record (type: `password_reset`, Argon2id-hashed token) and sends email only if account exists.
    - `POST /api/auth/reset-password` — Validates token hash, checks `expires_at` and `consumed_at`, updates password, marks token consumed.
  - Build email verification flow (on registration): Creates `user_tokens` (type: `email_verification`), sends link, verifies on click.
- [ ] **1.5 Frontend Auth Context & Route Guards**
  - Implement React AuthContext and `useAuth` hook managing the user session state.
  - Create protected route wrappers: `<ProtectedRoute />`, `<RoleGuard requiredRole={[...]} />` preventing unauthorized interface rendering.
  - Implement Login, Register, and Password Recovery UI screens with clean error handling, Zod form validation, and loading/disabled states on submission.
