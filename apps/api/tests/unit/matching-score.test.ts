import { describe, expect, it } from 'vitest';
import {
  buildMatchReasons,
  calculateMatchScore,
  REASON_THRESHOLDS,
  WEIGHTS,
} from '../../src/services/matching-score.js';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

describe('calculateMatchScore', () => {
  it('scores 0 for a completely disjoint profile', () => {
    const score = calculateMatchScore({
      freshmanTagIds: [U1],
      seniorTagIds: [U2],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(score).toBe(0);
  });

  it('weights tag overlap at 40% (full overlap = 40)', () => {
    const score = calculateMatchScore({
      freshmanTagIds: [U1, U2],
      seniorTagIds: [U1, U2],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(score).toBeCloseTo(40, 5);
  });

  it('uses Jaccard similarity for partial tag overlap', () => {
    const score = calculateMatchScore({
      freshmanTagIds: [U1, U2, U3],
      seniorTagIds: [U1, U2],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 0,
    });
    // overlap 2 / union 3 = 0.666... * 40, then rounded
    expect(score).toBe(Math.round(40 * (2 / 3)));
  });

  it('weights effort score at 30%', () => {
    const score = calculateMatchScore({
      freshmanTagIds: [],
      seniorTagIds: [],
      effortScore: 100,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(score).toBeCloseTo(30, 5);
  });

  it('weights profile views at 10% with logarithmic normalisation', () => {
    // viewsScore is clamped at 100, so the contribution is exactly 10 points
    const score = calculateMatchScore({
      freshmanTagIds: [],
      seniorTagIds: [],
      effortScore: 0,
      profileViews: 1000,
      bumpCount: 0,
    });
    expect(score).toBe(10);
  });

  it('weights bumps at 20% capped at 4 bumps (100% contribution)', () => {
    const score = calculateMatchScore({
      freshmanTagIds: [],
      seniorTagIds: [],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 4,
    });
    expect(score).toBeCloseTo(20, 5);
  });

  it('never exceeds the maximum combined score', () => {
    const score = calculateMatchScore({
      freshmanTagIds: [U1],
      seniorTagIds: [U1],
      effortScore: 100,
      profileViews: 1_000_000,
      bumpCount: 10,
    });
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeCloseTo(100, 1);
  });

  it('exposes documented weights', () => {
    expect(WEIGHTS).toEqual({ tagOverlap: 0.4, effort: 0.3, views: 0.1, bumps: 0.2 });
  });
});

const T1 = { id: U1, name: 'Algebra' };
const T2 = { id: U2, name: 'Databases' };
const T3 = { id: U3, name: 'Machine Learning' };

describe('buildMatchReasons', () => {
  it('returns no reasons for a senior with no matching signals', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [T1],
      seniorTags: [T2, T3],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(reasons).toEqual([]);
  });

  it('reports the shared tags with names', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [T1, T2, T3],
      seniorTags: [T1, T2],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(reasons).toEqual(['2 interesses em comum: Algebra, Databases']);
  });

  it('uses singular wording for a single shared tag', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [T1],
      seniorTags: [T1, T2],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(reasons).toContain('1 interesse em comum: Algebra');
  });

  it('caps the listed tag names and summarises the remainder', () => {
    const extra = Array.from({ length: 4 }, (_, i) => ({ id: `t-${i}`, name: `Tag ${i}` }));
    const reasons = buildMatchReasons({
      freshmanTags: [T1, T2, T3, ...extra],
      seniorTags: [T1, T2, T3, ...extra],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(reasons[0]).toBe(
      '7 interesses em comum: Algebra, Databases, Machine Learning +4',
    );
  });

  it('describes an above-average profile as rich', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [],
      seniorTags: [],
      effortScore: REASON_THRESHOLDS.effortRich,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(reasons).toContain('Perfil rico e muito detalhado');
  });

  it('describes a moderate profile as detailed, not rich', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [],
      seniorTags: [],
      effortScore: REASON_THRESHOLDS.effortDetailed,
      profileViews: 0,
      bumpCount: 0,
    });
    expect(reasons).toEqual(['Perfil detalhado']);
  });

  it('flags a profile in high demand by views', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [],
      seniorTags: [],
      effortScore: 0,
      profileViews: REASON_THRESHOLDS.viewsHighDemand,
      bumpCount: 0,
    });
    expect(reasons).toContain('Em alta entre os estudantes');
  });

  it('flags a frequently bumped senior', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [],
      seniorTags: [],
      effortScore: 0,
      profileViews: 0,
      bumpCount: REASON_THRESHOLDS.bumpsFrequent,
    });
    expect(reasons).toContain('Frequentemente impulsionado por calouros');
  });

  it('flags a single bump with softer wording', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [],
      seniorTags: [],
      effortScore: 0,
      profileViews: 0,
      bumpCount: REASON_THRESHOLDS.bumpsNoticed,
    });
    expect(reasons).toContain('Recentemente impulsionado por um calouro');
  });

  it('mentions that an accepting senior is open to new mentees', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [],
      seniorTags: [],
      effortScore: 0,
      profileViews: 0,
      bumpCount: 0,
      isAcceptingRequests: true,
    });
    expect(reasons).toContain('Aceitando novos ferinhas');
  });

  it('combines reasons across signals in stable order', () => {
    const reasons = buildMatchReasons({
      freshmanTags: [T1, T2],
      seniorTags: [T1, T2, T3],
      effortScore: REASON_THRESHOLDS.effortRich,
      profileViews: REASON_THRESHOLDS.viewsPopular,
      bumpCount: REASON_THRESHOLDS.bumpsFrequent,
      isAcceptingRequests: true,
    });
    expect(reasons).toEqual([
      '2 interesses em comum: Algebra, Databases',
      'Perfil rico e muito detalhado',
      'Perfil popular entre estudantes',
      'Frequentemente impulsionado por calouros',
      'Aceitando novos ferinhas',
    ]);
  });
});
