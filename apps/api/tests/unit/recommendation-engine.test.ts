import { describe, expect, it } from 'vitest';
import {
  createRecommendationEngine,
  type RankableSenior,
} from '../../src/services/recommendation-engine.js';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

function senior(overrides: Partial<RankableSenior>): RankableSenior {
  return {
    userId: U1,
    tags: [],
    effortScore: 0,
    profileViews: 0,
    bumpCount: 0,
    isAcceptingRequests: true,
    ...overrides,
  };
}

describe('createRecommendationEngine', () => {
  const engine = createRecommendationEngine();

  it('ranks seniors by descending score', () => {
    const ranked = engine.rank(
      [{ id: U1, name: 'Algebra' }],
      [
        senior({ userId: U3, tags: [], effortScore: 0 }),
        senior({ userId: U1, tags: [{ id: U1, name: 'Algebra' }], effortScore: 100 }),
        senior({ userId: U2, tags: [], effortScore: 40 }),
      ],
    );

    expect(ranked.map((s) => s.userId)).toEqual([U1, U2, U3]);
    expect(ranked[0]).toMatchObject({ score: 70, userId: U1 });
  });

  it('attaches human-readable match reasons to each senior', () => {
    const [top] = engine.rank(
      [{ id: U1, name: 'Algebra' }],
      [
        senior({
          userId: U1,
          tags: [{ id: U1, name: 'Algebra' }],
          effortScore: 80,
          bumpCount: 3,
        }),
      ],
    );

    expect(top!.matchReasons).toEqual([
      '1 interesse em comum: Algebra',
      'Perfil rico e muito detalhado',
      'Frequentemente impulsionado por calouros',
      'Aceitando novos pupilos',
    ]);
  });

  it('keeps an empty reason list for a zero-signal senior', () => {
    const [bottom] = engine.rank(
      [{ id: U1, name: 'Algebra' }],
      [senior({ tags: [], isAcceptingRequests: false })],
    );
    expect(bottom!.score).toBe(0);
    expect(bottom!.matchReasons).toEqual([]);
  });
});
