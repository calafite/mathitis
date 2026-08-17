# Mathitis — Architecture Entry Point

This repository follows a **modular architecture documentation** strategy. The canonical domain specifications live in `docs/architecture/`.

---

## 📁 Domain Architecture Files

| # | File | Domain Scope | Start Here For Tasks Involving... |
|---|------|--------------|-----------------------------------|
| 1 | [`docs/architecture/01-auth-and-identity.md`](docs/architecture/01-auth-and-identity.md) | Auth, User Tokens, Soft Deletes, Email Verification, RBAC | Login, Register, Recovery, Sessions, Roles, Account Deletion |
| 2 | [`docs/architecture/02-profile-and-expressive-studio.md`](docs/architecture/02-profile-and-expressive-studio.md) | Profiles, Themes, Markdown Engine, Rich Cards, Sharp Uploads | Profile Customization, Banners, Avatars, Cards, Markdown |
| 3 | [`docs/architecture/03-discovery-matching-and-requests.md`](docs/architecture/03-discovery-matching-and-requests.md) | Search, Algorithmic Matching, Bumps, Requests, Concurrency | Discovery Catalog, Matching Engine, Bumps, Requests |
| 4 | [`docs/architecture/04-mentorships-and-lineage-graph.md`](docs/architecture/04-mentorships-and-lineage-graph.md) | Mentorships (Family-like), Lineage Graph, Anonymization | Mentorships, Lineage Trees, User Deletion, Co-mentees |
| 5 | [`docs/architecture/05-admin-and-developer-portals.md`](docs/architecture/05-admin-and-developer-portals.md) | Admin Config, Path Protection, Telemetry, Audit Logs | System Config, Admin Dashboard, Developer Portal |
| 6 | [`docs/architecture/06-safeguards-security-and-ops.md`](docs/architecture/06-safeguards-security-and-ops.md) | TLS, WAF, Sentry, Pino, Idempotency TTL, CI/CD, Docker | Sentry, Logging, TLS, Rate Limiting, CI/CD, Docker |

---

## 🧭 Quick Navigation

**Index & Agent Guide**: [`docs/architecture/README.md`](docs/architecture/README.md) — contains the 10 non-negotiable invariants and task-to-file mapping.

**Design Rules**: [`design.md`](design.md) — coding standards, patterns, conventions, and execution requirements.

**Implementation Phases**: `tasks/phase-1-foundation-and-auth.md` through `tasks/phase-6-testing-and-deployment.md`

---

## ⚡ The 10 Invariants (Must Adhere in All Work)

1. **Soft Delete for Lineage** — No hard deletes on `users`; `deleted_at` + anonymize; `mentorships` FKs `ON DELETE RESTRICT`.
2. **Freshman Privacy** — `is_discoverable = false` by default; revealed only to target senior on request submission.
3. **Server-Side Image Pipeline** — No direct S3 uploads; Fastify → Sharp (EXIF strip + WebP) → S3.
4. **Permanent Mentorships** — No completion/termination; `mentorship_status = ('active')` only.
5. **Partial Unique Request Index** — `UNIQUE(freshman_id, senior_id) WHERE status IN ('pending', 'pending_admin_approval', 'accepted')`.
6. **Bump Limit (4)** — Max 4 active bumps per freshman; reallocation = DELETE + INSERT in transaction.
7. **Email Enumeration Prevention** — `POST /auth/recover` & `POST /auth/register` always return `200 OK` identical body.
8. **Idempotency TTL** — `X-Idempotency-Key` Redis entries **must** have 24-hour TTL (`SETEX key 86400`).
9. **Strict Path Protection** — `/admin/*` & `/dev/*` guarded by `<RoleGuard />` + Fastify pre-handler hooks (403 + audit log).
10. **Zod Boundary Validation** — Startup env validation (`env.schema.ts`); all HTTP input validated at edge before domain logic.

---

