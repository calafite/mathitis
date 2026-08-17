import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { detectImageFormat, processImage } from '../../src/services/image-service.js';
import { ValidationError } from '../../src/errors.js';

describe('detectImageFormat', () => {
  it('detects JPEG magic bytes', () => {
    expect(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpeg');
  });

  it('detects PNG magic bytes', () => {
    expect(
      detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    ).toBe('png');
  });

  it('detects WebP magic bytes', () => {
    const riff = Buffer.from('RIFF');
    const webp = Buffer.from('WEBP');
    expect(detectImageFormat(Buffer.concat([riff, Buffer.alloc(4), webp]))).toBe('webp');
  });

  it('rejects unknown signatures and empty buffers', () => {
    expect(detectImageFormat(Buffer.from([0x4d, 0x5a]))).toBeNull();
    expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
  });
});

describe('processImage', () => {
  async function makePng(width = 24, height = 24) {
    return sharp({
      create: { width, height, channels: 3, background: { r: 200, g: 80, b: 120 } },
    })
      .png()
      .toBuffer();
  }

  it('rejects non-image payloads', async () => {
    await expect(processImage(Buffer.from('<script>alert(1)</script>'), 'avatar')).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('rejects files over the per-kind size limit', async () => {
    const big = Buffer.alloc(3 * 1024 * 1024, 0xff);
    await expect(processImage(big, 'avatar')).rejects.toBeInstanceOf(ValidationError);
  });

  it('re-encodes a PNG avatar into sanitised WebP variants', async () => {
    const source = await makePng();
    const result = await processImage(source, 'avatar');

    expect(result.format).toBe('webp');
    expect(result.variants.full.buffer.readUInt32BE(0)).toBe(0x52494646); // RIFF (webp)
    expect(result.variants.thumbnail.width).toBeLessThanOrEqual(256);
    expect(result.variants.full.width).toBeLessThanOrEqual(512);
  });

  it('produces a full and a thumbnail variant for banners', async () => {
    const source = await makePng(400, 100);
    const result = await processImage(source, 'banner');

    expect(result.variants.full.width).toBeLessThanOrEqual(1600);
    expect(result.variants.thumbnail.buffer.length).toBeGreaterThan(0);
  });
});