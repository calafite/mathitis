# Phase 13: Lineage Graph Caching & Frontend Optimization

## Objective
Prevent future API latency and frontend rendering freezes caused by the unbounded growth of the Mentorship Lineage Graph. This phase introduces a Redis-backed caching layer for the backend graph computations and implements chronological filtering (by academic year) on the React frontend to keep DOM node counts within performant limits.

---

## Directives & Platform Constraints
- **Cache-Aside with Active Invalidation**: The backend must cache the expensive graph computation in Redis. The cache must be actively invalidated (cleared) whenever a graph-mutating event occurs (e.g., a mentorship request is accepted, or a user is anonymized).
- **Graceful DOM Degradation**: The frontend must not attempt to render thousands of SVG elements simultaneously. Default to rendering only recent academic years, giving users explicit controls to load historical generations.
- **Maintain Domain Invariants**: This optimization must not violate Invariant #1 (Soft Deletes / Lineage Preservation). Anonymized users must still be served from the cache correctly.

---

## Tasks

- [ ] **13.1 Backend Redis Cache Implementation (`apps/api`)**
  - Update `apps/api/src/services/lineage-service.ts`:
    - Inject the `Redis` client into `createLineageService`.
    - Implement caching for `getFullGraph()`:
      - Check Redis for key `lineage:full`.
      - If exists, parse and return.
      - If missing, execute the existing Prisma query, build the nodes/edges, store the JSON string in Redis (`SETEX lineage:full 86400`), and return.
    - Implement caching for `getSubgraph(handle)`:
      - Use cache key pattern `lineage:subgraph:{handle}` with the same 24-hour TTL and read-through logic.

- [ ] **13.2 Cache Invalidation Triggers (`apps/api`)**
  - Create a utility function `invalidateLineageCache(redis: Redis, handles?: string[])` that deletes `lineage:full` and any specific `lineage:subgraph:{handle}` keys.
  - Hook into `apps/api/src/services/request-service.ts`:
    - Upon `accept()` and `approveAdmin()` (which successfully create a new `mentorship` record), invoke the cache invalidator.
  - Hook into `apps/api/src/services/admin-service.ts`:
    - Upon `anonymizeUser()`, invoke the cache invalidator so the anonymized handle (`user_<uuid>`) replaces the old handle in the graph payload immediately.

- [ ] **13.3 Frontend Chronological Filtering & UI Controls (`apps/web`)**
  - Update `apps/web/src/pages/lineage.tsx`:
    - Modify the graph calculation logic (`useMemo`) to filter `nodes` and `edges` based on a selected academic year range.
    - **Default State**: Filter the graph to only display the *current and previous* academic year (e.g., if the latest is "2026/2027", show "2026/2027" and "2025/2026").
    - **UI Controls**: Add a "Filtro de Ano Acadêmico" (Academic Year Filter) near the header.
      - Use a dropdown or toggle group allowing the user to select specific years or click "Carregar Histórico Completo" (Load Full History).
      - Display a soft warning when "Full History" is selected (e.g., *"Aviso: Carregar a linhagem completa de todos os anos pode causar lentidão em dispositivos mais antigos."*).

- [ ] **13.4 Frontend Graph Rendering Optimizations (`apps/web`)**
  - Implement basic virtualization or constraint checks in the SVG canvas:
    - If the filtered graph contains $> 500$ nodes, ensure `opacity` or animation-heavy CSS properties (like transitions on hover) are disabled or reduced to prevent GPU thrashing.

- [ ] **13.5 Testing & Automated Quality Gates**
  - **Unit Tests (`apps/api/tests/unit/lineage-service.test.ts`)**:
    - Mock Redis and verify that `getFullGraph` reads from the cache when available.
    - Verify that cache misses trigger a database call and write the result back to Redis with a TTL.
  - **Integration Tests (`apps/api/tests/integration/discovery.test.ts` or `lineage.test.ts`)**:
    - Submit and accept a mentorship request, then verify that the `lineage:full` Redis key is successfully deleted (invalidated).
  - **Frontend Unit Tests (`apps/web/tests/unit/lineage.test.tsx`)**:
    - Feed a mock graph with 5 different academic years.
    - Assert that by default, only the 2 most recent years are rendered in the DOM.
    - Assert that clicking "Carregar Histórico Completo" renders all nodes.

---

## Verification Checklist
- [ ] Run `pnpm lint` and `pnpm typecheck` to ensure Redis injections and types are sound.
- [ ] Run `pnpm test:unit` and `pnpm test:integration`.
- [ ] Spin up the local environment, accept a mentorship request, and verify the graph updates immediately (cache invalidation works).
- [ ] Verify frontend defaults to recent years, keeping SVG node count small on initial load.
