import { describe, expect, it } from 'vitest';
import {
  createRichCardBodySchema,
  scrapeCardQuerySchema,
  socialLinksSchema,
} from '@mathitis/schemas';

describe('external URL validation', () => {
  it('rejects executable URL schemes in rendered links and scrape targets', () => {
    expect(
      createRichCardBodySchema.safeParse({
        cardType: 'custom',
        title: 'Unsafe link',
        externalUrl: 'javascript:alert(1)',
      }).success,
    ).toBe(false);
    expect(scrapeCardQuerySchema.safeParse({ url: 'javascript:alert(1)' }).success).toBe(false);
    expect(
      socialLinksSchema.safeParse({ website: 'data:text/html,<script>alert(1)</script>' }).success,
    ).toBe(false);
  });

  it('accepts http and https URLs', () => {
    expect(socialLinksSchema.safeParse({ website: 'https://example.com' }).success).toBe(true);
    expect(scrapeCardQuerySchema.safeParse({ url: 'http://example.com/page' }).success).toBe(true);
  });
});
