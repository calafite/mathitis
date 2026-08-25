# Phase 16: Profile Redesign & Ingestion Fixes

## Objective
Overhaul the Profile Preview (`ProfilePreview`) and Mentor Modal (`MentorProfileModal`) to strictly match the reference design. This entails stripping away soft UI elements in favor of high-contrast typography, full-width horizontal dividers, and sharp borders. 

Additionally, this phase addresses two active bugs: **1)** Discord, LinkedIn, and Site links currently do not render on the profile preview; and **2)** Rich Card auto-ingestion is failing for all platforms except Spotify.

---

## Directives & Platform Constraints
- **Structural Grid**: Sections (Header, Quote, Biography, Links, Cards) must be separated by stark, full-width horizontal lines (`border-b border-border` or `border-white`).
- **Typography Overhaul**: All metadata (pronouns, handles, section titles, links, footer stats) must use uppercase monospace with wide tracking (`font-mono text-[10px] uppercase tracking-widest`).
- **High Contrast**: Eliminate `/80` or `/70` opacity classes on important text. Text should be stark `text-foreground`.
- **Card Edges**: All interactive elements (Rich Cards, Buttons) must have sharp corners (`rounded-none`) and solid borders.

---

## Tasks

- [ ] **16.1 Structural Layout & Dividers (`apps/web`)**
  - In `apps/web/src/components/profile/profile-preview.tsx` and `mentor-profile-modal.tsx`:
    - Remove outer `rounded-2xl` and `shadow-sm` classes. Replace with `rounded-none border-2 border-foreground`.
    - Restructure the inner layout into a single-column stacked layout where every section is a full-width block with a bottom border (`border-b border-foreground/50`).
    - Sections top-to-bottom: Banner $\rightarrow$ Header (Avatar + Name) $\rightarrow$ Tagline $\rightarrow$ Bio $\rightarrow$ Links $\rightarrow$ Cards $\rightarrow$ Footer (Stats).

- [ ] **16.2 Header & Avatar Overlap (`apps/web`)**
  - Adjust the Banner and Avatar positioning:
    - Ensure the avatar overlaps the banner bottom edge and the header background perfectly.
    - Style the avatar with a solid border matching the background: `h-20 w-20 rounded-full border-2 border-foreground bg-background object-cover`.
    - Display social name in `font-sans text-2xl font-bold uppercase` and handle/pronouns below it in `font-mono text-[10px] uppercase tracking-widest`.
    - Position the "Aceitando ferinhas" badge to the far right, matching the bright acid green reference (`bg-primary text-primary-foreground rounded-none px-3 py-1 font-mono text-[10px] uppercase font-bold`).

- [ ] **16.3 Typography & Fixing Missing Contact Links (`apps/web`)**
  - **Tagline/Quote**: Render in `font-mono text-xs italic uppercase`.
  - **Section Labels**: For Biography and Cards, add headers like `<h3 className="font-mono text-[10px] uppercase tracking-widest py-2">Biografia</h3>`.
  - **Contact Links Fix**: Currently, the Discord, LinkedIn, and Site fields are useless because they are missing/failing to render in the preview. 
    - Fix the rendering logic so *all* populated fields (GitHub, LinkedIn, Discord, Website, Email) render successfully.
    - Render them inline, separated by spaces or borders. E.g., `GITHUB`, `LINKEDIN`, `DISCORD`, `SITE`, `EMAIL`.
    - Apply styling: `underline underline-offset-4 hover:bg-foreground hover:text-background`.

- [ ] **16.4 Rich Cards & Media Fixes (`apps/web`)**
  - Update `RichCardView` to match the wireframe:
    - Remove `rounded-xl`. Use `rounded-none border border-foreground`.
    - For Spotify embeds: remove `aspect-video`, enforce `height="152"` (or matching compact iframe height) to eliminate white letterboxing gaps.
    - If a card has an `imageUrl`, render it tight against the top border of the card: `className="w-full h-32 object-cover border-b border-foreground"`.
    - Style card internal text: `title` in bold sans, `subtitle/metadata` in uppercase mono.

- [ ] **16.5 Rich Card Scraper Diagnostics & Fixes (`apps/api`)**
  - **The Bug**: Automatic ingestion is currently broken for everything except Spotify.
  - Check the backend logs for `GET /api/profiles/me/cards/scrape`.
  - Debug and fix the extractors in `apps/api/src/services/rich-card-scraper.ts` for Steam, GitHub, Letterboxd, Books, and Custom fallbacks. 
  - Ensure missing OpenGraph tags or unexpected HTML structures do not throw unhandled exceptions that crash the entire unfurl process. Apply safe fallbacks.

- [ ] **16.6 Action Buttons & Footer (`apps/web`)**
  - Redesign the bottom action bar for the Mentor Modal:
    - Buttons ("IMPULSIONAR PERFIL", "PEDIR APADRINHAMENTO") must be `rounded-none border border-foreground bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest hover:bg-foreground hover:text-background`.
  - Footer stats ("ATÉ 3 FERINHAS", "PONTUAÇÃO DE ESFORÇO 5") must sit in a thin bottom bar: `flex justify-between border-t border-foreground py-1 px-2 font-mono text-[9px] uppercase text-muted-foreground`.

- [ ] **16.7 Testing & Verification**
  - **Component Tests**: Update `markdown-preview.test.tsx` and `rich-card-manager.test.tsx` to reflect structural DOM changes.
  - **Scraper Tests**: Update `apps/api/tests/unit/rich-card-scraper.test.ts` to assert that non-Spotify URLs resolve without throwing errors.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck`.
- [ ] Compare the rendered `ProfilePreview` in `/profile/studio` side-by-side with the provided reference image.
- [ ] Verify ALL contact links (Discord, LinkedIn, Site) actually appear on the profile preview when filled out.
- [ ] Paste a Steam, GitHub, or generic link into the Autocompletar bar and verify it successfully scrapes without breaking.
- [ ] Verify Spotify embeds have no awkward white vertical gaps.
