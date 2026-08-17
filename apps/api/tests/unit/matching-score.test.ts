import { describe, expect, it } from 'vitest';
import { calculateMatchScore, WEIGHTS } from '../../src/services/matching-score.js';

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