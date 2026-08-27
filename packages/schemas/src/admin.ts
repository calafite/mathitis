import { z } from 'zod';
import { accountStatusSchema, userRoleSchema } from './auth.js';
import { mentorshipRequestStatusSchema } from './discovery.js';

// ---------------------------------------------------------------------------
// Dynamic system configuration
// ---------------------------------------------------------------------------

export const systemConfigKeysSchema = z.enum([
  'REQUIRE_ADMIN_REQUEST_APPROVAL',
  'REGISTRATION_ENABLED',
  'DISCOVERY_ACTIVE',
  'EMAIL_NOTIFICATIONS_ENABLED',
  'MAX_FRESHMAN_REQUESTS',
  'MAX_SENIOR_MENTEES',
]);
export type SystemConfigKey = z.infer<typeof systemConfigKeysSchema>;

export const systemConfigSchema = z.object({
  REQUIRE_ADMIN_REQUEST_APPROVAL: z.boolean(),
  REGISTRATION_ENABLED: z.boolean(),
  DISCOVERY_ACTIVE: z.boolean(),
  EMAIL_NOTIFICATIONS_ENABLED: z.boolean(),
  MAX_FRESHMAN_REQUESTS: z.number().int().min(1).max(100),
  MAX_SENIOR_MENTEES: z.number().int().min(1).max(100),
});
export type SystemConfig = z.infer<typeof systemConfigSchema>;

export const configPatchSchema = systemConfigSchema.partial();
export type ConfigPatch = z.infer<typeof configPatchSchema>;

export const configResponseSchema = z.object({
  config: systemConfigSchema,
});
export type ConfigResponse = z.infer<typeof configResponseSchema>;

// ---------------------------------------------------------------------------
// User administration
// ---------------------------------------------------------------------------

export const adminUserSchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  semester: z.number(),
  status: accountStatusSchema,
  socialName: z.string().nullable(),
  deletedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const adminUsersQuerySchema = z.object({
  role: userRoleSchema.optional(),
  status: accountStatusSchema.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

export const adminUsersResponseSchema = z.object({
  users: z.array(adminUserSchema),
  total: z.number(),
});
export type AdminUsersResponse = z.infer<typeof adminUsersResponseSchema>;

export const adminUserParamsSchema = z.object({
  id: z.string().uuid('O id do usuário deve ser um UUID válido'),
});
export type AdminUserParams = z.infer<typeof adminUserParamsSchema>;

export const updateUserStatusBodySchema = z.object({
  status: accountStatusSchema,
});
export type UpdateUserStatusBody = z.infer<typeof updateUserStatusBodySchema>;

export const moderationActionSchema = z.enum([
  'clear_banner',
  'clear_biography',
  'clear_contact',
  'clear_rich_cards',
]);
export type ModerationAction = z.infer<typeof moderationActionSchema>;

export const moderationBodySchema = z.object({
  action: moderationActionSchema,
});
export type ModerationBody = z.infer<typeof moderationBodySchema>;

export const adminUserResponseSchema = z.object({
  user: adminUserSchema,
});
export type AdminUserResponse = z.infer<typeof adminUserResponseSchema>;

export const anonymizeResponseSchema = z.object({
  user: adminUserSchema,
  lineagePreserved: z.boolean(),
});
export type AnonymizeResponse = z.infer<typeof anonymizeResponseSchema>;

// ---------------------------------------------------------------------------
// Approval queue
// ---------------------------------------------------------------------------

const approvalPartySchema = z.object({
  userId: z.string().uuid(),
  handle: z.string(),
  socialName: z.string().nullable(),
  semester: z.number(),
  avatarThumbnailUrl: z.string().nullable(),
});

export const approvalSchema = z.object({
  id: z.string().uuid(),
  freshmanId: z.string().uuid(),
  seniorId: z.string().uuid(),
  status: mentorshipRequestStatusSchema,
  message: z.string(),
  createdAt: z.coerce.date(),
  freshman: approvalPartySchema.nullable(),
  senior: approvalPartySchema.nullable(),
});
export type Approval = z.infer<typeof approvalSchema>;

export const approvalsQuerySchema = z.object({
  status: mentorshipRequestStatusSchema.optional(),
});
export type ApprovalsQuery = z.infer<typeof approvalsQuerySchema>;

export const approvalsResponseSchema = z.object({
  approvals: z.array(approvalSchema),
});
export type ApprovalsResponse = z.infer<typeof approvalsResponseSchema>;

export const approvalParamsSchema = z.object({
  id: z.string().uuid('O id da aprovação deve ser um UUID válido'),
});
export type ApprovalParams = z.infer<typeof approvalParamsSchema>;

export const decisionBodySchema = z.object({
  decision: z.enum(['approve', 'deny']),
  reason: z.string().trim().max(1000).optional(),
});
export type DecisionBody = z.infer<typeof decisionBodySchema>;

export const decisionResponseSchema = z.object({
  request: z.object({
    id: z.string().uuid(),
    status: mentorshipRequestStatusSchema,
    rejectionReason: z.string().nullable(),
  }),
});
export type DecisionResponse = z.infer<typeof decisionResponseSchema>;

// ---------------------------------------------------------------------------
// Mentorship requests overview (admin dashboard)
// ---------------------------------------------------------------------------

export const adminMentorshipRequestsQuerySchema = z.object({
  status: mentorshipRequestStatusSchema.optional(),
});
export type AdminMentorshipRequestsQuery = z.infer<typeof adminMentorshipRequestsQuerySchema>;

export const adminMentorshipRequestSchema = z.object({
  id: z.string().uuid(),
  freshmanId: z.string().uuid(),
  seniorId: z.string().uuid(),
  status: mentorshipRequestStatusSchema,
  message: z.string(),
  rejectionReason: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  freshman: approvalPartySchema.nullable(),
  senior: approvalPartySchema.nullable(),
});
export type AdminMentorshipRequest = z.infer<typeof adminMentorshipRequestSchema>;

export const adminMentorshipRequestsResponseSchema = z.object({
  requests: z.array(adminMentorshipRequestSchema),
  total: z.number(),
});
export type AdminMentorshipRequestsResponse = z.infer<typeof adminMentorshipRequestsResponseSchema>;

// ---------------------------------------------------------------------------
// Audit log viewer
// ---------------------------------------------------------------------------

export const auditLogSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  action: z.string(),
  targetEntity: z.string(),
  targetId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()).nullable(),
  ipAddress: z.string().nullable(),
  createdAt: z.coerce.date(),
  actor: z
    .object({
      id: z.string().uuid(),
      handle: z.string(),
      role: userRoleSchema,
    })
    .nullable(),
});
export type AuditLog = z.infer<typeof auditLogSchema>;

