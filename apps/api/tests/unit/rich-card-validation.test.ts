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
});