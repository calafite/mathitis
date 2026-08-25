# Phase 14: Buffered Profile Views & Write-Lock Mitigation

## Objective
Eliminate read-induced database lock contention on senior profiles during high-traffic matching seasons. By buffering profile view increments in Redis and flushing them asynchronously to PostgreSQL via a background worker, we prevent the `GET /api/profiles/:handle` endpoint from throttling the database and blocking concurrent `SELECT FOR UPDATE` operations used during mentorship acceptance.

---

## Directives & Platform Constraints
- **Eventual Consistency**: It is acceptable for a senior's view count to be up to 5 minutes stale. Do not perform a Redis read on every profile fetch to calculate the "real" total; serve the value directly from PostgreSQL.
- **Zero Data Loss on Flush**: The flush operation must be atomic. Do not use a basic `HGETALL` followed by `DEL`, as this would erase any new views that arrive between the two commands. Use an atomic key swap (e.g., `RENAME`) or a transactional decrement.
- **Batched Database Writes**: When flushing the buffer to the database, group the updates efficiently to minimize database roundtrips (e.g., using Prisma `increment` operations within a single transaction).

---

## Tasks

- [ ] **14.1 Redis View Buffering (`apps/api`)**
  - Update `apps/api/src/services/profile-service.ts`:
    - Inject the `Redis` client into `createProfileService`.
    - Modify `incrementViews(userId)`: remove the Prisma `profileRepository.incrementViews` call.
    - Replace it with a Redis hash increment: `redis.hincrby('profile:views', userId, 1)`.

- [ ] **14.2 BullMQ Flush Worker & Queue Setup (`apps/api`)**
  - Create a new queue and worker for telemetry/maintenance tasks (or reuse an existing generic background queue if applicable, e.g., `system-tasks`).
  - Create `apps/api/src/services/views-worker.ts`:
    - Define a job `flush-profile-views`.
    - Configure the queue scheduler to add this job as a repeatable job (cron) executing every 5 minutes.
  - Implement the atomic flush logic inside the worker:
    1. Check if the hash exists (`EXISTS profile:views`). If not, exit gracefully.
    2. Atomically rename the hash to a processing key: `RENAME profile:views profile:views_processing_{timestamp}`.
    3. Read all pairs: `HGETALL profile:views_processing_{timestamp}`.
    4. Execute a PostgreSQL transaction containing multiple `update` statements:
       ```typescript
       await prisma.$transaction(
         Object.entries(views).map(([userId, count]) =>
           prisma.profile.update({
             where: { userId },
             data: { profileViews: { increment: Number(count) } }
           })
         )
       );
       ```
    5. On successful transaction commit, delete the processing key: `DEL profile:views_processing_{timestamp}`.
    6. If the transaction fails, the processing key remains in Redis. The worker should catch the error, log it, and throw (so BullMQ retries the job and data isn't lost).

- [ ] **14.3 API Initialization & Integration (`apps/api`)**
  - In `apps/api/src/app.ts` and `apps/api/src/main.ts`:
    - Initialize the new `views-worker` alongside the existing email worker.
    - Ensure graceful shutdown: the worker must close its Redis connections and wait for active flush jobs to finish when `SIGTERM` is received.

- [ ] **14.4 Testing & Automated Quality Gates**
  - **Unit Tests (`apps/api/tests/unit/views-worker.test.ts`)**:
    - Mock Redis and Prisma.
    - Verify the atomic `RENAME` $\rightarrow$ `HGETALL` $\rightarrow$ DB Update $\rightarrow$ `DEL` flow.
    - Verify that if Prisma throws an error, the `DEL` command is skipped so data is preserved for retry.
  - **Integration Tests (`apps/api/tests/integration/profiles.test.ts`)**:
    - Call `GET /api/profiles/:handle` multiple times.
    - Assert that the Redis hash `profile:views` increments correctly.
    - Manually invoke the flush job logic and assert that the PostgreSQL `profile_views` column updates accurately by the aggregated amount.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck` to ensure Redis logic is strictly typed.
- [ ] Run `pnpm test:unit` and `pnpm test:integration`.
- [ ] Verify that viewing a profile no longer locks the database row (no `UPDATE` statements appear in the Prisma query logs during standard browsing).
- [ ] Verify that the BullMQ dashboard (if exposed via Dev Portal) shows the `flush-profile-views` job running successfully on its 5-minute schedule.