## 🛠️ Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Radix UI, TanStack Query v5, Zustand, React Hook Form + Zod, React Flow/D3, Framer Motion, Sentry |
| **Backend** | Fastify, TypeScript, Prisma ORM, PostgreSQL 16, Redis + BullMQ, Argon2id, Pino, Sentry, Zod schemas |
| **Edge** | Nginx/Caddy (TLS 1.3, HSTS, CSP, WAF), MinIO/S3 |
| **CI/CD** | GitHub Actions (format → lint → typecheck → test → build → audit) |
| **Deploy** | Multi-stage Docker (non-root), docker-compose (internal networks), health checks |

---

<<<<<<< HEAD
> For detailed specifications, always read the relevant domain file in `docs/architecture/` before implementing changes.
=======
## 5. Database Schema Design (PostgreSQL)

```sql
-- Enums
CREATE TYPE user_role AS ENUM ('freshman', 'senior', 'administrator', 'developer');
CREATE TYPE account_status AS ENUM ('pending_verification', 'active', 'suspended', 'deactivated');
CREATE TYPE request_status AS ENUM ('pending', 'pending_admin_approval', 'accepted', 'rejected', 'cancelled');
CREATE TYPE mentorship_status AS ENUM ('active'); -- Family-like relationship; no completion/termination state
CREATE TYPE token_type AS ENUM ('email_verification', 'password_reset');
CREATE TYPE rich_card_type AS ENUM ('song', 'game', 'film', 'book', 'project', 'custom');

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
CREATE INDEX idx_user_tokens_user_type ON user_tokens(user_id, type) WHERE consumed_at IS NULL;

-- Rich Profiles
CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    social_name VARCHAR(100) NOT NULL,
    pronouns VARCHAR(50),
    tagline VARCHAR(200),
    biography_markdown TEXT,
    avatar_url VARCHAR(512),
    banner_url VARCHAR(512),
    banner_preset VARCHAR(50) DEFAULT 'gradient_cosmic', -- preset or custom
    theme_palette JSONB DEFAULT '{
        "primaryColor": "#6366f1",
        "accentColor": "#ec4899",
        "badgeColor": "#3b82f6",
        "cardStyle": "glassmorphic"
    }'::jsonb,
    max_mentees SMALLINT NOT NULL DEFAULT 3,
    is_accepting_requests BOOLEAN NOT NULL DEFAULT true,
    is_discoverable BOOLEAN NOT NULL DEFAULT true, -- Freshmen default false; Seniors default true
    social_links JSONB DEFAULT '{}'::jsonb, -- Public but optional: {"github": "...", "linkedin": "...", "discord": "..."}
    contact_email VARCHAR(255), -- Public but optional direct contact email
    profile_views INT NOT NULL DEFAULT 0,
    bump_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_profiles_discoverable ON profiles(is_discoverable) WHERE is_discoverable = true;

-- Freshmen Bumps / Likes (Max 4 active per freshman; reallocatable)
CREATE TABLE profile_bumps (
    freshman_id UUID REFERENCES users(id) ON DELETE CASCADE,
    senior_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (freshman_id, senior_id)
);
-- Application enforces: COUNT(*) WHERE freshman_id = $1 <= 4
-- Reallocation: DELETE old bump, INSERT new one (single transaction)

-- Tag Taxonomy
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'general', -- 'interest', 'course', 'tech_stack', 'hobby'
    color_hex VARCHAR(7) DEFAULT '#4f46e5',
    icon_name VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_tags (
    profile_id UUID REFERENCES profiles(user_id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, tag_id)
);

-- Rich Media Cards & Visual Showcases
CREATE TABLE rich_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES profiles(user_id) ON DELETE CASCADE,
    card_type rich_card_type NOT NULL,
    title VARCHAR(150) NOT NULL,
    subtitle VARCHAR(150),
    description TEXT,
    image_url VARCHAR(512),
    external_url VARCHAR(512),
    embed_url VARCHAR(512), -- for Spotify, Soundcloud, YouTube widget
    accent_color VARCHAR(7) DEFAULT '#6366f1',
    metadata JSONB DEFAULT '{}'::jsonb, -- e.g. Spotify URI, Steam app ID, Letterboxd rating, genres
    display_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mentorship Requests (Partial Unique Index: allows re-apply after rejection)
CREATE TABLE mentorship_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freshman_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    senior_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status request_status NOT NULL DEFAULT 'pending',
    message TEXT NOT NULL,
    rejection_reason TEXT,
    reviewed_by_admin_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Only one ACTIVE request per pair at a time
CREATE UNIQUE INDEX unique_active_request ON mentorship_requests (freshman_id, senior_id)
WHERE status IN ('pending', 'pending_admin_approval', 'accepted');

-- Active & Historical Mentorship Relationships (Powers Lineage Graph)
-- NO CASCADE DELETE on user FKs: preserves lineage when users are soft-deleted
CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID UNIQUE NOT NULL REFERENCES mentorship_requests(id),
    freshman_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    senior_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    semester SMALLINT NOT NULL, -- e.g. 1 to 12
    academic_year VARCHAR(10) NOT NULL, -- e.g. "2025-2026"
    status mentorship_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- No ended_at / termination_reason: mentorship is a permanent family link
);

-- In-App Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'REQUEST_RECEIVED', 'REQUEST_ACCEPTED', 'ADMIN_APPROVED', etc.
    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dynamic System Configuration
CREATE TABLE system_config (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Security & Administrative Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_entity VARCHAR(50) NOT NULL,
    target_id VARCHAR(255),
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance Indexes
CREATE INDEX idx_users_role_status ON users(role, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_users_deleted ON users(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX idx_profiles_accepting ON profiles(is_accepting_requests);
CREATE INDEX idx_profiles_discoverable ON profiles(is_discoverable) WHERE is_discoverable = true;
CREATE INDEX idx_requests_freshman ON mentorship_requests(freshman_id, status);
CREATE INDEX idx_requests_senior ON mentorship_requests(senior_id, status);
CREATE INDEX idx_mentorships_senior_status ON mentorships(senior_id, status);
CREATE INDEX idx_mentorships_freshman ON mentorships(freshman_id, status);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_rich_cards_profile ON rich_cards(profile_id, display_order);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
```

