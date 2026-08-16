# Architectural Specification & Blueprint
# Computer Science Mentorship Platform (*Mathitis*)

---

## 1. Executive Summary & Vision

*Mathitis* is an internal university mentorship platform built specifically for Computer Science students. It bridges the gap between incoming freshmen and experienced senior students.

A foundational pillar of the platform is **Profile Richness and Visual Expressiveness**. The platform rejects sterile minimalism in favor of rich, vibrant, student-curated digital spaces. Profiles serve as personal showcases where students express their technical and creative identities through:
- Custom profile banners, color palettes, and theme accents.
- Native extended Markdown with support for colored text spans, visual callouts, badges, and custom styling.
- Rich interactive cards for favorite songs (Spotify/SoundCloud embeds), video games (Steam/IGDB metadata), films (Letterboxd/TMDB cards), tech stacks, and custom media showcases.
- Visual status indicators, animated avatar accents, and customizable grid layouts.

The platform balances visual freedom with strict backend-enforced RBAC permissions, transactional concurrency safety, field-level privacy controls, comprehensive security sanitization, and enterprise-grade architectural safeguards.

---

## 2. Pre-Architecture Analysis: Edge Cases & Resolved Ambiguities

| Decision Area | Dilemma / Edge Case | Resolved Architectural Decision |
| :--- | :--- | :--- |
| **1. Identity & Enrolment** | How to verify CS student status before university SSO integration? | Enforce institutional email domain validation (`@university.edu` / `@cs.uni.edu`) on registration, mandatory semester selection, and password recovery via secure email tokens. Maintain an abstraction layer (`IAuthService`) for future SSO drop-in. |
| **2. Request Concurrency** | Race condition when a Senior with 1 slot left receives multiple concurrent requests or Admin approvals. | Use PostgreSQL transactional row locking (`SELECT FOR UPDATE`) on the Senior profile row during acceptance. Upon reaching `max_mentees`, automatically transition remaining `pending` requests for that Senior to `cancelled_capacity_filled` with automated student notification. |
| **3. Privacy & Contact Info** | Contact info visibility and Freshman profile discoverability. | **Contact Information**: Public but strictly **optional** for any student to display. **Freshman Discoverability**: Freshmen profiles are hidden from the public catalog by default; they become visible exclusively to a Senior (and Admins) when the Freshman submits a mentorship request to that Senior. |
| **4. Approval Workflow** | Administrators can toggle between *Direct Senior Acceptance* and *Admin Approval Required*. | System configuration key `REQUIRE_ADMIN_REQUEST_APPROVAL` (boolean) manageable dynamically via the protected Admin Dashboard (`/admin`). Protected by backend RBAC authorization and frontend route guards. |
| **5. Mentorship Lineage & Platform Focus** | Focus is on mentor discovery and manifesting interest. How to capture value after assignment? | The platform centers on discovery, profile curation, and matching during the assignment window. To preserve long-term value across academic cycles, a **Mentorship Lineage Graph** visually displays historical mentor-mentee trees and co-mentee connections across semesters. |
| **6. Algorithmic Mentor Matching** | How to help Freshmen discover the best-fitting Senior mentors? | Implement an algorithmic score based on: (1) Tag/interest overlap, (2) Profile effort/complexity (bio word count, markdown formatting, rich card count), (3) Profile views, and (4) Freshmen "Bumps/Likes". |
| **7. Expressive Content Security** | Allowing rich markdown, custom colors, and external embeds introduces XSS and layout break risks. | Markdown is sanitized using `rehype-sanitize` with a strict whitelist schema (custom color attributes, safe iframes for Spotify/YouTube, CSS variable-scoped color spans) combined with server-side validation against malicious script injection. |
| **8. Network Security & Firewall** | Protecting the application layer, ports, and data in transit. | **TLS/HTTPS Everywhere**: Enforce TLS 1.3, Strict-Transport-Security (HSTS), and HTTPS redirects via reverse proxy (Nginx/Caddy). **Firewall & Port Hardening**: Expose only ports 80/443 to the public internet; isolate PostgreSQL, Redis, and internal APIs on a private Docker bridge network. |
| **9. Developer Role Scope** | Developer role must not leak user PII while allowing technical maintenance. | Developer permissions strictly grant access to system diagnostics, error logs, queue telemetry, feature flag toggles, and schema migration status. Direct access to PII tables (emails, bios, contact details) is prohibited via backend API authorization filters. |
| **10. Duplicate Requests & Network Retries** | Network latency or button double-clicking leading to duplicate requests or state corruption. | Enforce `X-Idempotency-Key` middleware backed by Redis for all state-mutating requests (`POST`, `PUT`, `DELETE`). Return cached response on duplicate attempts within 24 hours. |
| **11. Secrets & Config Leaks** | Misconfigured environment variables causing silent failures or credential exposure in logs. | Enforce Zod environment variable schema validation at process launch. Strip passwords, emails, tokens, and authorization headers from Pino structured logs automatically via path redaction. |

