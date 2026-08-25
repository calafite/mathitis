# Phase 15: Security Patches & Operational Hardening

## Objective
Address critical security vulnerabilities, data integrity flaws, and operational bottlenecks discovered during pre-release audits. This phase hardens the authentication token pipeline against CPU-exhaustion (DoS), enforces tenant isolation in idempotency caches, resolves race conditions in application limits, eliminates cookie-bloat in profile tracking, and ensures the lineage data export complies with its hierarchical schema.

---

## Directives & Platform Constraints
- **Constant-Time & $O(1)$ Token Lookups**: Token verification must never execute full-table scans or loops involving computationally heavy algorithms like Argon2id.
- **Tenant-Isolated Caching**: All cache and idempotency keys must incorporate the authenticated user's ID to prevent cross-tenant data leaks.
- **Stateless Analytics Tracking**: Tracking unique profile views must not rely on accumulating state in the client's HTTP cookies, to prevent `431 Request Header Fields Too Large` errors.

---

## Tasks

- [ ] **15.1 Token Verification DoS Mitigation (`apps/api`)**
  - Refactor `apps/api/src/services/auth-service.ts` to implement a `selector.validator` pattern for secure tokens.
  - Update `issueToken`:
    - Generate a 32-byte `plainSecret` (the validator).
    - Hash the `plainSecret` with Argon2id and store it in `user_tokens`.
    - Retrieve the UUID `tokenId` (the selector) from the created row.
    - Return a composite token string: `${tokenId}.${plainSecret}`.
  - Update `verifyPlainToken` and `verifyEmail`:
    - Split the incoming composite token into `tokenId` and `plainSecret`.
    - Fetch the specific token row by `tokenId` ($O(1)$ lookup). If not found, expired, or already consumed, throw `TOKEN_INVALID`.
    - Run `argon2.verify(candidate.tokenHash, plainSecret)`.
    - This eliminates the $O(N)$ linear table scan and entirely mitigates the CPU-exhaustion DoS vulnerability.
  - Update `apps/web/e2e/auth.spec.ts` and `dev-mailbox.test.ts` to expect and extract the composite token pattern.

- [ ] **15.2 Idempotency Tenant Isolation & Concurrency Locks (`apps/api`)**
  - In `apps/api/src/services/request-service.ts` (`submit` function):
    - Update the idempotency key prefix to include the freshman's ID: `buildIdempotencyKey(\`request-submit-\${freshmanId}\`, idempotencyKey)`.
    - Wrap the `MAX_FRESHMAN_REQUESTS` check and request insertion in a `prisma.$transaction`.
    - Inside the transaction, place a pessimistic lock on the freshman's user row (`await tx.$queryRaw\`SELECT id FROM users WHERE id = ${freshmanId}::uuid FOR UPDATE\``) to serialize concurrent submissions and prevent race conditions from bypassing the maximum request limit.

- [ ] **15.3 Profile Views: Self-View Prevention & Redis HyperLogLog (`apps/api`)**
  - In `apps/api/src/plugins/profiles-plugin.ts` (`GET /profiles/:handle`):
    - Remove the `mathitis_profile_view_${handle}` cookie logic entirely to prevent HTTP 431 Cookie Bomb vulnerabilities.
    - Prevent self-view inflation: Only track the view if `!request.sessionUser || request.sessionUser.sub !== profile.userId`.
  - In `apps/api/src/services/profile-service.ts` (or `views-worker.ts` if Phase 14 was completed):
    - Track unique views server-side using Redis HyperLogLog: `await redis.pfadd(\`profile:unique_views:\${profile.userId}\`, viewerIdentifier)` (where `viewerIdentifier` is `sessionUser.sub` or `request.ip`).
    - If `pfadd` returns `1` (a new unique viewer), proceed with the view increment (either immediate DB update or Redis buffered increment, depending on Phase 14's state).

- [ ] **15.4 Discovery Query Parsing Fixes (`packages/schemas`)**
  - In `packages/schemas/src/discovery.ts`:
    - Update `uuidListSchema` and `cardTypeListSchema` to utilize `z.preprocess` to split comma-separated strings into arrays before validation.
    - Example: `z.preprocess((val) => (typeof val === 'string' ? val.split(',') : val), z.array(z.string().uuid()))`.
    - This resolves the `422 Unprocessable Entity` errors when the frontend sends multiple tags or card types (e.g., `?tagIds=uuid1,uuid2`).

- [ ] **15.5 Nginx Asset Proxy Resolution (`apps/web` / `deploy`)**
  - In `apps/web/nginx.conf`:
    - Fix the `/assets/uploads/` location block to properly route to MinIO when object storage is active, or ensure it falls back to Fastify correctly.
    - Ensure `S3_PUBLIC_BASE_URL` in `.env.production` dictates the correct frontend URL resolution so that Avatars and Banners do not return 404 in production.

- [ ] **15.6 Complete Lineage Data Export (`apps/api`)**
  - In `apps/api/src/plugins/account-plugin.ts` (`GET /api/account/export`):
    - Implement a traversal mechanism (up to 3 levels: `mentor`, `grand-mentor`, `great-grand-mentor`, and the equivalent for `pupil` descendants) to populate the `lineage.ancestors` and `lineage.descendants` arrays.
    - Ensure the payload structurally matches the `userDataExportSchema` commitments instead of only mapping immediate 1st-degree connections.

- [ ] **15.7 Testing & Automated Quality Gates**
  - **Unit Tests (`apps/api/tests/unit/auth-service.test.ts`)**:
    - Verify that `verifyEmail` and `resetPassword` successfully split the composite token and lookup by ID, avoiding the loop.
  - **Integration Tests (`apps/api/tests/integration/requests.test.ts`)**:
    - Send 5 concurrent `POST /api/requests` with different idempotency keys and verify that only `MAX_FRESHMAN_REQUESTS` succeed, while the rest return `409 Conflict`.
  - **Integration Tests (`apps/api/tests/integration/profiles.test.ts`)**:
    - Verify that viewing your own profile does not increment the view counter.
    - Verify that the `Set-Cookie` header no longer explodes with `mathitis_profile_view_*` entries.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck` to ensure schema preprocessing and composite token types are sound.
- [ ] Run `pnpm test:unit` and `pnpm test:integration`. Ensure all tests pass.
- [ ] Spin up the local environment and verify that multiple tag selections in the Discovery Hub successfully filter the mentors without throwing `422`.
- [ ] Verify that password reset and email verification flows function seamlessly end-to-end with the new composite token structure.
