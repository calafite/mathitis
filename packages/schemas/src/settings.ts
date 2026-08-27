import { z } from 'zod';

export const changePasswordBodySchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: z
    .string()
    .min(8, 'A senha deve ter pelo menos 8 caracteres')
    .regex(/[A-Z]/, 'A senha deve conter pelo menos uma letra maiúscula')
    .regex(/[a-z]/, 'A senha deve conter pelo menos uma letra minúscula')
    .regex(/[0-9]/, 'A senha deve conter pelo menos um dígito numérico'),
});

export const updateAccountBodySchema = z.object({
  semester: z.number().int().min(1).max(12).optional(),
  preferences: z
    .object({
      theme: z.enum(['dark', 'light', 'system']).optional(),
      reducedMotion: z.boolean().optional(),
      soundEnabled: z.boolean().optional(),
      emailNotifications: z.boolean().optional(),
      onboarded: z.boolean().optional(),
    })
    .optional(),
});

export const userDataExportSchema = z.object({
  user: z.object({
    id: z.string(),
    handle: z.string(),
    email: z.string(),
    role: z.enum(['freshman', 'senior', 'administrator', 'developer']),
    semester: z.number().int(),
    status: z.enum(['pending_verification', 'active', 'suspended', 'deactivated']),
    socialName: z.string().nullable(),
    pronouns: z.string().nullable(),
    tagline: z.string().nullable(),
    biographyMarkdown: z.string().nullable(),
    themePalette: z
      .object({
        primaryColor: z.string(),
        accentColor: z.string(),
        badgeColor: z.string(),
        cardStyle: z.enum(['glassmorphic', 'solid', 'bordered']),
      })
      .nullable(),
    contactEmail: z.string().nullable(),
    socialLinks: z
      .object({
        github: z.string().nullable().optional(),
        discord: z.string().nullable().optional(),
        linkedin: z.string().nullable().optional(),
        website: z.string().nullable().optional(),
      })
      .nullable(),
    maxMentees: z.number().int().nullable(),
    isAcceptingRequests: z.boolean(),
    isDiscoverable: z.boolean(),
    avatarUrl: z.string().nullable(),
    bannerUrl: z.string().nullable(),
    bannerPreset: z.string().nullable(),
    effortScore: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  tags: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      color: z.string(),
    }),
  ),
  richCards: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      title: z.string(),
      payload: z.record(z.unknown()),
      displayOrder: z.number().int(),
      createdAt: z.string(),
    }),
  ),
  sentRequests: z.array(
    z.object({
      id: z.string(),
      seniorHandle: z.string(),
      seniorSocialName: z.string().nullable(),
      message: z.string(),
      status: z.string(),
      createdAt: z.string(),
      decidedAt: z.string().nullable(),
    }),
  ),
  receivedRequests: z.array(
    z.object({
      id: z.string(),
      freshmanHandle: z.string(),
      freshmanSocialName: z.string().nullable(),
      message: z.string(),
      status: z.string(),
      createdAt: z.string(),
      decidedAt: z.string().nullable(),
    }),
  ),
  lineage: z.object({
    ancestors: z.array(
      z.object({
        handle: z.string(),
        socialName: z.string().nullable(),
        semester: z.number().int(),
        relationship: z.enum(['mentor', 'grand-mentor', 'great-grand-mentor']),
      }),
    ),
    descendants: z.array(
      z.object({
        handle: z.string(),
        socialName: z.string().nullable(),
        semester: z.number().int(),
        relationship: z.enum(['pupil', 'grand-pupil', 'great-grand-pupil']),
      }),
    ),
  }),
});

export const anonymizeAccountBodySchema = z.object({
  password: z.string().min(1, 'Confirme a senha'),
});

export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type UpdateAccountBody = z.infer<typeof updateAccountBodySchema>;
export type UserDataExport = z.infer<typeof userDataExportSchema>;
export type AnonymizeAccountBody = z.infer<typeof anonymizeAccountBodySchema>;