---

## 3. Technology Stack & Architectural Principles

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                   NETWORK EDGE & REVERSE PROXY HARDENING                         │
│   TLS 1.3 / HSTS Header Injection / WAF Filtering / Port Exposure Hardening      │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTPS / Port 443
┌────────────────────────────────────────▼─────────────────────────────────────────┐
│                               MODULAR MONOLITH                                   │
│                                                                                  │
│   ┌──────────────────────────────────────────────────────────────────────────┐   │
│   │                         React 18 SPA (Vite)                              │   │
│   │    Tailwind CSS │ Radix UI │ TanStack Query v5 │ Zustand │ Zod            │   │
│   │    Rehype / Remark Pipeline │ React Flow / D3 Lineage │ Framer Motion    │   │
│   └──────────────────────────────────┬───────────────────────────────────────┘   │
│                                      │ REST API (JSON) / Correlation ID          │
│   ┌──────────────────────────────────▼───────────────────────────────────────┐   │
│   │                      Node.js / Fastify Server                            │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│   │  │ Auth Module  │  │Profile Module│  │Request Module│  │ Admin Module │  │   │
│   │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │   │
│   │         │          ┌──────────┴───────────┐         │          │          │   │
│   │         │          │ Analytics / Matching │         │          │          │   │
│   │         └──────────┼──────────────────────┼─────────┘          │          │   │
│   │                    │ Prisma ORM           │ BullMQ Event Bus   │          │   │
│   └────────────────────┼──────────────────────┼────────────────────┘          │   │
│                        │                      │                               │   │
│           ┌────────────▼──────┐      ┌────────▼──────────┐                    │   │
│           │ PostgreSQL 16 DB  │      │  Redis / Sentry   │                    │   │
│           └───────────────────┘      └───────────────────┘                    │   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Technology Selections & Justifications

* **Network Edge & Security**:
  * **Reverse Proxy (Nginx / Caddy)**: Terminates TLS 1.3, enforces Strict-Transport-Security (HSTS), manages rate limits, and buffers payloads against DDoS attacks.
  * **Network Isolation**: Only ports 80/443 exposed publicly. Internal Fastify server (4000), PostgreSQL (5432), and Redis (6379) communicate exclusively across isolated private Docker networks.

* **Frontend**:
  * **React 18 (Vite + TypeScript)**: Fast bundling, rich component ecosystem, high developer velocity.
  * **Tailwind CSS + Radix UI Primitives**: Accessible, unstyled primitives coupled with utility classes for expressive, customized profile themes.
  * **TanStack Query (v5)**: Declarative server-state caching, optimistic updates, and automatic re-fetching.
  * **Zustand**: Minimalist client state for modals, drawers, and active preview states.
  * **React Flow / SVG Lineage Engine**: Interactive visual node-graph renderer for multi-semester mentorship trees (showing mentors, mentees, and co-mentees).
  * **React-Markdown + Rehype-Sanitize + Rehype-Raw + Remark-Gfm**: Native markdown parsing supporting colored text spans, custom badges, code highlighting, and sanitized HTML embeds.
  * **Sentry React SDK**: Client-side error tracking with route context and stack traces.
  * **Framer Motion**: Smooth micro-interactions, layout transitions, and rich card hover effects.
  * **React Hook Form + Zod**: Strict runtime schema validation for complex forms.

