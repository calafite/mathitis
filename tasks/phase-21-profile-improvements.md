# Phase 21: Dynamic Tags, Edge Semantic Embeddings & Brutalist Card Overhaul

## Objective
Transform the tag selector in the Profile Studio into a dynamic typeahead system with community-driven suggestions, integrate an in-process **Edge Semantic Similarity Embedding Engine** (`@huggingface/transformers` with `all-MiniLM-L6-v2`) to intelligently match related student interests, remove the obsolete "Estilo do cartão" buttons, and overhaul the Rich Card presentation (eliminating redundant double-covers, fixing embed corner gaps, introducing chamfered/cut brutalist corners, and styling the horizontal rail).

---

## Directives & Platform Constraints
- **In-Process Edge Inference**: Embeddings MUST be generated locally inside the Node.js API process using `@huggingface/transformers` and quantized ONNX models (`Xenova/all-MiniLM-L6-v2`, ~23MB). No external cloud AI APIs, no Python microservices.
- **Compute-Once Tag Caching**: Embeddings must be stored in PostgreSQL (`Tag.embedding Float[]`). A tag's vector is computed once upon creation and reused across all platform matching runs.
- **Zero-Allocation Dot Product**: All generated embeddings muthe x means st be $L_2$ unit-normalized at generation time so that runtime cosine similarity reduces to a fast in-memory dot product ($< 0.001\text{ms}$).
- **Chamfered / Cut-Corner Geometry**: Apply 45-degree cut corners (chamfers) on cards and badges using CSS `clip-path` to reinforce the technical/blueprint brutalist aesthetic.
- **Deduplicate Card Media**: For `song` cards featuring a Spotify player embed, DO NOT render the static cover image above the player.

---

## Tasks

- [ ] **21.1 Edge Embedding Pipeline & Database Schema (`apps/api` & `packages/schemas`)**
  - Install `@huggingface/transformers` in `apps/api/package.json`.
  - In `apps/api/prisma/schema.prisma`:
    - Add `embedding Float[]` to the `Tag` model and run `pnpm db:migrate`.
  - Create `apps/api/src/lib/embeddings.ts`:
    - Implement a singleton embedding service that lazily loads the pipeline on boot:
      ```typescript
      import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers';

      let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;

      async function getExtractor() {
        if (!extractorPromise) {
          extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            quantized: true,
          });
        }
        return extractorPromise;
      }

      export async function generateEmbedding(text: string): Promise<number[]> {
        const extractor = await getExtractor();
        const output = await extractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
      }

      export function dotProduct(a: number[], b: number[]): number {
        let sum = 0;
        for (let i = 0; i < a.length; i++) {
          sum += a[i]! * b[i]!;
        }
        return sum;
      }
      ```

- [ ] **21.2 Dynamic Tag Creation & Vector Persistence API (`apps/api`)**
  - In `apps/api/src/repositories/profile-repository.ts` and `discovery-repository.ts`:
    - When associating tag names with a profile:
      - Check if the tag already exists in the `tags` table.
      - If it is a new tag, call `generateEmbedding(tagName)` and insert into PostgreSQL with `name`, `category: 'custom'`, `icon`, and `embedding`.
  - In `apps/api/src/plugins/discovery-plugin.ts`:
    - Register `GET /api/tags/suggest?q=...` returning typeahead candidate tags sorted by usage count.

- [ ] **21.3 Semantic Matching Engine Upgrade (`apps/api`)**
  - In `apps/api/src/services/matching-score.ts`:
    - Update `calculateMatchScore` to receive tag embeddings along with tag IDs.
    - Compute the soft semantic similarity score:
      ```typescript
      export function calculateSemanticTagScore(
        freshmanEmbeddings: number[][],
        seniorEmbeddings: number[][],
      ): number {
        if (freshmanEmbeddings.length === 0 || seniorEmbeddings.length === 0) return 0;
        let totalSim = 0;
        for (const fVec of freshmanEmbeddings) {
          let maxSim = 0;
          for (const sVec of seniorEmbeddings) {
            const sim = dotProduct(fVec, sVec);
            if (sim > maxSim) maxSim = sim;
          }
          totalSim += Math.max(0, maxSim);
        }
        return Math.min(100, Math.round((totalSim / freshmanEmbeddings.length) * 100));
      }
      ```
    - Combine into final match score: $\text{TagScore} = \max(\text{JaccardOverlap}, \text{SemanticTagScore})$.
    - In `buildMatchReasons`, detect pairs where $\mathbf{e}_f \cdot \mathbf{e}_s \ge 0.75$ on distinct tag names and emit:
      *"Interesses afins: {freshmanTag} ~ {seniorTag}"*.

