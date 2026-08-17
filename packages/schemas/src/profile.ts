import { z } from 'zod';

const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Colour must be a valid hex value such as #6366f1');

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
  github: z.string().url('GitHub URL must be a valid URL').max(255).optional(),
  discord: z.string().max(255).optional(),
  linkedin: z.string().url('LinkedIn URL must be a valid URL').max(255).optional(),
  website: z.string().url('Website URL must be a valid URL').max(255).optional(),
});
export type SocialLinks = z.infer<typeof socialLinksSchema>;

export const bannerPresetSchema = z
  .string()
  .regex(/^[a-z0-9_-]+$/, 'Banner preset must be alphanumeric (lowercase, dashes, underscores)')
  .max(40);

const bannerPresetOptionalSchema = bannerPresetSchema.optional();

export const richCardTypeSchema = z.enum(['song', 'game', 'film', 'book', 'project', 'custom']);
export type RichCardType = z.infer<typeof richCardTypeSchema>;

export const songMetadataSchema = z.object({
  spotifyUri: z.string().min(1).max(255).optional(),
  trackName: z.string().max(255).optional(),
  artistName: z.string().max(255).optional(),
  albumName: z.string().max(255).optional(),
  durationMs: z.number().int().positive().optional(),
});
export type SongMetadata = z.infer<typeof songMetadataSchema>;

export const gameMetadataSchema = z.object({
  steamAppId: z.string().regex(/^\d{1,8}$/, 'Steam App ID must be numeric').optional(),
  platform: z.string().max(60).optional(),
  hoursPlayed: z.number().int().nonnegative().optional(),
});
export type GameMetadata = z.infer<typeof gameMetadataSchema>;

export const filmMetadataSchema = z.object({
  rating: z.number().min(0).max(10).optional(),
  year: z.number().int().min(1888).max(2100).optional(),
  director: z.string().max(120).optional(),
  genres: z.array(z.string().max(60)).max(10).optional(),
});
export type FilmMetadata = z.infer<typeof filmMetadataSchema>;

export const projectMetadataSchema = z.object({
  techStack: z.array(z.string().max(60)).max(20).optional(),
  stars: z.number().int().nonnegative().optional(),
  repository: z.string().url('Repository URL must be valid').max(255).optional(),
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
      }),
    )
    .default([]),
  richCards: z.array(richCardSchema).default([]),
});
export type Profile = z.infer<typeof profileSchema>;

export const updateProfileBodySchema = z.object({
  socialName: z.string().trim().max(60, 'Name must be at most 60 characters').optional(),
  pronouns: z.string().trim().max(30).optional().nullable(),
  tagline: z.string().trim().max(120).optional().nullable(),
  biographyMarkdown: z.string().max(20_000).optional().nullable(),
  bannerPreset: bannerPresetOptionalSchema,
  themePalette: themePaletteSchema.optional(),
  socialLinks: socialLinksSchema.optional(),
  contactEmail: z.string().email('Contact email must be valid').max(255).optional().nullable(),
  maxMentees: z.number().int().min(1).max(10).optional(),
  isDiscoverable: z.boolean().optional(),
  isAcceptingRequests: z.boolean().optional(),
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
  title: z.string().trim().min(1, 'Title is required').max(150),
  subtitle: z.string().trim().max(150).optional().nullable(),
  description: z.string().max(5_000).optional().nullable(),
  imageUrl: z.string().url('Image URL must be valid').max(512).optional().nullable(),
  externalUrl: z.string().url('External URL must be valid').max(512).optional().nullable(),
  embedUrl: z.string().url('Embed URL must be valid').max(512).optional().nullable(),
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
  order: z.array(z.string().uuid()).min(1, 'Order must contain at least one card id'),
});
export type ReorderRichCardsBody = z.infer<typeof reorderRichCardsBodySchema>;

export const richCardParamsSchema = z.object({
  id: z.string().uuid('Card id must be a valid UUID'),
});
export type RichCardParams = z.infer<typeof richCardParamsSchema>;

export const profileHandleParamsSchema = z.object({
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'Invalid handle'),
});
export type ProfileHandleParams = z.infer<typeof profileHandleParamsSchema>;