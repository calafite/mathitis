import { describe, expect, it } from 'vitest';
import { calculateEffortScore } from '../../src/services/effort-score.js';

describe('calculateEffortScore', () => {
  it('returns 0 for an empty profile', () => {
    expect(calculateEffortScore(null, 0)).toBe(0);
    expect(calculateEffortScore('', 0)).toBe(0);
  });

  it('awards up to 30 points for biography word count', () => {
    const words = Array.from({ length: 300 }, (_, i) => `word${i}`).join(' ');
    expect(calculateEffortScore(words, 0)).toBe(30);
  });

  it('awards 3 points for every 30 words', () => {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`).join(' ');
    expect(calculateEffortScore(words, 0)).toBe(6);
  });

  it('rewards markdown structure (headers, colour spans, callouts, code)', () => {
    const bio = [
      '# My story',
      '',
      '[Watch this]{color=#ff4444}',
      '',
      '> [!TIP]',
      '> A helpful tip.',
      '',
      '```ts',
      'const x = 1;',
      '```',
    ].join('\n');
    const score = calculateEffortScore(bio, 0);
    expect(score).toBeGreaterThan(0);
  });

  it('awards up to 40 points for rich cards (5 per card)', () => {
    expect(calculateEffortScore(null, 2)).toBe(10);
    expect(calculateEffortScore(null, 8)).toBe(40);
    expect(calculateEffortScore(null, 20)).toBe(40);
  });

  it('caps the total score at 100', () => {
    const richBio = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    expect(calculateEffortScore(richBio, 20)).toBeLessThanOrEqual(100);
  });
});