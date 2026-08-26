import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { ScrapedCardResponse } from '@mathitis/schemas';
import { ValidationError } from '../errors.js';
import { assertContentSafe } from './nsfw-filter.js';

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = 'MathitisCardBot/1.0 (+https://pasteldemiolos.xyz)';

/** Coerces a possibly-malformed JSON field into a string array. */
function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        const record = item as Record<string, unknown>;
        if ('description' in record && record.description != null) return String(record.description);
        if ('id' in record && record.id != null) return String(record.id);
      }
      return '';
    })
    .filter(Boolean);
}

/** Coerces a possibly-malformed JSON field into a numeric age rating. */
function asAgeRating(value: unknown): number | null {
  const n = Number(value ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

/** Hostnames that must never be scraped (container-internal services). */
const FORBIDDEN_HOSTNAMES = new Set([
  'localhost',
  'postgres',
  'postgresql',
  'redis',
  'minio',
  'db',
  'database',
  'api',
  'web',
  'nginx',
  'host.docker.internal',
  'metadata.google.internal',
]);

/** IP ranges that must never be scraped (SSRF boundary). */
function isForbiddenIp(ip: string): boolean {
  if (isIP(ip) === 4) {
    const parts = ip.split('.');
    if (parts.length !== 4) return true;
    const octets = parts.map((p) => Number(p));
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const a = octets[0]!;
    const b = octets[1]!;
    if (a === 127 || a === 10 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local + cloud metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  if (isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true;
    if (lower.startsWith('fe80') || lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (lower.startsWith('::ffff:')) return isForbiddenIp(lower.slice(7));
  }
  return false;
}

/**
 * SSRF guard: resolves the hostname and rejects any URL that points at a
 * private, loopback, link-local or container-internal address.
 */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new ValidationError('Informe uma URL válida');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ValidationError('Apenas URLs http(s) são suportadas');
  }

  const hostname = url.hostname.toLowerCase();
  if (FORBIDDEN_HOSTNAMES.has(hostname)) {
    throw new ValidationError('Este host não pode ser acessado');
  }

  // Literal IP in the URL.
  const literalIp = hostname.replace(/^\[|\]$/g, '');
  if (isIP(literalIp)) {
    if (isForbiddenIp(literalIp)) {
      throw new ValidationError('Este host não pode ser acessado');
    }
    return url;
  }

  // Resolve DNS and validate every returned address (DNS-rebinding defense
  // at resolution time; the fetch itself uses the hostname).
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ValidationError('Não foi possível resolver o host informado');
  }
  if (addresses.length === 0 || addresses.some((a) => isForbiddenIp(a.address))) {
    throw new ValidationError('Este host não pode ser acessado');
  }
  return url;
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** Some providers (e.g. Letterboxd) reject non-browser user agents outright. */
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchWithTimeout(
  url: string,
  fetchImpl: FetchLike,
  extraHeaders?: Record<string, string>,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/json', ...extraHeaders },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new ValidationError('Não foi possível ler o conteúdo deste link');
    }
    return await res.text();
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    throw new ValidationError('Não foi possível ler o conteúdo deste link');
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, fetchImpl: FetchLike): Promise<T> {
  return JSON.parse(await fetchWithTimeout(url, fetchImpl)) as T;
}

/** Extracts a meta tag content value (property or name attribute). */
function extractMeta(html: string, key: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${key}["']`, 'i'),
    new RegExp(`<meta[^>]+name=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${key}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'");
}

function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/* ------------------------------------------------------------------ */
/* Provider extractors                                                 */
/* ------------------------------------------------------------------ */

async function scrapeSpotify(
  url: URL,
  fetchImpl: FetchLike,
): Promise<ScrapedCardResponse> {
  const match = url.pathname.match(/\/(track|album)\/([A-Za-z0-9]+)/);
  if (!match) {
    throw new ValidationError('Link do Spotify inválido: use um link de música ou álbum');
  }
  const type = match[1] as 'track' | 'album';
  const id = match[2] as string;
  const oembed = await fetchJson<{ title?: string; thumbnail_url?: string }>(
    `https://open.spotify.com/oembed?url=${encodeURIComponent(url.toString())}`,
    fetchImpl,
  );
  const title = oembed.title?.trim();
  if (!title) {
    throw new ValidationError('Não foi possível ler este link do Spotify');
  }
  assertContentSafe({ title });
  return {
    cardType: 'song',
    title: truncate(title, 150),
    subtitle: null,
    description: null,
    imageUrl: oembed.thumbnail_url ?? null,
    externalUrl: url.toString(),
    accentColor: '#1db954',
    metadata: {
      spotifyUri: `spotify:${type === 'track' ? 'track' : 'album'}:${id}`,
    },
  };
}

interface SteamAppDetails {
  success?: boolean;
  data?: {
    name?: string;
    short_description?: string;
    header_image?: string;
    required_age?: unknown;
    content_descriptors?: unknown;
    categories?: unknown;
  };
}

async function scrapeSteam(
  url: URL,
  fetchImpl: FetchLike,
): Promise<ScrapedCardResponse> {
  const match = url.pathname.match(/\/app\/(\d+)/);
  if (!match) {
    throw new ValidationError('Link da Steam inválido: use um link de /app/{id}');
  }
  const appId = match[1] as string;
  const payload = await fetchJson<Record<string, SteamAppDetails>>(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&l=english`,
    fetchImpl,
  );
  const entry = payload[appId];
  const game = entry?.data;
  if (!entry?.success || !game?.name) {
    throw new ValidationError('Não foi possível ler este jogo na Steam');
  }
  const categories = asStringArray(game.categories);
  assertContentSafe({
    title: game.name,
    description: game.short_description ?? null,
    tags: categories,
    ageRating: asAgeRating(game.required_age),
    steamDescriptors: asStringArray(game.content_descriptors),
  });
  return {
    cardType: 'game',
    title: truncate(game.name, 150),
    subtitle: null,
    description: game.short_description ? truncate(game.short_description, 5000) : null,
    imageUrl: game.header_image ?? null,
    externalUrl: `https://store.steampowered.com/app/${appId}`,
    embedUrl: null,
    accentColor: '#1b2838',
    metadata: { steamAppId: appId },
  };
}

async function scrapeGitHub(
  url: URL,
  fetchImpl: FetchLike,
): Promise<ScrapedCardResponse> {
  const match = url.pathname.match(/^\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\/?$/);
  if (!match) {
    throw new ValidationError('Link do GitHub inválido: use owner/repo');
  }
  const [, owner, repo] = match;
  const html = await fetchWithTimeout(`https://github.com/${owner}/${repo}`, fetchImpl);
  const title = extractMeta(html, 'og:title') ?? `${owner}/${repo}`;
  const description = extractMeta(html, 'og:description');
  const image = extractMeta(html, 'og:image');
  assertContentSafe({ title, description });
  return {
    cardType: 'project',
    title: truncate(title.replace(/\s*·\s*GitHub$/, ''), 150),
    subtitle: `${owner}/${repo}`,
    description: description ? truncate(description, 5000) : null,
    imageUrl: image,
    externalUrl: `https://github.com/${owner}/${repo}`,
    embedUrl: null,
    accentColor: '#238636',
    metadata: { repository: `https://github.com/${owner}/${repo}` },
  };
}

async function scrapeLetterboxd(
  url: URL,
  fetchImpl: FetchLike,
): Promise<ScrapedCardResponse> {
  // Letterboxd sits behind a bot filter: only a browser-like UA gets the page.
  const html = await fetchWithTimeout(url.toString(), fetchImpl, {
    'user-agent': BROWSER_USER_AGENT,
    'accept-language': 'en-US,en;q=0.9',
  });
  const ogTitle = extractMeta(html, 'og:title');
  if (!ogTitle) {
    throw new ValidationError('Não foi possível ler este filme no Letterboxd');
  }
  const yearMatch = ogTitle.match(/^(.*?)\s*\((\d{4})\)\s*$/);
  const title = yearMatch ? (yearMatch[1] as string) : (ogTitle as string);
  const year = yearMatch ? Number(yearMatch[2]) : undefined;
  const poster = extractMeta(html, 'og:image');
  // Director is exposed in twitter:data1 on film pages; fall back to the
  // "Directed by" credits block in the page body.
  const director =
    extractMeta(html, 'twitter:data1') ??
    (html.match(/Directed by<\/h3>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i)?.[1] ?? null);
  const description = extractMeta(html, 'og:description');
  assertContentSafe({ title, description });
  const metadata: Record<string, unknown> = {};
  if (year && year >= 1888 && year <= 2100) metadata.year = year;
  if (director) metadata.director = truncate(director.trim(), 120);
  return {
    cardType: 'film',
    title: truncate(title, 150),
    subtitle: director ? truncate(director.trim(), 150) : null,
    description: description ? truncate(description, 5000) : null,
    imageUrl: poster,
    externalUrl: url.toString(),
    embedUrl: null,
    accentColor: '#00e054',
    metadata,
  };
}

interface OpenLibraryWork {
  title?: string;
  description?: string | { value?: string };
  covers?: number[];
  authors?: Array<{ author?: { key?: string } }>;
}

async function scrapeBooks(
  url: URL,
  fetchImpl: FetchLike,
): Promise<ScrapedCardResponse> {
  const workMatch = url.pathname.match(/\/works\/(OL\w+)/);
  if (!workMatch) {
    throw new ValidationError('Link da OpenLibrary inválido: use /works/{id}');
  }
  const work = await fetchJson<OpenLibraryWork>(
    `https://openlibrary.org/works/${workMatch[1]}.json`,
    fetchImpl,
  );
  if (!work.title) {
    throw new ValidationError('Não foi possível ler este livro na OpenLibrary');
  }
  const description =
    typeof work.description === 'string'
      ? work.description
      : (work.description?.value ?? null);

  let subtitle: string | null = null;
  const authorKey = work.authors?.[0]?.author?.key;
  if (authorKey) {
    try {
      const author = await fetchJson<{ name?: string }>(
        `https://openlibrary.org${authorKey}.json`,
        fetchImpl,
      );
      subtitle = author.name ?? null;
    } catch {
      // Author lookup is best-effort.
    }
  }

  const cover = work.covers?.[0];
  assertContentSafe({ title: work.title, description });
  return {
    cardType: 'book',
    title: truncate(work.title, 150),
    subtitle: subtitle ? truncate(subtitle, 150) : null,
    description: description ? truncate(description, 5000) : null,
    imageUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg` : null,
    externalUrl: url.toString(),
    embedUrl: null,
    accentColor: '#f4c430',
    metadata: {},
  };
}

async function scrapeGeneric(
  url: URL,
  fetchImpl: FetchLike,
): Promise<ScrapedCardResponse> {
  const html = await fetchWithTimeout(url.toString(), fetchImpl);
  const title = extractMeta(html, 'og:title') ?? extractMeta(html, 'title');
  if (!title) {
    throw new ValidationError('Não foi possível extrair metadados deste link');
  }
  const description = extractMeta(html, 'og:description');
  const image = extractMeta(html, 'og:image');
  assertContentSafe({ title, description });
  return {
    cardType: 'custom',
    title: truncate(title, 150),
    subtitle: url.hostname,
    description: description ? truncate(description, 5000) : null,
    imageUrl: image,
    externalUrl: url.toString(),
    embedUrl: null,
    accentColor: '#6366f1',
    metadata: {},
  };
}

export interface RichCardScraper {
  scrape(url: string): Promise<ScrapedCardResponse>;
}

export function createRichCardScraper(options?: {
  fetchImpl?: FetchLike;
}): RichCardScraper {
  const fetchImpl: FetchLike = options?.fetchImpl ?? fetch;

  async function scrape(rawUrl: string): Promise<ScrapedCardResponse> {
    const url = await assertPublicUrl(rawUrl);
    const hostname = url.hostname.toLowerCase();

    try {
      if (hostname === 'open.spotify.com' || hostname === 'spotify.com') {
        return await scrapeSpotify(url, fetchImpl);
      }
      if (hostname === 'store.steampowered.com') {
        return await scrapeSteam(url, fetchImpl);
      }
      if (hostname === 'github.com' || hostname === 'www.github.com') {
        return await scrapeGitHub(url, fetchImpl);
      }
      if (hostname === 'letterboxd.com' || hostname === 'www.letterboxd.com') {
        return await scrapeLetterboxd(url, fetchImpl);
      }
      if (hostname === 'openlibrary.org' || hostname === 'www.openlibrary.org') {
        return await scrapeBooks(url, fetchImpl);
      }
      // YouTube/Vimeo/SoundCloud are intentionally NOT auto-unfurled.
      return await scrapeGeneric(url, fetchImpl);
    } catch (error) {
      // Provider payloads are untrusted: never let an unexpected shape or
      // network hiccup surface as an unhandled 500.
      if (error instanceof ValidationError) throw error;
      throw new ValidationError('Não foi possível ler o conteúdo deste link');
    }
  }

  return { scrape };
}
