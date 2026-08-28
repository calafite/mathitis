import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import sharp from 'sharp';
import Redis from 'ioredis';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app.js';
import { startTestEnvironment, stopTestEnvironment, type TestContext } from './test-environment.js';

function multipartBody(field: string, filename: string, contentType: string, data: Buffer) {
  const boundary = `----mathitis-${randomUUID().slice(0, 8)}`;
  const header = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`,
    'utf8',
  );
  const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
  return {
    body: Buffer.concat([header, data, footer]),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}

describe('Profiles API', () => {
  let ctx: TestContext;

  const senior = {
    handle: 'senior_mentor',
    email: 'senior_mentor@cs.uni.edu',
    password: 'SeniorPass123!',
    role: 'senior' as const,
    semester: 8,
  };

  const freshman = {
    handle: 'freshman_mentee',
    email: 'freshman_mentee@cs.uni.edu',
    password: 'FreshPass123!',
    role: 'freshman' as const,
    semester: 2,
  };

  let seniorCookie = '';
  let freshmanCookie = '';

  type TestUser = {
    handle: string;
    email: string;
    password: string;
    role: 'senior' | 'freshman';
    semester: number;
  };

  async function createUser(user: TestUser) {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.default.hash(user.password, {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    return ctx.prisma.user.create({
      data: {
        handle: user.handle,
        email: user.email,
        passwordHash,
        role: user.role,
        semester: user.semester,
        status: 'active',
        profile: {
          create: {
            socialName: user.handle,
            isDiscoverable: user.role === 'senior',
          },
        },
      },
    });
  }

  async function login(handle: string, password: string): Promise<string> {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { identifier: handle, password },
    });
    expect(res.statusCode, `Login failed: ${res.body}`).toBe(200);
    return String(res.headers['set-cookie']).split(';')[0] ?? '';
  }

  beforeAll(async () => {
    ctx = await startTestEnvironment();
    await createUser(senior);
    await createUser(freshman);
    seniorCookie = await login(senior.handle, senior.password);
    freshmanCookie = await login(freshman.handle, freshman.password);
  });

  afterAll(async () => {
    await stopTestEnvironment(ctx);
  });

  it('returns a public senior profile with default attributes', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/profiles/${senior.handle}` });

    expect(res.statusCode).toBe(200);
    const profile = res.json().profile;
    expect(profile.handle).toBe(senior.handle);
    expect(profile.role).toBe('senior');
    expect(profile.richCards).toEqual([]);
    expect(profile.effortScore).toBe(0);
  });

  it('increments profile views only once per visitor', async () => {
    const argon2 = await import('argon2');
    const passwordHash = await argon2.default.hash('ViewerPass123!', {
      type: 2,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    await ctx.prisma.user.create({
      data: {
        handle: 'viewed_profile',
        email: 'viewed_profile@cs.uni.edu',
        passwordHash,
        role: 'senior',
        semester: 7,
        status: 'active',
        profile: { create: { socialName: 'Viewed', isDiscoverable: true } },
      },
    });

    const first = await ctx.app.inject({ method: 'GET', url: '/api/profiles/viewed_profile' });
    // Views are buffered in Redis (phase 14): the DB count is eventually consistent.
    expect(first.json().profile.profileViews).toBe(0);
    const viewCookie = String(first.headers['set-cookie']).split(';')[0];

    const viewedUser = await ctx.prisma.user.findUnique({ where: { handle: 'viewed_profile' } });
    expect(await ctx.redis.hget('profile:views', viewedUser!.id)).toBe('1');

    // Repeat visit from the same visitor is deduplicated (no new increment).
    await ctx.app.inject({
      method: 'GET',
      url: '/api/profiles/viewed_profile',
      headers: { cookie: viewCookie },
    });
    expect(await ctx.redis.hget('profile:views', viewedUser!.id)).toBe('1');

    // Flushing moves the buffered increments into PostgreSQL atomically.
    // Other tests may have buffered views for their own profiles — the viewed
    // user's entry must be consumed and persisted regardless.
    const { flushProfileViews } = await import('../../src/services/views-worker.js');
    const flushed = await flushProfileViews({ redis: ctx.redis, prisma: ctx.prisma });
    expect(flushed).toBeGreaterThanOrEqual(1);
    expect(await ctx.redis.hget('profile:views', viewedUser!.id)).toBeNull();

    const afterFlush = await ctx.app.inject({ method: 'GET', url: '/api/profiles/viewed_profile' });
    expect(afterFlush.json().profile.profileViews).toBe(1);
  });

  it('hides non-discoverable freshman profiles from anonymous visitors', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: `/api/profiles/${freshman.handle}` });
    expect(res.statusCode).toBe(404);
  });

  it('lets the freshman owner view their own hidden profile', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/profiles/${freshman.handle}`,
      headers: { cookie: freshmanCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.handle).toBe(freshman.handle);
  });

  it('lets a user fetch their own profile via /me', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/api/profiles/me',
      headers: { cookie: seniorCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().profile.userId).toBeTruthy();
  });

  it('requires authentication for /me', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/api/profiles/me' });
    expect(res.statusCode).toBe(403);
  });

  it('updates profile attributes and recomputes the effort score', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/profiles/me',
      headers: { cookie: seniorCookie },
      payload: {
        socialName: 'Dr. Mentor',
        pronouns: 'they/them',
        tagline: 'Linear algebra fan',
        biographyMarkdown:
          '# Research\n\n[Learning Rust]{color=#ff4444}\n\n> [!TIP]\n> Keep a proof journal.',
        themePalette: {
          primaryColor: '#0ea5e9',
          accentColor: '#22c55e',
          badgeColor: '#f59e0b',
          cardStyle: 'solid',
        },
        contactEmail: 'mentor@cs.uni.edu',
        maxMentees: 2,
      },
    });

    expect(res.statusCode, res.body).toBe(200);
    const profile = res.json().profile;
    expect(profile.socialName).toBe('Dr. Mentor');
    expect(profile.themePalette.cardStyle).toBe('solid');
    expect(profile.effortScore).toBeGreaterThan(0);
  });

  it('rejects malformed theme palettes', async () => {
    const res = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/profiles/me',
      headers: { cookie: seniorCookie },
      payload: { themePalette: { primaryColor: 'not-a-color' } },
    });
    expect(res.statusCode).toBe(422);
  });

  it('persists bio, social links and tagline across separate patches', async () => {
    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: '/api/profiles/me',
      headers: { cookie: seniorCookie },
      payload: {
        biographyMarkdown: '## Sobre mim\n\nGosto de teoria dos números.',
        tagline: 'Provando teoremas desde 2019',
        socialLinks: {
          github: 'https://github.com/satanyahu',
          discord: 'satanyahu#0001',
          linkedin: 'https://linkedin.com/in/satanyahu',
          website: 'https://satanyahu.dev',
        },
      },
    });
    expect(patch.statusCode, patch.body).toBe(200);

    // Refetch from the database (not the response) to verify persistence.
    const fetched = await ctx.app.inject({
      method: 'GET',
      url: '/api/profiles/me',
      headers: { cookie: seniorCookie },
    });
    expect(fetched.statusCode).toBe(200);
    const profile = fetched.json().profile;
    expect(profile.biographyMarkdown).toContain('teoria dos números');
    expect(profile.tagline).toBe('Provando teoremas desde 2019');
    expect(profile.socialLinks.github).toBe('https://github.com/satanyahu');
    expect(profile.socialLinks.discord).toBe('satanyahu#0001');
    expect(profile.socialLinks.linkedin).toBe('https://linkedin.com/in/satanyahu');
    expect(profile.socialLinks.website).toBe('https://satanyahu.dev');
  });

  it('uploads an avatar through the server-side pipeline', async () => {
    const png = await sharp({
      create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();

    const { body, headers } = multipartBody('file', 'avatar.png', 'image/png', png);
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/profiles/me/avatar',
      headers: { cookie: seniorCookie, ...headers },
      payload: body,
    });

    expect(res.statusCode, res.body).toBe(200);
    const result = res.json();
    expect(result.url).toContain('/assets/uploads/');
    expect(result.thumbnailUrl).toContain('-thumb');
    expect(result.width).toBeGreaterThan(0);
  });

  it('rejects non-image upload payloads', async () => {
    const { body, headers } = multipartBody(
      'file',
      'evil.txt',
      'text/plain',
      Buffer.from('<script>alert(1)</script>'),
    );
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/api/profiles/me/banner',
      headers: { cookie: seniorCookie, ...headers },
      payload: body,
    });

    expect(res.statusCode).toBe(422);
  });

  describe('rich cards', () => {
    let cardId = '';

    it('creates a song card with a whitelisted Spotify embed', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/profiles/me/cards',
        headers: { cookie: seniorCookie },
        payload: {
          cardType: 'song',
          title: 'Nude',
          subtitle: 'Radiohead',
          embedUrl: 'https://open.spotify.com/embed/track/35YyxFpE0ZTOoqFx5bADW8',
        },
      });

      expect(res.statusCode, res.body).toBe(200);
      const card = res.json().card;
      cardId = card.id;
      expect(card.cardType).toBe('song');
      expect(card.metadata.spotifyUri).toBe('spotify:track:35YyxFpE0ZTOoqFx5bADW8');
    });

    it('rejects embeds from non-whitelisted hosts', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/profiles/me/cards',
        headers: { cookie: seniorCookie },
        payload: {
          cardType: 'custom',
          title: 'Suspicious',
          embedUrl: 'https://evil.example.com/player',
        },
      });
      expect(res.statusCode).toBe(422);
    });

    it('creates a film card with numeric string metadata (Barry Lyndon case)', async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/profiles/me/cards',
        headers: { cookie: seniorCookie },
        payload: {
          cardType: 'film',
          title: 'Barry Lyndon',
          subtitle: 'Stanley Kubrick',
          imageUrl: 'https://a.ltrbxd.com/resized/film-poster/barry-lyndon.jpg',
          externalUrl: 'https://letterboxd.com/film/barry-lyndon/',
          metadata: { rating: '8.1', year: '1975', director: 'Stanley Kubrick' },
        },
      });

      expect(res.statusCode, res.body).toBe(200);
      const card = res.json().card;
      expect(card.cardType).toBe('film');
      expect(card.metadata.rating).toBe(8.1);
      expect(card.metadata.year).toBe(1975);

      // Clean up so count-dependent tests below see a pristine card list.
      const cleanup = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/profiles/me/cards/${card.id}`,
        headers: { cookie: seniorCookie },
      });
      expect(cleanup.statusCode).toBe(204);
    });

    it('lists the profile cards in display order', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/profiles/me/cards',
        headers: { cookie: seniorCookie },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().cards).toHaveLength(1);
    });

    it('updates a card', async () => {
      const res = await ctx.app.inject({
        method: 'PATCH',
        url: `/api/profiles/me/cards/${cardId}`,
        headers: { cookie: seniorCookie },
        payload: { title: 'Nude (From The Basement)' },
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().card.title).toBe('Nude (From The Basement)');
    });

    it('reorders cards and persists the new display order', async () => {
      const second = await ctx.app.inject({
        method: 'POST',
        url: '/api/profiles/me/cards',
        headers: { cookie: seniorCookie },
        payload: {
          cardType: 'project',
          title: 'Pagerank notes',
          metadata: { techStack: ['python'] },
        },
      });
      const secondId = second.json().card.id;

      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/profiles/me/cards/reorder',
        headers: { cookie: seniorCookie },
        payload: { order: [secondId, cardId] },
      });
      expect(res.statusCode, res.body).toBe(200);
      expect(res.json().cards.map((c: { id: string }) => c.id)).toEqual([secondId, cardId]);
    });

    it('rejects reorders containing foreign card ids', async () => {
      const foreign = randomUUID();
      const res = await ctx.app.inject({
        method: 'PUT',
        url: '/api/profiles/me/cards/reorder',
        headers: { cookie: seniorCookie },
        payload: { order: [foreign, cardId] },
      });
      expect(res.statusCode).toBe(422);
    });

    it('deletes a card', async () => {
      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/profiles/me/cards/${cardId}`,
        headers: { cookie: seniorCookie },
      });
      expect(res.statusCode).toBe(204);
    });

    it('cannot delete a card owned by another user', async () => {
      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/profiles/me/cards/${cardId}`,
        headers: { cookie: freshmanCookie },
      });
      expect(res.statusCode).toBe(404);
    });
  });

  describe('card scraping', () => {
    function htmlResponse(html: string): Response {
      return new Response(html, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    /** Builds a second Fastify app sharing the test DB/Redis, with a mocked scraper network. */
    async function buildScraperApp(scrapeFetch: typeof fetch): Promise<FastifyInstance> {
      const redis = new Redis(ctx.env.REDIS_URL);
      return buildApp({ env: ctx.env, prisma: ctx.prisma, redis, scrapeFetch });
    }

    async function loginOn(
      app: FastifyInstance,
      handle: string,
      password: string,
    ): Promise<string> {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { identifier: handle, password },
      });
      expect(res.statusCode, res.body).toBe(200);
      return String(res.headers['set-cookie']).split(';')[0] ?? '';
    }

    it('rejects unauthenticated scrape requests', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/profiles/me/cards/scrape?url=${encodeURIComponent('https://github.com/zodjs/zod')}`,
      });
      expect([401, 403]).toContain(res.statusCode);
    });

    it('rejects malformed URLs with a validation error', async () => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/profiles/me/cards/scrape?url=notaurl',
        headers: { cookie: seniorCookie },
      });
      expect([400, 422]).toContain(res.statusCode);
      expect(res.json().error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects adult Steam games with NSFW_CONTENT_REJECTED', async () => {
      const scrapeFetch: typeof fetch = async () =>
        new Response(
          JSON.stringify({
            '1245620': {
              success: true,
              data: {
                name: 'Adult Only Game',
                short_description: 'Explicit content not suitable for academia',
                required_age: 18,
                content_descriptors: [],
                categories: [],
              },
            },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );

      const app = await buildScraperApp(scrapeFetch);
      try {
        const cookie = await loginOn(app, senior.handle, senior.password);
        const res = await app.inject({
          method: 'GET',
          url: `/api/profiles/me/cards/scrape?url=${encodeURIComponent(
            'https://store.steampowered.com/app/1245620/SomeGame/',
          )}`,
          headers: { cookie },
        });

        expect(res.statusCode).toBe(422);
        expect(res.json().error.code).toBe('NSFW_CONTENT_REJECTED');
      } finally {
        await app.close();
      }
    });

    it('rate limits scraping to 15 requests per minute', async () => {
      const scrapeFetch: typeof fetch = async () =>
        htmlResponse(
          '<html><head><meta property="og:title" content="Study notes" /></head></html>',
        );

      const app = await buildScraperApp(scrapeFetch);
      try {
        const cookie = await loginOn(app, freshman.handle, freshman.password);

        const statuses: number[] = [];
        for (let i = 0; i < 20 && !statuses.includes(429); i++) {
          const res = await app.inject({
            method: 'GET',
            url: `/api/profiles/me/cards/scrape?url=${encodeURIComponent(
              `http://93.184.216.34/page-${i}`,
            )}`,
            headers: { cookie },
          });
          statuses.push(res.statusCode);
        }

        expect(statuses).toContain(429);
        expect(statuses.length).toBeLessThanOrEqual(16);
      } finally {
        await app.close();
      }
    });
  });
});
