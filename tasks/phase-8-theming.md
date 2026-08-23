# Phase 8: Site-Wide Dark Theme & Theme Switcher

## Objective
Implement a site-wide dark/light theme management system with dark mode configured as the default theme, persistent user preference storage, an accessible theme switcher toggle component across all navigation headers and authentication pages, and refined design tokens across all views and dialogs while preserving individual user profile studio palettes.

---

## Tasks
- [x] **8.1 Theme Tokens & Baseline Styles**
  - Update `apps/web/src/styles/index.css` to configure dark mode color tokens (`--color-background`, `--color-card`, `--color-foreground`, `--color-border`, `--color-muted`, `--color-popover`) as the default baseline.
  - Define `.light` class overrides for all semantic tokens to support clean switching without hardcoded style duplication.
  - Ensure student custom profile CSS variables (`--profile-primary`, `--profile-accent`, `--profile-card-bg`) layer cleanly over global dark and light surfaces without contrast conflicts or visual regressions.

- [x] **8.2 Theme State Management & Context**
  - Implement `ThemeContext` and custom hook `useTheme` in `apps/web/src/contexts/theme-context.tsx`.
  - Default initial theme to `'dark'` with fallback to `localStorage.getItem('mathitis_theme')`.
  - Synchronize active theme changes to `document.documentElement` class list (`dark` / `light`) and persist preference to `localStorage`.
  - Wrap `App` in `<ThemeProvider>` within `apps/web/src/app.tsx`.

- [x] **8.3 Theme Switcher UI Component**
  - Build an accessible `ThemeToggle` button component (`apps/web/src/components/ui/theme-toggle.tsx`) featuring Sun / Moon icons (`lucide-react`), clear ARIA labels (`aria-label="Switch to light theme"` / `"Switch to dark theme"`), and smooth visual transitions.
  - Place `ThemeToggle` in global headers and layouts:
    - Main Navigation Header (`HomePage`, `DiscoveryPage`, `RequestsPage`, `LineagePage`, `ProfileStudioPage`) next to `NotificationBell`.
    - Admin Navigation Sidebar & Header (`AdminLayout`).
    - Developer Diagnostics Portal (`DevDiagnosticsPage`).
    - Auth Layouts (`LoginPage`, `RegisterPage`, `PasswordRecoveryPage`, `VerifyEmailPage`).

- [x] **8.4 UI Screens & Dialogs Dark Mode Audit**
  - Refactor static light background classes (e.g. `bg-white`, `bg-slate-50`, `border-slate-200`, `text-slate-900`) across all screens to semantic theme tokens or dark-mode variant classes.
  - Verify high contrast and legibility across:
    - Mentorship Lineage canvas SVG nodes and connector lines (`LineagePage`).
    - Markdown preview blocks, code syntax highlighting, callouts, and custom badges (`MarkdownPreview`).
    - Rich Cards manager, Theme Picker, and Bio Editor in `ProfileStudioPage`.
    - Admin Approval, Audit Log viewer, and User Management moderation modals.
    - Floating toast notifications and dropdown menus (`NotificationBell`, `ToastStack`).

- [x] **8.5 Testing & Documentation**
  - Write Vitest unit tests (`apps/web/tests/unit/theme-toggle.test.tsx`) verifying default dark state, theme toggling, and `localStorage` persistence.
  - Add Playwright E2E tests (`apps/web/e2e/theme.spec.ts`) asserting that initial visitor load defaults to dark theme, toggling switches theme class on `<html>`, and selection persists across route navigation and reloads.
  - Verify complete quality gates pass (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`).
