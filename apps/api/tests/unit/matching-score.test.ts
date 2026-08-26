import { describe, expect, it } from 'vitest';
import {
  calculateMatchScore,
  calculateSemanticTagScore,
  findSemanticPairs,
  WEIGHTS,
} from '../../src/services/matching-score.js';

describe('matching-score', () => {
  describe('calculateMatchScore', () => {
    it('returns 0 when all inputs are zero', () => {
      const score = calculateMatchScore({
        freshmanTagIds: [],
        seniorTagIds: [],
        effortScore: 0,
        profileViews: 0,
        bumpCount: 0,
      });
      expect(score).toBe(0);
    });

    it('weights all four components', () => {
      const score = calculateMatchScore({
        freshmanTagIds: ['a'],
        seniorTagIds: ['a'],
        effortScore: 100,
        profileViews: 1000,
        bumpCount: 4,
      });
      // tagOverlap=100, effort=100, views≈100, bumps=100
      const expected =
        WEIGHTS.tagOverlap * 100 +
        WEIGHTS.effort * 100 +
        WEIGHTS.views * 100 +
        WEIGHTS.bumps * 100;
      expect(score).toBe(Math.round(expected));
    });
  });

  describe('calculateSemanticTagScore', () => {
    it('returns 0 when either map is empty', () => {
      const map = new Map([['a', [1, 0]]]);
      expect(calculateSemanticTagScore(new Map(), map)).toBe(0);
      expect(calculateSemanticTagScore(map, new Map())).toBe(0);
    });

    it('returns a high score for similar embeddings', () => {
      const freshman = new Map([['a', [1, 0, 0]]]);
      const senior = new Map([['b', [0.99, 0.1, 0]]]);
      const score = calculateSemanticTagScore(freshman, senior);
      expect(score).toBeGreaterThan(80);
    });

    it('returns a low score for dissimilar embeddings', () => {
      const freshman = new Map([['a', [1, 0, 0]]]);
      const senior = new Map([['b', [0, 1, 0]]]);
      const score = calculateSemanticTagScore(freshman, senior);
      expect(score).toBe(0);
    });

    it('caps at 100', () => {
      const vec = new Array(384).fill(1 / Math.sqrt(384));
      const freshman = new Map([['a', vec]]);
      const senior = new Map([['b', [...vec]]]);
      const score = calculateSemanticTagScore(freshman, senior);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('findSemanticPairs', () => {
    it('finds similar tag pairs above threshold', () => {
      const freshmanTags = [
        { id: 'a', name: 'IA' },
        { id: 'b', name: 'Calculo' },
      ];
      const seniorTags = [
        { id: 'c', name: 'Machine Learning' },
        { id: 'd', name: 'Musica' },
      ];
      const freshmanEmb = new Map([
        ['a', [1, 0, 0]],
        ['b', [0, 0, 1]],
      ]);
      const seniorEmb = new Map([
        ['c', [0.99, 0.1, 0]],
        ['d', [0, 1, 0]],
      ]);

      const pairs = findSemanticPairs(freshmanTags, seniorTags, freshmanEmb, seniorEmb, 0.5);
      expect(pairs.length).toBeGreaterThan(0);
      expect(pairs[0]).toHaveProperty('freshmanTag');
      expect(pairs[0]).toHaveProperty('seniorTag');
    });

    it('excludes shared tags from semantic pairs', () => {
      const freshmanTags = [{ id: 'a', name: 'Shared' }];
      const seniorTags = [{ id: 'a', name: 'Shared' }];
      const emb = new Map([['a', [1, 0, 0]]]);

      const pairs = findSemanticPairs(freshmanTags, seniorTags, emb, emb, 0.5);
      expect(pairs).toHaveLength(0);
    });
  });
});
