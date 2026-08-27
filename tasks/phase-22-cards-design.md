# Phase 22: Native Brutalist Media Cards (Iframe Eradication)

## Objective
Completely eradicate third-party `<iframe>` embeds (Spotify, YouTube, SoundCloud) from the platform. Third-party iframes introduce forced geometry (rounded corners, minimum widths), visual letterboxing, scrollbar bugs, and heavy external JS payloads that violate our Academic Brutalist design system. 

Instead, we will build a polymorphic, natively rendered React component (`RichCardView`) that reads the scraped metadata in our database (`song`, `game`, `film`, `project`, `book`) and renders a fully cohesive, native UI for each platform. 

---

## Directives & Platform Constraints
- **Strict Bounding Boxes**: All cards must respect a fixed width (e.g., `w-72` / `288px`) and flex-grow internally without horizontal scrolling or corner clipping.
- **Unified Card Anatomy**: Every card consists of 4 strict horizontal blocks separated by `border-b-2 border-foreground`: 
  1. **Header** (Title & Category)
  2. **Cover Art** (Full-bleed image, 160px fixed height)
  3. **Metadata Body** (Type-specific information)
  4. **Footer** (Contextual CTA Link).
- **Accent Color Usage**: Utilize the card's `accentColor` (hex) to paint a subtle visual indicator, such as the background of the category badge or the hover state of the footer link, integrating the card's native brand color (e.g., Spotify Green, Steam Blue) into our brutalist wireframe.

---

## Type-Specific Visual Mappings

Based on the `@mathitis/schemas/src/profile.ts` metadata, here is exactly how each platform should be natively rendered:

### 1. Music (Spotify)
* **Header**: Track Name (Bold Sans) + `[♪ MÚSICA]` Badge.
* **Media**: `imageUrl` (Album Cover). Full-bleed, object-cover, sharp corners.
* **Metadata Body**: 
  * Artist Name: `subtitle` (Large, Uppercase Mono, Foreground color).
  * Album Name: `metadata.albumName` (Small, Uppercase Mono, Muted color, prefixed with `ÁLBUM · `).
  * Duration (Optional): If `metadata.durationMs` exists, convert to `m:ss` and align right.
* **Footer**: `OUVIR NO SPOTIFY ↗` (Links to `externalUrl`).

### 2. Film (Letterboxd)
* **Header**: Movie Title + `[▶ FILME]` Badge.
* **Media**: `imageUrl` (Movie Poster/Backdrop).
* **Metadata Body**: 
  * Director & Year: Combine `subtitle` and `metadata.year` (e.g., `DIR: STANLEY KUBRICK (1975)`).
  * Rating: `metadata.rating` (Render as a brutalist metric: `AVALIAÇÃO: ★ 8.5/10`).
  * Genres: `metadata.genres` (Render as a comma-separated uppercase string if space allows).
* **Footer**: `VER NO LETTERBOXD ↗`.

### 3. Games (Steam)
* **Header**: Game Title + `[▣ JOGO]` Badge.
* **Media**: `imageUrl` (Steam Capsule Header).
* **Metadata Body**: 
  * Identifiers: `metadata.steamAppId` and `metadata.platform` (e.g., `STEAM APP ID: 1245620`).
  * Description: `description` (Truncated to 2 lines, leading-relaxed).
  * Hours Played: If `metadata.hoursPlayed` exists, `TEMPO DE JOGO: 120H`.
* **Footer**: `PÁGINA DA LOJA ↗`.

### 4. Projects (GitHub)
* **Header**: Repository / Project Name + `[⚙ PROJETO]` Badge.
* **Media**: `imageUrl` (OpenGraph Social Preview).
* **Metadata Body**: 
  * Tech Stack: `metadata.techStack` array rendered as sharp, square badges (`border border-foreground px-1.5 py-0.5 text-[8px] uppercase`).
  * Stats: `metadata.stars` (e.g., `★ 1,204 STARS`).
  * Description: `description` (Truncated to 2 lines).
