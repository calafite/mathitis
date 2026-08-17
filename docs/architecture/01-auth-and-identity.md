# 01. Authentication & Identity Architecture

This domain handles user accounts, role definitions, secure session tokens, password recovery, and email verification.

---

## 🔑 Core Database Models

```sql
-- Enums
CREATE TYPE user_role AS ENUM ('freshman', 'senior', 'administrator', 'developer');
CREATE TYPE account_status AS ENUM ('pending_verification', 'active', 'suspended', 'deactivated');
CREATE TYPE token_type AS ENUM ('email_verification', 'password_reset');

-- Users Core (Soft Delete for Lineage Preservation)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'freshman',
    semester SMALLINT NOT NULL, -- e.g. 1 to 12
    status account_status NOT NULL DEFAULT 'pending_verification',
    deleted_at TIMESTAMPTZ, -- Soft delete: preserves lineage graph when users leave
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Secure Tokens (Email Verification, Password Reset)
CREATE TABLE user_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL, -- Argon2id hash of the token sent via email
    type token_type NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ, -- Null until used; prevents token reuse
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_users_role_status ON users(role, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_user_tokens_user_type ON user_tokens(user_id, type) WHERE consumed_at IS NULL;
```

---

## 🔒 Security & Session Safeguards

1. **Password Hashing (Argon2id)**:
   - Uses Argon2id with high-entropy parameters matching modern cryptographic recommendations (e.g., Memory: 64MB, Iterations: 3, Parallelism: 4).
2. **Secure Session Management**:
   - Session tokens are signed, HttpOnly, SameSite=Strict, Secure cookies. No JWTs in localStorage to completely protect browsing sessions from XSS token theft.
3. **Email Enumeration Prevention**:
   - Both `/api/auth/register` and `/api/auth/recover` return an identical `200 OK` generic response regardless of whether the email/handle exists in the database.
   - For `/api/auth/recover`, if the user exists, a token is created, Argon2id-hashed in the database, and the plain token is sent via email. If not, the application fails silently.
4. **Token Verification Protocol**:
   - Verification emails and reset links contain a cryptographically secure plain token (e.g., 32 random bytes in hex).
   - The backend retrieves the `user_tokens` row, hashes the input plain token, and compares it securely (`crypto.timingSafeEqual`) to the saved database `token_hash`.
   - Ensure `consumed_at` is null and `expires_at > NOW()`.

---

## 🛡️ Role-Based Access Control (RBAC)

Every route checks permissions based on the user session role:

| Action / Permission | Freshman | Senior | Administrator | Developer |
| :--- | :---: | :---: | :---: | :---: |
| Browse Mentors & Discovery Hub | ✅ | ✅ | ✅ | ✅ |
| Customize Profile, Banner, Theme & Cards | ✅ | ✅ | ✅ | ✅ |
| Submit Mentorship Application | ✅ | ❌ | ❌ | ❌ |
| Accept/Reject Incoming Applications | ❌ | ✅ | ✅ (Override) | ❌ |
| Manage Global System Configurations | ❌ | ❌ | ✅ | ❌ |
| Moderate Profiles, Banners, Cards, Users | ❌ | ❌ | ✅ | ❌ |
| Inspect System Audit Logs | ❌ | ❌ | ✅ | ❌ |
| View System Telemetry, Metrics & Queue Logs | ❌ | ❌ | ❌ | ✅ |
| Database Migrations & Runtime Diagnostics | ❌ | ❌ | ❌ | ✅ |

---

## 🔄 User Account Lifecycle & Deletion Rules

1. **Soft Delete & Anonymisation**:
   - **No hard deletions** are permitted on `users`. If a user requests account deletion, a soft delete is triggered.
   - The system sets `deleted_at = NOW()`, sets `status = 'deactivated'`, and anonymises the `profiles` table row (clears biography, banners, avatar URL, optional contact links, and replaces the handle with `user_<uuid>`).
   - This ensures foreign key constraints on the `mentorships` table remain intact, preserving the historical department lineage graph for the remaining community.
   - All standard application queries must explicitly append `WHERE deleted_at IS NULL`.
