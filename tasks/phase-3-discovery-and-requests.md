# Phase 3: Discovery Catalog, Algorithmic Matching, Lineage Graph & Mentorship Engine

## Objective
Enable freshmen to discover mentors through rich profile previews, public-optional contact info, algorithmic compatibility scoring, and "Bump/Like" interactions (max 4 active, reallocatable); view department mentorship lineage trees; submit mentorship requests (which securely reveals the freshman's profile to the target senior); and allow seniors/admins to approve or reject requests within transactional concurrency limits. Mentorships are permanent family-like links (no completion/termination).

## Tasks
- [ ] **3.1 Discovery Catalog & Algorithmic Matching API**
  - Implement `GET /api/seniors` returning discoverable senior mentors (`is_discoverable = true`) with filters for semester, tags, card types, and availability.
  - Implement `GET /api/recommendations` calculating a dynamic compatibility score:
    - Weighted algorithm: 40% Tag/Interest overlap + 30% Profile Effort/Complexity Score (bio word count, markdown headers, card count) + 10% Profile Views + 20% Freshman Bumps.
  - Implement `POST /api/profiles/:handle/bump` allowing freshmen to "bump/like" a senior's profile once to signal interest and boost their recommendation rank.
    - **Enforce max 4 active bumps per freshman** (`COUNT(*) FROM profile_bumps WHERE freshman_id = $1 <= 4`).
    - **Reallocation support**: `DELETE` existing bump + `INSERT` new bump in single transaction to "move" affinity.
  - Implement `GET /api/tags` returning categorized tags with colors and icons.
- [ ] **3.2 Freshman Profile Privacy & Request-Based Discovery**
  - Enforce freshman discoverability policy: Freshman profiles default to `is_discoverable = false` (hidden from public mentor discovery catalog).
  - When a Freshman submits a request (`POST /api/requests`), dynamically grant the target Senior permission to view the Freshman's rich profile (bio, rich cards, semester) within their incoming request inbox.
- [ ] **3.3 Transactional & Idempotent Request API (Safeguards)**
  - Implement dynamic `X-Idempotency-Key` middleware backed by Redis for request creation and state changes (`POST /api/requests`, `POST /api/requests/:id/accept`).
    - **Explicit TTL enforcement**: All idempotency keys stored with mandatory 24-hour TTL (`SETEX key 86400 value`) to prevent Redis memory leaks.
  - Implement `POST /api/requests/:id/accept` wrapped in PostgreSQL row-locking (`SELECT FOR UPDATE`) on the senior's profile row to prevent over-subscription race conditions.
  - **Partial unique index for re-applications**: `mentorship_requests` unique constraint only on active statuses (`WHERE status IN ('pending', 'pending_admin_approval', 'accepted')`) so `rejected`/`cancelled` requests don't block future applications to the same senior in later semesters.
  - Read `REQUIRE_ADMIN_REQUEST_APPROVAL` configuration at runtime:
    - If `true`, transition request to `pending_admin_approval`.
    - If `false`, transition request to `accepted` and record permanent entry in `mentorships` with current semester/academic year tags (no completion/termination state).
  - Automatically transition remaining pending requests to `cancelled_capacity_filled` when a senior's active mentees reach `max_mentees`.
- [ ] **3.4 Mentorship Lineage Graph Engine (Permanent Family Links)**
  - `mentorships` table uses `ON DELETE RESTRICT` on user FKs + `users.deleted_at` soft deletes to preserve lineage when users leave.
  - Implement `GET /api/lineage` and `GET /api/lineage/:handle` endpoints querying historical `mentorships` records grouped by semester/academic year.
  - Build interactive **Mentorship Lineage Canvas** UI (`/lineage`) using React Flow or SVG node-graphs displaying mentor-mentee trees, ancestral roots, and co-mentee clusters across academic years.
- [ ] **3.5 Discovery & Inbox UI**
  - Build Senior Discovery grid page featuring algorithmic sorting, "Bump/Like" action buttons (with 4-bump limit indicator), tag filtering, and public-optional contact link widgets (GitHub, Discord, direct email).
  - Build Senior Request Inbox UI allowing seniors to inspect full applicant freshman profiles before accepting or declining.
  - Build Freshman Mentorship Hub showing active request tracker, status updates, and connected mentor details (permanent family link).
