# 05. Admin & Developer Portals Architecture

This domain covers the administrative command center, dynamic system configuration, user moderation, and the isolated developer telemetry portal — all with strict path protection and audit trails.

---

## 🔐 Strict Path Protection (Frontend + Backend)

Both `/admin/*` and `/dev/*` routes are **dual-protected**:

### Frontend (`apps/web`)
```tsx
// Route-level protection wrapping the entire admin/dev layout
<Route path="/admin/*" element={
  <RoleGuard allowedRoles={['administrator']}>
    <AdminLayout />
  </RoleGuard>
} />
<Route path="/dev/*" element={
  <RoleGuard allowedRoles={['developer', 'administrator']}>
    <DevLayout />
  </RoleGuard>
} />
```
- `RoleGuard` reads the authenticated session from React Context (`useAuth`).
- Unauthorized users → redirect to `/login` with 302.
- No lazy-loaded admin bundles for unauthorized roles.

### Backend (`apps/api`)
```typescript
// Fastify pre-handler hook (registered on admin/dev plugin prefixes)
fastify.addHook('onRequest', async (request, reply) => {
  const user = request.session.get('user');
  const isAdminRoute = request.url.startsWith('/api/admin');
  const isDevRoute = request.url.startsWith('/api/dev');

  if (isAdminRoute && user?.role !== 'administrator') {
    await auditLog.create({ actor: user?.id, action: 'ADMIN_ACCESS_DENIED', ip: request.ip });
    return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Administrator role required', statusCode: 403 }});
  }
  if (isDevRoute && !['developer', 'administrator'].includes(user?.role || '')) {
    await auditLog.create({ actor: user?.id, action: 'DEV_ACCESS_DENIED', ip: request.ip });
    return reply.code(403).send({ error: { code: 'FORBIDDEN', message: 'Developer role required', statusCode: 403 }});
  }
});
```
- Any unauthorized access attempt is **immediately logged** to `audit_logs` with actor ID, IP, and timestamp.

---

## ⚙️ Dynamic System Configuration Engine

Runtime toggles managed via `GET/PATCH /api/admin/config` (protected by RBAC):

| Config Key | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `REQUIRE_ADMIN_REQUEST_APPROVAL` | boolean | `false` | If `true`, senior acceptance triggers admin review queue |
| `REGISTRATION_ENABLED` | boolean | `true` | Enables/disables new account creation |
| `DISCOVERY_ACTIVE` | boolean | `true` | Global master switch for the matching season |
| `MAX_FRESHMAN_REQUESTS` | integer | `3` | Max concurrent pending applications per freshman |
| `MAX_SENIOR_MENTEES` | integer | `3` | Default mentee capacity for new seniors |
| `EMAIL_NOTIFICATIONS_ENABLED` | boolean | `true` | Master switch for BullMQ email dispatch |

- Every config change triggers an **automatic audit log** entry with `actor_id`, `target_entity: 'system_config'`, before/after JSON diffs, and client IP.

---

## 👥 User & Content Moderation (Anonymise, Don't Delete)

Admin panel (`/admin/users`) supports:

- **Role toggles**: Change user roles (freshman ↔ senior) with immediate effect
- **Status overrides**: Suspend / reactivate accounts
- **Content moderation**: Clear inappropriate banners, bios, or rich cards
- **Anonymise User** (Replaces "Delete"): Sets `users.deleted_at = NOW()`, `status = 'deactivated'`, anonymises profile data, **preserves mentorships** for lineage integrity.

---

## 📋 Admin Approval Queue

When `REQUIRE_ADMIN_REQUEST_APPROVAL = true`:
- Senior "Accept" transitions request to `pending_admin_approval`
- Admins view queue at `GET /api/admin/approvals`
- Admin decision: `POST /api/admin/approvals/:id/decide` with `{ action: 'approve' | 'reject', reason }`
- Approve → creates permanent `mentorships` record
- Reject → notifies freshman, frees senior capacity slot

---

## 📈 Admin Command Center Metrics

Dashboard (`/admin`) displays:
- Active mentorship count & growth trend
- Request volume & approval/rejection rates
- Tag popularity & semantic cluster analytics
- Lineage graph depth & connectivity metrics
- System health (DB latency, Redis memory, BullMQ queue lag)

---

## 🛠️ Developer Diagnostics Portal (`/dev`)

**Zero PII Exposure Guarantee**:
- All developer endpoints filter responses through a PII scrubber
- Shows: BullMQ queue stats (active/failed/completed jobs, throughput), memory usage, event loop lag, DB pool status, Prisma migration status
- Hides: Student emails, handles, bios, IP addresses, auth tokens

---

## 🔒 Audit Logging Framework

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- e.g. 'CONFIG_UPDATE', 'USER_SUSPENDED', 'ADMIN_ACCESS_DENIED'
    target_entity VARCHAR(50) NOT NULL, -- 'system_config', 'users', 'mentorship_requests'
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb, -- before/after diffs, metadata
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
```

- Middleware intercepts all admin mutations and auto-generates immutable audit entries.
- Viewable at `/admin/audit` with filterable timeline, IP search, and JSON diff inspection modal.