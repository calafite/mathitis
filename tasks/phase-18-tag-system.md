# Phase 18: Dynamic Tag Management, Studio Selection & Discovery Alignment

## Objective
Introduce user-selectable interest tags in the Profile Studio, display them elegantly on mentor profiles, and overhaul the Discovery page filters. The tag filters in the Discovery Hub must become dynamic (showing only tags currently used by available mentors) rather than a static list. Additionally, this phase introduces emoji associations for tags and fixes critical layout clipping issues in the Discovery sidebar.

---

## Directives & Platform Constraints
- **Dynamic Filter State**: The Discovery sidebar must not display empty filter categories. If no discoverable senior has the "Machine Learning" tag, it should not appear in the filter list.
- **Emoji Integration**: The existing `icon` field on the `Tag` model (`String?`) should be repurposed to store native emojis (e.g., `📐`, `💻`, `📊`) to add visual flair without breaking the brutalist aesthetic.
- **Graceful Tag Display**: On the profile preview and mentor modal, tags must be rendered cleanly (e.g., tightly packed brutalist badges or a single-line ticker) so they do not vertically bloat the profile card or distract from the biography and rich cards.
- **Fix Sidebar Clipping**: The current Discovery sidebar has a hardcoded `max-h-44` on the tag container that physically clips the bottom row of tags in half. This must be replaced with a proper flex-grow/overflow strategy.

---

## Tasks

- [ ] **18.1 Schema & API Updates (`packages/schemas` & `apps/api`)**
  - In `packages/schemas/src/profile.ts`:
    - Extend `updateProfileBodySchema` to accept `tagIds: z.array(z.string().uuid()).max(15).optional()`.
  - In `apps/api/src/services/profile-service.ts`:
    - Update `updateProfile` to handle `tagIds` sync. Use Prisma's `set` or a delete/insert transaction on the `profileTags` relation to overwrite the user's selected tags.
  - In `apps/api/src/repositories/discovery-repository.ts`:
    - Update `listTags()` (or add a new parameter) to perform a `DISTINCT` join against `profileTags` where the linked profile has `isDiscoverable = true`. This ensures `GET /api/tags?activeOnly=true` only returns tags actually in use by visible seniors.
  - In `apps/api/prisma/seed.ts`:
    - Update the default tags to use emojis in the `icon` field (e.g., `icon: '🧮'` for Algebra, `icon: '📈'` for Data Viz).

- [ ] **18.2 Profile Studio Tag Selector (`apps/web`)**
  - In `apps/web/src/pages/profile-studio.tsx`:
    - Add a new section: **Interesses & Especializações**.
    - Fetch all available tags (`GET /api/tags`).
    - Render a togglable grid of brutalist buttons, grouped by category (e.g., "COURSE", "INTEREST").
    - Display the tag's emoji alongside its name.
    - Sync the selected tags array to the `draft` state and include it in the `updateMutation` payload.

- [ ] **18.3 Graceful Profile Tag Display (`apps/web`)**
  - In `apps/web/src/components/profile/profile-preview.tsx` and `mentor-profile-modal.tsx`:
    - Redesign the tag display. Instead of scattering them, group them into a dedicated brutalist section (e.g., a thin horizontal scrolling row `overflow-x-auto whitespace-nowrap scrollbar-none` or a compact wrapping flexbox right below the bio).
    - Style them as sharp-edged badges: `border border-foreground px-2 py-0.5 font-mono text-[10px] uppercase font-bold text-foreground`. Include the emoji.
    - Ensure it does not visually pollute the "Vitrine" (Cards) or "Contato" sections.

- [ ] **18.4 Discovery Page Audit & Dynamic Filters (`apps/web`)**
  - In `apps/web/src/pages/discovery.tsx`:
    - **Fix the Clipping Bug**: Locate the `max-h-44 space-y-2 overflow-y-auto` class on the tag filter container. Remove the hardcoded height and ensure the sidebar layout uses `flex-col` and `flex-1 overflow-y-auto` properly so tags are never cut in half at the bottom.
    - Update the `useQuery` for tags to fetch the active-only list (`/api/tags?activeOnly=true`).
    - Review the entire Discovery page to ensure it is 100% aligned with the Phase 16 brutalist redesign:
      - Senior cards should have `rounded-none border-2 border-foreground`.
      - Remove any lingering soft shadows or rounded corners from the filter inputs.
      - Ensure the "Limpar filtros" button styling matches the stark aesthetic.

- [ ] **18.5 Testing & Automated Quality Gates**
  - **Unit Tests (`apps/api/tests/unit/profile-service.test.ts`)**:
    - Verify that `updateProfile` successfully creates, updates, and deletes `profileTags` relationships based on the provided `tagIds` array.
  - **Integration Tests (`apps/api/tests/integration/discovery.test.ts`)**:
    - Verify that `GET /api/tags?activeOnly=true` does *not* return a tag if no discoverable senior has it assigned.
  - **Frontend Tests (`apps/web/tests/unit/profile-studio.test.tsx`)**:
    - Test that checking/unchecking a tag updates the draft payload appropriately.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck`.
- [ ] Run `pnpm test:unit` and `pnpm test:integration`.
- [ ] Log into the Profile Studio, select tags, hit save, and verify they persist after a page reload.
- [ ] Go to the Discovery page and verify that the tags list only shows tags used by currently visible mentors.
- [ ] Verify that scrolling to the bottom of the tag filter in the Discovery sidebar no longer cuts off the text of the bottom-most tags.
- [ ] Verify emojis render correctly next to tag names in both the filter and the profile card.
