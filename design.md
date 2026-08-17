# Design & Architecture Rules

## Workspace Structure

- **pnpm workspace** with strict separation:
  - `apps/web` — Frontend presentation only (React 18, Vite, Tailwind, Radix UI)
  - `apps/api` — Backend business logic & I/O only (Fastify, Prisma, Redis/BullMQ)
  - `packages/*` — Shared types, Zod schemas, utilities (if needed)

No cross-imports between `apps/web` and `apps/api` except via shared packages.

---

## Architectural Principles

### Backend (Fastify)

- **Encapsulated plugins** for each domain (`auth`, `profiles`, `requests`, `mentorships`, `notifications`, `admin`, `dev`)
- **Layer separation**:
  - HTTP transport (routes, schemas) → Domain services (pure business logic) → Data access (Prisma repositories)
- **No business logic in route handlers** — delegate to injected services
- **Prisma** used only in repository layer; never in HTTP or domain layers directly

### Frontend (React)

- **Composable primitives** — unstyled Radix UI + Tailwind utility classes
- **Server state** — TanStack Query v5 (caching, optimistic updates, background refetch)
- **Client state** — Zustand (modals, drawers, ephemeral UI state)
- **Forms** — React Hook Form + Zod resolvers
- **No class components, no inheritance hierarchies**

### Shared

- **Zod schemas as single source of truth**:
  - Fastify route schemas (`jsonSchemaTransform`)
  - React Hook Form resolvers
  - Environment validation (`env.schema.ts`)
  - Shared package exports for frontend/backend parity

---

## Functional Style & Performance

### General

- Prefer native array methods (`map`, `filter`, `reduce`, `flatMap`)
- `Promise.all` / `Promise.allSettled` for concurrent async operations
- Functional composition over imperative chains
- Pure functions by default; side effects isolated at boundaries

### Frontend Performance

- `useMemo` / `useCallback` for expensive derivations and stable callbacks — **no premature optimization**
- State localized to the smallest component subtree
- Stable `key` props for lists; avoid index keys when order changes
- TanStack Query `select` option to subscribe to minimal data slices
- React `memo` for leaf components with stable props

### Backend Performance

- **Never block the event loop** — async/await throughout; no sync I/O
- Prisma `select` / `omit` to fetch only required fields (avoid over-fetching)
- Database indexes aligned with query patterns (partial indexes for filtered uniques)
- **Explicit concurrency control**: `SELECT FOR UPDATE` in transactions for capacity checks
- Redis + BullMQ for background work (email, image processing, notifications)
- Connection pool tuning: `min`/`max`, idle timeouts, queue limits

---

## Errors & Validation

### Validation Boundaries

- **All external input validated at the edge** via Zod
- Fastify: `schema` property on every route (body, query, params, headers, response)
- Frontend: Zod + React Hook Form on every form submission
- Environment: `env.schema.ts` validated at process startup (fail fast)

### Error Handling

#### Frontend

- **React Error Boundaries** wrapping route groups and critical UI sections
- TanStack Query `error` states for async mutations/queries
- User-facing errors: generic, actionable messages; no stack traces

#### Backend

- **Typed domain errors** (`class DomainError extends Error { constructor(public readonly code: string, public readonly status: number, message: string) }`)
- Fastify global error handler maps domain errors → HTTP status + structured JSON
- Uncaught exceptions → Sentry + structured Pino log (correlation ID, redacted)
- **No sensitive data in error responses** (no PII, passwords, SQL, internal paths)

### Structured Error Response

```json
{
  "error": {
    "code": "CONFLICT_CAPACITY_EXCEEDED",
    "message": "Senior has reached maximum mentee limit",
    "statusCode": 409
  }
}
```

---

## Code Quality

### Functions & Components

- Single responsibility; small, focused units
- Early returns / guard clauses to reduce nesting
- Descriptive names (≤2 words where clarity permits): `getMentorCapacity`, `validateTokenHash`

### Immutability