---

## 6. RBAC & Profile Privacy Matrix

### Role Permissions

| Action / Permission | Freshman | Senior | Administrator | Developer |
| :--- | :---: | :---: | :---: | :---: |
| **Browse Mentors & Discovery Hub** | ✅ | ✅ | ✅ | ✅ |
| **Customize Profile, Banner, Theme & Cards** | ✅ | ✅ | ✅ | ✅ |
| **Submit Mentorship Application** | ✅ | ❌ | ❌ | ❌ |
| **Accept/Reject Incoming Applications** | ❌ | ✅ | ✅ (Override) | ❌ |
| **Manage Global System Configurations** | ❌ | ❌ | ✅ | ❌ |
| **Moderate Profiles, Banners, Cards, Users** | ❌ | ❌ | ✅ | ❌ |
| **Inspect System Audit Logs** | ❌ | ❌ | ✅ | ❌ |
| **View System Telemetry, Metrics & Queue Logs** | ❌ | ❌ | ❌ | ✅ |
| **Database Migrations & Runtime Diagnostics** | ❌ | ❌ | ❌ | ✅ |

### Profile Data Privacy Boundaries

| Data Field | Anonymous / Public | Authenticated Student | Active Mentor / Mentee | Admin / Dev |
| :--- | :---: | :---: | :---: | :---: |
| **Handle, Social Name, Pronouns, Semester** | ❌ | ✅ | ✅ | ✅ |
| **Banner, Custom Theme, Markdown Bio** | ❌ | ✅ | ✅ | ✅ |
| **Tags, Tech Stack & Rich Media Cards** | ❌ | ✅ | ✅ | ✅ |
| **Direct Contact Email & Social Links (Optional)** | ❌ | ✅ (If added) | ✅ (If added) | ✅ |
| **Freshman Profile Discoverability** | ❌ | ❌ (Unless Senior has received request) | ✅ | ✅ |
| **Application Notes & Reviewer History** | ❌ | ❌ | ❌ | ✅ |
| **Audit Logs & IP Addresses** | ❌ | ❌ | ❌ | ✅ (Admin only) |

---

## 7. Core Workflows & State Machines

