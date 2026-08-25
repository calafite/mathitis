import { z } from 'zod';

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'A cor deve ser um valor hexadecimal válido, como #6366f1');

export const cardStyleSchema = z.enum(['glassmorphic', 'solid', 'bordered']);
export type CardStyle = z.infer<typeof cardStyleSchema>;

export const themePaletteSchema = z.object({
  primaryColor: hexColorSchema.default('#6366f1'),
  accentColor: hexColorSchema.default('#ec4899'),
  badgeColor: hexColorSchema.default('#3b82f6'),
  cardStyle: cardStyleSchema.default('glassmorphic'),
});
export type ThemePalette = z.infer<typeof themePaletteSchema>;

export const socialLinksSchema = z.object({
  github: z.string().url('Informe uma URL válida do GitHub').max(255).optional(),
  discord: z.string().max(255).optional(),
  linkedin: z.string().url('Informe uma URL válida do LinkedIn').max(255).optional(),
  website: z.string().url('Informe uma URL válida do site').max(255).optional(),
});
export type SocialLinks = z.infer<typeof socialLinksSchema>;

export const bannerPresetSchema = z
  .string()
  .regex(/^[a-z0-9_-]+$/, 'O preset de banner deve ser alfanumérico (minúsculas, traços e underscores)')
  .max(40);

const bannerPresetOptionalSchema = bannerPresetSchema.optional();

export const richCardTypeSchema = z.enum(['song', 'game', 'film', 'book', 'project', 'custom']);
export type RichCardType = z.infer<typeof richCardTypeSchema>;

/**
 * Form inputs submit numeric values as strings (or empty strings when the
 * field was left blank). Coerce string numbers into real numbers while
 * letting blank inputs fall through as undefined instead of coercing to 0.
 */
function numericInput<Output>(schema: z.ZodType<Output, z.ZodTypeDef, unknown>) {
  return z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined;
    return value;
  }, schema);
}

export const songMetadataSchema = z.object({
  spotifyUri: z.string().min(1).max(255).optional(),
  trackName: z.string().max(255).optional(),
  artistName: z.string().max(255).optional(),
  albumName: z.string().max(255).optional(),
  durationMs: numericInput(z.coerce.number().int().positive().optional()),
});
export type SongMetadata = z.infer<typeof songMetadataSchema>;

export const gameMetadataSchema = z.object({
  steamAppId: z.string().regex(/^\d{1,8}$/, 'O Steam App ID deve ser numérico').optional(),
  platform: z.string().max(60).optional(),
  hoursPlayed: numericInput(z.coerce.number().int().nonnegative().optional()),
});
export type GameMetadata = z.infer<typeof gameMetadataSchema>;

export const filmMetadataSchema = z.object({
  rating: numericInput(z.coerce.number().min(0).max(10).optional()),
  year: numericInput(z.coerce.number().int().min(1888).max(2100).optional()),
  director: z.string().max(120).optional(),
  genres: z.array(z.string().max(60)).max(10).optional(),
});
export type FilmMetadata = z.infer<typeof filmMetadataSchema>;

export const projectMetadataSchema = z.object({
  techStack: z.array(z.string().max(60)).max(20).optional(),
  stars: z.number().int().nonnegative().optional(),
  repository: z.string().url('Informe uma URL de repositório válida').max(255).optional(),
});
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;

export const richCardSchema = z.object({
  id: z.string().uuid(),
  cardType: richCardTypeSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  externalUrl: z.string().nullable(),
  embedUrl: z.string().nullable(),
  accentColor: z.string(),
  metadata: z.record(z.unknown()).nullable(),
  displayOrder: z.number(),
  createdAt: z.date(),
});
export type RichCard = z.infer<typeof richCardSchema>;

export const profileSchema = z.object({
  userId: z.string().uuid(),
  handle: z.string(),
  role: z.enum(['freshman', 'senior', 'administrator', 'developer']),
  semester: z.number(),
  socialName: z.string().nullable(),
  pronouns: z.string().nullable(),
  tagline: z.string().nullable(),
  biographyMarkdown: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  bannerPreset: z.string().nullable(),
  themePalette: themePaletteSchema.nullable(),
  socialLinks: socialLinksSchema.nullable(),
  contactEmail: z.string().nullable(),
  maxMentees: z.number(),
  isDiscoverable: z.boolean(),
  isAcceptingRequests: z.boolean(),
  profileViews: z.number(),
  effortScore: z.number(),
  tags: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        category: z.string(),
        color: z.string(),
        icon: z.string().nullable().default(null),
      }),
    )
    .default([]),
  richCards: z.array(richCardSchema).default([]),
});
export type Profile = z.infer<typeof profileSchema>;