* **Backend**:
  * **Node.js with Fastify (TypeScript)**: Schema-based JSON serialization, built-in plugin encapsulation for modular domains, and high throughput.
  * **Algorithmic Matching Engine**: In-memory score calculator scoring profiles on tag overlap, bio effort complexity, profile view analytics, and freshman "Bump" counts.
  * **Pino & Sentry Node SDK**: Structured JSON logging with `x-request-id` correlation, strict PII redaction, and global exception monitoring.
  * **Prisma ORM**: Type-safe relational database queries, migration engine, and JSONB column support for rich card metadata.
  * **PostgreSQL 16**: Relational integrity, row-level locking for concurrency control, full-text search, and JSONB indices.
  * **Redis + BullMQ**: Asynchronous background workers for email dispatch, notifications, and scheduled request cleanup.
  * **Sharp & S3 / MinIO**: Pre-signed upload URLs with server-side image processing, thumbnail generation, and metadata stripping.

---

## 4. Rich & Expressive Profile Architecture

To satisfy the core requirement of rich, expressive, student-curated profiles, the architecture provides a multi-layered customization engine:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          EXPRESSIVE PROFILE STRUCTURE                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 1. BANNER & HEADER HERO                                                         │
│    • Custom Banner Image / Animated Gradients / Pattern Overlays                │
│    • Avatar with Customizable Glow/Border Accent Color                          │
│    • Social Name, Pronouns, Current Semester & Course Tag                       │
│    • Availability Badge ("Accepting 2 Mentees" / "Capacity Full")               │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 2. THEME & COLOR PALETTE ENGINE                                                 │
│    • User-selected primary, accent, and background tint tokens                  │
│    • Dynamic CSS variables injected into profile container:                     │
│      --profile-primary, --profile-accent, --profile-card-bg                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 3. RICH MARKDOWN BIOGRAPHY                                                      │
│    • Extended Markdown syntax:                                                  │
│      - Colored text spans: `[text]{color="#ff4444"}` or `<span class="...">`   │
│      - Callout blocks: `> [!NOTE]`, `> [!TIP]`, `> [!QUOTE]`                    │
│      - Tech stack badges & dynamic status badges                                │
│      - Syntax highlighted code snippets for favorite algorithms/projects        │
├─────────────────────────────────────────────────────────────────────────────────┤
│ 4. MODULAR SHOWCASE GRID (Rich Visual Cards)                                    │
│    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │
│    │  🎵 Song Card    │  │  🎮 Game Card    │  │  🎬 Film Card    │             │
│    │  Spotify Embed / │  │  Cover Art, Rank,│  │  Poster, Rating, │             │
│    │  Audio Waveform  │  │  Steam/IGDB Sync │  │  Letterboxd link │             │
│    └──────────────────┘  └──────────────────┘  └──────────────────┘             │
│    ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │
│    │  💻 Tech Stack   │  │  🏆 Showcase     │  │  🌐 Social Links │             │
│    │  Interactive tag │  │  Hackathon/Side  │  │  GitHub, Discord,│             │
│    │  cloud & icons   │  │  Project Show    │  │  LinkedIn icons  │             │
│    └──────────────────┘  └──────────────────┘  └──────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Markdown Color & Extension Pipeline

To render custom colors and rich callouts safely:
1. **Parser Pipeline**: `remark-gfm` -> `remark-directive` -> `rehype-raw` -> `rehype-sanitize` -> `rehype-highlight`.
2. **Sanitization Whitelist**:
   - `<span>`, `<div>`, `<code>`, `<pre>`, `<blockquote>`, `<img>`, `<iframe>` (Spotify/YouTube embeds only).
   - Allowed attributes: `class`, `style` (restricted strictly to `color`, `background-color`, `text-align`), `data-*`.
   - Disallow `script`, `onerror`, `onload`, javascript URI schemes.

---

## 5. Database Schema Design (PostgreSQL)