```
──────────────────────────────────────────────────────────────────────────────────
1. FRESHMAN DISCOVERY & MENTORSHIP APPLICATION FLOW
──────────────────────────────────────────────────────────────────────────────────
 Freshmen                    Frontend App                 Backend API                Database
    │                             │                            │                        │
    ├─── Browse Discovery Grid ──►│                            │                        │
    │    (Search, Tags, Cards)    ├─── GET /api/seniors ──────►│                        │
    │                             │◄── Return Profile List ────┤                        │
    │                             │                            │                        │
    ├─── View Rich Profile Card ─►├─── GET /api/profiles/:h ──►│                        │
    │    (Theme, Cards, Banners)  │◄── Profile + Rich Cards ───┤                        │
    │                             │                            │                        │
    ├─── Click "Apply for Mentor" │                            │                        │
    │    (Fills pitch & goals)    ├─── POST /api/requests ────►│                        │
    │                             │    {seniorId, message}     ├── Check max req limits │
    │                             │                            ├── Check senior capacity│
    │                             │                            ├── INSERT INTO requests │
    │                             │◄── 201 Created ────────────┼── Dispatch Notif Job   │
```

```
──────────────────────────────────────────────────────────────────────────────────
2. SENIOR DECISION & TRANSACTIONAL APPROVAL WORKFLOW
──────────────────────────────────────────────────────────────────────────────────
 Senior                       Frontend App                 Backend API                Database
    │                             │                            │                        │
    ├─── View Request Inbox ─────►├─── GET /api/requests/in ──►│                        │
    │    (Inspect Freshman cards) │◄── List Requests + Cards ──┤                        │
    │                             │                            │                        │
    ├─── Click "Accept Request" ─►├─── POST /api/req/:id/accept│                        │
    │                             │                            ├── BEGIN TRANSACTION    │
    │                             │                            ├── SELECT FOR UPDATE    │
    │                             │                            │   (Lock Senior Profile)│
    │                             │                            ├── Verify active < max  │
    │                             │                            │                        │
    │                             │    ┌───────────────────────┼──────────────────────┐ │
    │                             │    │ IF Config:            │                      │ │
    │                             │    │ Admin Approval = TRUE │                      │ │
    │                             │    ├───────────────────────┴──────────────────────┤ │
    │                             │    │ status = 'pending_admin_approval'            │ │
    │                             │    │ Push to Admin Queue                          │ │
    │                             │    │                                              │ │
    │                             │    │ ELSE:                                        │ │
    │                             │    │ status = 'accepted'                          │ │
    │                             │    │ INSERT INTO mentorships                      │ │
    │                             │    │ IF active == max: auto-cancel other pending  │ │
    │                             │    └──────────────────────────────────────────────┘ │
    │                             │                            ├── COMMIT TRANSACTION   │
    │                             │◄── 200 OK ─────────────────┴── Dispatch Realtime Ev │
```

---

## 8. Main Application Screens & Frontend Architecture

### 1. Freshman Screens
* **Discovery Grid (`/explore`)**: Visual catalog of Senior mentors. Supports multi-faceted filtering (Semester, Specialization tags, Favorite Games/Songs, Current Slot Availability, and Algorithmic Sorting). Displays cards with custom theme previews, avatar glows, and tag badges.
* **Rich Mentor Profile Modal / Page (`/seniors/:handle`)**: High-fidelity personal showcase with custom banner, theme palette, rich markdown biography with colored badges, public-optional contact link widgets (GitHub, Discord, direct email), and interactive Rich Card modules (Spotify audio player embed, Steam game display, Letterboxd film cards). Includes a prominent **"Bump/Like" button** which freshmen can tap once to signal affinity and boost the senior's match ranking, and a persistent "Apply for Mentorship" action drawer.
* **Mentorship Application Drawer**: Clean slide-over modal showing senior bio snippet, custom application statement input (with live markdown preview), and active limit counter.
* **Mentorship Lineage Graph (`/lineage`)**: Interactive visual canvas (built using React Flow or D3.js) plotting multi-semester lineage trees. Freshmen can search and see which senior mentored whom, explore co-mentorship clusters (who was mentored alongside whom), and track the academic family tree of the department across years.
* **Freshman Mentorship Hub (`/dashboard`)**: Unified space with active request status, cancel controls, and connected mentor details. Note: **Freshman profiles are hidden from the discovery catalog by default**; they become visible *exclusively* to a senior when a mentorship request is sent to that specific senior, ensuring absolute freshman privacy during discovery.