export const auditLogsQuerySchema = z.object({
  action: z.string().trim().max(100).optional(),
  actorId: z.string().uuid().optional(),
  targetEntity: z.string().trim().max(50).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;

export const auditLogsResponseSchema = z.object({
  auditLogs: z.array(auditLogSchema),
  total: z.number(),
});
export type AuditLogsResponse = z.infer<typeof auditLogsResponseSchema>;

// ---------------------------------------------------------------------------
// Developer diagnostics
// ---------------------------------------------------------------------------

export const devHealthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
  checks: z.object({
    database: z.enum(['ok', 'error']),
    redis: z.enum(['ok', 'error']),
    queue: z.enum(['ok', 'error']),
  }),
});
export type DevHealth = z.infer<typeof devHealthSchema>;

export const devMetricsSchema = z.object({
  process: z.object({
    uptimeSeconds: z.number(),
    memory: z.object({
      rss: z.number(),
      heapUsed: z.number(),
      heapTotal: z.number(),
      external: z.number(),
    }),
    nodeVersion: z.string(),
    pid: z.number(),
  }),
  database: z.object({
    activeConnections: z.number(),
    idleConnections: z.number(),
    totalConnections: z.number(),
  }),
  queue: z.object({
    waiting: z.number(),
    active: z.number(),
    completed: z.number(),
    failed: z.number(),
    delayed: z.number(),
    throughput: z.object({ completed: z.number(), failed: z.number() }),
  }),
  network: z.object({
    listeningPorts: z.array(z.number()),
    exposedPorts: z.array(z.number()),
    warnings: z.array(z.string()),
  }),
});
export type DevMetrics = z.infer<typeof devMetricsSchema>;

export const devMetricsResponseSchema = z.object({
  metrics: devMetricsSchema,
});
export type DevMetricsResponse = z.infer<typeof devMetricsResponseSchema>;

export const devEmailSchema = z.object({
  id: z.string(),
  to: z.string(),
  subject: z.string(),
  text: z.string(),
  sentAt: z.string(),
});
export type DevEmail = z.infer<typeof devEmailSchema>;

export const devMailboxQuerySchema = z.object({
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export type DevMailboxQuery = z.infer<typeof devMailboxQuerySchema>;

export const devMailboxResponseSchema = z.object({
  emails: z.array(devEmailSchema),
});
export type DevMailboxResponse = z.infer<typeof devMailboxResponseSchema>;

export const devLinkQuerySchema = z.object({
  email: z.string(),
});
export type DevLinkQuery = z.infer<typeof devLinkQuerySchema>;

export const devLinkResponseSchema = z.object({
  url: z.string().nullable(),
});
export type DevLinkResponse = z.infer<typeof devLinkResponseSchema>;

// ---------------------------------------------------------------------------
// Developer portal: administrator management (phase 20)
// ---------------------------------------------------------------------------

export const devAdminSummarySchema = z.object({
  id: z.string().uuid(),
  handle: z.string(),
  email: z.string().email(),
  role: userRoleSchema,
  semester: z.number().int(),
  socialName: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type DevAdminSummary = z.infer<typeof devAdminSummarySchema>;

export const devAdminsResponseSchema = z.object({
  admins: z.array(devAdminSummarySchema),
});
export type DevAdminsResponse = z.infer<typeof devAdminsResponseSchema>;

export const promoteAdminBodySchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'Informe o nome de usuário ou e-mail')
    .max(255),
});
export type PromoteAdminBody = z.infer<typeof promoteAdminBodySchema>;

export const promoteAdminResponseSchema = z.object({
  admin: devAdminSummarySchema,
});
export type PromoteAdminResponse = z.infer<typeof promoteAdminResponseSchema>;

export const revokeAdminParamsSchema = z.object({
  id: z.string().uuid('ID de usuário inválido'),
});
export type RevokeAdminParams = z.infer<typeof revokeAdminParamsSchema>;

export const revokeAdminResponseSchema = z.object({
  ok: z.boolean(),
});
export type RevokeAdminResponse = z.infer<typeof revokeAdminResponseSchema>;
