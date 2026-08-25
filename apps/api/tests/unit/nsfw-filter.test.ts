import { describe, expect, it } from 'vitest';
import { assertContentSafe } from '../../src/services/nsfw-filter.js';
import { ValidationError } from '../../src/errors.js';

function expectRejected(payload: Parameters<typeof assertContentSafe>[0]): void {
  let caught: unknown;
  try {
    assertContentSafe(payload);
  } catch (err) {
    caught = err;
  }
  expect(caught).toBeInstanceOf(ValidationError);
  const error = caught as ValidationError;
  expect(error.code).toBe('NSFW_CONTENT_REJECTED');
  expect(error.status).toBe(422);
}

describe('assertContentSafe', () => {
  it('allows clean content through', () => {
    expect(() =>
      assertContentSafe({
        title: 'Linear Algebra Lectures',
        description: 'Complete course on vector spaces and matrix decompositions',
        tags: ['mathematics', 'university'],
        rating: 'general',
        ageRating: 0,
        steamDescriptors: [],
      }),
    ).not.toThrow();
  });

  it('rejects age ratings of 18 or above', () => {
    expectRejected({ title: 'Some Game', ageRating: 18 });
    expectRejected({ title: 'Some Game', ageRating: 21 });
  });

  it('accepts adult-adjacent but safe age ratings', () => {
    expect(() => assertContentSafe({ title: 'Teen-rated game', ageRating: 16 })).not.toThrow();
    expect(() => assertContentSafe({ title: 'Unrated', ageRating: null })).not.toThrow();
  });

  it('rejects adult Steam content descriptors (string and number forms)', () => {
    for (const id of ['1', '2', '5']) {
      expectRejected({ title: 'Innocent Title', steamDescriptors: [id] });
      expectRejected({ title: 'Innocent Title', steamDescriptors: [Number(id)] });
    }
  });

  it('allows non-adult Steam descriptors and categories', () => {
    expect(() =>
      assertContentSafe({
        title: 'Cozy Farming Simulator',
        steamDescriptors: [4, 6],
      }),
    ).not.toThrow();
    expect(() =>
      assertContentSafe({
        title: 'Portal 2',
        tags: ['Single-player', 'Multi-player', 'Steam Achievements'],
      }),
    ).not.toThrow();
  });

  it('rejects adult meta ratings (case/diacritic-insensitive)', () => {
    expectRejected({ title: 'Page', rating: 'adult' });
    expectRejected({ title: 'Page', rating: 'Mature' });
    expectRejected({ title: 'Page', rating: 'RESTRICTED' });
    expectRejected({ title: 'Page', rating: 'RTA-5042-1996-1400-1577-Rta' });
    expect(() => assertContentSafe({ title: 'Page', rating: 'safe' })).not.toThrow();
  });

  it('rejects NSFW keywords in the title', () => {
    expectRejected({ title: 'Best free porn videos' });
    expectRejected({ title: 'XXX mega collection' });
    expectRejected({ title: 'Hentai gallery' });
  });

  it('rejects NSFW keywords in the description', () => {
    expectRejected({ title: 'Study group', description: 'join our nsfw server' });
  });

  it('rejects NSFW keywords in tags', () => {
    expectRejected({ title: 'Curated links', tags: ['study', 'porn'] });
  });

  it('does not flag benign words that merely contain similar substrings', () => {
    expect(() =>
      assertContentSafe({ title: 'Classical music essentials', description: 'Scoring films' }),
    ).not.toThrow();
  });
});