### 2. Senior Screens
* **Rich Profile Studio (`/profile/studio`)**: Interactive visual profile editor:
  * Theme picker (accent colors, glassmorphic / solid card styles, gradient presets).
  * Banner uploader with crop & preview tools.
  * Live-rendered Markdown editor with custom color picker toolbar, callout inserters, and badge generators.
  * Drag-and-drop Rich Cards manager (Spotify search, Steam/Letterboxd card builders, custom project showcase cards).
  * Optional contact details form: direct email and social media handles (fully optional, made public if populated).
* **Incoming Request Inbox (`/requests`)**: Visual board displaying applicant freshmen. Even though freshman profiles are hidden from search, seniors can inspect full portfolios (bios, rich cards, semester) of applicant freshmen who have sent them requests. Allows accepting or declining with custom notes.
* **Mentees Roster (`/mentees`)**: Active mentorship dashboard with quick communication shortcuts, progress milestones, and relationship completion actions.

### 3. Administrator Screens
* **Strict Admin Path Protection**: All administrative screens under `/admin/*` are strictly protected:
  * **Frontend**: Wrapped in high-security `<RoleGuard allowedRoles={['administrator']} />` route blocks which perform automated redirect to login if unauthorized.
  * **Backend**: Guarded by Fastify session hook checks validating `req.session.user.role === 'administrator'`. Invalid or malicious access attempts trigger HTTP `403 Forbidden`, invoke Sentry tracking, and generate an immutable entry in `audit_logs` including actor IP and handle.
* **Admin Command Center (`/admin`)**: Metric charts for mentorship matching efficiency, active requests, tag distribution, lineage graph depth, and system health.
* **Approval Queue (`/admin/approvals`)**: Dedicated workflow for approving/rejecting senior-accepted requests when dynamic admin verification is enabled.
* **User & Content Moderation (`/admin/users`)**: Searchable directory with user role toggles, suspension controls, and content moderation tools for banners/profiles violating university conduct.
* **Dynamic Configuration Engine (`/admin/config`)**: Direct dashboard switches to configure runtime configurations, including toggling the dynamic `REQUIRE_ADMIN_REQUEST_APPROVAL` workflow mode, registration windows, and request limits.
* **Audit Trail Viewer (`/admin/audit`)**: Security event log viewer with JSON payload diff inspection and IP search.

### 4. Developer Screens
* **Strict Developer Path Protection**: Access to `/dev/*` is strictly limited to users with the `developer` role, utilizing identical backend session validation and frontend `<RoleGuard allowedRoles={['developer']} />` wrappers.
* **Developer Diagnostics Portal (`/dev`)**: Real-time telemetry: Redis BullMQ worker load, database connection pool latency, API error rates, and environment configuration summaries (with zero PII exposure).
* **Database & Migration Status (`/dev/schema`)**: Visual inspector of active Prisma migrations, system tables, and background worker queues.

---



## 8.5 **Algorithmic Mentor Matching**

To assist freshmen in discovering the most compatible mentors during the early matching phase, Mathitis implements a lightweight, analytical scoring engine:

Profile Compatibility Score = w₁ · Tₒ + w₂ · Eₚ + w₃ · Vₚ + w₄ · Bₚ

1. Tag Overlap (Tₒ - Weight: 40%): Counts shared tag items (e.g., matching courses, tech stacks, or interest categories) between the Freshman's profile and the Senior's profile.

2. Profile Effort & Complexity (Eₚ - Weight: 30%): Derived from the richness of the Senior's profile. Computed based on biography word-count, markdown complexity (use of custom headers, badges, colors, and blocks), and the total number of customized Rich Cards added (up to a max-cap score of 100).

3. Profile Popularity / Views (Vₚ - Weight: 10%): Logarithmically scaled count of unique student biography views (profile_views) to prevent popular seniors from locking out others while still surfacing highly sought-after profiles.

