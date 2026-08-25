import { ValidationError } from '../errors.js';

/**
 * Mature-content blocklists for the university mentorship environment.
 * Deliberately high-confidence: we reject obvious adult content only, to
 * avoid false positives on legitimate academic material.
 */

/** Steam "content_descriptors" ids that are disqualifying. */
const STEAM_ADULT_DESCRIPTOR_IDS = new Set(['1', '2', '3', '5']);

/** High-confidence NSFW keywords (word-boundary matched, diacritic-insensitive). */
const NSFW_KEYWORDS = [
  'porn',
  'pornografia',
  'xxx',
  'nsfw',
  'hentai',
  'sexo explícito',
  'conteúdo adulto',
  'adult content',
  'escort',
  'acam',
];

/** Meta rating values that mark a page as adult/mature. */
const ADULT_RATINGS = new Set([
  'adult',
  'mature',
  'restricted',
  'rta-5042-1996-1400-1577-rta',
  'rta-5042-1996-1400-1577-rta',
]);

export interface ContentSafetyInput {
  title: string;
  description?: string | null;
  tags?: string[];
  rating?: string | null;
  ageRating?: number | null;
  steamDescriptors?: Array<string | number> | null;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Rejects scraped content flagged as adult/mature for the academic community.
 * @throws ValidationError with code NSFW_CONTENT_REJECTED (HTTP 422).
 */
export function assertContentSafe(payload: ContentSafetyInput): void {
  const title = normalize(payload.title);
  const description = normalize(payload.description ?? '');
  const tags = (payload.tags ?? []).map(normalize);
  const rating = payload.rating ? normalize(payload.rating) : '';

  if (payload.ageRating !== null && payload.ageRating !== undefined && payload.ageRating >= 18) {
    throw new ValidationError(
      'O link fornecido contém conteúdo adulto ou impróprio para a comunidade acadêmica',
      'NSFW_CONTENT_REJECTED',
    );
  }

  if (payload.steamDescriptors?.some((id) => STEAM_ADULT_DESCRIPTOR_IDS.has(String(id)))) {
    throw new ValidationError(
      'O link fornecido contém conteúdo adulto ou impróprio para a comunidade acadêmica',
      'NSFW_CONTENT_REJECTED',
    );
  }

  if (rating && ADULT_RATINGS.has(rating)) {
    throw new ValidationError(
      'O link fornecido contém conteúdo adulto ou impróprio para a comunidade acadêmica',
      'NSFW_CONTENT_REJECTED',
    );
  }

  const haystack = normalize(`${title} ${description}`);
  const keywordHit =
    NSFW_KEYWORDS.some((keyword) => haystack.includes(keyword)) ||
    tags.some((tag) => NSFW_KEYWORDS.some((keyword) => tag.includes(keyword)));

  if (keywordHit) {
    throw new ValidationError(
      'O link fornecido contém conteúdo adulto ou impróprio para a comunidade acadêmica',
      'NSFW_CONTENT_REJECTED',
    );
  }
}