export const updateProfileBodySchema = z.object({
  socialName: z.string().trim().max(60, 'O nome deve ter no máximo 60 caracteres').optional(),
  pronouns: z.string().trim().max(30).optional().nullable(),
  tagline: z.string().trim().max(120).optional().nullable(),
  biographyMarkdown: z.string().max(20_000).optional().nullable(),
  bannerPreset: bannerPresetOptionalSchema,
  themePalette: themePaletteSchema.optional(),
  socialLinks: socialLinksSchema.optional(),
  contactEmail: z.string().email('Informe um e-mail de contato válido').max(255).optional().nullable(),
  maxMentees: z.number().int().min(1).max(10).optional(),
  isDiscoverable: z.boolean().optional(),
  isAcceptingRequests: z.boolean().optional(),
  tagIds: z.array(z.string().uuid()).max(15, 'Selecione no máximo 15 interesses').optional(),
});
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;

export const profileResponseSchema = z.object({
  profile: profileSchema,
});
export type ProfileResponse = z.infer<typeof profileResponseSchema>;

export const uploadImageResponseSchema = z.object({
  url: z.string().url(),
  thumbnailUrl: z.string().url(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type UploadImageResponse = z.infer<typeof uploadImageResponseSchema>;

export const createRichCardBodySchema = z.object({
  cardType: richCardTypeSchema,
  title: z.string().trim().min(1, 'O título é obrigatório').max(150),
  subtitle: z.string().trim().max(150).optional().nullable(),
  description: z.string().max(5_000).optional().nullable(),
  imageUrl: z.string().url('Informe uma URL de imagem válida').max(512).optional().nullable(),
  externalUrl: z.string().url('Informe uma URL externa válida').max(512).optional().nullable(),
  embedUrl: z.string().url('Informe uma URL de incorporação válida').max(512).optional().nullable(),
  accentColor: hexColorSchema.default('#6366f1'),
  metadata: z.record(z.unknown()).default({}),
});
export type CreateRichCardBody = z.infer<typeof createRichCardBodySchema>;

export const updateRichCardBodySchema = createRichCardBodySchema.partial();
export type UpdateRichCardBody = z.infer<typeof updateRichCardBodySchema>;

export const richCardsResponseSchema = z.object({
  cards: z.array(richCardSchema),
});
export type RichCardsResponse = z.infer<typeof richCardsResponseSchema>;

export const richCardResponseSchema = z.object({
  card: richCardSchema,
});
export type RichCardResponse = z.infer<typeof richCardResponseSchema>;

export const reorderRichCardsBodySchema = z.object({
  order: z.array(z.string().uuid()).min(1, 'A ordem deve conter pelo menos um id de cartão'),
});
export type ReorderRichCardsBody = z.infer<typeof reorderRichCardsBodySchema>;

export const richCardParamsSchema = z.object({
  id: z.string().uuid('O id do cartão deve ser um UUID válido'),
});
export type RichCardParams = z.infer<typeof richCardParamsSchema>;

export const profileHandleParamsSchema = z.object({
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'Nome de usuário inválido'),
});
export type ProfileHandleParams = z.infer<typeof profileHandleParamsSchema>;
export const scrapeCardQuerySchema = z.object({
  url: z.string().url('Informe uma URL válida').max(512),
});
export type ScrapeCardQuery = z.infer<typeof scrapeCardQuerySchema>;

export const scrapedCardResponseSchema = z.object({
  cardType: richCardTypeSchema,
  title: z.string().min(1).max(150),
  subtitle: z.string().max(150).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  imageUrl: z.string().url().max(512).nullable().optional(),
  externalUrl: z.string().url().max(512).nullable().optional(),
  embedUrl: z.string().url().max(512).nullable().optional(),
  accentColor: hexColorSchema.default('#6366f1'),
  metadata: z.record(z.unknown()).default({}),
});
export type ScrapedCardResponse = z.infer<typeof scrapedCardResponseSchema>;
