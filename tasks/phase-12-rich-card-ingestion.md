# Phase 12: Automated Rich Card Ingestion & Content-Safe Link Unfurling

## Objective
Streamline the creation of Rich Media Cards in the Profile Studio by implementing an automated metadata scraper ("Magic Link" auto-unfurl) with integrated content safety and NSFW safeguards. Students can paste a link from supported platforms (Spotify, Steam, GitHub, Letterboxd, OpenLibrary/Books, or generic educational/project websites) to automatically extract metadata, derive sandboxed widgets, and pre-fill card forms without manual data entry.

---

## Directives & Platform Constraints
- **Supported Providers Only**: Focus exclusively on **Spotify** (`song`), **Steam** (`game`), **GitHub** (`project`), **Letterboxd** (`film`), **OpenLibrary/Books** (`book`), and **Generic Webpages** (`custom`). Video and audio streaming services (YouTube, Vimeo, SoundCloud) are strictly excluded from automated unfurling.
- **NSFW & Mature Content Safeguards**: The university mentorship environment requires strict content safety. Scraped content MUST be evaluated before return:
  - **Steam Age-Gate & Mature Descriptors**: Inspect Steam Store API content descriptors (`content_descriptors.ids` containing adult/sexual content categories) or `required_age >= 18`. Reject adult-only titles with `422 Unprocessable Entity` (`NSFW_CONTENT_REJECTED`).
  - **Metadata & Rating Tags**: Inspect HTML metadata (`<meta name="rating" content="adult|RTA-5042...">`, adult classification meta tags, and explicit content headers).
  - **Keyword & Pattern Filters**: Deny URLs matching high-risk NSFW domain patterns or containing explicit adult content keywords in scraped titles and descriptions.
- **SSRF & Network Boundary Protection**: The backend scraper MUST strictly validate target hosts and prohibit requests to private/internal IP ranges (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, IPv6 loopback `::1`, and container hostnames like `postgres`, `redis`, `minio`).
- **Timeout & Rate Limiting**: Outgoing scraper requests enforce a strict 3-second `AbortController` timeout and route-level rate limiting (`max: 15` requests/minute per user) to prevent scraping abuse.

---

## Tasks

- [x] **12.1 Schema & Scraper Contract Definition (`@mathitis/schemas`)**
  - In `packages/schemas/src/profile.ts`:
    - Define `scrapeCardQuerySchema`:
      ```typescript
      export const scrapeCardQuerySchema = z.object({
        url: z.string().url('Informe uma URL válida').max(512),
      });
      export type ScrapeCardQuery = z.infer<typeof scrapeCardQuerySchema>;
      ```
    - Define `scrapedCardResponseSchema`:
      ```typescript
      export const scrapedCardResponseSchema = z.object({
        cardType: richCardTypeSchema,
        title: z.string().min(1).max(150),
        subtitle: z.string().max(150).nullable().optional(),
        description: z.string().max(5000).nullable().optional(),
        imageUrl: z.string().url().max(512).nullable().optional(),
        externalUrl: z.string().url().max(512).nullable().optional(),
        embedUrl: z.string().url().max(512).nullable().optional(),
        accentColor: hexColorSchema.default('#6366f1'),
        metadata: z.record(z.unknown()).default({}),
      });
      export type ScrapedCardResponse = z.infer<typeof scrapedCardResponseSchema>;
      ```
  - Export new schemas from `packages/schemas/src/index.ts`.

- [x] **12.2 Content Safety & NSFW Filter Engine (`apps/api`)**
  - Create `apps/api/src/services/nsfw-filter.ts`:
    - Define mature content keywords, rating classifications, and Steam content descriptor blocklists (e.g. Steam descriptor IDs `1` [Nudity], `2` [Sexual Content], `5` [Adult Only]).
    - Implement `assertContentSafe(payload: { title: string; description?: string; tags?: string[]; rating?: string; ageRating?: number; steamDescriptors?: number[] }): void`:
      - Checks `ageRating >= 18` or presence of mature Steam content descriptors.
      - Checks meta rating strings for adult classifications (`mature`, `adult`, `restricted`, `RTA-5042-1996-1400-1577-RTA`).
      - Checks title and description against high-confidence NSFW keyword heuristics.
      - Throws `ValidationError('O link fornecido contém conteúdo adulto ou impróprio para a comunidade acadêmica', 'NSFW_CONTENT_REJECTED')` when violation is detected.

