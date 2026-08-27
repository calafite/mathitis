# Phase 23: Expanded Showcase Grid & Categorized Collections

## Objective
Improve the scalability and scannability of the "Vitrine" (Showcase/Collection) section for mentors with many rich cards. Instead of forcing users to scroll endlessly through a single horizontal rail, introduce an inline brutalist toggle (`[ VER TODOS (X) ]`) that expands the section into a full vertical grid. In this expanded view, cards must be logically grouped and separated by their media types (e.g., Music, Games, Projects).

---

## Directives & Platform Constraints
- **Inline Expansion (No Modals-in-Modals)**: Expanding the collection must push the content down smoothly within the current scrollable container. Do not open a new popup over the existing Mentor Profile Modal.
- **Categorized Grids**: When expanded, cards cannot be a flat, disorganized list. They must be grouped by `cardType`, each group featuring a brutalist sub-header.
- **Toggle Aesthetics**: The expand/collapse control must replace or wrap the current card count badge in the section header, utilizing the signature stark, uppercase monospace styling with hover inversions.

---

## Tasks

- [x] **23.1 Showcase State Management & Grouping Logic (`apps/web`)**
  - In `apps/web/src/components/profile/profile-preview.tsx` and `mentor-profile-modal.tsx`:
    - Introduce local state: `const [expandedCards, setExpandedCards] = useState(false);`.
    - Create a helper to group the `cards` array by `cardType`:
      ```typescript
      const groupedCards = useMemo(() => {
        return cards.reduce((acc, card) => {
          if (!acc[card.cardType]) acc[card.cardType] = [];
          acc[card.cardType].push(card);
          return acc;
        }, {} as Record<string, RichCard[]>);
      }, [cards]);
      ```
    - Map the raw types to display labels (e.g., `song` $\rightarrow$ `♪ MÚSICA`, `game` $\rightarrow$ `▣ JOGOS`, `film` $\rightarrow$ `▶ FILMES`, `book` $\rightarrow$ `📖 LIVROS`, `project` $\rightarrow$ `⚙ PROJETOS`, `custom` $\rightarrow$ `✦ LINKS`).

- [x] **23.2 Brutalist Expansion Toggle (`apps/web`)**
  - Update the "VITRINE" / "COLEÇÃO" section header in both components.
  - Transform the static card count badge into an interactive button:
    ```tsx
    <div className="mb-2 flex items-center justify-between border-b border-foreground/50 pb-2">
      <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Vitrine
      </h3>
      {cards.length > 0 && (
        <button
          type="button"
          onClick={() => setExpandedCards((prev) => !prev)}
          className="border border-foreground px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-widest text-foreground transition-colors hover:bg-foreground hover:text-background focus:outline-none"
        >
          {expandedCards ? '[ COLAPSAR ]' : `[ VER TODOS (${cards.length}) ]`}
        </button>
      )}
    </div>
    ```

- [x] **23.3 Categorized Grid Rendering (`apps/web`)**
  - Implement a conditional rendering block for the cards section based on `expandedCards`:
    - **If `!expandedCards` (Default)**: Render the existing horizontal scroll carousel (`flex gap-4 overflow-x-auto snap-x...`).
    - **If `expandedCards` (Expanded)**: Render a vertical flow mapping over `Object.entries(groupedCards)`.
  - For each category group in the expanded view:
    - Render a brutalist sub-header: `<h4 className="mt-4 mb-3 border-b border-foreground/30 pb-1 font-mono text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{categoryLabel}</h4>`
    - Render the cards in a CSS Grid to maximize screen space: `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4"> ... </div>`
  - Ensure the cards themselves (`RichCardView`) stretch to fill the grid columns natively without breaking their aspect ratios or internal padding.

- [x] **23.4 Testing & Verification**
  - **Component Tests (`apps/web/tests/unit/rich-card-manager.test.tsx` / `profile-studio.test.tsx`)**:
    - Mock a profile with mixed card types (2 songs, 1 game, 1 project).
    - Assert that clicking `[ VER TODOS (4) ]` renders the categorized sub-headers ("MÚSICA", "JOGOS", "PROJETOS").
  - **Manual UI QA**:
    - Open the Profile Studio and add at least 4 cards of varying types.
    - Verify the horizontal scroll rail still works perfectly when collapsed.
    - Click "VER TODOS", verify the cards reflow into a clean 2-column grid categorized by type.
    - Ensure scrolling inside the Mentor Profile Modal handles the expanded height dynamically without cutting off content or breaking the fixed modal header/footer.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck`.
- [ ] Ensure `RichCardView` components maintain their $100\%$ width inside the expanded `sm:grid-cols-2` grid container.
- [ ] Ensure that clicking `[ COLAPSAR ]` instantly returns the view to the horizontal rail, hiding the category headers.
- [ ] Verify there is no awkward layout jumping or broken borders when toggling between states.
