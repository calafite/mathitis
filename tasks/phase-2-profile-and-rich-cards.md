# Phase 2: Expressive Profiles, Custom Markdown & Rich Cards

## Objective
Deliver full profile curation capabilities: custom banners, theme palettes/color accents, sanitized rich Markdown with colored text and callouts, public-optional contact links, and rich interactive media cards (songs, games, films, projects) with **server-side upload pipeline** (Fastify → Sharp → S3) for guaranteed EXIF stripping and sanitization, and profile effort scoring.

## Tasks
^- [x] **2.1 Server-Side Image Upload Pipeline (Fastify → Sharp → S3/MinIO)**
  - **No direct pre-signed URLs**: Frontend uploads multipart/form-data to Fastify endpoints (`POST /api/profiles/me/avatar`, `POST /api/profiles/me/banner`).
  - Fastify validates: strict file size limits (max 2MB avatar, 5MB banner), magic-byte MIME verification (file signature analysis).
  - Fastify processes with **Sharp**: re-encode pixels, strip ALL EXIF/GPS metadata (preventing geolocation leakage), convert to standardized `.webp` format, generate responsive variants.
  - Fastify uploads sanitized result to S3/MinIO; returns final CDN URL to frontend.
  - This guarantees server-side validation/sanitization before any object reaches object storage.
^- [x] **2.2 Profile Management, Public-Optional Contact & Privacy API**
  - Build `GET /api/profiles/:handle` and `PATCH /api/profiles/me` endpoints.
  - Support profile attributes: `social_name`, `pronouns`, `tagline`, `biography_markdown`, `banner_url`, `banner_preset`, `theme_palette`, `social_links`, `contact_email`, `max_mentees`.
  - Enforce contact visibility policy: Contact information (direct email, GitHub, Discord, LinkedIn) is public if added, but entirely optional.
  - Enforce freshman discoverability policy: Freshmen profiles default to `is_discoverable = false` (omitted from general catalog queries).
  - Increment unique profile views (`profile_views`) and compute the Profile Effort/Complexity Score (derived from bio length, markdown structure, and rich card count) to feed the algorithmic matching engine.
^- [x] **2.3 Rich Cards Subsystem**
  - Add Prisma schema model for `rich_cards`.
  - Implement CRUD endpoints for rich cards (`GET`, `POST`, `PATCH`, `DELETE /api/profiles/me/cards`).
  - Implement card reordering endpoint (`PUT /api/profiles/me/cards/reorder`).
  - Add API validation and metadata scrapers for Spotify embed URIs, Steam App IDs, Letterboxd ratings, and custom project showcases, ensuring embedded URLs belong to whitelisted domains.
^- [x] **2.4 Expressive Frontend Profile Studio & Sanitized Markdown**
  - Build the Rich Profile Studio (`/profile/studio`) with real-time visual preview side-by-side with editing forms.
  - Implement Theme & Color Palette picker (injecting CSS variables for primary, accent, and glassmorphic card styles into a scoped profile wrapper).
  - Implement Rich Markdown Editor with custom toolbar for color tokens, custom badges, callouts, and code segments.
  - Set up **Rehype-Sanitize** on the React client (and verify on the API) to strip script tags and dangerous HTML while safely rendering custom colors, badges, and safe embeds.
  - Implement Drag-and-Drop Rich Cards manager with interactive iframe previews (Spotify/Soundcloud embeds configured with secure sandboxing attributes).