4. Freshman Bumps (Bₚ - Weight: 20%): Total number of high-affinity "bumps" (bump_count) received by the senior from browsing freshmen. Freshmen can hit the "Bump/Like" button once per senior profile.


The matching score is computed in-memory or via simple SQL formulas during catalog query runs, returning dynamic, personalized mentor recommendations on the Freshman Discovery Hub.

---

## 9. Modular Backend Architecture & API Design

```
apps/api/src/
├── modules/
│   ├── auth/              # Registration, Login, Sessions, Argon2id, Role guards
│   ├── profiles/          # Profile CRUD, Theme & Banner engine, Privacy filters
│   ├── rich-cards/        # Rich card CRUD, metadata scrapers, Spotify/Steam embeds
│   ├── tags/              # Taxonomy management, tag categories & color tokens
│   ├── requests/          # Application submission, concurrency lock, state machine
│   ├── mentorships/       # Active relationship management, termination/completion
│   ├── notifications/     # In-app notifications & BullMQ email dispatcher
│   ├── admin/             # System config, user moderation, audit logs
│   └── dev/               # Telemetry, queue metrics, health diagnostics
├── shared/
│   ├── database/          # Prisma client & connection pool configuration
│   ├── middlewares/       # Rate limiting, Helmet, CORS, Error handling, RBAC
│   ├── sanitization/      # HTML/Markdown sanitization with rehype/DOMPurify
│   └── types/             # Shared TypeScript schemas and DTOs
```

### Core REST API Endpoints

```
# Authentication
POST   /api/auth/register               # Register new student (email domain validation)
POST   /api/auth/login                  # Authenticate and receive HttpOnly cookie
POST   /api/auth/logout                 # Invalidate session
GET    /api/auth/me                     # Get authenticated user session & role
POST   /api/auth/recover                # Request password recovery email
POST   /api/auth/reset-password         # Reset password with token

# Profiles & Expressive Showcases
GET    /api/profiles/:handle            # Get rich profile (public-optional contact details, rich cards)
PATCH  /api/profiles/me                 # Update bio, banner, theme palette, pronouns, optional contact
POST   /api/profiles/me/avatar          # Upload avatar image (validated + Sharp resized)
POST   /api/profiles/me/banner          # Upload custom banner image
POST   /api/profiles/:handle/bump       # Freshman bumps senior profile (rate-limited, 1 per user)
GET    /api/profiles/me/cards           # List user's rich media cards
POST   /api/profiles/me/cards           # Create rich card (song, game, film, custom)
PATCH  /api/profiles/me/cards/:id       # Update rich card
DELETE /api/profiles/me/cards/:id       # Delete rich card
PUT    /api/profiles/me/cards/reorder   # Reorder card display sequence

# Discovery, Algorithmic Matching & Catalog
GET    /api/seniors                     # Query discoverable senior mentors (filters: tags, semester, cards)
GET    /api/recommendations             # Top algorithmic matches (tag overlap, effort score, views, bumps)
GET    /api/tags                        # List all available interest/course tags

# Mentorship Lineage Graph
GET    /api/lineage                     # Fetch multi-semester department mentorship graph network
GET    /api/lineage/:handle             # Fetch specific student's mentor/mentee ancestral sub-tree

# Mentorship Requests & Concurrency
POST   /api/requests                    # Freshman submits mentorship application (reveals profile to senior)
GET    /api/requests/inbox              # Senior receives pending requests + inspects freshman profiles
GET    /api/requests/outbox             # Freshman tracks submitted applications
POST   /api/requests/:id/accept         # Senior accepts (with row-lock & config check)
POST   /api/requests/:id/reject         # Senior declines request
POST   /api/requests/:id/cancel         # Freshman cancels pending request

# Mentorships Active & Historical Records (Family-Like: Permanent)
GET    /api/mentorships/active          # Get active mentorship relationship & details
# No completion/termination endpoints: mentorship is a permanent family link recorded for lineage

# Notifications
GET    /api/notifications               # List user notifications
PATCH  /api/notifications/:id/read      # Mark notification as read
PATCH  /api/notifications/read-all      # Mark all as read

# Administration (Strictly Protected: RoleGuard + Fastify RBAC)
GET    /api/admin/metrics               # Global system metrics, lineage statistics, matching analytics
GET    /api/admin/users                 # Search and filter all student accounts (seniors + freshmen)
PATCH  /api/admin/users/:id/status      # Suspend / activate / update user role
GET    /api/admin/approvals             # Pending approval queue
POST   /api/admin/approvals/:id/decide  # Admin approve / reject override
GET    /api/admin/config                # Get dynamic system configurations (e.g. approval workflow toggle)
PATCH  /api/admin/config                # Update configuration flags (immediately persistent)
GET    /api/admin/audit                 # Query system audit logs (immutable with IP & actor tracking)

# Developer Diagnostics (Strictly Protected: Zero PII)
GET    /api/dev/health                  # Service health & DB latency
GET    /api/dev/metrics                 # BullMQ queue stats, active memory, connection pool
```

