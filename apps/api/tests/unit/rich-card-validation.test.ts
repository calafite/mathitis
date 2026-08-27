import { describe, expect, it } from 'vitest';
import {
  enrichCardMetadata,
  validateCardEmbedUrl,
} from '../../src/services/rich-card-validation.js';
import { ValidationError } from '../../src/errors.js';

describe('validateCardEmbedUrl', () => {
  it('allows whitelisted media hosts', () => {
    expect(() => validateCardEmbedUrl('https://open.spotify.com/embed/track/abc')).not.toThrow();
    expect(() => validateCardEmbedUrl('https://w.soundcloud.com/player/?url=x')).not.toThrow();
    expect(() => validateCardEmbedUrl('https://www.youtube.com/embed/abc')).not.toThrow();
    expect(() => validateCardEmbedUrl('https://player.vimeo.com/video/123')).not.toThrow();
  });

  it('rejects unknown or malicious hosts', () => {
    expect(() => validateCardEmbedUrl('https://evil.example.com/embed')).toThrow(ValidationError);
    expect(() => validateCardEmbedUrl('javascript:alert(1)')).toThrow(ValidationError);
    expect(() => validateCardEmbedUrl('not-a-url')).toThrow(ValidationError);
  });

  it('allows absent embed URLs', () => {
    expect(() => validateCardEmbedUrl(null)).not.toThrow();
    expect(() => validateCardEmbedUrl(undefined)).not.toThrow();
  });
});

describe('enrichCardMetadata', () => {
  it('derives a Spotify URI from an embed URL for song cards', () => {
    const meta = enrichCardMetadata(
      'song',
      {},
      'https://open.spotify.com/embed/track/4cOdK2wGLETKBW3PvgPWqT',
    );
    expect(meta.spotifyUri).toBe('spotify:track:4cOdK2wGLETKBW3PvgPWqT');
  });

  it('derives a Steam app ID from an external URL for game cards', () => {
    const meta = enrichCardMetadata(
      'game',
      {},
      undefined,
      'https://store.steampowered.com/app/1245620/Elden_Ring/',
    );
    expect(meta.steamAppId).toBe('1245620');
  });

  it('passes through plain metadata for book and custom cards', () => {
    expect(enrichCardMetadata('book', { pages: 300 })).toEqual({ pages: 300 });
    expect(enrichCardMetadata('custom', { anything: true })).toEqual({ anything: true });
  });

  it('rejects invalid type-specific metadata', () => {
    expect(() => enrichCardMetadata('song', { durationMs: -5 })).toThrow(ValidationError);
    expect(() => enrichCardMetadata('film', { rating: 11 })).toThrow(ValidationError);
    expect(() => enrichCardMetadata('game', { steamAppId: 'abc' })).toThrow(ValidationError);
  });

  it('validates project tech stack as an array of strings', () => {
    const meta = enrichCardMetadata('project', { techStack: ['python', 'numpy'] });
    expect(meta.techStack).toEqual(['python', 'numpy']);
    expect(() => enrichCardMetadata('project', { techStack: 'python' })).toThrow(ValidationError);
  });

  it('coerces string numbers in film metadata (form inputs submit strings)', () => {
    const meta = enrichCardMetadata('film', {
      rating: '8.5',
      year: '1975',
      director: 'Stanley Kubrick',
    });
    expect(meta.rating).toBe(8.5);
    expect(meta.year).toBe(1975);
    expect(meta.director).toBe('Stanley Kubrick');
  });

  it('parses a Barry Lyndon entry with numeric primitives and string years alike', () => {
    const fromStrings = enrichCardMetadata(
      'film',
      { rating: '8.1', year: '1975' },
      undefined,
      'https://letterboxd.com/film/barry-lyndon/',
    );
    expect(fromStrings.year).toBe(1975);
    expect(fromStrings.rating).toBe(8.1);

    const fromNumbers = enrichCardMetadata('film', { rating: 4.5, year: 1975 });
    expect(fromNumbers.rating).toBe(4.5);
    expect(fromNumbers.year).toBe(1975);
  });

  it('treats blank form fields as absent instead of coercing to zero', () => {
    const meta = enrichCardMetadata('film', { rating: '', year: '' });
    expect(meta.rating).toBeUndefined();
    expect(meta.year).toBeUndefined();

    const game = enrichCardMetadata('game', { hoursPlayed: '' }) as { hoursPlayed?: number };
    expect(game.hoursPlayed).toBeUndefined();
  });

  it('still rejects out-of-range values after coercion', () => {
    expect(() => enrichCardMetadata('film', { rating: '11' })).toThrow(ValidationError);
    expect(() => enrichCardMetadata('film', { year: '1800' })).toThrow(ValidationError);
  });
});