- [x] **12.3 Backend Scraper & Provider Extractors (`apps/api`)**
  - Create `apps/api/src/services/rich-card-scraper.ts`:
    - Implement SSRF guard: resolve DNS and assert IP is a public routable address (reject loopback, RFC 1918, link-local, cloud metadata service `169.254.169.254`).
    - Enforce 3-second timeout via `AbortController`.
    - **Spotify Extractor (`open.spotify.com`)**:
      - Parses `/track/{id}` or `/album/{id}` from URL path.
      - Extracts track/album title, artist name (`subtitle`), album art cover (`imageUrl`), and Spotify green accent (`#1db954`).
      - Sets `embedUrl: "https://open.spotify.com/embed/{type}/{id}"`.
      - Extracts `spotifyUri` into metadata.
    - **Steam Extractor (`store.steampowered.com`)**:
      - Extracts App ID from `/app/{appId}` path.
      - Queries Steam Store public API (`https://store.steampowered.com/api/appdetails?appids={appId}`).
      - Evaluates content safety via `assertContentSafe` using `required_age` and `content_descriptors`.
      - Extracts game title, capsule header image, short description, and sets Steam accent (`#1b2838`).
    - **GitHub Extractor (`github.com`)**:
      - Extracts repository `owner/repo` from path.
      - Parses OpenGraph description and repository thumbnail.
      - Sets `cardType: 'project'`, `externalUrl`, repository link, and extracts tech stack hints.
    - **Letterboxd Extractor (`letterboxd.com`) / Film**:
      - Parses `og:title` (extracts movie name and release year), director (subtitle), and poster image (`og:image`).
      - Validates movie description and rating through safety filter.
      - Sets `cardType: 'film'`.
    - **Books Extractor (`openlibrary.org` / generic books)**:
      - Parses book title, author (`subtitle`), cover image, and publication year.
      - Sets `cardType: 'book'`.
    - **Generic Webpage (Fallback)**:
      - Parses standard OpenGraph tags (`og:title`, `og:description`, `og:image`).
      - Runs text through `assertContentSafe`.
      - Returns `cardType: 'custom'`.

- [x] **12.4 API Route Registration (`apps/api`)**
  - In `apps/api/src/plugins/profiles-plugin.ts`:
    - Register `GET /api/profiles/me/cards/scrape`:
      - Guarded by `createRequireAuth` (requires active student session).
      - Schema validation: `querystring: scrapeCardQuerySchema`, `response: { 200: scrapedCardResponseSchema }`.
      - Route rate limit: `max: 15` per minute per user session.
      - Invokes `richCardScraperService.scrape(request.query.url)`.

- [x] **12.5 Frontend Quick-Add (Autocompletar) UX (`apps/web`)**
  - In `apps/web/src/lib/profile-api.ts`:
    - Add `scrapeCard(url: string): Promise<ScrapedCardResponse>` calling `GET /api/profiles/me/cards/scrape?url=...`.
  - In `apps/web/src/components/profile/rich-card-manager.tsx`:
    - Add a **"Preenchimento Automático via Link"** bar above the manual card form:
      - Input field with placeholder: `"Cole um link do Spotify, Steam, GitHub, Letterboxd ou Livro..."`.
      - "Autocompletar" button with loading spinner (`Loader2`).
    - Hook into TanStack Query mutation (`useMutation({ mutationFn: profileApi.scrapeCard })`).
    - On success:
      - Automatically populate all fields in `CardForm` (`cardType`, `title`, `subtitle`, `description`, `embedUrl`, `externalUrl`, `imageUrl`, `accentColor`, `metadata`).
      - Show confirmation badge (e.g. `✓ Spotify detectado`).
      - Keep all fields editable so the student can customize text before saving.
    - On safety violation or error:
      - Display clear Portuguese error banner (e.g. `"Este link contém conteúdo impróprio ou não pôde ser lido"`).
      - Keep manual entry form available as a graceful fallback.

- [x] **12.6 Testing & Automated Quality Gates**
  - **Unit Tests (`apps/api/tests/unit/rich-card-scraper.test.ts` & `nsfw-filter.test.ts`)**:
    - Test URL parsing for Spotify, Steam, GitHub, Letterboxd, and generic OpenGraph pages.
    - Test SSRF defense (rejection of `127.0.0.1`, `169.254.169.254`, `localhost`, and internal network hostnames).
    - Test NSFW rejection on adult Steam games (descriptor IDs, `required_age: 18`) and adult metadata tags.
    - Test timeout handling on unresponsive external hosts.
  - **Integration Tests (`apps/api/tests/integration/profiles.test.ts`)**:
    - Test `GET /api/profiles/me/cards/scrape` with valid mock URLs.
    - Verify 401/403 for unauthenticated sessions.
    - Verify 422 and structured error for NSFW/blocked content.
    - Verify rate-limiting behavior after 15 attempts.
  - **Frontend Unit Tests (`apps/web/tests/unit/rich-card-manager.test.tsx`)**:
    - Test quick-add URL submission triggers mutation and populates form fields.
    - Test error banner rendering when API returns a scraping/NSFW rejection.

---

## Verification Checklist
- [x] Run `pnpm lint` and `pnpm typecheck` across all workspaces without errors.
- [x] Run `pnpm test:unit` and `pnpm test:integration` ensuring all tests pass.
- [x] Verify that YouTube, Vimeo, and SoundCloud links are NOT accepted as special video embeds.
- [x] Verify that Steam games flagged with adult descriptors are rejected with `NSFW_CONTENT_REJECTED`.
- [x] Verify that embed URLs derived from Spotify pass `validateCardEmbedUrl` security checks.
- [x] Verify that manual card creation remains fully functional.
