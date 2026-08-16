# Phase 2: Expressive Profiles, Custom Markdown & Rich Cards

## Objective
Deliver full profile curation capabilities: custom banners, theme palettes/color accents, sanitized rich Markdown with colored text and callouts, public-optional contact links, and rich interactive media cards (songs, games, films, projects) with rigorous upload validation, EXIF metadata stripping, and profile effort scoring.

## Tasks
- [ ] **2.1 Secure Media Upload Service & Sharp Sanitization**
  - Implement S3/MinIO upload service with short-lived pre-signed URL generation for avatars and banners to keep storage endpoints private.
  - Build upload validation middleware enforcing strict file size limits (max 2MB avatar, 5MB banner) and content-type verification via file signature analysis (magic-byte image verification).
  - Integrate **Sharp** image processing worker to sanitize files: re-encode incoming image pixels, strip all EXIF/GPS metadata (preventing user geolocation leakage), and output optimized responsive formats in `.webp`.
- [ ] **2.2 Profile Management, Public-Optional Contact & Privacy API**
  - Build `GET /api/profiles/:handle` and `PATCH /api/profiles/me` endpoints.
  - Support profile attributes: `social_name`, `pronouns`, `tagline`, `biography_markdown`, `banner_url`, `banner_preset`, `theme_palette`, `social_links`, `contact_email`, `max_mentees`.
  - Enforce contact visibility policy: Contact information (direct email, GitHub, Discord, LinkedIn) is public if added, but entirely optional.
  - Enforce freshman discoverability policy: Freshmen profiles default to `is_discoverable = false` (omitted from general catalog queries).
  - Increment unique profile views (`profile_views`) and compute the Profile Effort/Complexity Score (derived from bio length, markdown structure, and rich card count) to feed the algorithmic matching engine.
- [ ] **2.3 Rich Cards Subsystem**
  - Add Prisma schema model for `rich_cards`.
  - Implement CRUD endpoints for rich cards (`GET`, `POST`, `PATCH`, `DELETE /api/profiles/me/cards`).
  - Implement card reordering endpoint (`PUT /api/profiles/me/cards/reorder`).
  - Add API validation and metadata scrapers for Spotify embed URIs, Steam App IDs, Letterboxd ratings, and custom project showcases, ensuring embedded URLs belong to whitelisted domains.
- [ ] **2.4 Expressive Frontend Profile Studio & Sanitized Markdown**
  - Build the Rich Profile Studio (`/profile/studio`) with real-time visual preview side-by-side with editing forms.
  - Implement Theme & Color Palette picker (injecting CSS variables for primary, accent, and glassmorphic card styles into a scoped profile wrapper).
  - Implement Rich Markdown Editor with custom toolbar for color tokens, custom badges, callouts, and code segments.
  - Set up **Rehype-Sanitize** on the React client (and verify on the API) to strip script tags and dangerous HTML while safely rendering custom colors, badges, and safe embeds.
  - Implement Drag-and-Drop Rich Cards manager with interactive iframe previews (Spotify/Soundcloud embeds configured with secure sandboxing attributes).