- `const` by default; `let` only when reassignment is necessary
- **Never mutate React state or TanStack Query cache directly** — always produce new references
- Prisma: use `update` with new objects, not in-place mutations

### Null Safety

- TypeScript `strictNullChecks` enabled
- Optional chaining (`?.`) and nullish coalescing (`??`) for safe access
- Explicit `undefined` checks over truthiness for nullable primitives

### Resource Management

- Frontend: `useEffect` cleanup functions for subscriptions, timers, abort controllers
- Backend: Prisma `$disconnect` on shutdown; Redis `quit`; BullMQ worker `close`
- Streams: proper `pipeline` / `destroy` handling

### Side-Effect Segregation

- Backend: I/O only at plugin edges (HTTP, DB, Redis, S3, SMTP)
- Domain services: **pure** — no I/O, no global state
- Frontend: declarative effects via TanStack Query mutations; no `useEffect` for data fetching

---

## Documentation

### When to Document

- Public interfaces (exported functions, classes, hooks, types)
- Custom React hooks (contract, parameters, return, side effects)
- Complex route handlers (business flow, invariants)
- Non-obvious algorithms or domain invariants

### Style

- **TSDoc / JSDoc** for public APIs
- Comments: **sparse, concise, lowercase**
- Only for: domain invariants, subtle React/Node performance notes
- **UK English** spelling (colour, optimise, behaviour, licence)

```ts
/**
 * Calculates the compatibility score between a freshman and senior profile.
 * @param freshman - The freshman's profile with tags and bump history
 * @param senior - The senior's profile with tags, effort score, and views
 * @returns Normalised score 0-100
 */
export function calculateMatchScore(freshman: FreshmanProfile, senior: SeniorProfile): number { ... }
```

---

## Type Safety

- Prefer `type` aliases and `interface` for object shapes
- **Discriminated unions** for state machines (`type RequestStatus = { status: 'pending' } | { status: 'accepted'; acceptedAt: Date }`)
- No `any` / loose `unknown` casting — narrow with type guards
- Branded types for IDs: `type UserId = string & { readonly __brand: unique symbol }`
- Zod `infer` for schema-derived types

---

## Security by Default

- **Argon2id** for all password/token hashing
- **HttpOnly, SameSite=Strict, Secure** cookies only
- **CSP** via Helmet — strict, nonce-based for inline scripts
- **Rate limiting** tiered by endpoint sensitivity
- **Magic-byte verification** + Sharp re-encode for all uploads
- **No pre-signed S3 URLs** — server-side upload pipeline only
- **Email enumeration prevention** — identical `200 OK` responses
- **Audit logs** for all privileged actions (immutable, IP + actor + diff)
- **Soft deletes** (`deleted_at`) — no hard deletes on lineage-critical tables

---

## Testing Standards

- **Unit**: Pure domain services, utilities, Zod schemas (Vitest)
- **Integration**: Fastify routes + Prisma test DB (Supertest)
- **E2E**: Critical user flows (Playwright)
- **Coverage**: ≥85% on core business logic
- **CI**: Every PR runs format → lint → typecheck → test → build

---

## Conventions

| Area | Convention |
|------|------------|
| Files | kebab-case (`profile-studio.tsx`, `auth-service.ts`) |
| Components | PascalCase (`ProfileCard.tsx`) |
| Hooks | `use` prefix (`useAuth`, `useMentorshipInbox`) |
| Types | PascalCase (`MentorshipRequest`, `BumpAllocation`) |
| Enums | PascalCase singular (`RequestStatus`, `TokenType`) |
| Database | snake_case tables/columns (`user_tokens`, `bump_count`) |
| Environment | SCREAMING_SNAKE_CASE (`DATABASE_URL`, `JWT_SECRET`) |
| Git | Conventional Commits (`feat:`, `fix:`, `refactor:`) |

---

## Execution & Verification

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test` before completing any task
- Build verification: `pnpm build` must pass for both `apps/web` and `apps/api`
- Accessibility: semantic HTML, ARIA labels on custom components, focus management in modals/drawers
- No conversational filler in code — only necessary logic, types, and sparse comments