# Phase 20: Developer Portal Admin Privilege Management

## Objective
Implement a secure, isolated interface within the Developer Diagnostics Portal (`/dev`) that allows developers (`developer` role) to view, promote, and revoke `administrator` privileges across the platform. Every role transition must trigger an immutable audit log entry and invalidate the target user's session epoch to immediately synchronize permissions across all devices.

---

## Directives & Platform Constraints
- **Developer-Only Guard**: The admin management endpoints must be strictly restricted to users with `role === 'developer'`. Users with the `administrator` role must NOT be permitted to access or invoke these developer endpoints.
- **Immediate Permission Synchronization (Session Epoch)**: Modifying a user's role to or from `administrator` MUST bump their `sessionEpoch` in Redis, instantly invalidating stale JWT sessions and requiring a fresh session cookie with updated role claims.
- **Immutable Audit Trail**: Every promotion and revocation action must create an explicit record in `audit_logs` (`action: 'developer.admin.promote'` / `'developer.admin.demote'`) capturing the developer's actor ID, target user ID, previous role, and client IP address.
- **Safe Demotion Fallback**: When revoking an administrator's privileges, the system must demote them to an appropriate student role based on their semester (e.g. `senior` if `semester >= 5`, otherwise `freshman`).

---

## Tasks

- [ ] **20.1 Schema & Contract Definition (`@mathitis/schemas`)**
  - In `packages/schemas/src/admin.ts` (or `dev.ts`):
    - Define `devAdminSummarySchema`:
      ```typescript
      export const devAdminSummarySchema = z.object({
        id: z.string().uuid(),
        handle: z.string(),
        email: z.string().email(),
        role: userRoleSchema,
        semester: z.number().int(),
        socialName: z.string().nullable(),
        createdAt: z.coerce.date(),
      });
      export type DevAdminSummary = z.infer<typeof devAdminSummarySchema>;
      ```
    - Define `devAdminsResponseSchema`:
      ```typescript
      export const devAdminsResponseSchema = z.object({
        admins: z.array(devAdminSummarySchema),
      });
      export type DevAdminsResponse = z.infer<typeof devAdminsResponseSchema>;
      ```
    - Define `promoteAdminBodySchema`:
      ```typescript
      export const promoteAdminBodySchema = z.object({
        identifier: z
          .string()
          .trim()
          .min(3, 'Informe o nome de usuário ou e-mail')
          .max(255),
      });
      export type PromoteAdminBody = z.infer<typeof promoteAdminBodySchema>;
      ```
    - Define `revokeAdminParamsSchema`:
      ```typescript
      export const revokeAdminParamsSchema = z.object({
        id: z.string().uuid('ID de usuário inválido'),
      });
      export type RevokeAdminParams = z.infer<typeof revokeAdminParamsSchema>;
      ```
  - Export all schemas from `packages/schemas/src/index.ts`.

- [ ] **20.2 Backend Developer Management API (`apps/api`)**
  - In `apps/api/src/services/dev-service.ts`:
    - Add `listAdmins()`: Queries all active users where `role = 'administrator'` and `deletedAt IS NULL`.
    - Add `promoteToAdmin(developerId: string, clientIp: string, identifier: string)`:
      - Looks up user by handle or email.
      - If user does not exist or is soft-deleted, throws `NotFoundError('Usuário não encontrado')`.
      - If user is already an administrator or developer, throws `ConflictError('Este usuário já possui privilégios administrativos')`.
      - Updates `role = 'administrator'`.
      - Emits audit log: `developer.admin.promote`.
      - Bumps the user's `sessionEpoch`.
    - Add `revokeAdmin(developerId: string, clientIp: string, targetUserId: string)`:
      - Looks up user by ID.
      - If user is not an administrator, throws `ValidationError('O usuário selecionado não é um administrador')`.
      - Calculates fallback role: `semester >= 5 ? 'senior' : 'freshman'`.
      - Updates `role = fallbackRole`.
      - Emits audit log: `developer.admin.demote`.
      - Bumps the user's `sessionEpoch`.
  - In `apps/api/src/plugins/dev-plugin.ts`:
    - Register routes strictly guarded by `createRequireRole(session, ['developer'])`:
      - `GET /api/dev/admins`: Returns `{ admins: [...] }`.
      - `POST /api/dev/admins`: Validates body with `promoteAdminBodySchema`, executes `devService.promoteToAdmin`.
      - `DELETE /api/dev/admins/:id`: Validates params with `revokeAdminParamsSchema`, executes `devService.revokeAdmin`.

- [ ] **20.3 Frontend API Client (`apps/web`)**
  - In `apps/web/src/lib/dev-api.ts`:
    - Add `listAdmins(): Promise<DevAdminsResponse>`.
    - Add `promoteAdmin(identifier: string): Promise<{ admin: DevAdminSummary }>`.
    - Add `revokeAdmin(id: string): Promise<{ ok: boolean }>`.

- [ ] **20.4 Developer Dashboard UI Integration (`apps/web`)**
  - In `apps/web/src/pages/dev/dev-diagnostics.tsx`:
    - Add a dedicated brutalist management card: **"Corpo Administrativo (Administradores)"**.
    - Render a table/list of active administrators showing:
      - Social name and `@handle`
      - University email
      - Semester
      - Date granted / created
      - Action button: **"Revogar Acesso"** (with confirmation dialog).
    - Add a **"Promover Novo Administrador"** form:
      - Input for handle or academic email (`@cs.uni.edu` / `@academico...`).
      - Submit button with loading state (`Loader2`).
      - Clear success toast and reactive TanStack Query invalidation (`queryKey: ['dev', 'admins']`).
    - Display error banners when promotions fail (e.g. user not found or already admin).

- [ ] **20.5 Testing & Automated Quality Gates**
  - **Unit Tests (`apps/api/tests/unit/dev-service.test.ts`)**:
    - Test `promoteToAdmin` successfully updates role, emits audit log, and bumps session epoch.
    - Test `promoteToAdmin` rejects non-existent users and existing admins.
    - Test `revokeAdmin` successfully demotes to `senior` (semester $\ge 5$) or `freshman` (semester $< 5$) and bumps epoch.
  - **Integration Tests (`apps/api/tests/integration/dev.test.ts`)**:
    - Assert that `POST /api/dev/admins` and `DELETE /api/dev/admins/:id` return `403 Forbidden` when called by an `administrator`, `senior`, or `freshman`.
    - Assert that only users with `role: 'developer'` can execute promotion/revocation.
    - Verify that an administrator whose privileges are revoked is immediately rejected with `403` on `/api/admin/*` endpoints due to session epoch invalidation.
  - **Frontend Unit Tests (`apps/web/tests/unit/dev-diagnostics.test.tsx`)**:
    - Test rendering of the administrators roster.
    - Test promote form submission and revocation confirmation trigger.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck` across all workspaces.
- [ ] Run `pnpm test:unit` and `pnpm test:integration`.
- [ ] Log in as a `developer` user, navigate to `/dev`, and verify the "Corpo Administrativo" section is visible.
- [ ] Promote a student user to administrator via handle; verify they appear in the active admin list and can now access `/admin`.
- [ ] Revoke the admin privileges from `/dev`; verify their active session is immediately kicked out of `/admin/*` routes.
- [ ] Check `/admin/audit-logs` as an admin or dev; verify `developer.admin.promote` and `developer.admin.demote` entries are logged with developer actor ID and client IP.
