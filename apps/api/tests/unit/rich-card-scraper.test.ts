import { describe, expect, it, vi } from 'vitest';
import {
  createRichCardScraper,
  type FetchLike,
} from '../../src/services/rich-card-scraper.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

describe('createRichCardScraper', () => {
  describe('Spotify provider', () => {
    it('builds a song card from the oembed payload', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        expect(url).toContain('https://open.spotify.com/oembed?url=');
        return jsonResponse({
          title: 'Everlong',
          thumbnail_url: 'https://i.scdn.co/image/ab67616d0000b273',
        });
      });
      const scraper = createRichCardScraper({ fetchImpl });

      const card = await scraper.scrape('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');

      expect(card.cardType).toBe('song');
      expect(card.title).toBe('Everlong');
      expect(card.imageUrl).toBe('https://i.scdn.co/image/ab67616d0000b273');
      expect(card).not.toHaveProperty('embedUrl');
      expect(card.metadata.spotifyUri).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC');
      expect(card.accentColor).toBe('#1db954');
    });
  });

  describe('Steam provider', () => {
    const appId = '570';
    const details = {
      success: true,
      data: {
        name: 'Dota 2',
        short_description: 'Every day, millions of players worldwide enter battle.',
        header_image: 'https://cdn.cloudflare.steamstatic.com/steam/apps/570/header.jpg',
        required_age: 0,
        content_descriptors: [],
        categories: [{ description: 'Single-player' }, { description: 'Multi-player' }],
      },
    };

    it('builds a game card from appdetails', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        expect(url).toContain(`appids=${appId}`);
        return jsonResponse({ [appId]: details });
      });
      const scraper = createRichCardScraper({ fetchImpl });

      const card = await scraper.scrape(`https://store.steampowered.com/app/${appId}/Dota_2/`);

      expect(fetchImpl).toHaveBeenCalledOnce();
      expect(card.cardType).toBe('game');
      expect(card.title).toBe('Dota 2');
      expect(card.imageUrl).toContain(`/apps/${appId}/header.jpg`);
      expect(card.externalUrl).toBe(`https://store.steampowered.com/app/${appId}`);
      expect(card.metadata.steamAppId).toBe(appId);
      expect(card.accentColor).toBe('#1b2838');
    });

    it('rejects adult-only games (required_age >= 18)', async () => {
      const adult = {
        ...details,
        data: { ...details.data, required_age: 18 },
      };
      const scraper = createRichCardScraper({
        fetchImpl: async () => jsonResponse({ [appId]: adult }),
      });

      await expect(
        scraper.scrape(`https://store.steampowered.com/app/${appId}/SomeGame/`),
      ).rejects.toMatchObject({ code: 'NSFW_CONTENT_REJECTED', status: 422 });
    });

    it('rejects games with adult content descriptors', async () => {
      const adult = {
        ...details,
        data: {
          ...details.data,
          required_age: 0,
          content_descriptors: [{ id: '2' }, { id: 5 }],
        },
      };
      const scraper = createRichCardScraper({
        fetchImpl: async () => jsonResponse({ [appId]: adult }),
      });

      await expect(
        scraper.scrape(`https://store.steampowered.com/app/${appId}/SomeGame/`),
      ).rejects.toMatchObject({ code: 'NSFW_CONTENT_REJECTED' });
    });

    it('does not crash when Steam returns malformed descriptor/category shapes', async () => {
      const malformed = {
        success: true,
        data: {
          name: 'Hearts of Iron IV',
          short_description: 'Victory is at your fingertips.',
          header_image: 'https://cdn.cloudflare.steamstatic.com/header.jpg',
          required_age: null,
          content_descriptors: { ids: ['2'] },
          categories: 'Single-player',
        },
      };
      const scraper = createRichCardScraper({
        fetchImpl: async () => jsonResponse({ [appId]: malformed }),
      });

      const card = await scraper.scrape(`https://store.steampowered.com/app/${appId}/HOI4/`);
      expect(card.cardType).toBe('game');
      expect(card.title).toBe('Hearts of Iron IV');
    });
  });

  describe('GitHub provider', () => {
    it('parses og tags into a project card', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        expect(url).toBe('https://github.com/acme/rocket');
        return htmlResponse(`<html><head>
          <meta property="og:title" content="acme/rocket · GitHub" />
          <meta property="og:description" content="A fast build tool for monorepos" />
          <meta property="og:image" content="https://repository-images.githubusercontent.com/abc" />
        </head><body></body></html>`);
      });
      const scraper = createRichCardScraper({ fetchImpl });

      const card = await scraper.scrape('https://github.com/acme/rocket');

      expect(card.cardType).toBe('project');
      expect(card.title).toBe('acme/rocket');
      expect(card.subtitle).toBe('acme/rocket');
      expect(card.description).toBe('A fast build tool for monorepos');
      expect(card.metadata.repository).toBe('https://github.com/acme/rocket');
    });
  });

  describe('Letterboxd provider', () => {
    it('extracts film title, year and director', async () => {
      const html = `<html><head>
        <meta property="og:title" content="Parasite (2019)" />
        <meta property="og:description" content="All unemployed, Ki-taek's family takes peculiar interest in the wealthy Parks." />
        <meta property="og:image" content="https://a.ltrbxd.com/resized/film-poster/parasite.jpg" />
        </head><body>
        <div id="film-page-wrapper"><h2>Directed by</h2></div>
        <h3 class="credits">Directed by</h3><p class="credits"><a href="/director/bong-joon-ho/">Bong Joon-ho</a></p>
        </body></html>`;
      const scraper = createRichCardScraper({ fetchImpl: async () => htmlResponse(html) });

      const card = await scraper.scrape('https://letterboxd.com/film/parasite/');

      expect(card.cardType).toBe('film');
      expect(card.title).toBe('Parasite');
      expect(card.subtitle).toBe('Bong Joon-ho');
      expect(card.metadata.year).toBe(2019);
      expect(card.imageUrl).toContain('parasite.jpg');
      expect(card.accentColor).toBe('#00e054');
    });
  });

  describe('OpenLibrary provider', () => {
    it('fetches the work and author to build a book card', async () => {
      const fetchImpl = vi.fn(async (url: string) => {
        if (url === 'https://openlibrary.org/works/OL1934249W.json') {
          return jsonResponse({
            title: 'O Cortiço',
            description: { value: 'Romance naturalista de Aluísio Azevedo.' },
            covers: [8262321],
            authors: [{ author: { key: '/authors/OL20568A' } }],
          });
        }
        if (url === 'https://openlibrary.org/authors/OL20568A.json') {
          return jsonResponse({ name: 'Aluísio Azevedo' });
        }
        throw new Error(`unexpected fetch: ${url}`);
      });
      const scraper = createRichCardScraper({ fetchImpl });

      const card = await scraper.scrape('https://openlibrary.org/works/OL1934249W/O_Cortico');

      expect(card.cardType).toBe('book');
      expect(card.title).toBe('O Cortiço');
      expect(card.subtitle).toBe('Aluísio Azevedo');
      expect(card.description).toContain('naturalista');
      expect(card.imageUrl).toBe('https://covers.openlibrary.org/b/id/8262321-L.jpg');
    });
  });

  describe('generic fallback', () => {
    it('returns a custom card from OpenGraph tags', async () => {
      const html = `<html><head>
        <meta property="og:title" content="Universidade de São Paulo" />
        <meta property="og:description" content="Página oficial da USP" />
        <meta property="og:image" content="https://usp.br/img/logo.png" />
        </head></html>`;
      const scraper = createRichCardScraper({ fetchImpl: async () => htmlResponse(html) });

      const card = await scraper.scrape('https://example.com/university-page');

      expect(card.cardType).toBe('custom');
      expect(card.title).toBe('Universidade de São Paulo');
      expect(card.subtitle).toBe('example.com');
      expect(card.description).toBe('Página oficial da USP');
    });
  });

  describe('SSRF guard', () => {
    const blockedUrls = [
      'http://127.0.0.1:8080/admin',
      'http://169.254.169.254/latest/meta-data/',
      'http://localhost/x',
      'http://postgres:5432',
      'http://192.168.1.10/router',
      'http://[::1]/health',
      'http://10.0.0.5/internal',
      'http://172.16.0.9/',
    ];

    for (const url of blockedUrls) {
      it(`rejects ${url}`, async () => {
        const fetchImpl = vi.fn<FetchLike>();
        const scraper = createRichCardScraper({ fetchImpl });

        await expect(scraper.scrape(url)).rejects.toMatchObject({ status: 422 });
        expect(fetchImpl).not.toHaveBeenCalled();
      });
    }

    it('rejects non-http protocols', async () => {
      const scraper = createRichCardScraper({ fetchImpl: async () => new Response('', { status: 200 }) });
      await expect(scraper.scrape('ftp://example.com/file')).rejects.toMatchObject({ status: 422 });
    });

    it('rejects unresolvable hosts', async () => {
      const scraper = createRichCardScraper({ fetchImpl: async () => new Response('', { status: 200 }) });
      await expect(scraper.scrape('http://this-host-does-not-exist-mathitis.invalid/')).rejects.toMatchObject(
        { status: 422 },
      );
    });

    it('rejects redirects to a private address before following them', async () => {
      const fetchImpl = vi.fn(
        async () =>
          new Response('', {
            status: 302,
            headers: { location: 'http://127.0.0.1:8080/admin' },
          }),
      );
      const scraper = createRichCardScraper({ fetchImpl });

      await expect(scraper.scrape('http://203.0.113.10/redirect')).rejects.toMatchObject({
        status: 422,
      });
      expect(fetchImpl).toHaveBeenCalledOnce();
    });
  });

  describe('timeout handling', () => {
    it('aborts requests that exceed the fetch timeout', async () => {
      vi.useFakeTimers();
      try {
        const slowFetch: FetchLike = (_url, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          });
        const scraper = createRichCardScraper({ fetchImpl: slowFetch });

        const pending = scraper.scrape('https://203.0.113.10/slow-page');
        pending.catch(() => {});
        await vi.advanceTimersByTimeAsync(10_001);
        await expect(pending).rejects.toMatchObject({ status: 422 });
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('unexpected provider failures', () => {
    it('converts an extractor crash into a validation error instead of a 500', async () => {
      const scraper = createRichCardScraper({
        fetchImpl: async () => {
          throw new TypeError('Unexpected token < in JSON');
        },
      });

      await expect(
        scraper.scrape('https://store.steampowered.com/app/570/Dota_2/'),
      ).rejects.toMatchObject({ status: 422, code: 'VALIDATION_ERROR' });
    });
  });
});