---

## 10. Architectural Safeguards & Operational Quality Framework

To ensure the system remains robust, maintainable, and secure as it scales, *Mathitis* implements a set of strict architectural safeguards across the frontend, backend, and operational pipeline.

### 10.1 System Reliability & Monitoring
* **Sentry (or Equivalent) Error Monitoring**: 
  * Integrates deep error tracing for both frontend and backend.
  * Captures stack traces, request context (HTTP method, headers, redacted body, request ID), frontend browser environment, release version tagging, and error severity.
  * Grouping and alerting rules notify developers of new production exceptions instantly.
* **Structured JSON Server Logs (Pino)**:
  * Emits structured logs containing correlation IDs (`x-request-id`) across middleware and database transaction boundaries.
  * Suppresses sensitive fields (e.g., passwords, recovery tokens, full student names, emails) using built-in high-performance redaction pathways.
  * Separates logs into distinct levels (`debug`, `info`, `warn`, `error`) with standard streams configured for log aggregators.
* **Graceful Degradation & Resiliency**:
  * Implement automatic retries with exponential backoff and jitter for transient failures (e.g., mail delivery or S3-compatible storage network hiccups).
  * Configure database connection pool parameters (min/max connections, idle timeouts, and queue limits) to handle traffic spikes.

### 10.2 Security & Data Hardening
* **Proper Cryptography**: Password hashing utilizes **Argon2id** with university-vetted parameter strengths (memory, iterations, parallelism) to resist modern offline attacks.
* **Secure Session Management**: Session tokens are issued as cryptographically signed HttpOnly, SameSite (Strict/Lax), Secure cookies with short lifetimes and sliding window renewal.
* **Strict Input Validation**:
  * Every single backend request is validated at the boundary using schema validators (**Zod** / Fastify JSON schema validation compiler). Malformed payloads reject early before execution of any business logic.
  * Sanitize user-curated profiles against cross-site scripting (XSS) via a tailored Markdown parser combined with secondary sanitization (DOMPurify/rehype-sanitize).
* **Rate Limiting**:
  * Implemented at the API layer with different thresholds (e.g., login/register endpoints have strict IP and handle limits, while profile browsing allows moderate concurrency).
* **Secure File Upload Pipeline (Server-Side Sanitization)**:
  * Image uploads (avatars/banners) go to Fastify first → **Sharp** processes (re-encode, strip EXIF, convert to WebP, enforce size limits) → Fastify uploads sanitized result to S3/MinIO. **No direct pre-signed URLs** — guarantees server-side validation before object storage.
* **Least Privilege Credentials**:
  * Application and CI/CD runners use separated database users. The application database user has only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions, whereas schema migrations are performed by a migration user with administrative schema controls.
* **Secrets Management**:
  * Secrets are separated from code and loaded exclusively from environment variables. These are validated *at process startup* using a Zod schema config validator. The application will immediately crash and refuse to start if any crucial secret is missing or malformed.
* **Secret Rotation**:
  * Session keys and JWT tokens are designed to support seamless rotation by accepting key rings/arrays of valid secrets.
* **Idempotency Key TTL Enforcement**:
  * All `X-Idempotency-Key` entries in Redis are stored with a mandatory **24-hour TTL** (`SETEX key 86400 value`). Automatic expiry prevents memory leaks from abandoned client requests.
