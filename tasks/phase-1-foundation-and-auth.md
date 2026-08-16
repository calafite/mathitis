# Phase 1: Core Foundation, Database & Authentication Engine

## Objective
Establish the repository architecture, database schema, Fastify server setup, and robust authentication engine with role management, university domain verification, dynamic environment variable validation, and structured JSON logging.

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
  - Implement initial schema migration containing `users`, `profiles`, `tags`, `profile_tags`, and `system_config`.
  - Create database seed script providing initial default tags, system configs, and test users for all 4 roles (`freshman`, `senior`, `administrator`, `developer`).
- [ ] **1.4 Authentication & Session System**
  - Implement robust password hashing using **Argon2id** with standard high-entropy work parameters.
  - Build Fastify Auth plugin utilizing cryptographically signed, short-lived **HttpOnly**, **SameSite** (Strict/Lax), **Secure** session cookies/JWTs.
  - Build registration endpoint (`POST /api/auth/register`) with strict validation of university email domain (`.edu` / `@cs.uni.edu`) and semester.
  - Build login (`POST /api/auth/login`), logout (`POST /api/auth/logout`), and current user (`GET /api/auth/me`) endpoints.
  - Build password recovery email request and reset verification logic using unique single-use cryptographically secure reset tokens.
- [ ] **1.5 Frontend Auth Context & Route Guards**
  - Implement React AuthContext and `useAuth` hook managing the user session state.
  - Create protected route wrappers: `<ProtectedRoute />`, `<RoleGuard requiredRole={[...]} />` preventing unauthorized interface rendering.
  - Implement Login, Register, and Password Recovery UI screens with clean error handling, Zod form validation, and loading/disabled states on submission.
