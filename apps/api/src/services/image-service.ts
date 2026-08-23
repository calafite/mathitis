import sharp from 'sharp';
import { ValidationError } from '../errors.js';

export type ImageKind = 'avatar' | 'banner';

export interface ProcessedVariant {
  buffer: Buffer;
  width: number;
  height: number;
}

export interface ProcessedImage {
  kind: ImageKind;
  format: 'webp';
  variants: {
    full: ProcessedVariant;
    thumbnail: ProcessedVariant;
  };
}

const MAX_BYTES: Record<ImageKind, number> = {
  avatar: 2 * 1024 * 1024,
  banner: 5 * 1024 * 1024,
};

const SIZE_LIMITS: Record<
  ImageKind,
  { full: { width: number; height: number }; thumb: { width: number; height: number } }
> = {
  avatar: { full: { width: 512, height: 512 }, thumb: { width: 256, height: 256 } },
  banner: { full: { width: 1600, height: 400 }, thumb: { width: 800, height: 200 } },
};

export type ImageFormat = 'jpeg' | 'png' | 'webp';

export function detectImageFormat(buffer: Buffer): ImageFormat | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('latin1', 0, 4) === 'RIFF' &&
    buffer.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Validates magic bytes and processes an image with Sharp.
 *
 * The pipeline strips all EXIF/GPS metadata (no `.withMetadata()` call), auto-rotates
 * based on the source orientation, re-encodes pixels to WebP, and produces a full and
 * a thumbnail variant. Returns sanitised buffers ready for object storage.
 * @param input - Raw uploaded image buffer (JPEG, PNG, or WebP)
 * @param kind - Which kind of asset the image represents (avatar or banner)
 * @returns Sanitised WebP variants
 */
export async function processImage(input: Buffer, kind: ImageKind): Promise<ProcessedImage> {
  const format = detectImageFormat(input);
  if (!format) {
    throw new ValidationError('Tipo de imagem não suportado. Envie um arquivo JPEG, PNG ou WebP');
  }
  if (input.length > MAX_BYTES[kind]) {
    const limitMb = Math.round(MAX_BYTES[kind] / 1024 / 1024);
    throw new ValidationError(`Image exceeds the ${limitMb}MB upload limit`);
  }

  const limits = SIZE_LIMITS[kind];
  const fit = kind === 'avatar' ? ('cover' as const) : ('inside' as const);

  const full = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize(limits.full.width, limits.full.height, {
      fit,
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  const thumbnail = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize(limits.thumb.width, limits.thumb.height, {
      fit,
      withoutEnlargement: true,
    })
    .webp({ quality: 75 })
    .toBuffer({ resolveWithObject: true });

  return {
    kind,
    format: 'webp',
    variants: {
      full: { buffer: full.data, width: full.info.width, height: full.info.height },
      thumbnail: {
        buffer: thumbnail.data,
        width: thumbnail.info.width,
        height: thumbnail.info.height,
      },
    },
  };
}