```sql
-- Enums
CREATE TYPE user_role AS ENUM ('freshman', 'senior', 'administrator', 'developer');
CREATE TYPE account_status AS ENUM ('pending_verification', 'active', 'suspended', 'deactivated');
CREATE TYPE request_status AS ENUM ('pending', 'pending_admin_approval', 'accepted', 'rejected', 'cancelled');
CREATE TYPE mentorship_status AS ENUM ('active', 'completed', 'terminated');
CREATE TYPE rich_card_type AS ENUM ('song', 'game', 'film', 'book', 'project', 'custom');

-- Users Core
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle VARCHAR(32) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'freshman',
    semester SMALLINT NOT NULL, -- e.g. 1 to 12
    status account_status NOT NULL DEFAULT 'pending_verification',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

-- Freshmen Bumps / Likes (Interest Signal for Seniors)
CREATE TABLE profile_bumps (
    freshman_id UUID REFERENCES users(id) ON DELETE CASCADE,
    senior_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (freshman_id, senior_id)
);

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

-- Mentorship Requests
CREATE TABLE mentorship_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    freshman_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    senior_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status request_status NOT NULL DEFAULT 'pending',
    message TEXT NOT NULL,
    rejection_reason TEXT,
    reviewed_by_admin_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_active_request UNIQUE (freshman_id, senior_id)
);

-- Active & Historical Mentorship Relationships (Powers Lineage Graph)
CREATE TABLE mentorships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID UNIQUE NOT NULL REFERENCES mentorship_requests(id),
    freshman_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    senior_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    semester SMALLINT NOT NULL, -- e.g. 1 to 12
    academic_year VARCHAR(10) NOT NULL, -- e.g. "2025-2026"
    status mentorship_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    termination_reason TEXT
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
CREATE INDEX idx_users_role_status ON users(role, status);
CREATE INDEX idx_profiles_accepting ON profiles(is_accepting_requests);
CREATE INDEX idx_requests_freshman ON mentorship_requests(freshman_id, status);
CREATE INDEX idx_requests_senior ON mentorship_requests(senior_id, status);
CREATE INDEX idx_mentorships_senior_status ON mentorships(senior_id, status);
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

## 8.5 Algorithmic Mentor Matching Engine

To assist freshmen in discovering the most compatible mentors during the early matching phase, *Mathitis* implements a lightweight, analytical scoring engine:

$$\text{Profile Compatibility Score} = w_1 \cdot T_o + w_2 \cdot E_p + w_3 \cdot V_p + w_4 \cdot B_p$$

* **1. Tag Overlap ($T_o$ - Weight: 40%)**: Counts shared tag items (e.g., matching courses, tech stacks, or interest categories) between the Freshman's profile and the Senior's profile.
* **2. Profile Effort & Complexity ($E_p$ - Weight: 30%)**: Derived from the richness of the Senior's profile. Computed based on biography word-count, markdown complexity (use of custom headers, badges, colors, and blocks), and the total number of customized Rich Cards added (up to a max-cap score of 100).
* **3. Profile Popularity / Views ($V_p$ - Weight: 10%)**: Logarithmically scaled count of unique student biography views (`profile_views`) to prevent popular seniors from locking out others while still surfacing highly sought-after profiles.
* **4. Freshman Bumps ($B_p$ - Weight: 20%)**: Total number of high-affinity "bumps" (`bump_count`) received by the senior from browsing freshmen. Freshmen can hit the "Bump/Like" button once per senior profile.

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

# Mentorships Active & Historical Records
GET    /api/mentorships/active          # Get active mentorship relationship & details
POST   /api/mentorships/:id/complete    # Mark mentorship as successfully completed (recorded for lineage)
POST   /api/mentorships/:id/terminate   # Early termination with reason code

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
* **Secure File Upload Pipeline**:
  * Image uploads (avatars/banners) undergo multi-layered checks: size limits, verification of magic bytes (MIME sniffing), EXIF metadata scrubbing, and conversion to standardized WebP formats using **Sharp** before storage in S3/MinIO bucket.
* **Least Privilege Credentials**:
  * Application and CI/CD runners use separated database users. The application database user has only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions, whereas schema migrations are performed by a migration user with administrative schema controls.
* **Secrets Management**:
  * Secrets are separated from code and loaded exclusively from environment variables. These are validated *at process startup* using a Zod schema config validator. The application will immediately crash and refuse to start if any crucial secret is missing or malformed.
* **Secret Rotation**:
  * Session keys and JWT tokens are designed to support seamless rotation by accepting key rings/arrays of valid secrets.

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
