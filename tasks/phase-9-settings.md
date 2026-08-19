# Phase 9: User Settings & Account Management Portal

## Objective
Implement a dedicated User Settings portal (`/settings`) allowing authenticated students to manage account credentials, advance their academic semester, configure appearance and notification preferences, export their complete platform data archive, and initiate self-service account deactivation/anonymization while strictly preserving historical mentorship lineage records (Invariant #1).

---

## Tasks
- [ ] **9.1 Schemas & Contract Definition**
  - Create `packages/schemas/src/settings.ts` and export from `packages/schemas/src/index.ts`:
    - `changePasswordBodySchema`: Current password verification + new password with standard complexity regex (`/[A-Z]/`, `/[a-z]/`, `/[0-9]/`, min 8 chars).
    - `updateAccountBodySchema`: Academic `semester` (1–12) and user `preferences` (theme: `dark` | `light` | `system`, `reducedMotion`: boolean, `soundEnabled`: boolean, `emailNotifications`: boolean).
    - `userDataExportSchema`: Complete structured schema for data portability (user profile, tags, rich cards, request history, and ancestral lineage tree).
    - `anonymizeAccountBodySchema`: Password confirmation payload required for self-service deactivation.
  - Update Prisma schema (`apps/api/prisma/schema.prisma`) to support user-level preference storage (`preferences Json?` on `User` or `Profile`) and generate migration.

- [ ] **9.2 Backend Account Management & Security API**
  - Implement Fastify route endpoints in `apps/api/src/plugins/auth-plugin.ts` or a new `account-plugin.ts`:
    - `POST /api/account/change-password`: Verifies current password hash via Argon2id, hashes new password, updates database, and emits audit log (`account.password.update`).
    - `PATCH /api/account`: Updates current academic semester and user preferences.
    - `GET /api/account/export`: Aggregates the authenticated user's profile, bio, tags, rich cards, submitted/received request history, and lineage links into a downloadable JSON payload.
    - `POST /api/account/anonymize` (Self-Service Deactivation):
      - Verifies user password before proceeding.
      - Sets `users.deleted_at = NOW()` and `status = 'deactivated'`.
      - Anonymizes profile data (handle → `user_<uuid>`, scrubs bio, banner, avatar, contact links, and rich cards).
      - **Preserves foreign keys** on `mentorships` (`ON DELETE RESTRICT`) so the ancestral lineage tree remains complete for former mentees/mentors.
      - Clears session cookies and logs `account.self_anonymize` to `audit_logs`.
  - Apply strict rate-limiting (`RATE_LIMIT_AUTH_MAX`) on password change and anonymization endpoints to prevent brute-force attacks.

- [ ] **9.3 Frontend Settings Hub UI**
  - Build `apps/web/src/pages/settings.tsx` with a responsive tabbed navigation layout using Radix UI Tabs:
    - **Tab 1: Account & Security**
      - Current semester selector (allowing students to advance their semester over time).
      - Change Password form with live Zod validation, current password check, and success/error toasts.
      - Primary verified university email display (read-only with domain indicator).
    - **Tab 2: Appearance & Accessibility**
      - Global theme selector: Dark Mode (default), Light Mode, or Sync with System.
      - Accessibility toggles: Reduced Motion (disabling heavy transitions) and High-Contrast accents.
    - **Tab 3: Notifications & Alerts**
      - In-app notification sound chime toggle.
      - Granular transactional email notification checkboxes (requests received, accepted/rejected, admin reviews).
    - **Tab 4: Data & Lineage Archive**
      - "Download My Data" button fetching `GET /api/account/export` and triggering a client-side JSON file download (`mathitis-data-export.json`).
      - Summary view of active lineage connections and academic family links.
    - **Tab 5: Danger Zone**
      - Informational banner detailing the Soft-Delete Lineage Preservation policy:
        > *"Deactivating your account removes your personal information, bio, and showcase cards. Your ancestral nodes on the Mentorship Lineage Graph will remain preserved as an anonymized alumnus to keep your academic family tree intact."*
      - "Anonymize Account" button opening a confirmation modal with password re-entry.
  - Register `/settings` route in `apps/web/src/app.tsx` inside `<ProtectedRoute />`.
  - Add navigation shortcuts to `/settings` in `HomePage` header and navigation bars.

- [ ] **9.4 Frontend API Client & State Hooks**
  - Create `apps/web/src/lib/settings-api.ts` supporting `changePassword`, `updateAccount`, `exportData`, and `anonymizeAccount`.
  - Integrate TanStack Query mutations with optimistic UI updates and cache invalidation for user session/profile queries.

- [ ] **9.5 Testing & Automated Quality Gates**
  - **Unit Tests (Vitest)**:
    - `apps/api/tests/unit/account-service.test.ts`: Password change validation, Argon2id verification, and data export builder.
    - `apps/web/tests/unit/settings.test.tsx`: Tab switching, password change form submission, and data export download trigger.
  - **Integration Tests (Fastify + Supertest)**:
    - Test password change success and rejection on incorrect current password.
    - Test data export completeness and verification that no internal secrets (like `password_hash`) are leaked in the export.
    - Test self-anonymization flow: verify profile stripping, soft-delete timestamp, preserved mentorship rows, and session invalidation.
  - **Playwright E2E Tests (`apps/web/e2e/settings.spec.ts`)**:
    - Update semester and appearance preferences and verify persistence across page reloads.
    - Complete password change and verify login with the new password.
    - Verify data export download event.
    - Execute account deactivation in the Danger Zone and verify immediate redirection to logged-out state with blocked subsequent logins
