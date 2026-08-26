import { describe, expect, it, vi } from 'vitest';
import { dotProduct } from '../../src/lib/embeddings.js';

vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(
    vi.fn().mockResolvedValue({
      data: new Float32Array(384).fill(0),
    }),
  ),
}));

describe('embeddings', () => {
  describe('dotProduct', () => {
    it('returns 1 for identical unit vectors', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      expect(dotProduct(a, b)).toBe(1);
    });

    it('returns 0 for orthogonal vectors', () => {
      const a = [1, 0, 0];
      const b = [0, 1, 0];
      expect(dotProduct(a, b)).toBe(0);
    });

    it('returns -1 for opposite unit vectors', () => {
      const a = [1, 0];
      const b = [-1, 0];
      expect(dotProduct(a, b)).toBe(-1);
    });

    it('computes a weighted sum correctly', () => {
      const a = [0.5, 0.5];
      const b = [0.3, 0.7];
      expect(dotProduct(a, b)).toBeCloseTo(0.5 * 0.3 + 0.5 * 0.7);
    });

    it('handles empty arrays', () => {
      expect(dotProduct([], [])).toBe(0);
    });
  });
});