* **Footer**: `CÓDIGO ABERTO ↗` (Links to `metadata.repository` or `externalUrl`).

### 5. Books (OpenLibrary / General)
* **Header**: Book Title + `[📖 LIVRO]` Badge.
* **Media**: `imageUrl` (Book Cover).
* **Metadata Body**: 
  * Author: `subtitle` (Uppercase Mono).
  * Description: `description` (Truncated to 3 lines).
* **Footer**: `VER LIVRO ↗`.

---

## Tasks

- [ ] **22.1 Wipe Iframe Logic & Dependencies (`apps/web`)**
  - In `apps/web/src/components/profile/rich-card-view.tsx` (or `profile-preview.tsx`):
    - Completely remove the `<iframe src={card.embedUrl} ... />` implementation.
    - Remove the `bg-black` wrapper previously used to hide Spotify corner gaps.

- [ ] **22.2 Build the Polymorphic `RichCardView` Component (`apps/web`)**
  - Structure the component as a strict vertical flexbox inside an `<article>` with `border-2 border-foreground bg-card rounded-none shrink-0 w-72`.
  - **Header Implementation**: 
    - Flex row with `border-b-2 border-foreground p-3`.
    - Apply `card.accentColor` as the background color of the Category Badge (ensure text contrast by dynamically calculating whether the text inside the badge should be black or white, or simply use the accent color for the badge border/text).
  - **Media Implementation**:
    - `h-40 w-full bg-muted border-b-2 border-foreground overflow-hidden`.
    - Fallback: If `!card.imageUrl`, render a brutalist placeholder (`flex items-center justify-center font-mono text-[10px] text-muted-foreground uppercase` reading `[ SEM IMAGEM ]`).
  - **Body Implementation**:
    - Build a switch/case or conditional rendering block that maps the JSON `card.metadata` to the precise layouts defined in the *Type-Specific Visual Mappings* section above.
    - Use `font-mono text-[10px] uppercase tracking-widest` for all metadata labels (Artist, Director, App ID).
  - **Footer Implementation**:
    - Standardized block: `border-t-2 border-foreground p-3 bg-muted/20`.
    - Hover effect: On hover, the link background changes to `card.accentColor` and text changes to contrasting foreground.

- [ ] **22.3 Update Form Validator UI (`apps/web`)**
  - In `apps/web/src/components/profile/rich-card-manager.tsx`:
    - Remove the "URL de incorporação (Spotify / SoundCloud / YouTube / Vimeo)" (`embedUrl`) input field from the manual entry form, as the platform no longer supports or relies on iframes. The scraper will just pull the `externalUrl`, `imageUrl`, and metadata.

- [ ] **22.4 Scraper Service Cleanup (`apps/api`)**
  - In `apps/api/src/services/rich-card-scraper.ts`:
    - You no longer need to construct `embedUrl` values (e.g., `https://open.spotify.com/embed/...`). Remove this mapping from the Spotify and YouTube extractors. Only extract the high-res image cover, the external URL, and the native metadata.

- [ ] **22.5 Testing & Verification**
  - **Frontend Tests (`apps/web/tests/unit/rich-card-manager.test.tsx`)**:
    - Verify the `RichCardView` renders specific metadata elements (e.g., `★ 8.5/10`) based on the `cardType` prop.
    - Verify that the absence of `embedUrl` in the payload no longer causes validation errors.
  - **API Tests (`apps/api/tests/unit/rich-card-scraper.test.ts`)**:
    - Verify that scraping a Spotify URL returns `imageUrl`, `title`, and `metadata.artistName` correctly without attempting to build an iframe URL.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck` to ensure `embedUrl` deprecation does not break types (it should already be `z.string().nullable().optional()`).
- [ ] Render a Spotify card, Steam card, and GitHub card in the Profile Studio preview.
- [ ] Verify that ALL cards share the exact same brutalist anatomy (Header line, 160px Media block, Body block, Footer link).
- [ ] Verify that no horizontal scrollbars appear inside the cards and they snap cleanly in the carousel.
