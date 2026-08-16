# Phase 3: Discovery Catalog, Algorithmic Matching, Lineage Graph & Mentorship Engine

## Objective
Enable freshmen to discover mentors through rich profile previews, public-optional contact info, algorithmic compatibility scoring, and "Bump/Like" interactions; view department mentorship lineage trees; submit mentorship requests (which securely reveals the freshman's profile to the target senior); and allow seniors/admins to approve or reject requests within transactional concurrency limits.

## Tasks
- [ ] **3.1 Discovery Catalog & Algorithmic Matching API**
  - Implement `GET /api/seniors` returning discoverable senior mentors (`is_discoverable = true`) with filters for semester, tags, card types, and availability.
  - Implement `GET /api/recommendations` calculating a dynamic compatibility score:
    - Weighted algorithm: 40% Tag/Interest overlap + 30% Profile Effort/Complexity Score (bio word count, markdown headers, card count) + 10% Profile Views + 20% Freshman Bumps.
  - Implement `POST /api/profiles/:handle/bump` allowing freshmen to "bump/like" a senior's profile once to signal interest and boost their recommendation rank.
  - Implement `GET /api/tags` returning categorized tags with colors and icons.
- [ ] **3.2 Freshman Profile Privacy & Request-Based Discovery**
  - Enforce freshman discoverability policy: Freshman profiles default to `is_discoverable = false` (hidden from public mentor discovery catalog).
  - When a Freshman submits a request (`POST /api/requests`), dynamically grant the target Senior permission to view the Freshman's rich profile (bio, rich cards, semester) within their incoming request inbox.
- [ ] **3.3 Transactional & Idempotent Request API (Safeguards)**
  - Implement dynamic `X-Idempotency-Key` middleware backed by Redis for request creation and state changes (`POST /api/requests`, `POST /api/requests/:id/accept`).
  - Implement `POST /api/requests/:id/accept` wrapped in PostgreSQL row-locking (`SELECT FOR UPDATE`) on the senior's profile row to prevent over-subscription race conditions.
  - Read `REQUIRE_ADMIN_REQUEST_APPROVAL` configuration at runtime:
    - If `true`, transition request to `pending_admin_approval`.
    - If `false`, transition request to `accepted` and record active entry in `mentorships` with current semester/academic year tags.
  - Automatically transition remaining pending requests to `cancelled_capacity_filled` when a senior's active mentees reach `max_mentees`.
- [ ] **3.4 Mentorship Lineage Graph Engine**
  - Implement `GET /api/lineage` and `GET /api/lineage/:handle` endpoints querying historical `mentorships` records grouped by semester.
  - Build interactive **Mentorship Lineage Canvas** UI (`/lineage`) using React Flow or SVG node-graphs displaying mentor-mentee trees, ancestral roots, and co-mentee clusters across academic years.
- [ ] **3.5 Discovery & Inbox UI**
  - Build Senior Discovery grid page featuring algorithmic sorting, "Bump/Like" action buttons, tag filtering, and public-optional contact link widgets (GitHub, Discord, direct email).
  - Build Senior Request Inbox UI allowing seniors to inspect full applicant freshman profiles before accepting or declining.
  - Build Freshman Mentorship Hub showing active request tracker, status updates, and connected mentor details.