- [ ] **21.4 Dynamic Tag Input Component (`apps/web`)**
  - Create `apps/web/src/components/profile/dynamic-tag-input.tsx`:
    - Brutalist text input bar with live typeahead dropdown showing existing tags, emojis, and usage counts.
    - Pressing `Enter`, `Comma`, or clicking a suggestion adds the tag as a chamfered brutalist badge with an `✕` removal button.
    - If no suggestion matches, displays `+ Criar tag "{digitado}"` and adds it dynamically.
  - In `apps/web/src/pages/profile-studio.tsx`:
    - Replace the hardcoded tag grid with `<DynamicTagInput />`.

- [ ] **21.5 Theme Picker Cleanup (`packages/schemas` & `apps/web`)**
  - In `packages/schemas/src/profile.ts`:
    - Deprecate `cardStyle` in `themePaletteSchema`.
  - In `apps/web/src/components/profile/theme-picker.tsx`:
    - Remove the "Estilo do cartão" buttons (`Vidro fosco`, `Sólido`, `com borda`). Keep color pickers and presets.
  - In `profile-preview.tsx` and `mentor-profile-modal.tsx`:
    - Clean up unused legacy classes referencing `cardStyle`.

- [ ] **21.6 Rich Card Chamfered Geometry & Media Deduplication (`apps/web`)**
  - In `apps/web/src/components/profile/profile-preview.tsx` and `mentor-profile-modal.tsx` (`RichCardView`):
    - Apply 45-degree chamfered cut corners via CSS `clip-path`:
      ```css
      clip-path: polygon(
        0 8px, 8px 0, 
        calc(100% - 8px) 0, 100% 8px, 
        100% calc(100% - 8px), calc(100% - 8px) 100%, 
        8px 100%, 0 calc(100% - 8px)
      );
      ```
    - Only render the top banner image if the card is NOT a song with an active Spotify embed (eliminates double-cover redundancy).
    - Wrap the Spotify iframe in a flush container (`bg-black`) without padding to eliminate corner gaps.
    - Style the carousel scrollbar with a sharp, thin brutalist thumb.

- [ ] **21.7 Testing & Automated Quality Gates**
  - **Unit Tests (`apps/api/tests/unit/embeddings.test.ts` & `matching-score.test.ts`)**:
    - Test that `generateEmbedding("Machine Learning")` returns a 384-dimension normalized vector.
    - Test that `dotProduct("Inteligência Artificial", "Machine Learning")` yields $> 0.75$.
    - Test that `dotProduct("Cálculo 1", "Música Clássica")` yields $< 0.30$.
  - **Integration Tests (`apps/api/tests/integration/profiles.test.ts`)**:
    - Test saving a profile with custom tags; verify `Tag` records are created with non-empty `embedding` float arrays in PostgreSQL.
  - **Frontend Component Tests (`apps/web/tests/unit/dynamic-tag-input.test.tsx`)**:
    - Test tag creation, autocomplete selection, and badge removal.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck` across all workspaces.
- [ ] Run `pnpm test:unit` and `pnpm test:integration`.
- [ ] Open `/profile/studio`: Verify "Estilo do cartão" buttons are removed.
- [ ] Create a custom tag (e.g. *"Compiladores"*), verify it persists with a 384-dim vector in PostgreSQL, and shows up in typeahead for other accounts.
- [ ] Create a freshman with tag *"IA"* and a senior with tag *"Machine Learning"*; verify they receive a high compatibility score in `/discovery` with an explainable match reason.
- [ ] Inspect a Spotify card: verify the duplicate top image is gone and corners sit flush without letterboxing gaps.
