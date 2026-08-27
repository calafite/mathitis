# Phase 24: Declarative Onboarding Engine & Guided Flows

## Objective
Implement a highly modular, "low-code" onboarding engine to guide new users through the platform. For **seniors**, the flow enforces the creation of a minimum viable profile (bio, theme, tags) before they can access the dashboard. For **freshmen**, it serves as an interactive tutorial explaining the mechanics of discovery, bumps, and the 4-bump limit. The system must be driven by declarative, reusable block configurations in the source code—similar to Scratch logic blocks—allowing developers to easily snap together, reorder, or branch steps.

---

## Directives & Platform Constraints
- **Declarative "Scratch-Like" Configuration**: The sequence of onboarding steps must be defined as static TypeScript arrays (`OnboardingFlow`) containing step objects. The engine maps these JSON-like objects to specific UI block components.
- **Component Registry Pattern**: The engine must use a `BlockRegistry` to dynamically render steps based on their `type` (e.g., `type: 'markdown_editor'`, `type: 'theme_picker'`, `type: 'info_slide'`). This prevents a monolithic component and allows adding new block types easily.
- **Brutalist Wizard UI**: The onboarding should be a focused, full-screen, distraction-free experience. Sharp edges, heavy borders, stark typography, and a massive progress indicator (e.g., `[ 02 / 05 ]`).
- **Resilient State**: Progress and intermediate profile data should be stored in a local Zustand store or synced to the backend immediately so users don't lose their drafted bio if they refresh the page.

---

## Tasks

- [ ] **24.1 Onboarding State Tracking (`apps/api` & `packages/schemas`)**
  - In `packages/schemas/src/settings.ts` (and `updateAccountBodySchema`):
    - Extend the user `preferences` JSON schema to include `onboarded: z.boolean().optional()`.
  - This avoids a database schema migration by utilizing the existing `preferences` JSONB column to permanently track if a user has completed the onboarding flow.

- [ ] **24.2 The "Low-Code" Engine Types & Registry (`apps/web`)**
  - Create `apps/web/src/lib/onboarding-engine.ts`:
    - Define the core types:
      ```typescript
      export type BlockType = 'info_slide' | 'profile_input' | 'theme_picker' | 'tag_selector' | 'rich_card_quick_add';

      export interface OnboardingStep {
        id: string;
        type: BlockType;
        title: string;
        description?: string;
        config?: Record<string, unknown>; // Block-specific props (e.g., { field: "biographyMarkdown" })
        ctaText?: string;
      }

      export type OnboardingFlow = OnboardingStep[];
      ```
  - Create the UI Engine Component (`apps/web/src/components/onboarding/onboarding-wizard.tsx`):
    - Accepts a `flow` array and an `onComplete` callback.
    - Manages the `currentStepIndex`.
    - Looks up the current step's `type` in a `BLOCK_REGISTRY` and renders the associated React component, passing the `config`, user draft state, and a `next()` function as props.

- [ ] **24.3 Reusable Onboarding Blocks (`apps/web`)**
  - Create isolated components in `apps/web/src/components/onboarding/blocks/`:
    - **`InfoSlideBlock`**: Displays brutalist typography, an optional SVG illustration, and a "CONTINUAR" button. Used to explain the rules (e.g., the 4-bump limit for freshmen).
    - **`ProfileInputBlock`**: Reuses the `BioEditor` or standard `Input` components. Maps to specific fields in the profile draft.
    - **`ThemePickerBlock`**: Reuses the `ThemePicker` component.
    - **`TagSelectorBlock`**: Reuses the `DynamicTagInput` created in Phase 21.

- [ ] **24.4 Declarative Flow Configurations (`apps/web`)**
  - Create `apps/web/src/config/onboarding-flows.ts`:
    - Define `FRESHMAN_FLOW`:
      1. `info_slide`: Welcome to Mathitis.
      2. `info_slide`: Explanation of the Discovery Hub and privacy (profiles are hidden until requested).
      3. `info_slide`: Explanation of the 4-Bump system and reallocation.
      4. `tag_selector`: "Quais são seus interesses acadêmicos?" (To seed the recommendation engine).
    - Define `SENIOR_FLOW`:
      1. `info_slide`: "Seu legado começa aqui. Construa seu dossiê."
      2. `profile_input`: Nome social e Frase de destaque.
      3. `theme_picker`: Escolha sua identidade visual.
      4. `profile_input` (Markdown): Escreva sua biografia.
      5. `tag_selector`: Especifique suas áreas de atuação.

- [ ] **24.5 Routing & Global Guard Integration (`apps/web`)**
  - In `apps/web/src/components/auth/route-guards.tsx`:
    - Update the `<ProtectedRoute />` logic:
    - If `isAuthenticated` is true, but `user.preferences?.onboarded !== true`, redirect the user to `/onboarding`.
    - Exempt the `/onboarding` route itself from this redirect.
  - Create `apps/web/src/pages/onboarding.tsx`:
    - Reads `user.role` to select the correct flow (`FRESHMAN_FLOW` vs `SENIOR_FLOW`).
    - Renders the `<OnboardingWizard>`.
    - On completion, fires `settingsApi.updateAccount({ preferences: { onboarded: true } })` (and any profile updates for seniors), then redirects to `/`.

- [ ] **24.6 Testing & Automated Quality Gates**
  - **Component Tests (`apps/web/tests/unit/onboarding-engine.test.tsx`)**:
    - Provide a mock flow array to the engine and verify it renders the correct block from the registry.
    - Verify that calling `next()` advances the step index.
  - **E2E Tests (`apps/web/e2e/onboarding.spec.ts`)**:
    - Register a new senior account.
    - Verify they are trapped in the `/onboarding` route and cannot navigate to `/discovery` until complete.
    - Step through the declarative flow, fill out the bio and tags, finish the wizard, and verify the profile updates were saved and the user is released to the dashboard.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck`.
- [ ] Register a new Freshman and verify the informational slides display correctly.
- [ ] Register a new Senior, refresh the page mid-onboarding (verify state is not disastrously broken or it safely restarts), complete the flow, and check `/profile/studio` to ensure the onboarding inputs were saved.
- [ ] Review `onboarding-flows.ts` to ensure the structure allows developers to add a new step just by appending a 6-line JSON object.