* **Email Enumeration Prevention**:
  * `POST /api/auth/recover` and `POST /api/auth/register` **always return `200 OK` with identical generic messaging** regardless of whether the email/handle exists. Valid accounts receive the token via email silently; invalid accounts are discarded without disclosure.
* **Bump Allocation Limit**:
  * Freshmen may hold **maximum 4 active bumps** simultaneously (`profile_bumps` count per `freshman_id` ≤ 4). Reallocation is supported: `DELETE` an existing bump and `INSERT` a new one in a single transaction to "move" the bump to a different senior.
* **Soft Delete for Lineage Preservation**:
  * `users.deleted_at` timestamp implements soft deletion. Hard deletes are forbidden. When a user requests account removal, their profile is anonymized and `deleted_at` is set, preserving `mentorships` foreign key integrity for the lineage graph. Queries default to `WHERE deleted_at IS NULL`.
* **Partial Unique Index for Re-Applications**:
  * `mentorship_requests` uses a partial unique index `WHERE status IN ('pending', 'pending_admin_approval', 'accepted')` so that `rejected` or `cancelled` requests do not block future applications to the same senior in later semesters.

### 10.3 CI/CD & Automated Quality Gates
Every single Pull Request (PR) automatically executes an integrated GitHub Actions pipeline to prevent regression and maintain visual/logic quality:
* **Formatting & Linting**: Ensures uniform code styling via Prettier and ESLint.
* **Static Analysis / Type Checking**: Complete TypeScript compilation checks (`tsc --noEmit`).
* **Automated Test Suites**:
  * **Unit Tests**: Full coverage for pure business logic, calculations (e.g. limit calculations), and permission rules.
  * **Integration Tests**: Fastify API tests using Supertest to verify request/response lifecycles and PostgreSQL transaction behavior.
  * **Frontend Tests**: Component validation (React Testing Library) and E2E visual flows (Playwright).
* **Dependency & Security Scanning**: Integrates `pnpm audit` or equivalent to scan for vulnerable dependencies, alongside static analysis tools to check for committed raw secrets.
* **Build Verification**: Compile-step verification of the React client and Nest/Fastify server to guarantee build safety.

---

## 11. Future Extensibility Interfaces

```typescript
// 1. Recommendation & Matching Engine Interface
export interface IRecommendationEngine {
  getRecommendedMentors(
    freshmanId: string,
    limit: number
  ): Promise<Array<{ seniorId: string; score: number; matchReasons: string[] }>>;
}

// 2. Real-time Messaging Interface
export interface IMessagingService {
  sendMessage(senderId: string, recipientId: string, content: string): Promise<void>;
  getConversation(userIdA: string, userIdB: string): Promise<unknown[]>;
}

// 3. Mentorship Goals & Milestones Interface
export interface IGoalTrackingService {
  createGoal(mentorshipId: string, title: string, targetDate: Date): Promise<unknown>;
  updateGoalProgress(goalId: string, status: 'pending' | 'completed'): Promise<unknown>;
}

// 4. University SSO Provider Strategy
export interface ISSOAuthProvider {
  validateUniversityCredentials(token: string): Promise<{
    email: string;
    universityId: string;
    isEnrolled: boolean;
    academicStanding: string;
  }>;
}
```

---

## 12. Implementation Roadmap & Task Files

The project is structured into 6 sequential, verifiable phases:

1. **Phase 1**: Core Foundation, PostgreSQL/Prisma Schema, Fastify Server & Authentication Engine.
2. **Phase 2**: Expressive Profile Customization, Rich Markdown Engine, Media Storage & Rich Cards.
3. **Phase 3**: Discovery Catalog, Concurrency-Safe Application Workflow & Mentorship Roster.
4. **Phase 4**: Administrator Command Center & Developer Telemetry Portal.
5. **Phase 5**: Real-Time Notifications, Background Workers, Security Hardening & Audit Logging.
6. **Phase 6**: Automated Testing (Vitest + Supertest + Playwright) & Production Docker Deployment.
>>>>>>> 09a0639c2d3e9a8040754263da32e2a164af549e
