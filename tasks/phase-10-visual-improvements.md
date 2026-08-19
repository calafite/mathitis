# Phase 10: Homepage Visual Polish & Mentor Profile Modal

## Objective
Elevate the visual presentation and utility of the homepage dashboard while strictly adhering to the existing application design system (Radix UI + Tailwind tokens in `index.css`). Ensure mentor profiles across discovery and recommendations open in a dedicated, high-fidelity modal rendering all curated profile information (markdown bio, custom banner, theme palette, contact links, and rich cards). Maintain strict fidelity to the established domain specifications without introducing hallucinated lore.

---

## Directives & Platform Constraints
- **Platform Identity**: *Mathitis* (μαθητής = pupil/learner) is a university student mentorship platform. Adhere strictly to the established domain models, RBAC roles (`freshman`, `senior`, `administrator`, `developer`), and the 10 core invariants in `architecture.md`. Do not invent fictional lore, unrelated scoring mechanics, or arbitrary decorative formulas.
- **Aesthetic Consistency**: Avoid disconnected visual themes. Utilize the design system tokens defined in `apps/web/src/styles/index.css` (`--color-background`, `--color-card`, `--color-border`, `--color-muted`, etc.) so views blend seamlessly with the rest of the application in both dark and light modes.
- **Mentor Modal Invariant**: Senior profiles clicked in Discovery or on the Homepage must open an interactive modal rendering the senior's full rich portfolio.

---

## Tasks
- [ ] **10.1 Grounded Homepage Dashboard (`HomePage`)**
  - Redesign `apps/web/src/pages/home.tsx` into a clean, informative student dashboard matching the design system:
    - **Header & Standing**: Personalized greeting, user role badge, academic semester indicator, and active request/mentee capacity counters.
    - **Quick Launchpad**: Cohesive navigation cards routing to **Discovery** (`/discovery`), **Requests** (`/requests`), **Lineage** (`/lineage`), and **Profile Studio** (`/profile/studio`).
    - **Active Connections Section**: Displays current confirmed mentor/mentee status or an actionable prompt to explore mentors.
    - **Recommendation Spotlight (Freshmen)**: Renders top algorithmic matches with match percentages and explainable match reason chips (`matchReasons`).
    - **Recent Activity / Status**: Displays current pending mentorship applications and status badges (`pending`, `pending_admin_approval`, `accepted`).

- [ ] **10.2 Comprehensive Mentor Profile Modal (`MentorProfileModal`)**
  - Create `apps/web/src/components/profile/mentor-profile-modal.tsx` (using `@radix-ui/react-dialog`):
    - **Banner & Avatar Header**: Displays user-uploaded banner or preset, avatar, social name, pronouns, handle, and semester badge.
    - **Custom Palette Wrapper**: Scopes the senior's customized `themePalette` CSS variables (`--profile-primary`, `--profile-accent`, `--profile-card-bg`) to the modal card container.
    - **Biography & Tags**: Renders sanitized Markdown biography via `<MarkdownPreview />` alongside categorized interest tags.
    - **Public-Optional Contact Links**: Renders contact email, Discord, GitHub, LinkedIn, and website links when populated.
    - **Rich Cards Grid**: Renders the complete stack of curated rich cards in display order (including sandboxed Spotify/YouTube audio-video embeds, Steam game badges, Letterboxd film cards, and project showcases).
    - **Integrated Actions**:
      - One-click **Bump / Like** button (reflecting active bump status and 4-bump limit).
      - **Apply for Mentorship** button (opens the application drawer / submission form).
  - Connect the modal to profile cards in both `DiscoveryPage` (`discovery.tsx`) and `HomePage` (`home.tsx`).

- [ ] **10.3 Visual Cohesion & Polish Across Views**
  - Harmonize spacing, border radius, and surface elevations across `discovery.tsx`, `requests.tsx`, `lineage.tsx`, and `profile-studio.tsx`.
  - Ensure all card containers, dropdowns, and modals strictly derive backgrounds and borders from semantic tokens (`bg-card`, `border-border`, `text-foreground`).
  - Verify that custom profile styling (glassmorphic, solid, bordered) is safely isolated within profile containers and does not bleed into global navigation or modal backdrops.

- [ ] **10.4 Testing & Verification**
  - **Unit Tests (`apps/web/tests/unit/mentor-profile-modal.test.tsx`)**:
    - Verify that clicking a mentor card triggers the modal.
    - Verify all rich profile sections (bio markdown, tags, contact widgets, rich cards) render correctly inside the modal.
    - Verify that Bump and Apply action buttons function properly within the modal.
  - **Playwright E2E Tests (`apps/web/e2e/homepage-and-modal.spec.ts`)**:
    - Log in as a freshman, verify the home dashboard displays active capacity and recommendation cards.
    - Click a recommended mentor on the homepage, assert the modal opens with full profile details.
    - Submit a bump from within the modal and verify counter updates.
  - Ensure all repository tests pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`).
