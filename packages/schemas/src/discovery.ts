import { z } from 'zod';
import {
  profileSchema,
  richCardTypeSchema,
  socialLinksSchema,
  themePaletteSchema,
} from './profile.js';

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

export const tagSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  color: z.string(),
  icon: z.string().nullable(),
});
export type Tag = z.infer<typeof tagSchema>;

export const tagsResponseSchema = z.object({
  tags: z.array(tagSchema),
});
export type TagsResponse = z.infer<typeof tagsResponseSchema>;

// ---------------------------------------------------------------------------
// Discovery catalog
// ---------------------------------------------------------------------------

export const seniorSummarySchema = z.object({
  userId: z.string().uuid(),
  handle: z.string(),
  socialName: z.string().nullable(),
  tagline: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  avatarThumbnailUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  bannerPreset: z.string().nullable(),
  themePalette: themePaletteSchema.nullable(),
  semester: z.number(),
  tags: z.array(tagSchema),
  contactEmail: z.string().nullable(),
  socialLinks: socialLinksSchema.nullable(),
  richCardTypes: z.array(richCardTypeSchema),
  effortScore: z.number(),
  profileViews: z.number(),
  bumpCount: z.number(),
  isAcceptingRequests: z.boolean(),
  maxMentees: z.number(),
  activeMenteeCount: z.number(),
});
export type SeniorSummary = z.infer<typeof seniorSummarySchema>;

const uuidListSchema = z
  .union([z.string().uuid(), z.array(z.string().uuid())])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .optional();

const cardTypeListSchema = z
  .union([richCardTypeSchema, z.array(richCardTypeSchema)])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .optional();

export const seniorsQuerySchema = z.object({
  semester: z.coerce.number().int().min(1).max(12).optional(),
  tagIds: uuidListSchema,
  cardTypes: cardTypeListSchema,
  availability: z.enum(['accepting', 'full']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type SeniorsQuery = z.infer<typeof seniorsQuerySchema>;

export const seniorsResponseSchema = z.object({
  seniors: z.array(seniorSummarySchema),
  total: z.number(),
});
export type SeniorsResponse = z.infer<typeof seniorsResponseSchema>;

export const scoredSeniorSchema = seniorSummarySchema.extend({
  score: z.number(),
  matchReasons: z.array(z.string()),
});
export type ScoredSenior = z.infer<typeof scoredSeniorSchema>;

export const recommendationsResponseSchema = z.object({
  recommendations: z.array(scoredSeniorSchema),
});
export type RecommendationsResponse = z.infer<typeof recommendationsResponseSchema>;

// ---------------------------------------------------------------------------
// Bumps
// ---------------------------------------------------------------------------

export const bumpParamsSchema = z.object({
  handle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'Nome de usuário inválido'),
});
export type BumpParams = z.infer<typeof bumpParamsSchema>;

export const bumpBodySchema = z.object({
  replaceHandle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'Nome de usuário inválido')
    .optional(),
});
export type BumpBody = z.infer<typeof bumpBodySchema>;

export const bumpResponseSchema = z.object({
  bumped: z.boolean(),
  bumpCount: z.number(),
  remainingSlots: z.number(),
});
export type BumpResponse = z.infer<typeof bumpResponseSchema>;

// ---------------------------------------------------------------------------
// Mentorship requests
// ---------------------------------------------------------------------------

export const mentorshipRequestStatusSchema = z.enum([
  'pending',
  'pending_admin_approval',
  'accepted',
  'rejected',
  'cancelled',
  'cancelled_capacity_filled',
]);
export type MentorshipRequestStatus = z.infer<typeof mentorshipRequestStatusSchema>;

export const createMentorshipRequestBodySchema = z.object({
  seniorHandle: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-z0-9_]+$/, 'Nome de usuário inválido'),
  message: z.string().trim().min(1, 'A mensagem é obrigatória').max(2000),
});
export type CreateMentorshipRequestBody = z.infer<typeof createMentorshipRequestBodySchema>;

const requestPartySchema = z.object({
  userId: z.string().uuid(),
  handle: z.string(),
  socialName: z.string().nullable(),
  tagline: z.string().nullable(),
  semester: z.number(),
  avatarThumbnailUrl: z.string().nullable(),
});
export type RequestParty = z.infer<typeof requestPartySchema>;

export const mentorshipRequestSchema = z.object({
  id: z.string().uuid(),
  freshmanId: z.string().uuid(),
  seniorId: z.string().uuid(),
  status: mentorshipRequestStatusSchema,
  message: z.string(),
  rejectionReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  freshman: requestPartySchema.optional(),
  senior: requestPartySchema.optional(),
  freshmanProfile: profileSchema.optional(),
});
export type MentorshipRequest = z.infer<typeof mentorshipRequestSchema>;

export const requestsQuerySchema = z.object({
  inbox: z.enum(['incoming', 'sent']).optional(),
  status: mentorshipRequestStatusSchema.optional(),
});
export type RequestsQuery = z.infer<typeof requestsQuerySchema>;

export const requestsResponseSchema = z.object({
  requests: z.array(mentorshipRequestSchema),
});
export type RequestsResponse = z.infer<typeof requestsResponseSchema>;

export const requestResponseSchema = z.object({
  request: mentorshipRequestSchema,
});
export type RequestResponse = z.infer<typeof requestResponseSchema>;

export const requestParamsSchema = z.object({
  id: z.string().uuid('O id do pedido deve ser um UUID válido'),
});
export type RequestParams = z.infer<typeof requestParamsSchema>;

export const rejectRequestBodySchema = z.object({
  reason: z.string().trim().max(1000).optional(),
});
export type RejectRequestBody = z.infer<typeof rejectRequestBodySchema>;

// ---------------------------------------------------------------------------
// Lineage
// ---------------------------------------------------------------------------

export const lineageNodeSchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  socialName: z.string().nullable(),
  semester: z.number(),
  role: z.enum(['freshman', 'senior', 'administrator', 'developer']),
});
export type LineageNode = z.infer<typeof lineageNodeSchema>;

export const lineageEdgeSchema = z.object({
  mentorId: z.string().uuid(),
  menteeId: z.string().uuid(),
  academicYear: z.string(),
  semester: z.number(),
});
export type LineageEdge = z.infer<typeof lineageEdgeSchema>;

export const lineageResponseSchema = z.object({
  nodes: z.array(lineageNodeSchema),
  edges: z.array(lineageEdgeSchema),
  academicYears: z.array(z.string()),
});
export type LineageResponse = z.infer<typeof lineageResponseSchema>;
