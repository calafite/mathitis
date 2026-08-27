import { type ZodType } from 'zod';
import {
  filmMetadataSchema,
  gameMetadataSchema,
  projectMetadataSchema,
  songMetadataSchema,
  type RichCardType,
} from '@mathitis/schemas';
import { ValidationError } from '../errors.js';

const EMBED_HOST_WHITELIST = [
  'open.spotify.com',
  'w.soundcloud.com',
  'soundcloud.com',
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'player.vimeo.com',
] as const;

export const CARD_TYPE_SCHEMAS: Record<'song' | 'game' | 'film' | 'project', ZodType> = {
  song: songMetadataSchema,
  game: gameMetadataSchema,
  film: filmMetadataSchema,
  project: projectMetadataSchema,
};

/**
 * Verifies an embed URL resolves to a whitelisted media host so that arbitrary
 * third-party iframes can never be injected into profiles.
 * @param url - Candidate embed URL (may be absent)
 */
export function validateCardEmbedUrl(url: string | null | undefined): void {
  if (!url) return;
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    throw new ValidationError('A URL de incorporação deve ser uma URL válida');
  }
  if (!EMBED_HOST_WHITELIST.includes(host as (typeof EMBED_HOST_WHITELIST)[number])) {
    throw new ValidationError(`Embed URL host "${host}" is not permitted`);
  }
}

/**
 * Validates type-specific metadata and derives missing values from supplied
 * URLs (Spotify track URIs, Steam app IDs) without requiring external API keys.
 * @param cardType - The rich card type
 * @param metadata - Raw metadata object from the client
 * @param embedUrl - The card's embed URL (may be absent)
 * @param externalUrl - The card's external URL (may be absent)
 * @returns Normalised, validated metadata
 */
export function enrichCardMetadata(
  cardType: RichCardType,
  metadata: Record<string, unknown> | null | undefined,
  embedUrl?: string | null,
  externalUrl?: string | null,
): Record<string, unknown> {
  const base = { ...(metadata ?? {}) };

  if (cardType !== 'song' && cardType !== 'game' && cardType !== 'film' && cardType !== 'project') {
    return base;
  }

  const parsed = CARD_TYPE_SCHEMAS[cardType].safeParse(base);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => issue.message).join('; ');
    throw new ValidationError(`Invalid ${cardType} metadata: ${detail}`);
  }

  const out: Record<string, unknown> = { ...parsed.data };

  if (cardType === 'song' && !out.spotifyUri && embedUrl) {
    const match = embedUrl.match(/\/track\/([A-Za-z0-9]+)/);
    if (match) out.spotifyUri = `spotify:track:${match[1]}`;
  }

  if (cardType === 'game' && !out.steamAppId && externalUrl) {
    const match = externalUrl.match(/\/(?:app|games?)\/(\d{1,8})/);
    if (match) out.steamAppId = match[1];
  }

  if (cardType === 'project' && !out.repository && externalUrl) {
    const parsedUrl = new URL(externalUrl);
    if (parsedUrl.protocol === 'https:') out.repository = externalUrl;
  }

  return out;
}
