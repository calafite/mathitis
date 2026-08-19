# Phase 7: Recommendation & Matching Engine

## Objective
Formalize the algorithmic mentor matching engine with explainable, human-readable match reasons and surface them to freshmen on the Discovery Hub, building on the existing effort-score and weighted compatibility scoring.

## Tasks
^- [x] **7.1 Recommendation Engine Module**
  - Extract a standalone `RecommendationEngine` in `apps/api/src/services/recommendation-engine.ts` implementing the `IRecommendationEngine` extensibility interface (`architecture.md` §11), decoupled from the discovery service via structural types.
  - Keep `calculateMatchScore` as a pure weighted compatibility score (`matching-score.ts`), aligned with the formula in `architecture.md` §8.5.
  - Unit-test ranking order, score attachment, and reason generation (threshold-based, deterministic reason order).
^- [x] **7.2 Explainable Match Reasons**
  - Add `buildMatchReasons` to `matching-score.ts` emitting reasons only for meaningful signals:
    - Shared tags (`N shared tag(s): <names>`, capped at 3 with `+N more`).
    - Profile effort (`Rich, highly detailed profile` ≥ 60, `Detailed profile` ≥ 40).
    - Profile views (`In high demand among students` ≥ 120, `Popular profile with students` ≥ 40).
    - Bumps (`Frequently bumped by fellow freshmen` ≥ 2, `Recently bumped by a fellow freshman` = 1).
    - Acceptance status (`Currently accepting new mentees`).
^- [x] **7.3 API Contract**
  - Extend `scoredSeniorSchema` with `matchReasons: string[]` in `packages/schemas`.
  - Ensure `GET /api/recommendations` returns reasons; update the integration test to assert reasons on every recommendation and on the leading shared-tag senior.
^- [x] **7.4 Discovery Hub UI**
  - Render `matchReasons` on recommendation cards in `apps/web/src/pages/discovery.tsx` under a "why we matched" list.
  - Keep catalog mode unchanged (reasons are recommendation-only).
^- [x] **7.5 Verification & Docs**
  - Full verification: API unit + integration tests, web unit tests, typecheck, and Playwright E2E suite remain green.
  - Document the engine and reason table in `docs/architecture/03-discovery-matching-and-requests.md`.