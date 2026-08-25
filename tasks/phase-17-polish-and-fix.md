# Phase 17: Showcase Carousel, Spotify Polish & Studio Persistence Fixes

## Objective
Address critical profile studio bugs and elevate the presentation of Rich Cards. This phase resolves the schema type mismatch preventing Letterboxd film cards (such as *Barry Lyndon*) from saving, fixes profile form persistence so all profile details (bio, links, tagline, theme) save reliably alongside card mutations, refines the Spotify player integration to eliminate sizing letterbox glitches, and converts the card showcase into a smooth horizontal scrolling track with infinite loop / snap carousel support.

---

## Directives & Platform Constraints
- **Type Coercion on Card Metadata**: Form inputs in React submit string values by default. All numeric card metadata schemas (`rating`, `year`, `hoursPlayed`, `durationMs`) MUST use `z.coerce.number()` or explicit numeric transformation to prevent `422 Validation Error (Expected number, received string)` rejections.
- **Unified Profile Persistence**: Profile attributes (`socialName`, `tagline`, `biographyMarkdown`, `pronouns`, `themePalette`, `socialLinks`, `contactEmail`) and Rich Cards must have clear, distinct save lifecycles with immediate visual feedback so students never lose unsaved drafts.
- **Fixed Embed Geometry**: Spotify iframes must never use 16:9 `aspect-video`. They require strict, fixed viewport heights ($152\text{px}$ for compact track/album widgets, $352\text{px}$ for full players) with seamless dark backgrounds.
- **Infinite / Snap Horizontal Rail**: Showcase cards on the Profile Preview and Mentor Modal must flow horizontally across a smooth, draggable rail rather than stacking vertically in a rigid 2-column grid.

---

## Tasks

- [ ] **17.1 Film & Letterboxd Schema Coercion & Scraper Fixes (`@mathitis/schemas` & `apps/api`)**
  - **The Bug**: Film cards fail validation when adding titles like *Barry Lyndon* because `RichCardManager` sends form values as strings (`rating: "8.5"`, `year: "1975"`), while `filmMetadataSchema` expects strict numbers, rejecting the request with `Invalid film metadata: Expected number, received string`.
  - In `packages/schemas/src/profile.ts`:
    - Update `filmMetadataSchema` to coerce numeric inputs:
      ```typescript
      export const filmMetadataSchema = z.object({
        rating: z.coerce.number().min(0).max(10).optional(),
        year: z.coerce.number().int().min(1888).max(2100).optional(),
        director: z.string().max(120).optional(),
        genres: z.array(z.string().max(60)).max(10).optional(),
      });
      ```
    - Apply `z.coerce.number()` similarly to `songMetadataSchema.durationMs` and `gameMetadataSchema.hoursPlayed`.
  - In `apps/api/src/services/rich-card-scraper.ts`:
    - Enhance the Letterboxd extractor:
      - Set a realistic browser `User-Agent` header to prevent 403 blocks from Letterboxd.
      - Parse film titles with parenthetical years (e.g. `Barry Lyndon (1975)`) and extract `title: "Barry Lyndon"` and `year: 1975`.
      - Extract director name from `meta[name="twitter:data1"]` or OpenGraph description.
      - Extract high-resolution movie poster from `meta[property="og:image"]`.

- [ ] **17.2 Profile Studio State Persistence & Unsaved Changes Bar (`apps/web`)**
  - **The Bug**: Only card changes (which mutate instantly in the modal) appear to persist, while text fields (bio, links, tagline, pronouns) are frequently lost because the top save button is unobtrusive and lacks auto-sync confirmation.
  - In `apps/web/src/pages/profile-studio.tsx`:
    - Fix `toUpdateBody` payload mapping: Ensure `socialLinks` converts empty strings `""` to `undefined` without wiping the entire JSON object on patch.
    - Fix draft state synchronization: Ensure that when card mutations trigger `queryClient.invalidateQueries(['profile', 'me'])`, background refetches do not reset or desynchronize uncommitted text in `draft`.
    - Implement a **Floating Save Bar** at the bottom of the studio screen when `dirty === true`:
      - Shows an explicit warning: *"Você tem alterações não salvas no seu perfil"*.
      - Provides immediate "Salvar alterações" (with spinner) and "Descartar" buttons.
    - Display a clear success toast notification upon successful profile patch.

- [ ] **17.3 Spotify Embed Optimization & Sizing (`apps/web`)**
  - In `apps/web/src/components/profile/profile-preview.tsx` and `mentor-profile-modal.tsx`:
    - Replace the generic `aspect-video` class in `CardEmbed`:
      - For Spotify links: Render the iframe with fixed height `height="152"` (compact) or `height="352"` (expanded) and `width="100%"`.
      - Force `borderRadius="0px"` and iframe background `bg-black`.
      - Set required iframe permissions: `allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"`.
    - Fix the white letterbox gap underneath the player by setting container `bg-black overflow-hidden`.

- [ ] **17.4 Infinite Horizontal Scroll on Showcase Cards (`apps/web`)**
  - In `apps/web/src/components/profile/profile-preview.tsx` and `mentor-profile-modal.tsx`:
    - Replace the vertical 2-column grid (`grid grid-cols-1 sm:grid-cols-2`) with an **Infinite / Continuous Horizontal Rail**:
      - Container: `flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/20`.
      - Cards: Fixed width `w-72 sm:w-80 shrink-0 snap-start`.
    - Implement smooth scroll navigation:
      - Add subtle left/right arrow buttons (`‹` and `›`) on the "Vitrine" / "Coleção" header bar to allow clicking to slide cards horizontally.
      - Add optional seamless CSS marquee or drag-to-scroll interaction for desktop trackpads and mobile swiping.

- [ ] **17.5 Testing & Automated Quality Gates**
  - **Unit Tests (`apps/api/tests/unit/rich-card-validation.test.ts`)**:
    - Test `filmMetadataSchema` parsing with both string numbers (`"8.5"`, `"1975"`) and primitive numbers (`8.5`, `1975`).
    - Test `enrichCardMetadata` parsing for Letterboxd movie entries like *Barry Lyndon*.
  - **Integration Tests (`apps/api/tests/integration/profiles.test.ts`)**:
    - Submit a `PATCH /api/profiles/me` with updated bio, social links, and tagline; verify all attributes persist in database.
    - Create a film rich card with numeric string metadata; verify 200 OK and correct JSON response.
  - **Frontend Component Tests (`apps/web/tests/unit/rich-card-manager.test.tsx`)**:
    - Test film card form submission with decimal ratings and release years.
    - Test horizontal scroll container renders cards in a flex row without wrapping.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck` across all packages.
- [ ] Run `pnpm test:unit` and `pnpm test:integration`. Ensure all tests pass.
- [ ] Add a film card for *Barry Lyndon* via URL and verify that title, year, poster, and rating save without `422` validation errors.
- [ ] Modify profile biography, tagline, and Discord/LinkedIn links in `/profile/studio`, click Save, and verify all values persist after a page refresh.
- [ ] Inspect the Spotify embed in the live preview; verify no white letterboxing boxes appear.
- [ ] Verify that Rich Cards scroll smoothly on a horizontal axis in both the Live Preview and the Mentor Modal.
